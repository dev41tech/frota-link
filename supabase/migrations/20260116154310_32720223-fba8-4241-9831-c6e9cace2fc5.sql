-- Fix fuel_expenses RLS policies to be PERMISSIVE instead of RESTRICTIVE
-- Current policies are RESTRICTIVE which requires ALL to pass, but we need at least one PERMISSIVE

-- Drop existing policies
DROP POLICY IF EXISTS "Drivers can view fuel expenses for their vehicles" ON public.fuel_expenses;
DROP POLICY IF EXISTS "Drivers can insert fuel expenses for their vehicles" ON public.fuel_expenses;
DROP POLICY IF EXISTS "Users can manage fuel expenses in their company" ON public.fuel_expenses;

-- Recreate as PERMISSIVE policies (at least one must pass)
-- Policy for company users (admins, etc.)
CREATE POLICY "Company users can manage fuel expenses" ON public.fuel_expenses
FOR ALL
TO authenticated
USING (user_has_company_access(auth.uid(), company_id))
WITH CHECK (user_has_company_access(auth.uid(), company_id));

-- Policy for drivers to view their vehicles' fuel expenses
CREATE POLICY "Drivers can view own vehicle fuel expenses" ON public.fuel_expenses
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM driver_vehicles dv
    JOIN drivers d ON d.id = dv.driver_id
    WHERE dv.vehicle_id = fuel_expenses.vehicle_id 
    AND d.auth_user_id = auth.uid()
  )
);

-- Policy for drivers to insert fuel expenses for their vehicles
CREATE POLICY "Drivers can insert own vehicle fuel expenses" ON public.fuel_expenses
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM driver_vehicles dv
    JOIN drivers d ON d.id = dv.driver_id
    WHERE dv.vehicle_id = fuel_expenses.vehicle_id 
    AND d.auth_user_id = auth.uid()
    AND dv.status = 'active'
  )
);

-- Policy for drivers to update their own fuel expenses
CREATE POLICY "Drivers can update own fuel expenses" ON public.fuel_expenses
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM driver_vehicles dv
    JOIN drivers d ON d.id = dv.driver_id
    WHERE dv.vehicle_id = fuel_expenses.vehicle_id 
    AND d.auth_user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM driver_vehicles dv
    JOIN drivers d ON d.id = dv.driver_id
    WHERE dv.vehicle_id = fuel_expenses.vehicle_id 
    AND d.auth_user_id = auth.uid()
    AND dv.status = 'active'
  )
);