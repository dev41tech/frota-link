-- Add coupling_id to journeys table
ALTER TABLE journeys 
ADD COLUMN IF NOT EXISTS coupling_id uuid REFERENCES vehicle_couplings(id) ON DELETE SET NULL;

-- Create saved_couplings table for reusable templates
CREATE TABLE IF NOT EXISTS saved_couplings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  truck_id uuid NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  coupling_type text NOT NULL CHECK (coupling_type IN ('simple', 'bitrem', 'rodotrem')),
  trailer_ids uuid[] NOT NULL,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  is_active boolean DEFAULT true
);

-- Enable RLS
ALTER TABLE saved_couplings ENABLE ROW LEVEL SECURITY;

-- RLS policies for saved_couplings
CREATE POLICY "Block anonymous access to saved_couplings"
ON saved_couplings AS RESTRICTIVE FOR ALL
USING (false)
WITH CHECK (false);

CREATE POLICY "Users can manage saved_couplings in their company"
ON saved_couplings AS RESTRICTIVE FOR ALL
USING (user_has_company_access(auth.uid(), company_id))
WITH CHECK (user_has_company_access(auth.uid(), company_id));

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_saved_couplings_company ON saved_couplings(company_id);
CREATE INDEX IF NOT EXISTS idx_saved_couplings_truck ON saved_couplings(truck_id);
CREATE INDEX IF NOT EXISTS idx_journeys_coupling ON journeys(coupling_id);