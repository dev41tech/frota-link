-- Adicionar campo is_ignored nas tabelas expenses e fuel_expenses
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS is_ignored BOOLEAN DEFAULT false;
ALTER TABLE fuel_expenses ADD COLUMN IF NOT EXISTS is_ignored BOOLEAN DEFAULT false;