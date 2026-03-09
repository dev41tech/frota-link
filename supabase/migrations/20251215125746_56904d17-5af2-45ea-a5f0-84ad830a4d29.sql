-- Atualizar plano Starter para Controle
UPDATE subscription_plans 
SET 
  name = 'Controle',
  price_per_vehicle = 59.90,
  min_price = 0,
  monthly_price = 59.90,
  pricing_model = 'per_vehicle',
  vehicle_limit = 999,
  has_simulator = false,
  has_ai = false,
  has_copilot = false,
  has_pwa_driver = false,
  has_dedicated_support = false,
  features = '["Gestão básica de frota", "Relatórios essenciais", "CT-e e MDF-e", "Controle de despesas"]'::jsonb,
  is_active = true
WHERE id = '25b7b1d0-efe0-42e7-b1b0-7c0307eaafbb';

-- Atualizar plano Professional para Pro
UPDATE subscription_plans 
SET 
  name = 'Pro',
  price_per_vehicle = 79.90,
  min_price = 0,
  monthly_price = 79.90,
  pricing_model = 'per_vehicle',
  vehicle_limit = 999,
  has_simulator = true,
  has_ai = true,
  has_copilot = true,
  has_pwa_driver = false,
  has_dedicated_support = false,
  features = '["Tudo do Controle", "Simulador de Frete", "Assistente IA", "Copilot inteligente", "Relatórios avançados"]'::jsonb,
  is_active = true
WHERE id = '26605622-d824-4887-b892-0b2f5a25b471';

-- Atualizar plano Enterprise existente
UPDATE subscription_plans 
SET 
  name = 'Enterprise',
  price_per_vehicle = 89.90,
  min_price = 0,
  monthly_price = 89.90,
  pricing_model = 'per_vehicle',
  vehicle_limit = 999,
  has_simulator = true,
  has_ai = true,
  has_copilot = true,
  has_pwa_driver = true,
  has_dedicated_support = false,
  features = '["Tudo do Pro", "PWA Motorista completo", "Checklists digitais", "Geolocalização", "Chat motorista-central"]'::jsonb,
  is_active = true
WHERE id = '2a98e7b2-2b8e-4e58-8225-6468d1f69f9f';

-- Inserir novo plano Concierge
INSERT INTO subscription_plans (
  name, 
  price_per_vehicle, 
  min_price,
  monthly_price,
  pricing_model,
  vehicle_limit, 
  has_simulator, 
  has_ai, 
  has_copilot, 
  has_pwa_driver, 
  has_dedicated_support,
  features,
  is_active
) VALUES (
  'Concierge',
  170.00,
  170.00,
  170.00,
  'per_vehicle',
  999,
  true,
  true,
  true,
  true,
  true,
  '["Tudo do Enterprise", "Especialista humano dedicado", "Lançamentos gerenciados", "Suporte prioritário 24/7", "Onboarding personalizado"]'::jsonb,
  true
);