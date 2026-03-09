-- Create tire_history table to track all tire movements
CREATE TABLE public.tire_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  tire_id UUID NOT NULL REFERENCES tire_assets(id) ON DELETE CASCADE,
  vehicle_id UUID REFERENCES vehicles(id) ON DELETE SET NULL,
  vehicle_plate TEXT,
  action TEXT NOT NULL, -- 'install', 'rotation', 'unlink', 'replace', 'recap_send', 'recap_return', 'discard'
  position TEXT,
  km_at_action INTEGER,
  km_driven INTEGER, -- KM rodados naquele período
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  user_id UUID NOT NULL
);

-- Add total_km column to tire_assets
ALTER TABLE public.tire_assets ADD COLUMN IF NOT EXISTS total_km INTEGER DEFAULT 0;

-- Enable RLS
ALTER TABLE public.tire_history ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for tire_history
CREATE POLICY "Users can view tire history in their company" 
ON public.tire_history 
FOR SELECT 
USING (company_id IN (
  SELECT p.company_id FROM profiles p WHERE p.user_id = auth.uid()
));

CREATE POLICY "Users can insert tire history in their company" 
ON public.tire_history 
FOR INSERT 
WITH CHECK (company_id IN (
  SELECT p.company_id FROM profiles p WHERE p.user_id = auth.uid()
));

CREATE POLICY "Users can update tire history in their company" 
ON public.tire_history 
FOR UPDATE 
USING (company_id IN (
  SELECT p.company_id FROM profiles p WHERE p.user_id = auth.uid()
));

CREATE POLICY "Users can delete tire history in their company" 
ON public.tire_history 
FOR DELETE 
USING (company_id IN (
  SELECT p.company_id FROM profiles p WHERE p.user_id = auth.uid()
));

-- Create index for faster queries
CREATE INDEX idx_tire_history_tire_id ON public.tire_history(tire_id);
CREATE INDEX idx_tire_history_company_id ON public.tire_history(company_id);
CREATE INDEX idx_tire_history_vehicle_id ON public.tire_history(vehicle_id);