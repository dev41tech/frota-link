-- Create companies table
CREATE TABLE public.companies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cnpj TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  responsible_name TEXT NOT NULL,
  responsible_cpf TEXT NOT NULL,
  address TEXT NOT NULL,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  phone TEXT,
  email TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on companies
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

-- Create app_role enum for user roles
CREATE TYPE public.app_role AS ENUM ('master', 'admin', 'gestor', 'motorista');

-- Update profiles table to include company_id and role
ALTER TABLE public.profiles 
ADD COLUMN company_id UUID REFERENCES public.companies(id),
ADD COLUMN role public.app_role NOT NULL DEFAULT 'admin';

-- Create user_roles table for role management
CREATE TABLE public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  company_id UUID NOT NULL REFERENCES public.companies(id),
  role public.app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, company_id)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create audit log table
CREATE TABLE public.audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  company_id UUID,
  action TEXT NOT NULL,
  table_name TEXT,
  record_id UUID,
  old_values JSONB,
  new_values JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on audit_logs
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Add company_id to existing tables
ALTER TABLE public.vehicles ADD COLUMN company_id UUID REFERENCES public.companies(id);
ALTER TABLE public.drivers ADD COLUMN company_id UUID REFERENCES public.companies(id);
ALTER TABLE public.journeys ADD COLUMN company_id UUID REFERENCES public.companies(id);
ALTER TABLE public.expenses ADD COLUMN company_id UUID REFERENCES public.companies(id);
ALTER TABLE public.fuel_expenses ADD COLUMN company_id UUID REFERENCES public.companies(id);
ALTER TABLE public.gas_stations ADD COLUMN company_id UUID REFERENCES public.companies(id);
ALTER TABLE public.revenue ADD COLUMN company_id UUID REFERENCES public.companies(id);
ALTER TABLE public.accounts_payable ADD COLUMN company_id UUID REFERENCES public.companies(id);

-- Create security definer functions for role checking
CREATE OR REPLACE FUNCTION public.get_user_role(user_uuid UUID, company_uuid UUID)
RETURNS public.app_role
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.user_roles 
  WHERE user_id = user_uuid AND company_id = company_uuid
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_master_user(user_uuid UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = user_uuid AND role = 'master'
  );
$$;

CREATE OR REPLACE FUNCTION public.get_user_company_id(user_uuid UUID)
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT company_id FROM public.profiles 
  WHERE user_id = user_uuid
  LIMIT 1;
$$;

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

-- Create triggers for updating timestamps
CREATE TRIGGER update_companies_updated_at
BEFORE UPDATE ON public.companies
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_roles_updated_at
BEFORE UPDATE ON public.user_roles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to automatically set company_id on inserts
CREATE OR REPLACE FUNCTION public.set_company_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.company_id IS NULL THEN
    NEW.company_id := public.get_user_company_id(auth.uid());
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add triggers to auto-set company_id
CREATE TRIGGER set_company_id_vehicles BEFORE INSERT ON public.vehicles FOR EACH ROW EXECUTE FUNCTION public.set_company_id();
CREATE TRIGGER set_company_id_drivers BEFORE INSERT ON public.drivers FOR EACH ROW EXECUTE FUNCTION public.set_company_id();
CREATE TRIGGER set_company_id_journeys BEFORE INSERT ON public.journeys FOR EACH ROW EXECUTE FUNCTION public.set_company_id();
CREATE TRIGGER set_company_id_expenses BEFORE INSERT ON public.expenses FOR EACH ROW EXECUTE FUNCTION public.set_company_id();
CREATE TRIGGER set_company_id_fuel_expenses BEFORE INSERT ON public.fuel_expenses FOR EACH ROW EXECUTE FUNCTION public.set_company_id();
CREATE TRIGGER set_company_id_gas_stations BEFORE INSERT ON public.gas_stations FOR EACH ROW EXECUTE FUNCTION public.set_company_id();
CREATE TRIGGER set_company_id_revenue BEFORE INSERT ON public.revenue FOR EACH ROW EXECUTE FUNCTION public.set_company_id();
CREATE TRIGGER set_company_id_accounts_payable BEFORE INSERT ON public.accounts_payable FOR EACH ROW EXECUTE FUNCTION public.set_company_id();