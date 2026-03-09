-- =====================================================
-- FASE 1: SOFT DELETE - Adicionar coluna deleted_at
-- =====================================================

-- Tabelas financeiras principais
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE revenue ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE fuel_expenses ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE journeys ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE vehicle_maintenances ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE accounts_payable ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE bank_transactions ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- =====================================================
-- ÍNDICES PARA PERFORMANCE (Soft Delete + Consultas)
-- =====================================================

-- Índices para filtrar registros não deletados
CREATE INDEX IF NOT EXISTS idx_expenses_not_deleted ON expenses(company_id, date) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_revenue_not_deleted ON revenue(company_id, date) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_fuel_expenses_not_deleted ON fuel_expenses(company_id, date) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_journeys_not_deleted ON journeys(company_id, created_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_maintenances_not_deleted ON vehicle_maintenances(company_id, service_date) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_accounts_payable_not_deleted ON accounts_payable(company_id, due_date) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_bank_transactions_not_deleted ON bank_transactions(company_id, transaction_date) WHERE deleted_at IS NULL;

-- Índices compostos para consultas de longo prazo (5 anos)
CREATE INDEX IF NOT EXISTS idx_expenses_company_date_amount ON expenses(company_id, date, amount) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_revenue_company_date_amount ON revenue(company_id, date, amount) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_fuel_company_vehicle_date ON fuel_expenses(company_id, vehicle_id, date) WHERE deleted_at IS NULL;