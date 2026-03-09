-- Create expense_categories table
CREATE TABLE IF NOT EXISTS public.expense_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  classification TEXT NOT NULL CHECK (classification IN ('direct', 'indirect')),
  icon TEXT DEFAULT 'Package',
  color TEXT DEFAULT '#6B7280',
  is_active BOOLEAN DEFAULT true,
  is_system BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(company_id, name)
);

-- Create revenue_categories table
CREATE TABLE IF NOT EXISTS public.revenue_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  icon TEXT DEFAULT 'DollarSign',
  color TEXT DEFAULT '#10B981',
  is_active BOOLEAN DEFAULT true,
  is_system BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(company_id, name)
);

-- Enable RLS
ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.revenue_categories ENABLE ROW LEVEL SECURITY;

-- RLS Policies for expense_categories
CREATE POLICY "Block anonymous access to expense_categories"
ON public.expense_categories
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (false)
WITH CHECK (false);

CREATE POLICY "Users can manage expense categories in their company"
ON public.expense_categories
AS PERMISSIVE
FOR ALL
TO authenticated
USING (user_has_company_access(auth.uid(), company_id));

-- RLS Policies for revenue_categories
CREATE POLICY "Block anonymous access to revenue_categories"
ON public.revenue_categories
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (false)
WITH CHECK (false);

CREATE POLICY "Users can manage revenue categories in their company"
ON public.revenue_categories
AS PERMISSIVE
FOR ALL
TO authenticated
USING (user_has_company_access(auth.uid(), company_id));

-- Trigger for updated_at
CREATE TRIGGER update_expense_categories_updated_at
BEFORE UPDATE ON public.expense_categories
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_revenue_categories_updated_at
BEFORE UPDATE ON public.revenue_categories
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Function to seed default categories for a company
CREATE OR REPLACE FUNCTION public.seed_default_categories(p_company_id UUID, p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Seed expense categories (direct)
  INSERT INTO public.expense_categories (company_id, user_id, name, classification, icon, color, is_system)
  VALUES 
    (p_company_id, p_user_id, 'Combustível', 'direct', 'Fuel', '#EF4444', true),
    (p_company_id, p_user_id, 'Pedágio', 'direct', 'Ticket', '#F59E0B', true),
    (p_company_id, p_user_id, 'Alimentação', 'direct', 'UtensilsCrossed', '#10B981', true),
    (p_company_id, p_user_id, 'Hospedagem', 'direct', 'Hotel', '#3B82F6', true),
    (p_company_id, p_user_id, 'Manutenção', 'direct', 'Wrench', '#8B5CF6', true),
    (p_company_id, p_user_id, 'Borracharia', 'direct', 'CircleDot', '#EC4899', true)
  ON CONFLICT (company_id, name) DO NOTHING;
  
  -- Seed expense categories (indirect)
  INSERT INTO public.expense_categories (company_id, user_id, name, classification, icon, color, is_system)
  VALUES 
    (p_company_id, p_user_id, 'Seguro', 'indirect', 'Shield', '#6366F1', true),
    (p_company_id, p_user_id, 'Impostos', 'indirect', 'Receipt', '#DC2626', true),
    (p_company_id, p_user_id, 'Estacionamento', 'indirect', 'ParkingCircle', '#14B8A6', true),
    (p_company_id, p_user_id, 'Outros', 'indirect', 'Package', '#6B7280', true)
  ON CONFLICT (company_id, name) DO NOTHING;
  
  -- Seed revenue categories
  INSERT INTO public.revenue_categories (company_id, user_id, name, icon, color, is_system)
  VALUES 
    (p_company_id, p_user_id, 'Carga', 'Package', '#10B981', true),
    (p_company_id, p_user_id, 'Frete', 'Truck', '#059669', true),
    (p_company_id, p_user_id, 'Bonificação', 'Award', '#F59E0B', true),
    (p_company_id, p_user_id, 'Outros', 'DollarSign', '#6B7280', true)
  ON CONFLICT (company_id, name) DO NOTHING;
END;
$$;

-- Seed categories for existing companies
DO $$
DECLARE
  company_record RECORD;
BEGIN
  FOR company_record IN SELECT id, (SELECT user_id FROM profiles WHERE company_id = companies.id LIMIT 1) as user_id FROM companies
  LOOP
    IF company_record.user_id IS NOT NULL THEN
      PERFORM seed_default_categories(company_record.id, company_record.user_id);
    END IF;
  END LOOP;
END $$;