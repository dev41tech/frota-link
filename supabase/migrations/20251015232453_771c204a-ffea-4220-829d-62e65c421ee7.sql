-- Adicionar despesas realistas ao ambiente DEMO (36 registros)
-- Categorias válidas: maintenance, insurance, tax, toll, parking, food, accommodation, fuel, other

-- CATEGORIA: MAINTENANCE (R$ 6.850,00)
INSERT INTO expenses (company_id, user_id, vehicle_id, category, description, amount, date, payment_method, status, notes) VALUES
('00000000-0000-0000-0000-000000000001', 'aab69731-85bf-49e8-9c8d-be19e648dcf8', '10000000-0000-0000-0000-000000000001', 'maintenance', 'Revisão 10.000 km - ABC-1234', 1200.00, '2025-01-15 10:00:00', 'bank_transfer', 'paid', 'Revisão preventiva completa'),
('00000000-0000-0000-0000-000000000001', 'aab69731-85bf-49e8-9c8d-be19e648dcf8', '10000000-0000-0000-0000-000000000003', 'maintenance', 'Troca de pastilhas de freio - GHI-9012', 850.00, '2025-01-18 14:30:00', 'card', 'paid', 'Freio dianteiro e traseiro'),
('00000000-0000-0000-0000-000000000001', 'aab69731-85bf-49e8-9c8d-be19e648dcf8', '10000000-0000-0000-0000-000000000005', 'maintenance', 'Troca de correia dentada - MNO-7890', 980.00, '2025-01-22 09:15:00', 'bank_transfer', 'paid', 'Incluindo tensor e bomba'),
('00000000-0000-0000-0000-000000000001', 'aab69731-85bf-49e8-9c8d-be19e648dcf8', '10000000-0000-0000-0000-000000000002', 'maintenance', 'Revisão 20.000 km - DEF-5678', 1600.00, '2025-02-05 11:00:00', 'bank_transfer', 'paid', 'Revisão completa com troca de filtros'),
('00000000-0000-0000-0000-000000000001', 'aab69731-85bf-49e8-9c8d-be19e648dcf8', '10000000-0000-0000-0000-000000000001', 'maintenance', 'Alinhamento e balanceamento - ABC-1234', 420.00, '2025-02-12 15:30:00', 'cash', 'paid', 'Após viagem de longa distância'),
('00000000-0000-0000-0000-000000000001', 'aab69731-85bf-49e8-9c8d-be19e648dcf8', '10000000-0000-0000-0000-000000000004', 'maintenance', 'Troca de bateria - JKL-3456', 890.00, '2025-02-18 08:45:00', 'card', 'paid', 'Bateria 150ah'),
('00000000-0000-0000-0000-000000000001', 'aab69731-85bf-49e8-9c8d-be19e648dcf8', '10000000-0000-0000-0000-000000000003', 'maintenance', 'Limpeza de tanque diesel - GHI-9012', 910.00, '2025-01-28 10:20:00', 'bank_transfer', 'paid', 'Remoção de impurezas');

-- CATEGORIA: TOLL (R$ 2.890,50)
INSERT INTO expenses (company_id, user_id, journey_id, category, description, amount, date, payment_method, status, notes) VALUES
('00000000-0000-0000-0000-000000000001', 'aab69731-85bf-49e8-9c8d-be19e648dcf8', '30000000-0000-0000-0000-000000000002', 'toll', 'Pedágios viagem VG-2025-002 (BH)', 285.00, '2025-01-12 00:00:00', 'card', 'paid', 'Via Dutra e Fernão Dias'),
('00000000-0000-0000-0000-000000000001', 'aab69731-85bf-49e8-9c8d-be19e648dcf8', '30000000-0000-0000-0000-000000000003', 'toll', 'Pedágios viagem VG-2025-003 (Floripa)', 412.50, '2025-01-14 00:00:00', 'card', 'paid', 'BR-116 e BR-101'),
('00000000-0000-0000-0000-000000000001', 'aab69731-85bf-49e8-9c8d-be19e648dcf8', '30000000-0000-0000-0000-000000000004', 'toll', 'Pedágios viagem VG-2025-004 (Salvador)', 678.00, '2025-10-02 00:00:00', 'card', 'pending', 'Viagem em andamento'),
('00000000-0000-0000-0000-000000000001', 'aab69731-85bf-49e8-9c8d-be19e648dcf8', '30000000-0000-0000-0000-000000000005', 'toll', 'Pedágios viagem VG-2025-005 (Brasília)', 395.00, '2025-10-03 00:00:00', 'card', 'pending', 'Viagem em andamento'),
('00000000-0000-0000-0000-000000000001', 'aab69731-85bf-49e8-9c8d-be19e648dcf8', '30000000-0000-0000-0000-000000000008', 'toll', 'Pedágios viagem VG-2025-008 (Curitiba)', 178.00, '2025-02-08 00:00:00', 'card', 'paid', 'Via Régis Bittencourt'),
('00000000-0000-0000-0000-000000000001', 'aab69731-85bf-49e8-9c8d-be19e648dcf8', NULL, 'toll', 'Pedágios extras - diversos', 942.00, '2025-01-30 00:00:00', 'card', 'paid', 'Acumulado Jan-Out');

-- CATEGORIA: FOOD (R$ 2.640,00)
INSERT INTO expenses (company_id, user_id, journey_id, category, description, amount, date, payment_method, status, notes) VALUES
('00000000-0000-0000-0000-000000000001', 'aab69731-85bf-49e8-9c8d-be19e648dcf8', '30000000-0000-0000-0000-000000000001', 'food', 'Alimentação motorista - VG-2025-001', 280.00, '2025-01-10 00:00:00', 'cash', 'paid', 'Viagem Rio de Janeiro'),
('00000000-0000-0000-0000-000000000001', 'aab69731-85bf-49e8-9c8d-be19e648dcf8', '30000000-0000-0000-0000-000000000002', 'food', 'Alimentação motorista - VG-2025-002', 320.00, '2025-01-12 00:00:00', 'cash', 'paid', 'Viagem Belo Horizonte'),
('00000000-0000-0000-0000-000000000001', 'aab69731-85bf-49e8-9c8d-be19e648dcf8', '30000000-0000-0000-0000-000000000003', 'food', 'Alimentação motorista - VG-2025-003', 420.00, '2025-01-14 00:00:00', 'cash', 'paid', 'Viagem Florianópolis'),
('00000000-0000-0000-0000-000000000001', 'aab69731-85bf-49e8-9c8d-be19e648dcf8', '30000000-0000-0000-0000-000000000004', 'food', 'Alimentação motorista - VG-2025-004', 560.00, '2025-10-02 00:00:00', 'cash', 'pending', 'Viagem Salvador'),
('00000000-0000-0000-0000-000000000001', 'aab69731-85bf-49e8-9c8d-be19e648dcf8', '30000000-0000-0000-0000-000000000005', 'food', 'Alimentação motorista - VG-2025-005', 380.00, '2025-10-03 00:00:00', 'cash', 'pending', 'Viagem Brasília'),
('00000000-0000-0000-0000-000000000001', 'aab69731-85bf-49e8-9c8d-be19e648dcf8', '30000000-0000-0000-0000-000000000008', 'food', 'Alimentação motorista - VG-2025-008', 290.00, '2025-02-08 00:00:00', 'cash', 'paid', 'Viagem Curitiba'),
('00000000-0000-0000-0000-000000000001', 'aab69731-85bf-49e8-9c8d-be19e648dcf8', NULL, 'food', 'Vale refeição extra', 390.00, '2025-02-15 00:00:00', 'card', 'paid', 'Diversos motoristas');

-- CATEGORIA: ACCOMMODATION (R$ 1.890,00)
INSERT INTO expenses (company_id, user_id, journey_id, category, description, amount, date, payment_method, status, notes) VALUES
('00000000-0000-0000-0000-000000000001', 'aab69731-85bf-49e8-9c8d-be19e648dcf8', '30000000-0000-0000-0000-000000000001', 'accommodation', 'Hotel viagem VG-2025-001', 240.00, '2025-01-10 00:00:00', 'card', 'paid', '2 diárias - Rio de Janeiro'),
('00000000-0000-0000-0000-000000000001', 'aab69731-85bf-49e8-9c8d-be19e648dcf8', '30000000-0000-0000-0000-000000000003', 'accommodation', 'Hotel viagem VG-2025-003', 360.00, '2025-01-14 00:00:00', 'card', 'paid', '3 diárias - Florianópolis'),
('00000000-0000-0000-0000-000000000001', 'aab69731-85bf-49e8-9c8d-be19e648dcf8', '30000000-0000-0000-0000-000000000004', 'accommodation', 'Hotel viagem VG-2025-004', 720.00, '2025-10-02 00:00:00', 'card', 'pending', '6 diárias - Salvador'),
('00000000-0000-0000-0000-000000000001', 'aab69731-85bf-49e8-9c8d-be19e648dcf8', '30000000-0000-0000-0000-000000000005', 'accommodation', 'Hotel viagem VG-2025-005', 480.00, '2025-10-03 00:00:00', 'card', 'pending', '4 diárias - Brasília'),
('00000000-0000-0000-0000-000000000001', 'aab69731-85bf-49e8-9c8d-be19e648dcf8', NULL, 'accommodation', 'Pernoite emergencial', 90.00, '2025-01-20 00:00:00', 'cash', 'paid', 'Emergência na estrada');

-- CATEGORIA: INSURANCE (R$ 2.450,00)
INSERT INTO expenses (company_id, user_id, category, description, amount, date, payment_method, status, notes) VALUES
('00000000-0000-0000-0000-000000000001', 'aab69731-85bf-49e8-9c8d-be19e648dcf8', 'insurance', 'Seguro de carga - Janeiro', 890.00, '2025-01-05 00:00:00', 'bank_transfer', 'paid', 'Seguro mensal de carga'),
('00000000-0000-0000-0000-000000000001', 'aab69731-85bf-49e8-9c8d-be19e648dcf8', 'insurance', 'Seguro de carga - Fevereiro', 890.00, '2025-02-05 00:00:00', 'bank_transfer', 'paid', 'Seguro mensal de carga'),
('00000000-0000-0000-0000-000000000001', 'aab69731-85bf-49e8-9c8d-be19e648dcf8', 'insurance', 'DPVAT 2025 - ABC-1234', 178.00, '2025-01-08 00:00:00', 'card', 'paid', 'Seguro obrigatório'),
('00000000-0000-0000-0000-000000000001', 'aab69731-85bf-49e8-9c8d-be19e648dcf8', 'insurance', 'DPVAT 2025 - DEF-5678', 178.00, '2025-01-08 00:00:00', 'card', 'paid', 'Seguro obrigatório'),
('00000000-0000-0000-0000-000000000001', 'aab69731-85bf-49e8-9c8d-be19e648dcf8', 'insurance', 'DPVAT 2025 - GHI-9012', 178.00, '2025-02-10 00:00:00', 'card', 'paid', 'Seguro obrigatório'),
('00000000-0000-0000-0000-000000000001', 'aab69731-85bf-49e8-9c8d-be19e648dcf8', 'insurance', 'DPVAT 2025 - MNO-7890', 136.00, '2025-01-08 00:00:00', 'card', 'paid', 'Seguro obrigatório');

-- CATEGORIA: TAX (R$ 1.280,00)
INSERT INTO expenses (company_id, user_id, vehicle_id, category, description, amount, date, payment_method, status, notes) VALUES
('00000000-0000-0000-0000-000000000001', 'aab69731-85bf-49e8-9c8d-be19e648dcf8', '10000000-0000-0000-0000-000000000001', 'tax', 'Licenciamento anual 2025 - ABC-1234', 340.00, '2025-01-10 00:00:00', 'card', 'paid', 'IPVA + Taxa + DPVAT'),
('00000000-0000-0000-0000-000000000001', 'aab69731-85bf-49e8-9c8d-be19e648dcf8', '10000000-0000-0000-0000-000000000002', 'tax', 'Licenciamento anual 2025 - DEF-5678', 380.00, '2025-01-10 00:00:00', 'card', 'paid', 'IPVA + Taxa + DPVAT'),
('00000000-0000-0000-0000-000000000001', 'aab69731-85bf-49e8-9c8d-be19e648dcf8', '10000000-0000-0000-0000-000000000003', 'tax', 'Licenciamento anual 2025 - GHI-9012', 320.00, '2025-02-10 00:00:00', 'card', 'paid', 'IPVA + Taxa + DPVAT'),
('00000000-0000-0000-0000-000000000001', 'aab69731-85bf-49e8-9c8d-be19e648dcf8', '10000000-0000-0000-0000-000000000005', 'tax', 'Licenciamento anual 2025 - MNO-7890', 240.00, '2025-01-10 00:00:00', 'card', 'paid', 'IPVA + Taxa + DPVAT');

-- CATEGORIA: OTHER (R$ 500,00)
INSERT INTO expenses (company_id, user_id, vehicle_id, category, description, amount, date, payment_method, status, notes) VALUES
('00000000-0000-0000-0000-000000000001', 'aab69731-85bf-49e8-9c8d-be19e648dcf8', '10000000-0000-0000-0000-000000000001', 'other', 'Multa de trânsito - ABC-1234', 195.00, '2025-01-25 00:00:00', 'card', 'paid', 'Excesso de velocidade'),
('00000000-0000-0000-0000-000000000001', 'aab69731-85bf-49e8-9c8d-be19e648dcf8', NULL, 'other', 'Lavagem completa - 3 veículos', 180.00, '2025-01-18 00:00:00', 'cash', 'paid', 'Manutenção estética'),
('00000000-0000-0000-0000-000000000001', 'aab69731-85bf-49e8-9c8d-be19e648dcf8', NULL, 'parking', 'Taxas de estacionamento', 125.00, '2025-02-05 00:00:00', 'cash', 'paid', 'Diversos locais');