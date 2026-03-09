-- Adicionar novas colunas para modelo de preço por placa
ALTER TABLE subscription_plans 
  ADD COLUMN IF NOT EXISTS price_per_vehicle numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pricing_model text DEFAULT 'per_vehicle',
  ADD COLUMN IF NOT EXISTS has_simulator boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_ai boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_copilot boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_pwa_driver boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_dedicated_support boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS min_price numeric DEFAULT 0;

-- Comentários para documentação
COMMENT ON COLUMN subscription_plans.price_per_vehicle IS 'Preço por placa/veículo';
COMMENT ON COLUMN subscription_plans.pricing_model IS 'Modelo de precificação: per_vehicle ou fixed';
COMMENT ON COLUMN subscription_plans.min_price IS 'Preço mínimo mensal (para planos com valor mínimo garantido)';
COMMENT ON COLUMN subscription_plans.has_simulator IS 'Acesso ao Simulador de Frete';
COMMENT ON COLUMN subscription_plans.has_ai IS 'Acesso ao Assistente IA';
COMMENT ON COLUMN subscription_plans.has_copilot IS 'Acesso ao Copilot flutuante';
COMMENT ON COLUMN subscription_plans.has_pwa_driver IS 'Acesso ao PWA do Motorista';
COMMENT ON COLUMN subscription_plans.has_dedicated_support IS 'Suporte humano dedicado';