-- Tabela de Faturas
CREATE TABLE public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  plan_id UUID REFERENCES public.subscription_plans(id) NOT NULL,
  amount NUMERIC NOT NULL,
  due_date DATE NOT NULL,
  paid_date DATE,
  status TEXT NOT NULL DEFAULT 'pending',
  billing_period_start DATE NOT NULL,
  billing_period_end DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Tabela de Alertas do Sistema
CREATE TABLE public.system_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL,
  severity TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolved_by UUID
);

-- Tabela de Configurações do Sistema
CREATE TABLE public.system_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key TEXT UNIQUE NOT NULL,
  setting_value JSONB NOT NULL,
  setting_type TEXT NOT NULL,
  description TEXT,
  updated_by UUID,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Tabela de Logs de Uso
CREATE TABLE public.usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  user_id UUID NOT NULL,
  action TEXT NOT NULL,
  module TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Habilitar RLS
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies para invoices
CREATE POLICY "Block anonymous access to invoices"
ON public.invoices FOR ALL TO anon USING (false) WITH CHECK (false);

CREATE POLICY "Master users can manage all invoices"
ON public.invoices FOR ALL USING (is_master_user(auth.uid()));

-- RLS Policies para system_alerts
CREATE POLICY "Block anonymous access to system_alerts"
ON public.system_alerts FOR ALL TO anon USING (false) WITH CHECK (false);

CREATE POLICY "Master users can manage all alerts"
ON public.system_alerts FOR ALL USING (is_master_user(auth.uid()));

-- RLS Policies para system_settings
CREATE POLICY "Block anonymous access to system_settings"
ON public.system_settings FOR ALL TO anon USING (false) WITH CHECK (false);

CREATE POLICY "Master users can manage all settings"
ON public.system_settings FOR ALL USING (is_master_user(auth.uid()));

-- RLS Policies para usage_logs
CREATE POLICY "Block anonymous access to usage_logs"
ON public.usage_logs FOR ALL TO anon USING (false) WITH CHECK (false);

CREATE POLICY "Master users can view all usage logs"
ON public.usage_logs FOR SELECT USING (is_master_user(auth.uid()));

CREATE POLICY "System can insert usage logs"
ON public.usage_logs FOR INSERT WITH CHECK (true);

-- Triggers para updated_at
CREATE TRIGGER update_invoices_updated_at
BEFORE UPDATE ON public.invoices
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_system_settings_updated_at
BEFORE UPDATE ON public.system_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();