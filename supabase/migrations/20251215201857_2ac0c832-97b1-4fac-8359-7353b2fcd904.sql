-- Adicionar coluna has_geolocation à tabela subscription_plans
ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS has_geolocation BOOLEAN DEFAULT false;

-- Atualizar planos: Pro, Enterprise e Concierge têm geolocalização
UPDATE subscription_plans SET has_geolocation = true WHERE name IN ('Pro', 'Enterprise', 'Concierge');

-- Controle não tem geolocalização
UPDATE subscription_plans SET has_geolocation = false WHERE name = 'Controle';