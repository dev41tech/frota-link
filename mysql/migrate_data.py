#!/usr/bin/env python3
"""
migrate_data.py – Frota-Link: PostgreSQL (Supabase) → MySQL 8.0
================================================================
Migra dados de todas as tabelas em ordem de dependência.
Estratégia: UPSERT via INSERT ... ON DUPLICATE KEY UPDATE.
Processamento em batches para evitar memory overflows.

Requisitos:
  pip install psycopg2-binary mysql-connector-python tqdm python-dotenv

Uso:
  # Configurar via variáveis de ambiente ou editar as constantes abaixo
  python migrate_data.py [--tables table1,table2] [--batch-size 500] [--dry-run]

Argumentos:
  --tables     Migrar apenas as tabelas listadas (separadas por vírgula)
  --batch-size Tamanho do batch por tabela (default: 500)
  --dry-run    Apenas exibe quantos registros seriam migrados, sem inserir
"""

import argparse
import json
import sys
import traceback
import uuid
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Any, Generator, List, Optional

import psycopg2
import psycopg2.extras
import mysql.connector
from mysql.connector import MySQLConnection

# =============================================================
# CONFIGURAÇÃO – edite aqui ou use variáveis de ambiente
# =============================================================
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

import os

PG_CONFIG = {
    "host":     os.getenv("PG_HOST",     "db.hxfhubhijampubrsqfhg.supabase.co"),
    "port":     int(os.getenv("PG_PORT", "5432")),
    "dbname":   os.getenv("PG_DBNAME",   "postgres"),
    "user":     os.getenv("PG_USER",     "postgres"),
    "password": os.getenv("PG_PASSWORD", ""),
    "sslmode":  os.getenv("PG_SSLMODE",  "require"),
}

MYSQL_CONFIG = {
    "host":     os.getenv("MYSQL_HOST",     "127.0.0.1"),
    "port":     int(os.getenv("MYSQL_PORT", "3306")),
    "database": os.getenv("MYSQL_DATABASE", "frota_link"),
    "user":     os.getenv("MYSQL_USER",     "root"),
    "password": os.getenv("MYSQL_PASSWORD", ""),
    "charset":  "utf8mb4",
    "collation":"utf8mb4_unicode_ci",
}

DEFAULT_BATCH_SIZE = 500

# =============================================================
# ORDEM DE MIGRAÇÃO (respeita dependências FK)
# =============================================================
MIGRATION_ORDER = [
    "subscription_plans",
    "system_settings",
    "vehicle_consumption_references",
    "companies",
    "profiles",
    "user_roles",
    "bpo_company_access",
    "audit_logs",
    "system_alerts",
    "usage_logs",
    "invoices",
    "gas_stations",
    "parties",
    "expense_categories",
    "revenue_categories",
    "workshops",
    "cte_settings",
    "cte_series",
    "digital_certificates",
    "fiscal_party_templates",
    "freight_rates",
    "freight_pricing_settings",
    "vehicles",
    "drivers",
    "driver_performance_history",
    "driver_vehicles",
    "vehicle_consumption_history",
    "vehicle_couplings",
    "vehicle_coupling_items",
    "saved_couplings",
    "tire_assets",
    "tire_logs",
    "journeys",
    "journey_legs",
    "journey_checklists",
    "driver_messages",
    "bank_transactions",
    "fuel_expenses",
    "expenses",
    "accounts_payable",
    "revenue",
    "bank_reconciliations",
    "cte_documents",
    "cte_anulacao_documents",
    "mdfe_documents",
    "mdfe_cte_links",
    "fiscal_document_lookups",
    "fiscal_audit_logs",
    "customer_portal_tokens",
    "freight_requests",
    "vehicle_maintenances",
    "maintenance_parts",
    "maintenance_schedules",
    "tire_history",
    "announcements",
    "announcement_targets",
    "announcement_reads",
    "incidents",
]

# =============================================================
# MAPEAMENTO DE COLUNAS: Transformações especiais por tabela
# Formato: { "table": { "pg_column": transformer_fn } }
# =============================================================
def _uuid_to_str(val: Any) -> Optional[str]:
    """Converte UUID do Postgres para string CHAR(36)."""
    if val is None:
        return None
    if isinstance(val, uuid.UUID):
        return str(val)
    return str(val)

def _bool_to_int(val: Any) -> Optional[int]:
    """Converte boolean Python para TINYINT(1)."""
    if val is None:
        return None
    return 1 if val else 0

def _datetime_to_str(val: Any) -> Optional[str]:
    """Converte datetime/date para string MySQL DATETIME(6)."""
    if val is None:
        return None
    if isinstance(val, datetime):
        # Remove timezone info (MySQL DATETIME não armazena tz)
        if val.tzinfo is not None:
            val = val.astimezone(timezone.utc).replace(tzinfo=None)
        return val.strftime("%Y-%m-%d %H:%M:%S.%f")
    if isinstance(val, date):
        return val.isoformat()
    return str(val)

def _json_to_str(val: Any) -> Optional[str]:
    """Converte dict/list/jsonb do Postgres para JSON string."""
    if val is None:
        return None
    if isinstance(val, (dict, list)):
        return json.dumps(val, ensure_ascii=False, default=str)
    return str(val)  # já é string (psycopg2 retorna str para jsonb em alguns modos)

def _decimal_to_float(val: Any) -> Optional[float]:
    """Converte Decimal para float (MySQL aceita Decimal diretamente, mas float é mais seguro)."""
    if val is None:
        return None
    if isinstance(val, Decimal):
        return float(val)
    return val

def _array_to_json(val: Any) -> Optional[str]:
    """Converte array PostgreSQL (list Python) para JSON string."""
    if val is None:
        return None
    if isinstance(val, list):
        return json.dumps([str(v) if isinstance(v, uuid.UUID) else v for v in val],
                          ensure_ascii=False, default=str)
    return str(val)

# =============================================================
# CONFIGURAÇÃO DE TRANSFORMAÇÕES POR TABELA
# Colunas listadas aqui recebem tratamento especial.
# Colunas não listadas são copiadas diretamente (após sanitização geral).
# =============================================================
COLUMN_TRANSFORMS: dict[str, dict[str, callable]] = {
    "workshops": {
        "specialties": _array_to_json,
    },
    "saved_couplings": {
        "trailer_ids": _array_to_json,
    },
}

# Colunas que são arrays em qualquer tabela (fallback genérico)
ARRAY_COLUMNS = {"specialties", "trailer_ids"}

# Colunas que são booleans em Postgres (mas não detectadas automaticamente)
# psycopg2 normalmente converte bool para bool Python automaticamente.

# =============================================================
# HELPER: conversão genérica de valor
# =============================================================
def sanitize_value(col_name: str, val: Any, table: str) -> Any:
    """
    Aplica transformação específica ou genérica ao valor.
    """
    # 1. Transformação específica da tabela/coluna
    if table in COLUMN_TRANSFORMS and col_name in COLUMN_TRANSFORMS[table]:
        return COLUMN_TRANSFORMS[table][col_name](val)

    # 2. Transformações genéricas por tipo Python
    if val is None:
        return None
    if isinstance(val, uuid.UUID):
        return str(val)
    if isinstance(val, bool):
        return 1 if val else 0
    if isinstance(val, datetime):
        return _datetime_to_str(val)
    if isinstance(val, date):
        return val.isoformat()
    if isinstance(val, Decimal):
        return float(val)
    if isinstance(val, dict):
        return _json_to_str(val)
    if isinstance(val, list):
        # Array genérico → JSON
        return _array_to_json(val)
    if isinstance(val, memoryview):
        return bytes(val)
    return val

# =============================================================
# HELPER: batch generator
# =============================================================
def batched(iterable, size: int) -> Generator:
    batch = []
    for item in iterable:
        batch.append(item)
        if len(batch) >= size:
            yield batch
            batch = []
    if batch:
        yield batch

# =============================================================
# CORE: migrar uma tabela
# =============================================================
def migrate_table(
    pg_cur,
    mysql_conn: MySQLConnection,
    table: str,
    batch_size: int,
    dry_run: bool,
) -> tuple[int, int]:
    """
    Retorna (rows_read, rows_upserted).
    Usa INSERT ... ON DUPLICATE KEY UPDATE para idempotência.
    """
    # Contar registros na origem
    pg_cur.execute(f"SELECT COUNT(*) FROM public.{table}")
    total = pg_cur.fetchone()[0]

    if total == 0:
        print(f"  ⚠  {table}: 0 registros — pulando.")
        return 0, 0

    print(f"  → {table}: {total:,} registros", end="", flush=True)

    if dry_run:
        print(f" [DRY-RUN]")
        return total, 0

    # Buscar schema de colunas
    pg_cur.execute(f"""
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name   = %s
        ORDER BY ordinal_position
    """, (table,))
    pg_columns = [row[0] for row in pg_cur.fetchall()]

    if not pg_columns:
        print(f"\n  ✗ {table}: colunas não encontradas no Postgres — pulando.")
        return 0, 0

    # Carregar dados em batches via server-side cursor
    pg_cur.execute(f"SELECT {', '.join(pg_columns)} FROM public.{table}")

    mysql_cur = mysql_conn.cursor()
    upserted = 0

    col_list  = ", ".join(f"`{c}`" for c in pg_columns)
    placeholders = ", ".join(["%s"] * len(pg_columns))
    update_clause = ", ".join(
        f"`{c}` = VALUES(`{c}`)"
        for c in pg_columns
        if c != "id"  # não atualizar PK
    )

    insert_sql = (
        f"INSERT INTO `{table}` ({col_list}) "
        f"VALUES ({placeholders}) "
        f"ON DUPLICATE KEY UPDATE {update_clause}"
    )

    for batch_rows in batched(pg_cur, batch_size):
        mysql_rows = []
        for row in batch_rows:
            sanitized = tuple(
                sanitize_value(col, val, table)
                for col, val in zip(pg_columns, row)
            )
            mysql_rows.append(sanitized)

        try:
            mysql_cur.executemany(insert_sql, mysql_rows)
            mysql_conn.commit()
            upserted += len(mysql_rows)
            print(".", end="", flush=True)
        except Exception as e:
            mysql_conn.rollback()
            print(f"\n  ✗ Erro no batch de {table}: {e}")
            raise

    mysql_cur.close()
    print(f" ✓ {upserted:,} linhas")
    return total, upserted

# =============================================================
# MAIN
# =============================================================
def main():
    parser = argparse.ArgumentParser(description="Migra dados Postgres → MySQL (Frota-Link)")
    parser.add_argument(
        "--tables", type=str, default=None,
        help="Tabelas a migrar (separadas por vírgula). Padrão: todas."
    )
    parser.add_argument(
        "--batch-size", type=int, default=DEFAULT_BATCH_SIZE,
        help=f"Registros por batch (padrão: {DEFAULT_BATCH_SIZE})"
    )
    parser.add_argument(
        "--dry-run", action="store_true",
        help="Apenas conta registros, sem inserir no MySQL."
    )
    args = parser.parse_args()

    tables_to_migrate = (
        [t.strip() for t in args.tables.split(",")]
        if args.tables
        else MIGRATION_ORDER
    )

    # Validar tabelas solicitadas
    unknown = set(tables_to_migrate) - set(MIGRATION_ORDER)
    if unknown:
        print(f"✗ Tabelas desconhecidas: {', '.join(unknown)}")
        sys.exit(1)

    # Preservar ordem de dependência mesmo quando subset
    tables_to_migrate = [t for t in MIGRATION_ORDER if t in tables_to_migrate]

    print("=" * 60)
    print("Frota-Link – Migração PostgreSQL → MySQL")
    print("=" * 60)

    if args.dry_run:
        print("[MODO DRY-RUN] Nenhum dado será inserido.\n")

    # Conectar ao Postgres
    print("Conectando ao PostgreSQL (Supabase)... ", end="")
    try:
        pg_conn = psycopg2.connect(**PG_CONFIG)
        pg_conn.autocommit = True
        print("OK")
    except Exception as e:
        print(f"FALHA\n  {e}")
        sys.exit(1)

    # Conectar ao MySQL
    print("Conectando ao MySQL... ", end="")
    try:
        mysql_conn = mysql.connector.connect(**MYSQL_CONFIG)
        mysql_conn.autocommit = False
        print("OK")
    except Exception as e:
        print(f"FALHA\n  {e}")
        pg_conn.close()
        sys.exit(1)

    # Configurar MySQL session
    mysql_cur = mysql_conn.cursor()
    mysql_cur.execute("SET NAMES utf8mb4")
    mysql_cur.execute("SET time_zone = '+00:00'")
    mysql_cur.execute("SET foreign_key_checks = 0")  # desabilitar durante carga
    mysql_cur.execute("SET GLOBAL max_allowed_packet = 67108864")  # 64MB para XML/blobs
    mysql_cur.close()

    # Usar cursor server-side no Postgres para streaming de grandes tabelas
    pg_cur = pg_conn.cursor(name="frota_link_migration", cursor_factory=psycopg2.extras.DictCursor)
    pg_cur.itersize = args.batch_size

    total_read = 0
    total_upserted = 0
    failed_tables = []

    print(f"\nMigrando {len(tables_to_migrate)} tabela(s)...\n")

    for table in tables_to_migrate:
        try:
            # Server-side cursors não podem ser reutilizados – criar novo para cada tabela
            pg_cur.close()
            pg_cur = pg_conn.cursor(
                name=f"cur_{table}",
                cursor_factory=psycopg2.extras.DictCursor
            )
            pg_cur.itersize = args.batch_size

            r, u = migrate_table(pg_cur, mysql_conn, table, args.batch_size, args.dry_run)
            total_read += r
            total_upserted += u
        except Exception:
            print(f"\n  ✗ ERRO na tabela '{table}':")
            traceback.print_exc()
            failed_tables.append(table)
            # Continuar com as próximas tabelas
            mysql_conn.rollback()

    # Reabilitar FK checks
    mysql_cur2 = mysql_conn.cursor()
    mysql_cur2.execute("SET foreign_key_checks = 1")
    mysql_cur2.close()
    mysql_conn.commit()

    # Fechar conexões
    pg_cur.close()
    pg_conn.close()
    mysql_conn.close()

    print("\n" + "=" * 60)
    print(f"Migração concluída.")
    print(f"  Registros lidos (Postgres):   {total_read:,}")
    print(f"  Registros inseridos (MySQL):  {total_upserted:,}")
    if failed_tables:
        print(f"  ✗ Tabelas com erro: {', '.join(failed_tables)}")
        print("\n  ⚠  Revise os erros acima e re-execute somente as tabelas falhas:")
        print(f"     python migrate_data.py --tables {','.join(failed_tables)}")
        sys.exit(1)
    else:
        print("  ✓ Todas as tabelas migradas com sucesso.")
    print("=" * 60)


if __name__ == "__main__":
    main()
