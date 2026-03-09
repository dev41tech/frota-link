-- ============================================
-- SEED DATA: Ambiente de Demonstração TransLog
-- ============================================

-- 1. Criar empresa DEMO
INSERT INTO public.companies (
  id, name, cnpj, responsible_name, responsible_cpf, address, city, state, zip_code,
  phone, email, status, subscription_status, vehicle_limit
) VALUES (
  '00000000-0000-0000-0000-000000000001', 'TransLog Demonstração LTDA', '00.000.000/0001-99',
  'João Silva Demonstração', '000.000.000-00', 'Rua das Flores, 123', 'São Paulo', 'SP', '01234-567',
  '(11) 98765-4321', 'demo@translog.com.br', 'active', 'active', 10
) ON CONFLICT (id) DO NOTHING;

-- 2. Criar veículos DEMO
INSERT INTO public.vehicles (
  id, company_id, user_id, plate, brand, model, year, chassis, renavam, fuel_type,
  tank_capacity, avg_consumption, status, purchase_date, purchase_value, current_value,
  insurance_company, insurance_policy, insurance_expiry
) VALUES
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '0a0af510-f15c-4983-a961-d912d823f91d',
   'ABC-1234', 'Scania', 'R450 6x2', 2022, '9BSC4X2P0NR123456', '12345678901', 'diesel',
   500, 2.5, 'active', '2022-01-15', 450000, 380000, 'Porto Seguro', 'PS-2024-789456', '2025-06-30'),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', '0a0af510-f15c-4983-a961-d912d823f91d',
   'DEF-5678', 'Mercedes-Benz', 'Actros 2646', 2021, '9BM9842646R654321', '98765432109', 'diesel',
   600, 2.8, 'active', '2021-03-20', 520000, 420000, 'Azul Seguros', 'AZ-2024-456789', '2025-08-15'),
  ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', '0a0af510-f15c-4983-a961-d912d823f91d',
   'GHI-9012', 'Volvo', 'FH 540 6x4', 2023, '9BVF54006P5789012', '45678912345', 'diesel',
   550, 2.3, 'active', '2023-05-10', 580000, 550000, 'Liberty Seguros', 'LB-2024-123456', '2025-10-20'),
  ('10000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', '0a0af510-f15c-4983-a961-d912d823f91d',
   'JKL-3456', 'Iveco', 'Stralis 570', 2020, '9BIV5700KR123789', '78945612378', 'diesel',
   580, 3.0, 'maintenance', '2020-07-05', 480000, 350000, 'Mapfre', 'MP-2024-789123', '2025-12-31'),
  ('10000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', '0a0af510-f15c-4983-a961-d912d823f91d',
   'MNO-7890', 'DAF', 'XF 480 FT', 2022, '9BDF4800NR456123', '32165498732', 'diesel',
   520, 2.6, 'active', '2022-09-12', 510000, 460000, 'HDI Seguros', 'HD-2024-654321', '2025-11-10')
ON CONFLICT (id) DO NOTHING;

-- 3. Criar motoristas DEMO
INSERT INTO public.drivers (
  id, company_id, user_id, name, cpf, cnh, cnh_category, cnh_expiry,
  phone, email, address, emergency_contact, emergency_phone, status
) VALUES
  ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '0a0af510-f15c-4983-a961-d912d823f91d',
   'Carlos Alberto Santos', '123.456.789-01', '12345678901', 'E', '2026-03-15',
   '(11) 99876-5432', 'carlos.santos@demo.com', 'Rua A, 100 - São Paulo/SP',
   'Maria Santos', '(11) 98765-4321', 'active'),
  ('20000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', '0a0af510-f15c-4983-a961-d912d823f91d',
   'Roberto Oliveira', '234.567.890-12', '23456789012', 'D', '2025-08-20',
   '(11) 99765-4321', 'roberto.oliveira@demo.com', 'Rua B, 200 - Guarulhos/SP',
   'Ana Oliveira', '(11) 98654-3210', 'active'),
  ('20000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', '0a0af510-f15c-4983-a961-d912d823f91d',
   'Fernando Costa', '345.678.901-23', '34567890123', 'E', '2026-12-10',
   '(11) 99654-3210', 'fernando.costa@demo.com', 'Rua C, 300 - Osasco/SP',
   'Juliana Costa', '(11) 98543-2109', 'active'),
  ('20000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', '0a0af510-f15c-4983-a961-d912d823f91d',
   'Pedro Henrique Lima', '456.789.012-34', '45678901234', 'E', '2027-02-28',
   '(11) 99543-2109', 'pedro.lima@demo.com', 'Rua D, 400 - Barueri/SP',
   'Carla Lima', '(11) 98432-1098', 'active')
ON CONFLICT (id) DO NOTHING;

-- 4. Criar viagens DEMO
INSERT INTO public.journeys (
  id, company_id, user_id, journey_number, vehicle_id, driver_id, origin, destination,
  status, distance, freight_value, commission_percentage, commission_value, advance_value,
  start_date, end_date, start_km, end_km
) VALUES
  ('30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '0a0af510-f15c-4983-a961-d912d823f91d',
   'VG-2025-001', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001',
   'São Paulo/SP', 'Rio de Janeiro/RJ', 'completed', 450, 8500, 10, 850, 2000,
   '2025-01-05 08:00:00', '2025-01-06 18:00:00', 125000, 125450),
  ('30000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', '0a0af510-f15c-4983-a961-d912d823f91d',
   'VG-2025-002', '10000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002',
   'São Paulo/SP', 'Belo Horizonte/MG', 'completed', 586, 10200, 10, 1020, 2500,
   '2025-01-10 06:00:00', '2025-01-11 20:00:00', 98000, 98586),
  ('30000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', '0a0af510-f15c-4983-a961-d912d823f91d',
   'VG-2025-003', '10000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000003',
   'Curitiba/PR', 'Florianópolis/SC', 'completed', 300, 6800, 10, 680, 1500,
   '2025-01-15 07:00:00', '2025-01-16 15:00:00', 45000, 45300),
  ('30000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', '0a0af510-f15c-4983-a961-d912d823f91d',
   'VG-2025-004', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001',
   'São Paulo/SP', 'Salvador/BA', 'in_progress', 1960, 28000, 10, 2800, 5000,
   '2025-10-14 05:00:00', NULL, 125450, NULL),
  ('30000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', '0a0af510-f15c-4983-a961-d912d823f91d',
   'VG-2025-005', '10000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000004',
   'Porto Alegre/RS', 'Brasília/DF', 'in_progress', 2027, 32000, 10, 3200, 6000,
   '2025-10-13 06:00:00', NULL, 87000, NULL),
  ('30000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000001', '0a0af510-f15c-4983-a961-d912d823f91d',
   'VG-2025-006', '10000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002',
   'São Paulo/SP', 'Recife/PE', 'planned', 2660, 38000, 10, 3800, 7000,
   '2025-10-20 04:00:00', NULL, NULL, NULL),
  ('30000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000001', '0a0af510-f15c-4983-a961-d912d823f91d',
   'VG-2025-007', '10000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000003',
   'Campinas/SP', 'Manaus/AM', 'planned', 3800, 52000, 10, 5200, 10000,
   '2025-10-25 03:00:00', NULL, NULL, NULL),
  ('30000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000001', '0a0af510-f15c-4983-a961-d912d823f91d',
   'VG-2025-008', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001',
   'São Paulo/SP', 'Curitiba/PR', 'completed', 408, 7200, 10, 720, 1800,
   '2025-02-01 07:00:00', '2025-02-02 16:00:00', 125900, 126308)
ON CONFLICT (id) DO NOTHING;

-- 5. Criar abastecimentos DEMO
INSERT INTO public.fuel_expenses (
  id, company_id, user_id, vehicle_id, journey_id, date, liters, price_per_liter,
  total_amount, odometer, payment_method, receipt_number
) VALUES
  ('40000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '0a0af510-f15c-4983-a961-d912d823f91d',
   '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001',
   '2025-01-05 14:00:00', 180, 5.89, 1060.20, 125225, 'card', 'AB-12345'),
  ('40000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', '0a0af510-f15c-4983-a961-d912d823f91d',
   '10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000002',
   '2025-01-10 16:00:00', 210, 5.92, 1243.20, 98293, 'card', 'CD-23456')
ON CONFLICT (id) DO NOTHING;

-- 6. Criar despesas DEMO (com categorias válidas: fuel, maintenance, toll, food, other)
INSERT INTO public.expenses (
  id, company_id, user_id, category, description, amount, date, vehicle_id,
  journey_id, payment_method, status, receipt_number
) VALUES
  ('50000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '0a0af510-f15c-4983-a961-d912d823f91d',
   'maintenance', 'Troca de óleo e filtros', 850.00, '2025-01-08 10:00:00',
   '10000000-0000-0000-0000-000000000001', NULL, 'bank_transfer', 'paid', 'NF-11111'),
  ('50000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', '0a0af510-f15c-4983-a961-d912d823f91d',
   'toll', 'Pedágios viagem RJ', 340.50, '2025-01-05 15:00:00',
   '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'cash', 'paid', NULL),
  ('50000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', '0a0af510-f15c-4983-a961-d912d823f91d',
   'maintenance', 'Substituição de pneus', 4200.00, '2025-02-10 14:00:00',
   '10000000-0000-0000-0000-000000000002', NULL, 'bank_transfer', 'paid', 'NF-22222')
ON CONFLICT (id) DO NOTHING;

-- 7. Criar receitas DEMO
INSERT INTO public.revenue (
  id, company_id, user_id, journey_id, description, amount, date, client,
  invoice_number, payment_method, status
) VALUES
  ('60000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '0a0af510-f15c-4983-a961-d912d823f91d',
   '30000000-0000-0000-0000-000000000001', 'Frete São Paulo - Rio de Janeiro', 8500.00,
   '2025-01-07 10:00:00', 'Empresa ABC Logística', 'NF-001/2025', 'bank_transfer', 'received'),
  ('60000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', '0a0af510-f15c-4983-a961-d912d823f91d',
   '30000000-0000-0000-0000-000000000002', 'Frete São Paulo - Belo Horizonte', 10200.00,
   '2025-01-12 14:00:00', 'Distribuidora XYZ LTDA', 'NF-002/2025', 'bank_transfer', 'received')
ON CONFLICT (id) DO NOTHING;

-- 8. Criar contas a pagar DEMO
INSERT INTO public.accounts_payable (
  id, company_id, user_id, category, description, supplier, amount, due_date,
  payment_date, status, payment_method
) VALUES
  ('70000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '0a0af510-f15c-4983-a961-d912d823f91d',
   'insurance', 'Seguro mensal frota', 'Porto Seguro', 3200.00,
   '2025-01-10', '2025-01-08', 'paid', 'bank_transfer'),
  ('70000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', '0a0af510-f15c-4983-a961-d912d823f91d',
   'salary', 'Salário motoristas Janeiro', 'Folha de Pagamento', 12000.00,
   '2025-02-05', '2025-02-05', 'paid', 'bank_transfer'),
  ('70000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', '0a0af510-f15c-4983-a961-d912d823f91d',
   'maintenance', 'Manutenção preventiva frota', 'Oficina Truck Center', 5600.00,
   '2025-10-20', NULL, 'pending', NULL)
ON CONFLICT (id) DO NOTHING;