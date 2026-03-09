-- Add new columns to tire_assets for KM-based alerts
ALTER TABLE tire_assets 
ADD COLUMN IF NOT EXISTS installation_km INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS alert_rotation_km INTEGER DEFAULT 20000,
ADD COLUMN IF NOT EXISTS alert_replacement_km INTEGER DEFAULT 80000,
ADD COLUMN IF NOT EXISTS last_rotation_km INTEGER,
ADD COLUMN IF NOT EXISTS last_rotation_date DATE,
ADD COLUMN IF NOT EXISTS notes TEXT,
ADD COLUMN IF NOT EXISTS user_id UUID;

-- Enable RLS on tire_assets if not already enabled
ALTER TABLE tire_assets ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for tire_assets
DROP POLICY IF EXISTS "Users can manage tires in their company" ON tire_assets;
CREATE POLICY "Users can manage tires in their company"
ON tire_assets
FOR ALL
USING (user_has_company_access(auth.uid(), company_id))
WITH CHECK (user_has_company_access(auth.uid(), company_id));

-- Block anonymous access
DROP POLICY IF EXISTS "Block anonymous access to tire_assets" ON tire_assets;
CREATE POLICY "Block anonymous access to tire_assets"
ON tire_assets
FOR ALL
USING (false)
WITH CHECK (false);