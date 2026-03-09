-- Tabela de checklists de viagem
CREATE TABLE IF NOT EXISTS public.journey_checklists (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  journey_id UUID NOT NULL REFERENCES public.journeys(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  vehicle_id UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  driver_id UUID NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  checklist_type TEXT NOT NULL CHECK (checklist_type IN ('pre', 'post')),
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  photos JSONB DEFAULT '[]'::jsonb,
  notes TEXT,
  location_lat NUMERIC(10, 6),
  location_lng NUMERIC(10, 6),
  location_address TEXT,
  completed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Tabela de mensagens do chat
CREATE TABLE IF NOT EXISTS public.driver_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  driver_id UUID REFERENCES public.drivers(id) ON DELETE CASCADE,
  user_id UUID,
  message TEXT NOT NULL,
  is_from_driver BOOLEAN NOT NULL DEFAULT false,
  read_at TIMESTAMP WITH TIME ZONE,
  journey_id UUID REFERENCES public.journeys(id) ON DELETE SET NULL,
  attachment_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_journey_checklists_journey ON public.journey_checklists(journey_id);
CREATE INDEX IF NOT EXISTS idx_journey_checklists_company ON public.journey_checklists(company_id);
CREATE INDEX IF NOT EXISTS idx_driver_messages_company ON public.driver_messages(company_id);
CREATE INDEX IF NOT EXISTS idx_driver_messages_driver ON public.driver_messages(driver_id);
CREATE INDEX IF NOT EXISTS idx_driver_messages_created ON public.driver_messages(created_at DESC);

-- Habilitar RLS
ALTER TABLE public.journey_checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_messages ENABLE ROW LEVEL SECURITY;

-- Políticas para journey_checklists
CREATE POLICY "Drivers can insert their own checklists"
  ON public.journey_checklists FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM drivers d
      WHERE d.id = driver_id AND d.auth_user_id = auth.uid()
    )
    OR user_has_company_access(auth.uid(), company_id)
  );

CREATE POLICY "Drivers can view their own checklists"
  ON public.journey_checklists FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM drivers d
      WHERE d.id = driver_id AND d.auth_user_id = auth.uid()
    )
    OR user_has_company_access(auth.uid(), company_id)
  );

CREATE POLICY "Users can manage checklists in their company"
  ON public.journey_checklists FOR ALL
  USING (user_has_company_access(auth.uid(), company_id));

-- Políticas para driver_messages
CREATE POLICY "Drivers can insert their own messages"
  ON public.driver_messages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM drivers d
      WHERE d.id = driver_id AND d.auth_user_id = auth.uid()
    )
    OR user_has_company_access(auth.uid(), company_id)
  );

CREATE POLICY "Drivers can view their messages"
  ON public.driver_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM drivers d
      WHERE d.id = driver_id AND d.auth_user_id = auth.uid()
    )
    OR user_has_company_access(auth.uid(), company_id)
  );

CREATE POLICY "Users can view messages in their company"
  ON public.driver_messages FOR SELECT
  USING (user_has_company_access(auth.uid(), company_id));

CREATE POLICY "Users can manage messages in their company"
  ON public.driver_messages FOR ALL
  USING (user_has_company_access(auth.uid(), company_id));

-- Adicionar campos de geolocalização em journeys
ALTER TABLE public.journeys 
  ADD COLUMN IF NOT EXISTS start_location_lat NUMERIC(10, 6),
  ADD COLUMN IF NOT EXISTS start_location_lng NUMERIC(10, 6),
  ADD COLUMN IF NOT EXISTS start_location_address TEXT,
  ADD COLUMN IF NOT EXISTS end_location_lat NUMERIC(10, 6),
  ADD COLUMN IF NOT EXISTS end_location_lng NUMERIC(10, 6),
  ADD COLUMN IF NOT EXISTS end_location_address TEXT;