-- Adicionar colunas para módulos adicionais (Add-ons)
ALTER TABLE companies
ADD COLUMN IF NOT EXISTS cte_module_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS cte_monthly_limit INTEGER,
ADD COLUMN IF NOT EXISTS coupling_module_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS coupling_asset_limit INTEGER;

-- Comentários para documentação
COMMENT ON COLUMN companies.cte_module_enabled IS 'Habilita o módulo de emissão de CT-e';
COMMENT ON COLUMN companies.cte_monthly_limit IS 'Limite mensal de emissões de CT-e';
COMMENT ON COLUMN companies.coupling_module_enabled IS 'Habilita o módulo de gestão de engates';
COMMENT ON COLUMN companies.coupling_asset_limit IS 'Limite de engates/reboques permitidos';