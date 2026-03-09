-- CRITICAL SECURITY FIXES FOR ROLE ESCALATION AND DATA PROTECTION

-- 1. Remove role field from profiles UPDATE policy to prevent escalation
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

-- Create new UPDATE policy without role field access
CREATE POLICY "Users can update their own profile" ON public.profiles
FOR UPDATE 
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id 
  AND role = (SELECT role FROM public.profiles WHERE user_id = auth.uid())
);

-- 2. Create separate policy for role updates (admin/master only)
CREATE POLICY "Admins can update user roles" ON public.profiles
FOR UPDATE
USING (
  auth.uid() != user_id 
  AND (
    (company_id = get_user_company_id(auth.uid()) AND get_user_role(auth.uid(), get_user_company_id(auth.uid())) = 'admin'::app_role)
    OR is_master_user(auth.uid())
  )
)
WITH CHECK (
  auth.uid() != user_id 
  AND (
    (company_id = get_user_company_id(auth.uid()) AND get_user_role(auth.uid(), get_user_company_id(auth.uid())) = 'admin'::app_role)
    OR is_master_user(auth.uid())
  )
);

-- 3. Add trigger to prevent direct role modifications in profiles and ensure sync
CREATE OR REPLACE FUNCTION public.validate_role_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Prevent users from changing their own role
  IF OLD.user_id = auth.uid() AND OLD.role != NEW.role THEN
    RAISE EXCEPTION 'Users cannot change their own role';
  END IF;
  
  -- Sync role changes to user_roles table
  IF OLD.role != NEW.role THEN
    -- Remove old role
    DELETE FROM public.user_roles 
    WHERE user_id = NEW.user_id AND company_id = NEW.company_id;
    
    -- Add new role
    INSERT INTO public.user_roles (user_id, company_id, role)
    VALUES (NEW.user_id, NEW.company_id, NEW.role)
    ON CONFLICT (user_id, company_id) DO UPDATE SET role = NEW.role;
    
    -- Audit log for role changes
    INSERT INTO public.audit_logs (user_id, company_id, action, table_name, record_id, old_values, new_values)
    VALUES (
      auth.uid(),
      NEW.company_id,
      'role_change',
      'profiles',
      NEW.id,
      jsonb_build_object('role', OLD.role),
      jsonb_build_object('role', NEW.role)
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Add trigger for role validation
DROP TRIGGER IF EXISTS validate_role_change_trigger ON public.profiles;
CREATE TRIGGER validate_role_change_trigger
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_role_change();

-- 4. Strengthen company_id validation - make NOT NULL where critical
ALTER TABLE public.profiles ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.drivers ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.vehicles ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.journeys ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.expenses ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.fuel_expenses ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.gas_stations ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.accounts_payable ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.revenue ALTER COLUMN company_id SET NOT NULL;

-- 5. Add unique constraint for user roles to prevent duplicates
ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS user_roles_user_id_company_id_key;
ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_user_id_company_id_key UNIQUE (user_id, company_id);

-- 6. Update security definer functions to prevent search_path attacks
CREATE OR REPLACE FUNCTION public.get_user_role(user_uuid uuid, company_uuid uuid)
RETURNS app_role
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.user_roles 
  WHERE user_id = user_uuid AND company_id = company_uuid
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_master_user(user_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = user_uuid AND role = 'master'
  );
$$;

CREATE OR REPLACE FUNCTION public.get_user_company_id(user_uuid uuid)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT company_id FROM public.profiles 
  WHERE user_id = user_uuid
  LIMIT 1;
$$;

-- 7. Add function to validate company access
CREATE OR REPLACE FUNCTION public.user_has_company_access(user_uuid uuid, company_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = user_uuid 
    AND (company_id = company_uuid OR role = 'master')
  );
$$;

-- 8. Enhance RLS policies to use the new validation function
DROP POLICY IF EXISTS "Users can manage drivers in their company" ON public.drivers;
CREATE POLICY "Users can manage drivers in their company" ON public.drivers
FOR ALL
USING (public.user_has_company_access(auth.uid(), company_id));

DROP POLICY IF EXISTS "Users can manage vehicles in their company" ON public.vehicles;
CREATE POLICY "Users can manage vehicles in their company" ON public.vehicles
FOR ALL
USING (public.user_has_company_access(auth.uid(), company_id));

DROP POLICY IF EXISTS "Users can manage journeys in their company" ON public.journeys;
CREATE POLICY "Users can manage journeys in their company" ON public.journeys
FOR ALL
USING (public.user_has_company_access(auth.uid(), company_id));

DROP POLICY IF EXISTS "Users can manage expenses in their company" ON public.expenses;
CREATE POLICY "Users can manage expenses in their company" ON public.expenses
FOR ALL
USING (public.user_has_company_access(auth.uid(), company_id));

DROP POLICY IF EXISTS "Users can manage fuel expenses in their company" ON public.fuel_expenses;
CREATE POLICY "Users can manage fuel expenses in their company" ON public.fuel_expenses
FOR ALL
USING (public.user_has_company_access(auth.uid(), company_id));

DROP POLICY IF EXISTS "Users can manage gas stations in their company" ON public.gas_stations;
CREATE POLICY "Users can manage gas stations in their company" ON public.gas_stations
FOR ALL
USING (public.user_has_company_access(auth.uid(), company_id));

DROP POLICY IF EXISTS "Users can manage accounts payable in their company" ON public.accounts_payable;
CREATE POLICY "Users can manage accounts payable in their company" ON public.accounts_payable
FOR ALL
USING (public.user_has_company_access(auth.uid(), company_id));

DROP POLICY IF EXISTS "Users can manage revenue in their company" ON public.revenue;
CREATE POLICY "Users can manage revenue in their company" ON public.revenue
FOR ALL
USING (public.user_has_company_access(auth.uid(), company_id));

DROP POLICY IF EXISTS "Users can manage CT-e documents in their company" ON public.cte_documents;
CREATE POLICY "Users can manage CT-e documents in their company" ON public.cte_documents
FOR ALL
USING (public.user_has_company_access(auth.uid(), company_id));

DROP POLICY IF EXISTS "Users can manage CT-e settings in their company" ON public.cte_settings;
CREATE POLICY "Users can manage CT-e settings in their company" ON public.cte_settings
FOR ALL
USING (public.user_has_company_access(auth.uid(), company_id));

DROP POLICY IF EXISTS "Users can manage digital certificates in their company" ON public.digital_certificates;
CREATE POLICY "Users can manage digital certificates in their company" ON public.digital_certificates
FOR ALL
USING (public.user_has_company_access(auth.uid(), company_id));