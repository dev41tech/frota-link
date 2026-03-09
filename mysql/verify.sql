-- =============================================================
-- verify.sql – Smoke Tests pós-migração Frota-Link
-- Executar no MySQL APÓS migração de dados.
-- Comparar os valores com o resultado equivalente no Postgres.
-- =============================================================

SET NAMES utf8mb4;
SET time_zone = '+00:00';

-- =============================================================
-- SEÇÃO 1: CONTAGEM POR TABELA
-- Compare cada linha com o resultado do Postgres:
--   SELECT COUNT(*) FROM public.<tabela>;
-- =============================================================

SELECT 'subscription_plans'          AS tabela, COUNT(*) AS total FROM subscription_plans
UNION ALL
SELECT 'system_settings',                        COUNT(*)         FROM system_settings
UNION ALL
SELECT 'vehicle_consumption_references',         COUNT(*)         FROM vehicle_consumption_references
UNION ALL
SELECT 'companies',                              COUNT(*)         FROM companies
UNION ALL
SELECT 'profiles',                               COUNT(*)         FROM profiles
UNION ALL
SELECT 'user_roles',                             COUNT(*)         FROM user_roles
UNION ALL
SELECT 'bpo_company_access',                     COUNT(*)         FROM bpo_company_access
UNION ALL
SELECT 'audit_logs',                             COUNT(*)         FROM audit_logs
UNION ALL
SELECT 'system_alerts',                          COUNT(*)         FROM system_alerts
UNION ALL
SELECT 'usage_logs',                             COUNT(*)         FROM usage_logs
UNION ALL
SELECT 'invoices',                               COUNT(*)         FROM invoices
UNION ALL
SELECT 'gas_stations',                           COUNT(*)         FROM gas_stations
UNION ALL
SELECT 'parties',                                COUNT(*)         FROM parties
UNION ALL
SELECT 'expense_categories',                     COUNT(*)         FROM expense_categories
UNION ALL
SELECT 'revenue_categories',                     COUNT(*)         FROM revenue_categories
UNION ALL
SELECT 'workshops',                              COUNT(*)         FROM workshops
UNION ALL
SELECT 'cte_settings',                           COUNT(*)         FROM cte_settings
UNION ALL
SELECT 'cte_series',                             COUNT(*)         FROM cte_series
UNION ALL
SELECT 'digital_certificates',                   COUNT(*)         FROM digital_certificates
UNION ALL
SELECT 'fiscal_party_templates',                 COUNT(*)         FROM fiscal_party_templates
UNION ALL
SELECT 'freight_rates',                          COUNT(*)         FROM freight_rates
UNION ALL
SELECT 'freight_pricing_settings',               COUNT(*)         FROM freight_pricing_settings
UNION ALL
SELECT 'vehicles',                               COUNT(*)         FROM vehicles
UNION ALL
SELECT 'drivers',                                COUNT(*)         FROM drivers
UNION ALL
SELECT 'driver_performance_history',             COUNT(*)         FROM driver_performance_history
UNION ALL
SELECT 'driver_vehicles',                        COUNT(*)         FROM driver_vehicles
UNION ALL
SELECT 'vehicle_consumption_history',            COUNT(*)         FROM vehicle_consumption_history
UNION ALL
SELECT 'vehicle_couplings',                      COUNT(*)         FROM vehicle_couplings
UNION ALL
SELECT 'vehicle_coupling_items',                 COUNT(*)         FROM vehicle_coupling_items
UNION ALL
SELECT 'saved_couplings',                        COUNT(*)         FROM saved_couplings
UNION ALL
SELECT 'tire_assets',                            COUNT(*)         FROM tire_assets
UNION ALL
SELECT 'tire_logs',                              COUNT(*)         FROM tire_logs
UNION ALL
SELECT 'journeys',                               COUNT(*)         FROM journeys
UNION ALL
SELECT 'journey_legs',                           COUNT(*)         FROM journey_legs
UNION ALL
SELECT 'journey_checklists',                     COUNT(*)         FROM journey_checklists
UNION ALL
SELECT 'driver_messages',                        COUNT(*)         FROM driver_messages
UNION ALL
SELECT 'bank_transactions',                      COUNT(*)         FROM bank_transactions
UNION ALL
SELECT 'fuel_expenses',                          COUNT(*)         FROM fuel_expenses
UNION ALL
SELECT 'expenses',                               COUNT(*)         FROM expenses
UNION ALL
SELECT 'accounts_payable',                       COUNT(*)         FROM accounts_payable
UNION ALL
SELECT 'revenue',                                COUNT(*)         FROM revenue
UNION ALL
SELECT 'bank_reconciliations',                   COUNT(*)         FROM bank_reconciliations
UNION ALL
SELECT 'cte_documents',                          COUNT(*)         FROM cte_documents
UNION ALL
SELECT 'cte_anulacao_documents',                 COUNT(*)         FROM cte_anulacao_documents
UNION ALL
SELECT 'mdfe_documents',                         COUNT(*)         FROM mdfe_documents
UNION ALL
SELECT 'mdfe_cte_links',                         COUNT(*)         FROM mdfe_cte_links
UNION ALL
SELECT 'fiscal_document_lookups',                COUNT(*)         FROM fiscal_document_lookups
UNION ALL
SELECT 'fiscal_audit_logs',                      COUNT(*)         FROM fiscal_audit_logs
UNION ALL
SELECT 'customer_portal_tokens',                 COUNT(*)         FROM customer_portal_tokens
UNION ALL
SELECT 'freight_requests',                       COUNT(*)         FROM freight_requests
UNION ALL
SELECT 'vehicle_maintenances',                   COUNT(*)         FROM vehicle_maintenances
UNION ALL
SELECT 'maintenance_parts',                      COUNT(*)         FROM maintenance_parts
UNION ALL
SELECT 'maintenance_schedules',                  COUNT(*)         FROM maintenance_schedules
UNION ALL
SELECT 'tire_history',                           COUNT(*)         FROM tire_history
UNION ALL
SELECT 'announcements',                          COUNT(*)         FROM announcements
UNION ALL
SELECT 'announcement_targets',                   COUNT(*)         FROM announcement_targets
UNION ALL
SELECT 'announcement_reads',                     COUNT(*)         FROM announcement_reads
UNION ALL
SELECT 'incidents',                              COUNT(*)         FROM incidents
ORDER BY tabela;


-- =============================================================
-- SEÇÃO 2: VERIFICAÇÃO DE PKs NULAS (não deveria haver)
-- Se retornar algum resultado, há problema na migração.
-- =============================================================

SELECT 'PROBLEMA: PK nula em subscription_plans' AS check_result WHERE EXISTS (SELECT 1 FROM subscription_plans WHERE id IS NULL)
UNION ALL
SELECT 'PROBLEMA: PK nula em companies'          WHERE EXISTS (SELECT 1 FROM companies         WHERE id IS NULL)
UNION ALL
SELECT 'PROBLEMA: PK nula em profiles'           WHERE EXISTS (SELECT 1 FROM profiles          WHERE id IS NULL)
UNION ALL
SELECT 'PROBLEMA: PK nula em user_roles'         WHERE EXISTS (SELECT 1 FROM user_roles        WHERE id IS NULL)
UNION ALL
SELECT 'PROBLEMA: PK nula em vehicles'           WHERE EXISTS (SELECT 1 FROM vehicles          WHERE id IS NULL)
UNION ALL
SELECT 'PROBLEMA: PK nula em drivers'            WHERE EXISTS (SELECT 1 FROM drivers           WHERE id IS NULL)
UNION ALL
SELECT 'PROBLEMA: PK nula em journeys'           WHERE EXISTS (SELECT 1 FROM journeys          WHERE id IS NULL)
UNION ALL
SELECT 'PROBLEMA: PK nula em expenses'           WHERE EXISTS (SELECT 1 FROM expenses          WHERE id IS NULL)
UNION ALL
SELECT 'PROBLEMA: PK nula em revenue'            WHERE EXISTS (SELECT 1 FROM revenue           WHERE id IS NULL)
UNION ALL
SELECT 'PROBLEMA: PK nula em fuel_expenses'      WHERE EXISTS (SELECT 1 FROM fuel_expenses     WHERE id IS NULL)
UNION ALL
SELECT 'PROBLEMA: PK nula em accounts_payable'   WHERE EXISTS (SELECT 1 FROM accounts_payable  WHERE id IS NULL)
UNION ALL
SELECT 'PROBLEMA: PK nula em cte_documents'      WHERE EXISTS (SELECT 1 FROM cte_documents     WHERE id IS NULL)
UNION ALL
SELECT 'PROBLEMA: PK nula em bank_transactions'  WHERE EXISTS (SELECT 1 FROM bank_transactions WHERE id IS NULL)
UNION ALL
SELECT 'OK: nenhuma PK nula detectada'           WHERE NOT EXISTS (
    SELECT 1 FROM subscription_plans WHERE id IS NULL UNION ALL
    SELECT 1 FROM companies          WHERE id IS NULL UNION ALL
    SELECT 1 FROM profiles           WHERE id IS NULL UNION ALL
    SELECT 1 FROM vehicles           WHERE id IS NULL UNION ALL
    SELECT 1 FROM drivers            WHERE id IS NULL UNION ALL
    SELECT 1 FROM journeys           WHERE id IS NULL
);


-- =============================================================
-- SEÇÃO 3: CONSTRAINT CHECK – UNIQUEs básicos
-- =============================================================

-- companies.cnpj deve ser único
SELECT 'PROBLEMA: CNPJs duplicados em companies' AS check_result, cnpj, COUNT(*) AS cnt
FROM companies
GROUP BY cnpj
HAVING cnt > 1;

-- profiles.user_id deve ser único
SELECT 'PROBLEMA: user_id duplicado em profiles' AS check_result, user_id, COUNT(*) AS cnt
FROM profiles
GROUP BY user_id
HAVING cnt > 1;

-- drivers.cpf deve ser único (exceto NULLs)
SELECT 'PROBLEMA: CPF duplicado em drivers' AS check_result, cpf, COUNT(*) AS cnt
FROM drivers
WHERE cpf IS NOT NULL
GROUP BY cpf
HAVING cnt > 1;

-- drivers.cnh deve ser único (exceto NULLs)
SELECT 'PROBLEMA: CNH duplicada em drivers' AS check_result, cnh, COUNT(*) AS cnt
FROM drivers
WHERE cnh IS NOT NULL
GROUP BY cnh
HAVING cnt > 1;

-- user_roles deve ser único por (user_id, company_id)
SELECT 'PROBLEMA: user_roles duplicado' AS check_result, user_id, company_id, COUNT(*) AS cnt
FROM user_roles
GROUP BY user_id, company_id
HAVING cnt > 1;

-- expense_categories deve ser único por (company_id, name)
SELECT 'PROBLEMA: expense_categories duplicado' AS check_result, company_id, name, COUNT(*) AS cnt
FROM expense_categories
GROUP BY company_id, name(200)
HAVING cnt > 1;


-- =============================================================
-- SEÇÃO 4: SOMATÓRIOS FINANCEIROS (comparar com Postgres)
-- Postgres equivalente:
--   SELECT SUM(amount), SUM(total_amount), etc.
-- =============================================================

-- Somatório de receitas por status
SELECT
  'revenue' AS tabela,
  status,
  COUNT(*)                   AS qtd,
  ROUND(SUM(amount), 2)     AS total_amount,
  MIN(date)                  AS data_mais_antiga,
  MAX(date)                  AS data_mais_recente
FROM revenue
WHERE deleted_at IS NULL
GROUP BY status
ORDER BY status;

-- Somatório de despesas por status
SELECT
  'expenses' AS tabela,
  status,
  COUNT(*)                   AS qtd,
  ROUND(SUM(amount), 2)     AS total_amount
FROM expenses
WHERE deleted_at IS NULL
GROUP BY status
ORDER BY status;

-- Somatório de contas a pagar por status
SELECT
  'accounts_payable' AS tabela,
  status,
  COUNT(*)                   AS qtd,
  ROUND(SUM(amount), 2)     AS total_amount
FROM accounts_payable
WHERE deleted_at IS NULL
GROUP BY status
ORDER BY status;

-- Somatório de abastecimentos
SELECT
  'fuel_expenses' AS tabela,
  COUNT(*)                       AS qtd,
  ROUND(SUM(liters), 3)         AS total_liters,
  ROUND(SUM(total_amount), 2)   AS total_amount
FROM fuel_expenses
WHERE deleted_at IS NULL;

-- Viagens por status
SELECT
  'journeys' AS tabela,
  status,
  COUNT(*) AS qtd
FROM journeys
WHERE deleted_at IS NULL
GROUP BY status
ORDER BY status;

-- Veículos por status
SELECT
  'vehicles' AS tabela,
  status,
  COUNT(*) AS qtd
FROM vehicles
GROUP BY status
ORDER BY status;

-- Motoristas por status
SELECT
  'drivers' AS tabela,
  status,
  COUNT(*) AS qtd
FROM drivers
GROUP BY status
ORDER BY status;


-- =============================================================
-- SEÇÃO 5: VALIDAÇÃO DE FOREIGN KEYS (ORPHAN CHECK)
-- Verifica se há registros filhos com FK inválida.
-- =============================================================

-- journeys → vehicles
SELECT 'ORPHAN: journeys.vehicle_id sem vehicles' AS check_result, COUNT(*) AS cnt
FROM journeys j
WHERE j.vehicle_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM vehicles v WHERE v.id = j.vehicle_id);

-- journeys → drivers
SELECT 'ORPHAN: journeys.driver_id sem drivers' AS check_result, COUNT(*) AS cnt
FROM journeys j
WHERE j.driver_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM drivers d WHERE d.id = j.driver_id);

-- fuel_expenses → journeys
SELECT 'ORPHAN: fuel_expenses.journey_id sem journeys' AS check_result, COUNT(*) AS cnt
FROM fuel_expenses fe
WHERE fe.journey_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM journeys j WHERE j.id = fe.journey_id);

-- expenses → journeys
SELECT 'ORPHAN: expenses.journey_id sem journeys' AS check_result, COUNT(*) AS cnt
FROM expenses e
WHERE e.journey_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM journeys j WHERE j.id = e.journey_id);

-- revenue → journeys
SELECT 'ORPHAN: revenue.journey_id sem journeys' AS check_result, COUNT(*) AS cnt
FROM revenue r
WHERE r.journey_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM journeys j WHERE j.id = r.journey_id);

-- profiles → companies
SELECT 'ORPHAN: profiles.company_id sem companies' AS check_result, COUNT(*) AS cnt
FROM profiles p
WHERE p.company_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM companies c WHERE c.id = p.company_id);

-- user_roles → companies
SELECT 'ORPHAN: user_roles.company_id sem companies' AS check_result, COUNT(*) AS cnt
FROM user_roles ur
WHERE NOT EXISTS (SELECT 1 FROM companies c WHERE c.id = ur.company_id);

-- invoices → companies
SELECT 'ORPHAN: invoices.company_id sem companies' AS check_result, COUNT(*) AS cnt
FROM invoices i
WHERE NOT EXISTS (SELECT 1 FROM companies c WHERE c.id = i.company_id);

-- bank_reconciliations → bank_transactions
SELECT 'ORPHAN: bank_reconciliations sem bank_transactions' AS check_result, COUNT(*) AS cnt
FROM bank_reconciliations br
WHERE NOT EXISTS (SELECT 1 FROM bank_transactions bt WHERE bt.id = br.bank_transaction_id);


-- =============================================================
-- SEÇÃO 6: AMOSTRAS POR PK (verificação de integridade básica)
-- Executar estes SELECTs com IDs reais após migração.
-- Substitua <UUID_REAL> por IDs copiados do Postgres.
-- =============================================================

-- Exemplo: SELECT * FROM companies WHERE id = '<UUID_DA_EMPRESA>';
-- Exemplo: SELECT * FROM journeys  WHERE id = '<UUID_DA_VIAGEM>';
-- Exemplo: SELECT * FROM vehicles  WHERE plate = '<PLACA>';

-- Para checar uma amostra aleatória de 5 registros por tabela:
SELECT 'companies'  AS tabela, id, name,   cnpj,   status     FROM companies  ORDER BY RAND() LIMIT 5;
SELECT 'vehicles'   AS tabela, id, plate,  model,  status     FROM vehicles   ORDER BY RAND() LIMIT 5;
SELECT 'drivers'    AS tabela, id, name,   cpf,    status     FROM drivers    ORDER BY RAND() LIMIT 5;
SELECT 'journeys'   AS tabela, id, journey_number, status, freight_value FROM journeys ORDER BY RAND() LIMIT 5;
SELECT 'revenue'    AS tabela, id, amount, status, date       FROM revenue    ORDER BY RAND() LIMIT 5;
SELECT 'expenses'   AS tabela, id, amount, category, status  FROM expenses   ORDER BY RAND() LIMIT 5;
SELECT 'fuel_expenses' AS tabela, id, liters, total_amount, date FROM fuel_expenses ORDER BY RAND() LIMIT 5;


-- =============================================================
-- SEÇÃO 7: VALIDAÇÃO DE DADOS JSON
-- Verifica se colunas JSON têm conteúdo válido onde esperado.
-- =============================================================

-- subscription_plans.features deve ser um JSON array
SELECT COUNT(*) AS plans_with_invalid_features
FROM subscription_plans
WHERE features IS NOT NULL
  AND JSON_TYPE(features) != 'ARRAY';

-- system_settings.setting_value deve ser JSON válido
SELECT COUNT(*) AS settings_with_null_value
FROM system_settings
WHERE setting_value IS NULL;

-- audit_logs: old_values e new_values devem ser JSON ou NULL
SELECT COUNT(*) AS audit_logs_invalid_old_values
FROM audit_logs
WHERE old_values IS NOT NULL
  AND JSON_VALID(old_values) = 0;

-- cte_documents: cargo_info deve ser JSON ou NULL
SELECT COUNT(*) AS cte_invalid_cargo_info
FROM cte_documents
WHERE cargo_info IS NOT NULL
  AND JSON_VALID(cargo_info) = 0;

-- freight_requests: nfe_xml_data deve ser JSON ou NULL
SELECT COUNT(*) AS freight_req_invalid_nfe
FROM freight_requests
WHERE nfe_xml_data IS NOT NULL
  AND JSON_VALID(nfe_xml_data) = 0;


-- =============================================================
-- SEÇÃO 8: RELATÓRIO FINAL
-- =============================================================

SELECT
  'VERIFICAÇÃO CONCLUÍDA' AS status,
  NOW()                   AS timestamp_verificacao,
  @@version               AS mysql_version,
  DATABASE()              AS banco_atual;
