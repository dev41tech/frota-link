-- Adicionar role 'driver' ao enum se não existir
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'app_role' AND e.enumlabel = 'driver') THEN
    ALTER TYPE app_role ADD VALUE 'driver';
  END IF;
END $$;

-- Adicionar user_id aos motoristas para vincular com autenticação
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS auth_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Criar índice para melhor performance
CREATE INDEX IF NOT EXISTS idx_drivers_auth_user_id ON drivers(auth_user_id);

-- Criar tabela de vinculação motorista-veículo (um motorista pode ter várias placas)
CREATE TABLE IF NOT EXISTS driver_vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
  vehicle_id uuid NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  assigned_at timestamp with time zone DEFAULT now(),
  assigned_by uuid REFERENCES auth.users(id),
  status text DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(driver_id, vehicle_id)
);

-- Habilitar RLS na tabela driver_vehicles
ALTER TABLE driver_vehicles ENABLE ROW LEVEL SECURITY;

-- Policy para motoristas verem apenas seus veículos
CREATE POLICY "Drivers can view their assigned vehicles"
ON driver_vehicles FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM drivers d
    WHERE d.id = driver_vehicles.driver_id
    AND d.auth_user_id = auth.uid()
  )
);

-- Policy para admins gerenciarem vinculações
CREATE POLICY "Admins can manage driver-vehicle assignments"
ON driver_vehicles FOR ALL
USING (user_has_company_access(auth.uid(), company_id));

-- Bloquear acesso anônimo
CREATE POLICY "Block anonymous access to driver_vehicles"
ON driver_vehicles FOR ALL
USING (false)
WITH CHECK (false);

-- Adicionar status de fechamento em journeys
ALTER TABLE journeys ADD COLUMN IF NOT EXISTS closure_requested_at timestamp with time zone;
ALTER TABLE journeys ADD COLUMN IF NOT EXISTS closure_requested_by uuid REFERENCES auth.users(id);
ALTER TABLE journeys ADD COLUMN IF NOT EXISTS closed_at timestamp with time zone;
ALTER TABLE journeys ADD COLUMN IF NOT EXISTS closed_by uuid REFERENCES auth.users(id);
ALTER TABLE journeys ADD COLUMN IF NOT EXISTS closure_notes text;

-- Atualizar RLS para motoristas verem apenas suas jornadas
CREATE POLICY "Drivers can view their own journeys"
ON journeys FOR SELECT
USING (
  user_has_company_access(auth.uid(), company_id) OR
  EXISTS (
    SELECT 1 FROM drivers d
    WHERE d.id = journeys.driver_id
    AND d.auth_user_id = auth.uid()
  )
);

-- Motoristas podem atualizar status de suas jornadas (solicitar fechamento)
CREATE POLICY "Drivers can update their journey status"
ON journeys FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM drivers d
    WHERE d.id = journeys.driver_id
    AND d.auth_user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM drivers d
    WHERE d.id = journeys.driver_id
    AND d.auth_user_id = auth.uid()
  )
);

-- Motoristas podem inserir lançamentos apenas para suas jornadas e veículos
CREATE POLICY "Drivers can insert fuel expenses for their vehicles"
ON fuel_expenses FOR INSERT
WITH CHECK (
  user_has_company_access(auth.uid(), company_id) OR
  (
    EXISTS (
      SELECT 1 FROM driver_vehicles dv
      JOIN drivers d ON d.id = dv.driver_id
      WHERE dv.vehicle_id = fuel_expenses.vehicle_id
      AND d.auth_user_id = auth.uid()
      AND dv.status = 'active'
    )
  )
);

CREATE POLICY "Drivers can view fuel expenses for their vehicles"
ON fuel_expenses FOR SELECT
USING (
  user_has_company_access(auth.uid(), company_id) OR
  (
    EXISTS (
      SELECT 1 FROM driver_vehicles dv
      JOIN drivers d ON d.id = dv.driver_id
      WHERE dv.vehicle_id = fuel_expenses.vehicle_id
      AND d.auth_user_id = auth.uid()
    )
  )
);

-- Same for expenses
CREATE POLICY "Drivers can insert expenses for their vehicles"
ON expenses FOR INSERT
WITH CHECK (
  user_has_company_access(auth.uid(), company_id) OR
  (
    vehicle_id IS NULL OR
    EXISTS (
      SELECT 1 FROM driver_vehicles dv
      JOIN drivers d ON d.id = dv.driver_id
      WHERE dv.vehicle_id = expenses.vehicle_id
      AND d.auth_user_id = auth.uid()
      AND dv.status = 'active'
    )
  )
);

CREATE POLICY "Drivers can view expenses for their vehicles"
ON expenses FOR SELECT
USING (
  user_has_company_access(auth.uid(), company_id) OR
  (
    vehicle_id IS NULL OR
    EXISTS (
      SELECT 1 FROM driver_vehicles dv
      JOIN drivers d ON d.id = dv.driver_id
      WHERE dv.vehicle_id = expenses.vehicle_id
      AND d.auth_user_id = auth.uid()
    )
  )
);

-- Função para verificar se usuário é motorista
CREATE OR REPLACE FUNCTION is_driver_user(user_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM drivers
    WHERE auth_user_id = user_uuid
  );
$$;

-- Função para obter driver_id do usuário autenticado
CREATE OR REPLACE FUNCTION get_driver_id(user_uuid uuid)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM drivers
  WHERE auth_user_id = user_uuid
  LIMIT 1;
$$;

-- Trigger para atualizar updated_at
CREATE TRIGGER update_driver_vehicles_updated_at
BEFORE UPDATE ON driver_vehicles
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();