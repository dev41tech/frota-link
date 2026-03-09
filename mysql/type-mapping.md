# Type Mapping: PostgreSQL/Supabase → MySQL 8.0

## Mapeamento de Tipos

| Postgres/Supabase | MySQL 8.0 | Decisão / Notas |
|---|---|---|
| `UUID` / `gen_random_uuid()` | `CHAR(36)` / `DEFAULT (UUID())` | CHAR(36) é portável e legível. Alternativa: BINARY(16) economiza espaço mas exige conversão HEX/UNHEX em toda query. Optou-se por CHAR(36) pela simplicidade. |
| `TIMESTAMP WITH TIME ZONE` / `TIMESTAMPTZ` | `DATETIME(6)` | MySQL 8 armazena DATETIME em UTC se o servidor for configurado com `time_zone = '+00:00'`. **Importante:** garanta `SET time_zone = '+00:00'` no servidor MySQL. TIMESTAMP(6) tem limite até 2038; DATETIME(6) vai até 9999. Escolhido DATETIME(6). |
| `TEXT` | `TEXT` | Direto. |
| `VARCHAR(n)` | `VARCHAR(n)` | Direto. |
| `BOOLEAN` | `TINYINT(1)` | Convenção MySQL. TRUE=1, FALSE=0. |
| `NUMERIC(p,s)` / `DECIMAL(p,s)` | `DECIMAL(p,s)` | Direto. |
| `INTEGER` / `INT` | `INT` | Direto. |
| `BIGINT` | `BIGINT` | Direto. |
| `SMALLINT` | `SMALLINT` | Direto. |
| `REAL` / `FLOAT4` | `FLOAT` | Direto. |
| `DOUBLE PRECISION` | `DOUBLE` | Direto. |
| `DATE` | `DATE` | Direto. |
| `JSON` / `JSONB` | `JSON` | MySQL 8 suporta JSON nativo com validação. Sem equivalente ao índice GIN do Postgres — use colunas geradas (virtual) se precisar indexar campos JSON específicos. |
| `TEXT[]` (array de texto) | `JSON` | Não há tipo array nativo no MySQL. Arrays convertidos para JSON. Impacta: `workshops.specialties`. Aplicação deve serializar/deserializar. |
| `UUID[]` (array de UUID) | `JSON` | Idem. Impacta: `saved_couplings.trailer_ids`. |
| `SERIAL` / `BIGSERIAL` | `INT AUTO_INCREMENT` / `BIGINT AUTO_INCREMENT` | Apenas para PKs numéricas. Tabelas com UUID como PK não usam AUTO_INCREMENT. |
| `SEQUENCE` (ex: freight_request_number_seq) | Tabela auxiliar + TRIGGER BEFORE INSERT | MySQL não tem SEQUENCE independente. Simulado via tabela `freight_request_sequences` com AUTO_INCREMENT + TRIGGER. |

## Mapeamento de ENUMs

| Postgres ENUM | MySQL ENUM | Notas |
|---|---|---|
| `app_role` (`master`,`admin`,`gestor`,`motorista`,`bpo`,`suporte`) | `ENUM('master','admin','gestor','motorista','bpo','suporte')` | Definido inline em `profiles.role` e `user_roles.role`. Em Postgres era um TYPE global; em MySQL é definido por coluna. |

## Features Supabase/Postgres NÃO Migradas

| Feature | Decisão |
|---|---|
| **Row Level Security (RLS)** | **NÃO migrada.** RLS é exclusivo do PostgreSQL. Em MySQL, a segurança deve ser implementada na camada de aplicação ou via views filtradas por `company_id`. Todas as políticas RLS foram ignoradas. |
| **`auth.users` (Supabase Auth)** | **NÃO migrada.** O sistema de autenticação do Supabase não existe no MySQL. Todas as FKs para `auth.users` foram convertidas para `CHAR(36)` sem constraint. Se usar outro sistema de auth (ex: Keycloak, Firebase, custom), crie uma tabela `auth_users` e adicione FKs manualmente. |
| **Triggers `updated_at`** | **Recriados como TRIGGERS MySQL.** O trigger `update_updated_at_column()` foi reproduzido com sintaxe MySQL em cada tabela relevante. |
| **Trigger `handle_new_user()`** | **NÃO migrado.** Era um trigger que criava `profiles` ao criar um usuário em `auth.users`. Deve ser implementado na camada de aplicação. |
| **Trigger `set_company_id()`** | **NÃO migrado.** Auto-atribuição de `company_id` via contexto do usuário é exclusivo do Supabase. Implementar no backend. |
| **Trigger `enforce_vehicle_limit`** | **Migrado como TRIGGER MySQL.** Recriado com lógica equivalente. |
| **Trigger `set_freight_request_number`** | **Migrado como TRIGGER MySQL.** Usa tabela de sequência + TRIGGER BEFORE INSERT. |
| **Trigger `check_vehicle_limit()`** | **Migrado como TRIGGER MySQL.** |
| **Functions PL/pgSQL** (`get_user_role`, `is_master_user`, `get_user_company_id`, `user_has_company_access`, etc.) | **NÃO migradas.** São funções auxiliares para RLS. Em MySQL, a lógica deve ir para procedures ou para a camada de aplicação. |
| **`pg_cron` (notify-due-accounts)** | **NÃO migrado.** MySQL não tem cron nativo. Use um cron job externo (ex: Task Scheduler Windows, crontab Linux) ou um job scheduler na aplicação. |
| **`pg_net` (HTTP calls)** | **NÃO migrado.** Sem equivalente MySQL. Implementar via aplicação. |
| **`unaccent` extension** | **NÃO migrada.** Usada para gerar slugs. Implemente `generate_company_slug()` na aplicação. |
| **`gen_random_uuid()`** | **Substituído por `UUID()`** do MySQL. |
| **Storage Buckets** (`expense-receipts`) | **NÃO migrado.** Supabase Storage não existe em MySQL. As colunas `receipt_url`, `pdf_url`, etc. mantêm as URLs como TEXT. Configure um storage externo (S3, MinIO, etc.). |
| **Realtime subscriptions** | **NÃO migrada.** Implementar via polling ou WebSockets na aplicação. |
| **Edge Functions** (35 funções) | **NÃO migradas.** Devem ser reimplementadas como APIs REST. |
| **Views materializadas** | Não havia views materializadas no schema. |
| **Extensions** (`pgcrypto`, `uuid-ossp`, `pg_cron`, `pg_net`, `unaccent`) | **NÃO migradas.** Funcionalidades essenciais já cobertas por MySQL nativo. |

## Índices Parciais (WHERE clause) — Limitação MySQL

MySQL 8 não suporta índices parciais com cláusula WHERE. Os seguintes índices foram convertidos para índices completos:

| Índice Postgres (parcial) | Índice MySQL (completo) | Impacto |
|---|---|---|
| `idx_revenue_reconciled ON revenue(reconciled_at) WHERE reconciled_at IS NOT NULL` | `idx_revenue_reconciled ON revenue(reconciled_at)` | Levemente menos seletivo |
| `idx_expenses_reconciled ON expenses(reconciled_at) WHERE reconciled_at IS NOT NULL` | `idx_expenses_reconciled ON expenses(reconciled_at)` | Idem |
| `idx_vehicle_couplings_active ON vehicle_couplings(truck_id) WHERE decoupled_at IS NULL` | `idx_vehicle_couplings_active ON vehicle_couplings(truck_id, decoupled_at)` | Incluído `decoupled_at` para compensar |
| `idx_vehicles_company_deleted ON vehicles(company_id) WHERE deleted_at IS NULL` | `idx_vehicles_company ON vehicles(company_id)` | Idem |
| Diversos outros índices parciais para `deleted_at IS NULL` | Convertidos para índices compostos incluindo `deleted_at` | Considere filtrar `deleted_at IS NULL` na aplicação |

## Decisões por Coluna (Arrays)

| Tabela | Coluna | Tipo Postgres | Tipo MySQL | Notas |
|---|---|---|---|---|
| `workshops` | `specialties` | `TEXT[]` | `JSON` | Ex: `["funilaria","mecanica"]` |
| `saved_couplings` | `trailer_ids` | `UUID[]` | `JSON` | Ex: `["uuid1","uuid2"]` |
| `journey_checklists` | `items` | `JSONB` | `JSON` | Sem alteração semântica |
| `journey_checklists` | `photos` | `JSONB` | `JSON` | Idem |
| `audit_logs` | `old_values`, `new_values` | `JSONB` | `JSON` | Idem |
| `subscription_plans` | `features` | `JSONB` | `JSON` | Idem |
| `system_alerts` | `metadata` | `JSONB` | `JSON` | Idem |
| `system_settings` | `setting_value` | `JSONB` | `JSON` | Idem |
| `freight_requests` | `nfe_xml_data` | `JSONB` | `JSON` | Idem |
| `cte_documents` | `linked_documents`, `cargo_info`, `vehicle_info`, `driver_info`, `tax_info`, `sender_full`, `recipient_full` | `JSONB` | `JSON` | Idem |
| `fiscal_document_lookups` | `request_payload`, `response_payload` | `JSONB` | `JSON` | Idem |
| `fiscal_audit_logs` | `request_payload`, `response_payload` | `JSONB` | `JSON` | Idem |
| `usage_logs` | `metadata` | `JSONB` | `JSON` | Idem |

## Configuração MySQL Recomendada

```sql
-- Executar antes de qualquer operação
SET time_zone = '+00:00';
SET NAMES utf8mb4;
SET foreign_key_checks = 1;

-- Configurações do servidor (my.cnf / my.ini)
-- character-set-server = utf8mb4
-- collation-server = utf8mb4_unicode_ci
-- explicit_defaults_for_timestamp = ON
-- time_zone = '+00:00'
```

## Tabela `tire_assets` — Nota Especial

Esta tabela foi criada via Supabase Studio (não encontrada nas migrations locais). A estrutura foi reconstruída a partir do arquivo `src/integrations/supabase/types.ts` + migrations de ALTER TABLE. Valide a estrutura contra o banco de produção Supabase antes da migração.

## Tabela `tire_logs` — Nota Especial

Idem ao `tire_assets` — estrutura reconstruída a partir de `types.ts`. Sem migration de CREATE TABLE encontrada.
