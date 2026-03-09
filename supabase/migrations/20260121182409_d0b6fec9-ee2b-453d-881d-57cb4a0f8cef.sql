-- Add vehicle type column to vehicles table
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS vehicle_type text DEFAULT 'truck';
-- Values: 'truck' (Cavalo), 'trailer' (Carreta), 'rigid' (Caminhão Comum)

-- Add trailer-specific columns
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS trailer_type text;
-- For trailers: 'bau', 'graneleira', 'sider', 'tanque', 'cegonha', 'prancha', 'container'

ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS axle_count integer;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS load_capacity numeric;

-- Create vehicle_couplings table (tracks truck + trailer combinations)
CREATE TABLE IF NOT EXISTS vehicle_couplings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  truck_id uuid NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  coupling_type text NOT NULL DEFAULT 'simple', -- 'simple', 'bitrem', 'rodotrem'
  coupled_at timestamp with time zone NOT NULL DEFAULT now(),
  decoupled_at timestamp with time zone, -- NULL = still coupled
  coupled_by uuid REFERENCES auth.users(id),
  decoupled_by uuid REFERENCES auth.users(id),
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create vehicle_coupling_items table (individual trailers in a coupling)
CREATE TABLE IF NOT EXISTS vehicle_coupling_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coupling_id uuid NOT NULL REFERENCES vehicle_couplings(id) ON DELETE CASCADE,
  trailer_id uuid NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 1, -- 1 = first trailer, 2 = second (bitrem/rodotrem)
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE vehicle_couplings ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_coupling_items ENABLE ROW LEVEL SECURITY;

-- Block anonymous access to vehicle_couplings
CREATE POLICY "Block anonymous access to vehicle_couplings"
ON vehicle_couplings FOR ALL
USING (false)
WITH CHECK (false);

-- Users can manage couplings in their company
CREATE POLICY "Users can manage couplings in their company"
ON vehicle_couplings FOR ALL
USING (user_has_company_access(auth.uid(), company_id))
WITH CHECK (user_has_company_access(auth.uid(), company_id));

-- Block anonymous access to vehicle_coupling_items
CREATE POLICY "Block anonymous access to vehicle_coupling_items"
ON vehicle_coupling_items FOR ALL
USING (false)
WITH CHECK (false);

-- Users can manage coupling items via company access
CREATE POLICY "Users can manage coupling items via company"
ON vehicle_coupling_items FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM vehicle_couplings vc 
    WHERE vc.id = vehicle_coupling_items.coupling_id 
    AND user_has_company_access(auth.uid(), vc.company_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM vehicle_couplings vc 
    WHERE vc.id = vehicle_coupling_items.coupling_id 
    AND user_has_company_access(auth.uid(), vc.company_id)
  )
);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_vehicle_couplings_company ON vehicle_couplings(company_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_couplings_truck ON vehicle_couplings(truck_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_couplings_active ON vehicle_couplings(truck_id) WHERE decoupled_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_vehicle_coupling_items_coupling ON vehicle_coupling_items(coupling_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_coupling_items_trailer ON vehicle_coupling_items(trailer_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_type ON vehicles(vehicle_type);
CREATE INDEX IF NOT EXISTS idx_vehicles_company_type ON vehicles(company_id, vehicle_type);