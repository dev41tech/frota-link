-- Adicionar colunas de controle de faturamento do frete na tabela journeys
ALTER TABLE public.journeys ADD COLUMN IF NOT EXISTS freight_status text DEFAULT 'pending';
ALTER TABLE public.journeys ADD COLUMN IF NOT EXISTS freight_received_date timestamp with time zone;
ALTER TABLE public.journeys ADD COLUMN IF NOT EXISTS freight_due_date timestamp with time zone;

-- Constraint para valores válidos de freight_status
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'journeys_freight_status_check'
  ) THEN
    ALTER TABLE public.journeys ADD CONSTRAINT journeys_freight_status_check 
      CHECK (freight_status IN ('pending', 'received', 'invoiced'));
  END IF;
END $$;

-- Adicionar colunas na tabela accounts_payable para vincular despesa à jornada
ALTER TABLE public.accounts_payable ADD COLUMN IF NOT EXISTS journey_id uuid REFERENCES journeys(id);
ALTER TABLE public.accounts_payable ADD COLUMN IF NOT EXISTS driver_id uuid REFERENCES drivers(id);

-- Índice para busca eficiente por journey_id
CREATE INDEX IF NOT EXISTS idx_accounts_payable_journey_id ON public.accounts_payable(journey_id);

-- Constraint unique para evitar duplicação de comissão por jornada
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'accounts_payable_journey_id_unique'
  ) THEN
    ALTER TABLE public.accounts_payable ADD CONSTRAINT accounts_payable_journey_id_unique UNIQUE (journey_id);
  END IF;
END $$;