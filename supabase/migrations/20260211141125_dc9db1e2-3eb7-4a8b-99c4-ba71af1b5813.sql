
-- Permissoes do motorista
ALTER TABLE public.drivers ADD COLUMN can_add_revenue boolean NOT NULL DEFAULT false;
ALTER TABLE public.drivers ADD COLUMN can_start_journey boolean NOT NULL DEFAULT true;
ALTER TABLE public.drivers ADD COLUMN can_auto_close_journey boolean NOT NULL DEFAULT false;
ALTER TABLE public.drivers ADD COLUMN can_create_journey_without_approval boolean NOT NULL DEFAULT false;

-- Rastreamento de origem da jornada
ALTER TABLE public.journeys ADD COLUMN created_by_driver boolean NOT NULL DEFAULT false;
