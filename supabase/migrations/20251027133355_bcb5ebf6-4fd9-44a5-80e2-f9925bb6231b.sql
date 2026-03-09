-- Criar índices para melhorar performance das queries de alertas
CREATE INDEX IF NOT EXISTS idx_vehicles_company_status ON vehicles(company_id, status);
CREATE INDEX IF NOT EXISTS idx_fuel_expenses_vehicle_date ON fuel_expenses(vehicle_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_system_alerts_company_status ON system_alerts(company_id, status, created_at DESC);