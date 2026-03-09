-- Create user profiles table for authentication
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  company_name TEXT,
  phone TEXT,
  role TEXT DEFAULT 'admin',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create policies for profiles
CREATE POLICY "Users can view their own profile" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile" 
ON public.profiles 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile" 
ON public.profiles 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
NEW.updated_at = now();
RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to handle new user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, email)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data ->> 'full_name',
    NEW.email
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for new user registration
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create drivers table
CREATE TABLE public.drivers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  cpf TEXT UNIQUE,
  cnh TEXT UNIQUE,
  cnh_category TEXT,
  cnh_expiry DATE,
  phone TEXT,
  email TEXT,
  address TEXT,
  emergency_contact TEXT,
  emergency_phone TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own drivers" 
ON public.drivers 
FOR ALL 
USING (auth.uid() = user_id);

CREATE TRIGGER update_drivers_updated_at
BEFORE UPDATE ON public.drivers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create vehicles table
CREATE TABLE public.vehicles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plate TEXT NOT NULL,
  model TEXT NOT NULL,
  brand TEXT,
  year INTEGER,
  chassis TEXT,
  renavam TEXT,
  fuel_type TEXT DEFAULT 'diesel' CHECK (fuel_type IN ('diesel', 'gasoline', 'ethanol', 'hybrid', 'electric')),
  tank_capacity DECIMAL(10,2),
  avg_consumption DECIMAL(5,2), -- km/l
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'maintenance', 'sold')),
  purchase_date DATE,
  purchase_value DECIMAL(12,2),
  current_value DECIMAL(12,2),
  insurance_company TEXT,
  insurance_policy TEXT,
  insurance_expiry DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own vehicles" 
ON public.vehicles 
FOR ALL 
USING (auth.uid() = user_id);

CREATE TRIGGER update_vehicles_updated_at
BEFORE UPDATE ON public.vehicles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create gas stations table
CREATE TABLE public.gas_stations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT,
  city TEXT,
  state TEXT,
  phone TEXT,
  cnpj TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.gas_stations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own gas stations" 
ON public.gas_stations 
FOR ALL 
USING (auth.uid() = user_id);

CREATE TRIGGER update_gas_stations_updated_at
BEFORE UPDATE ON public.gas_stations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create journeys table
CREATE TABLE public.journeys (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vehicle_id UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  driver_id UUID REFERENCES public.drivers(id) ON DELETE SET NULL,
  journey_number TEXT NOT NULL,
  origin TEXT NOT NULL,
  destination TEXT NOT NULL,
  distance DECIMAL(10,2),
  freight_value DECIMAL(12,2),
  commission_percentage DECIMAL(5,2) DEFAULT 0,
  commission_value DECIMAL(12,2) DEFAULT 0,
  advance_value DECIMAL(12,2) DEFAULT 0,
  status TEXT DEFAULT 'planned' CHECK (status IN ('planned', 'in_progress', 'completed', 'cancelled')),
  start_date TIMESTAMP WITH TIME ZONE,
  end_date TIMESTAMP WITH TIME ZONE,
  start_km INTEGER,
  end_km INTEGER,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.journeys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own journeys" 
ON public.journeys 
FOR ALL 
USING (auth.uid() = user_id);

CREATE TRIGGER update_journeys_updated_at
BEFORE UPDATE ON public.journeys
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create fuel expenses table
CREATE TABLE public.fuel_expenses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vehicle_id UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  journey_id UUID REFERENCES public.journeys(id) ON DELETE SET NULL,
  gas_station_id UUID REFERENCES public.gas_stations(id) ON DELETE SET NULL,
  date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  liters DECIMAL(10,3) NOT NULL,
  price_per_liter DECIMAL(10,4) NOT NULL,
  total_amount DECIMAL(12,2) NOT NULL,
  odometer INTEGER,
  payment_method TEXT DEFAULT 'card' CHECK (payment_method IN ('cash', 'card', 'pix', 'credit')),
  receipt_number TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.fuel_expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own fuel expenses" 
ON public.fuel_expenses 
FOR ALL 
USING (auth.uid() = user_id);

CREATE TRIGGER update_fuel_expenses_updated_at
BEFORE UPDATE ON public.fuel_expenses
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create expenses table (general expenses)
CREATE TABLE public.expenses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE SET NULL,
  journey_id UUID REFERENCES public.journeys(id) ON DELETE SET NULL,
  category TEXT NOT NULL CHECK (category IN ('maintenance', 'insurance', 'tax', 'toll', 'parking', 'food', 'accommodation', 'fuel', 'other')),
  description TEXT NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  payment_method TEXT DEFAULT 'card' CHECK (payment_method IN ('cash', 'card', 'pix', 'credit', 'bank_transfer')),
  supplier TEXT,
  receipt_number TEXT,
  notes TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'cancelled')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own expenses" 
ON public.expenses 
FOR ALL 
USING (auth.uid() = user_id);

CREATE TRIGGER update_expenses_updated_at
BEFORE UPDATE ON public.expenses
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create accounts payable table
CREATE TABLE public.accounts_payable (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expense_id UUID REFERENCES public.expenses(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  due_date DATE NOT NULL,
  payment_date DATE,
  supplier TEXT,
  category TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue', 'cancelled')),
  payment_method TEXT CHECK (payment_method IN ('cash', 'card', 'pix', 'bank_transfer', 'check')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.accounts_payable ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own accounts payable" 
ON public.accounts_payable 
FOR ALL 
USING (auth.uid() = user_id);

CREATE TRIGGER update_accounts_payable_updated_at
BEFORE UPDATE ON public.accounts_payable
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create revenue table
CREATE TABLE public.revenue (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  journey_id UUID NOT NULL REFERENCES public.journeys(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  payment_method TEXT DEFAULT 'bank_transfer' CHECK (payment_method IN ('cash', 'card', 'pix', 'bank_transfer', 'check')),
  client TEXT,
  invoice_number TEXT,
  notes TEXT,
  status TEXT DEFAULT 'received' CHECK (status IN ('pending', 'received', 'cancelled')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.revenue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own revenue" 
ON public.revenue 
FOR ALL 
USING (auth.uid() = user_id);

CREATE TRIGGER update_revenue_updated_at
BEFORE UPDATE ON public.revenue
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add indexes for better performance
CREATE INDEX idx_drivers_user_id ON public.drivers(user_id);
CREATE INDEX idx_vehicles_user_id ON public.vehicles(user_id);
CREATE INDEX idx_vehicles_status ON public.vehicles(status);
CREATE INDEX idx_journeys_user_id ON public.journeys(user_id);
CREATE INDEX idx_journeys_vehicle_id ON public.journeys(vehicle_id);
CREATE INDEX idx_journeys_status ON public.journeys(status);
CREATE INDEX idx_fuel_expenses_user_id ON public.fuel_expenses(user_id);
CREATE INDEX idx_fuel_expenses_vehicle_id ON public.fuel_expenses(vehicle_id);
CREATE INDEX idx_expenses_user_id ON public.expenses(user_id);
CREATE INDEX idx_accounts_payable_user_id ON public.accounts_payable(user_id);
CREATE INDEX idx_accounts_payable_status ON public.accounts_payable(status);
CREATE INDEX idx_revenue_user_id ON public.revenue(user_id);