# Frota-Link – Migração PostgreSQL (Supabase) → MySQL 8.0

Este diretório contém todos os artefatos para migrar o banco de dados do Frota-Link de Supabase (PostgreSQL) para MySQL 8.0.

## Arquivos gerados

| Arquivo | Descrição |
|---|---|
| `schema.mysql.sql` | DDL completo do MySQL: tabelas, índices, FKs, triggers |
| `type-mapping.md` | Mapa de tipos PostgreSQL → MySQL e decisões documentadas |
| `migrate_data.py` | Script Python de migração de dados (UPSERT idempotente) |
| `verify.sql` | Queries de smoke test pós-migração |
| `README.md` | Este guia |

---

## Pré-requisitos

### MySQL 8.0
- Versão mínima: **8.0.17** (suporte a CHECK constraints e índices funcionais)
- Engine: **InnoDB** (obrigatório)
- Charset: **utf8mb4** / collation **utf8mb4_unicode_ci**

### Python 3.9+ (para migração de dados)
```bash
pip install psycopg2-binary mysql-connector-python python-dotenv
```

### Acesso ao Supabase
- Você precisa de acesso de **leitura** ao banco Postgres via credenciais de serviço (não a chave anon).
- Obtenha em: Supabase Dashboard → Settings → Database → Connection string.

---

## Passo a Passo

### PASSO 1 – Criar o banco MySQL e aplicar o schema

```bash
# 1. Conectar ao MySQL como root
mysql -u root -p

# 2. Criar o banco
CREATE DATABASE frota_link
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

# 3. Criar usuário dedicado (recomendado)
CREATE USER 'frota_link_user'@'%' IDENTIFIED BY 'senha_forte_aqui';
GRANT ALL PRIVILEGES ON frota_link.* TO 'frota_link_user'@'%';
FLUSH PRIVILEGES;

# 4. Sair e aplicar o schema
exit
```

```bash
mysql -u frota_link_user -p frota_link < mysql/schema.mysql.sql
```

Verifique se não há erros. O script:
- Cria todas as 59 tabelas na ordem correta de dependência
- Cria todos os índices e FKs
- Cria os triggers `trg_freight_request_number` e `trg_check_vehicle_limit`
- Desabilita `foreign_key_checks` durante a criação e reabilita no final

---

### PASSO 2 – Configurar credenciais de acesso

Crie um arquivo `.env` na raiz do projeto (ou exporte as variáveis de ambiente):

```env
# PostgreSQL (Supabase)
PG_HOST=db.hxfhubhijampubrsqfhg.supabase.co
PG_PORT=5432
PG_DBNAME=postgres
PG_USER=postgres
PG_PASSWORD=<SUA_SENHA_SUPABASE>
PG_SSLMODE=require

# MySQL
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_DATABASE=frota_link
MYSQL_USER=frota_link_user
MYSQL_PASSWORD=<SUA_SENHA_MYSQL>
```

> **Atenção:** Nunca comite o arquivo `.env` no git.

---

### PASSO 3 – Executar a migração de dados

#### Dry-run (apenas conta registros, sem inserir)
```bash
python mysql/migrate_data.py --dry-run
```

#### Migração completa
```bash
python mysql/migrate_data.py
```

#### Migrar apenas tabelas específicas
```bash
python mysql/migrate_data.py --tables companies,vehicles,drivers,journeys
```

#### Ajustar tamanho do batch (default: 500)
```bash
python mysql/migrate_data.py --batch-size 200
```

**Comportamento da migração:**
- Processa as tabelas na **ordem correta de dependência FK**
- Usa `INSERT ... ON DUPLICATE KEY UPDATE` → **idempotente** (pode ser re-executado)
- Processa dados em batches para não sobrecarregar memória
- Se uma tabela falhar, continua com as demais e lista as falhas no final
- Re-execute apenas as tabelas que falharam com `--tables`

**Estimativas de tempo:**
- Depende do volume de dados e latência de rede até o Supabase
- Para bases com <100k registros: ~5-15 minutos
- Para bases maiores: ajuste `--batch-size` para baixo se houver timeout

---

### PASSO 4 – Executar os smoke tests

Após a migração, valide os dados:

```bash
mysql -u frota_link_user -p frota_link < mysql/verify.sql > verify_output.txt 2>&1
```

Compare os resultados com o banco Postgres:

```sql
-- No Postgres (Supabase SQL Editor):
SELECT 'companies' AS tabela, COUNT(*) FROM public.companies
UNION ALL SELECT 'vehicles', COUNT(*) FROM public.vehicles
UNION ALL SELECT 'drivers',  COUNT(*) FROM public.drivers
UNION ALL SELECT 'journeys', COUNT(*) FROM public.journeys
UNION ALL SELECT 'revenue',  COUNT(*) FROM public.revenue
UNION ALL SELECT 'expenses', COUNT(*) FROM public.expenses
-- ... etc
```

O arquivo `verify.sql` verifica:
1. **Contagem por tabela** – compare com Postgres
2. **PKs nulas** – não deve haver nenhuma
3. **UNIQUEs** – CNPJs, CPFs, CNHs, user_ids duplicados
4. **Orphan records** – FKs sem pai correspondente
5. **Somatórios financeiros** – totais de receita, despesa, combustível
6. **Validade JSON** – colunas JSON com conteúdo inválido
7. **Amostras aleatórias** – 5 registros de cada tabela principal

---

## Decisões de Design Importantes

### O que NÃO migra automaticamente

| Feature Supabase | Ação necessária |
|---|---|
| **Row Level Security (RLS)** | Implementar segurança na camada de aplicação (filtrar por `company_id` e papel do usuário) |
| **Supabase Auth** (`auth.users`) | Integrar com outro sistema de autenticação. Todos os `user_id` estão como `CHAR(36)` sem FK |
| **Edge Functions** (35 funções) | Re-implementar como endpoints REST na sua API backend |
| **Storage Buckets** (`expense-receipts`) | Configurar S3, MinIO ou outro object storage. As URLs nas colunas `receipt_url`, `pdf_url` etc. continuam válidas se o bucket for mantido |
| **pg_cron** (notify-due-accounts) | Configurar job agendado externo (cron Linux, Task Scheduler Windows, ou scheduler na aplicação) |
| **Trigger `handle_new_user()`** | Implementar na camada de aplicação: ao criar usuário, criar também o `profile` correspondente |
| **Trigger `set_company_id()`** | Implementar na camada de aplicação: ao inserir registros, incluir sempre o `company_id` |

### Tipos de dados alterados

Veja o detalhamento completo em `type-mapping.md`. Resumo:

- `UUID` → `CHAR(36)` (armazenado como string UUID padrão)
- `TIMESTAMPTZ` → `DATETIME(6)` (UTC, sem timezone)
- `JSONB` → `JSON`
- `TEXT[]` (arrays) → `JSON` (ex: `workshops.specialties`, `saved_couplings.trailer_ids`)
- `BOOLEAN` → `TINYINT(1)` (1=true, 0=false)
- `app_role` (enum Postgres) → `ENUM(...)` MySQL por coluna

### Índices parciais

MySQL não suporta `WHERE` em índices. Todos os índices parciais foram convertidos para índices completos (ou compostos). Isso pode aumentar levemente o tamanho do índice mas não afeta a corretude. Veja detalhes em `type-mapping.md`.

### Dependência circular: expenses ↔ accounts_payable

Ambas as tabelas referenciam uma à outra. A solução:
1. `expenses` é criada **sem** a FK para `accounts_payable`
2. `accounts_payable` é criada com FK para `expenses`
3. Um `ALTER TABLE expenses ADD FOREIGN KEY` fecha o ciclo

O script `schema.mysql.sql` já trata isso corretamente.

### tire_assets e tire_logs

Essas tabelas foram criadas via Supabase Studio (não há migrations locais de `CREATE TABLE`). A estrutura foi reconstruída a partir de `src/integrations/supabase/types.ts`. **Verifique contra o banco Supabase de produção antes de migrar:**

```sql
-- No Supabase SQL Editor:
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('tire_assets', 'tire_logs')
ORDER BY table_name, ordinal_position;
```

---

## Configuração do Servidor MySQL

Adicione ao seu `my.cnf` / `my.ini`:

```ini
[mysqld]
character-set-server    = utf8mb4
collation-server        = utf8mb4_unicode_ci
explicit_defaults_for_timestamp = ON
time_zone               = '+00:00'
max_allowed_packet      = 64M    # necessário para xml_content (CT-e/MDF-e)
innodb_file_per_table   = ON
sql_mode                = STRICT_TRANS_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION
```

---

## Rollback

Como a migração é **aditiva** (não apaga dados do Postgres), o rollback é simplesmente:
1. Parar de usar o MySQL
2. Apontar a aplicação de volta para o Supabase

Para limpar o MySQL:
```sql
DROP DATABASE frota_link;
```

---

## Checklist de Validação Final

- [ ] Schema criado sem erros (`schema.mysql.sql`)
- [ ] Contagens MySQL == Contagens Postgres (Seção 1 do `verify.sql`)
- [ ] Nenhuma PK nula (Seção 2)
- [ ] Nenhum UNIQUE violado (Seção 3)
- [ ] Nenhum orphan record (Seção 5)
- [ ] Somatórios financeiros batem (Seção 4)
- [ ] Aplicação consegue autenticar e buscar dados
- [ ] Trigger `trg_freight_request_number` gera `request_number` no formato `FR-000001`
- [ ] Trigger `trg_check_vehicle_limit` bloqueia inserção acima do limite do plano
- [ ] Sistema de autenticação substituto configurado
- [ ] Job de notificações de vencimento configurado (substitui pg_cron)
