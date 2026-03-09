-- Update RLS policies for companies table
CREATE POLICY "Master users can manage all companies"
ON public.companies
FOR ALL
USING (public.is_master_user(auth.uid()));

CREATE POLICY "Company admins can view their company"
ON public.companies
FOR SELECT
USING (
  id = public.get_user_company_id(auth.uid()) OR 
  public.is_master_user(auth.uid())
);

-- Update RLS policies for profiles table
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;

CREATE POLICY "Users can view profiles in their company"
ON public.profiles
FOR SELECT
USING (
  auth.uid() = user_id OR
  (company_id = public.get_user_company_id(auth.uid()) AND 
   public.get_user_role(auth.uid(), public.get_user_company_id(auth.uid())) IN ('admin', 'master')) OR
  public.is_master_user(auth.uid())
);

CREATE POLICY "Users can update their own profile"
ON public.profiles
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Admins can insert profiles in their company"
ON public.profiles
FOR INSERT
WITH CHECK (
  auth.uid() = user_id OR
  (company_id = public.get_user_company_id(auth.uid()) AND 
   public.get_user_role(auth.uid(), public.get_user_company_id(auth.uid())) IN ('admin', 'master')) OR
  public.is_master_user(auth.uid())
);

-- Update RLS policies for user_roles table
CREATE POLICY "Master users can manage all user roles"
ON public.user_roles
FOR ALL
USING (public.is_master_user(auth.uid()));

CREATE POLICY "Company admins can manage roles in their company"
ON public.user_roles
FOR ALL
USING (
  company_id = public.get_user_company_id(auth.uid()) AND
  public.get_user_role(auth.uid(), public.get_user_company_id(auth.uid())) = 'admin'
);

-- Update existing table policies to include company isolation
-- Vehicles
DROP POLICY IF EXISTS "Users can manage their own vehicles" ON public.vehicles;
CREATE POLICY "Users can manage vehicles in their company"
ON public.vehicles
FOR ALL
USING (
  company_id = public.get_user_company_id(auth.uid()) OR
  public.is_master_user(auth.uid())
);

-- Drivers
DROP POLICY IF EXISTS "Users can manage their own drivers" ON public.drivers;
CREATE POLICY "Users can manage drivers in their company"
ON public.drivers
FOR ALL
USING (
  company_id = public.get_user_company_id(auth.uid()) OR
  public.is_master_user(auth.uid())
);

-- Journeys
DROP POLICY IF EXISTS "Users can manage their own journeys" ON public.journeys;
CREATE POLICY "Users can manage journeys in their company"
ON public.journeys
FOR ALL
USING (
  company_id = public.get_user_company_id(auth.uid()) OR
  public.is_master_user(auth.uid())
);

-- Expenses
DROP POLICY IF EXISTS "Users can manage their own expenses" ON public.expenses;
CREATE POLICY "Users can manage expenses in their company"
ON public.expenses
FOR ALL
USING (
  company_id = public.get_user_company_id(auth.uid()) OR
  public.is_master_user(auth.uid())
);

-- Fuel expenses
DROP POLICY IF EXISTS "Users can manage their own fuel expenses" ON public.fuel_expenses;
CREATE POLICY "Users can manage fuel expenses in their company"
ON public.fuel_expenses
FOR ALL
USING (
  company_id = public.get_user_company_id(auth.uid()) OR
  public.is_master_user(auth.uid())
);

-- Gas stations
DROP POLICY IF EXISTS "Users can manage their own gas stations" ON public.gas_stations;
CREATE POLICY "Users can manage gas stations in their company"
ON public.gas_stations
FOR ALL
USING (
  company_id = public.get_user_company_id(auth.uid()) OR
  public.is_master_user(auth.uid())
);

-- Revenue
DROP POLICY IF EXISTS "Users can manage their own revenue" ON public.revenue;
CREATE POLICY "Users can manage revenue in their company"
ON public.revenue
FOR ALL
USING (
  company_id = public.get_user_company_id(auth.uid()) OR
  public.is_master_user(auth.uid())
);

-- Accounts payable
DROP POLICY IF EXISTS "Users can manage their own accounts payable" ON public.accounts_payable;
CREATE POLICY "Users can manage accounts payable in their company"
ON public.accounts_payable
FOR ALL
USING (
  company_id = public.get_user_company_id(auth.uid()) OR
  public.is_master_user(auth.uid())
);

-- Audit logs policies
CREATE POLICY "Users can view audit logs for their company"
ON public.audit_logs
FOR SELECT
USING (
  company_id = public.get_user_company_id(auth.uid()) OR
  public.is_master_user(auth.uid())
);

CREATE POLICY "System can insert audit logs"
ON public.audit_logs
FOR INSERT
WITH CHECK (true);

-- Add triggers to auto-set company_id
DROP TRIGGER IF EXISTS set_company_id_vehicles ON public.vehicles;
DROP TRIGGER IF EXISTS set_company_id_drivers ON public.drivers;
DROP TRIGGER IF EXISTS set_company_id_journeys ON public.journeys;
DROP TRIGGER IF EXISTS set_company_id_expenses ON public.expenses;
DROP TRIGGER IF EXISTS set_company_id_fuel_expenses ON public.fuel_expenses;
DROP TRIGGER IF EXISTS set_company_id_gas_stations ON public.gas_stations;
DROP TRIGGER IF EXISTS set_company_id_revenue ON public.revenue;
DROP TRIGGER IF EXISTS set_company_id_accounts_payable ON public.accounts_payable;

CREATE TRIGGER set_company_id_vehicles BEFORE INSERT ON public.vehicles FOR EACH ROW EXECUTE FUNCTION public.set_company_id();
CREATE TRIGGER set_company_id_drivers BEFORE INSERT ON public.drivers FOR EACH ROW EXECUTE FUNCTION public.set_company_id();
CREATE TRIGGER set_company_id_journeys BEFORE INSERT ON public.journeys FOR EACH ROW EXECUTE FUNCTION public.set_company_id();
CREATE TRIGGER set_company_id_expenses BEFORE INSERT ON public.expenses FOR EACH ROW EXECUTE FUNCTION public.set_company_id();
CREATE TRIGGER set_company_id_fuel_expenses BEFORE INSERT ON public.fuel_expenses FOR EACH ROW EXECUTE FUNCTION public.set_company_id();
CREATE TRIGGER set_company_id_gas_stations BEFORE INSERT ON public.gas_stations FOR EACH ROW EXECUTE FUNCTION public.set_company_id();
CREATE TRIGGER set_company_id_revenue BEFORE INSERT ON public.revenue FOR EACH ROW EXECUTE FUNCTION public.set_company_id();
CREATE TRIGGER set_company_id_accounts_payable BEFORE INSERT ON public.accounts_payable FOR EACH ROW EXECUTE FUNCTION public.set_company_id();