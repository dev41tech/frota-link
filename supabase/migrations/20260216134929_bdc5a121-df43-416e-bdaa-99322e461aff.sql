
-- =============================================
-- ANNOUNCEMENTS (Avisos)
-- =============================================
CREATE TABLE public.announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  priority text NOT NULL DEFAULT 'normal',
  target_type text NOT NULL DEFAULT 'all',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_announcements_company ON public.announcements(company_id);
CREATE INDEX idx_announcements_created ON public.announcements(created_at DESC);

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

-- Block anon
CREATE POLICY "Block anonymous access to announcements"
ON public.announcements FOR ALL TO anon
USING (false) WITH CHECK (false);

-- Managers CRUD
CREATE POLICY "Company users can manage announcements"
ON public.announcements FOR ALL TO authenticated
USING (user_has_company_access(auth.uid(), company_id))
WITH CHECK (user_has_company_access(auth.uid(), company_id));

-- Drivers can SELECT announcements from their company
CREATE POLICY "Drivers can view announcements"
ON public.announcements FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM drivers d
    WHERE d.auth_user_id = auth.uid()
    AND d.company_id = announcements.company_id
  )
);

-- =============================================
-- ANNOUNCEMENT_TARGETS (Destinatários específicos)
-- =============================================
CREATE TABLE public.announcement_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id uuid NOT NULL REFERENCES public.announcements(id) ON DELETE CASCADE,
  driver_id uuid NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  UNIQUE(announcement_id, driver_id)
);

CREATE INDEX idx_announcement_targets_announcement ON public.announcement_targets(announcement_id);
CREATE INDEX idx_announcement_targets_driver ON public.announcement_targets(driver_id);

ALTER TABLE public.announcement_targets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Block anonymous access to announcement_targets"
ON public.announcement_targets FOR ALL TO anon
USING (false) WITH CHECK (false);

CREATE POLICY "Company users can manage announcement targets"
ON public.announcement_targets FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM announcements a
    WHERE a.id = announcement_targets.announcement_id
    AND user_has_company_access(auth.uid(), a.company_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM announcements a
    WHERE a.id = announcement_targets.announcement_id
    AND user_has_company_access(auth.uid(), a.company_id)
  )
);

CREATE POLICY "Drivers can view their targets"
ON public.announcement_targets FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM drivers d
    WHERE d.id = announcement_targets.driver_id
    AND d.auth_user_id = auth.uid()
  )
);

-- =============================================
-- ANNOUNCEMENT_READS (Confirmações de leitura)
-- =============================================
CREATE TABLE public.announcement_reads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id uuid NOT NULL REFERENCES public.announcements(id) ON DELETE CASCADE,
  driver_id uuid NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  read_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(announcement_id, driver_id)
);

CREATE INDEX idx_announcement_reads_announcement ON public.announcement_reads(announcement_id);
CREATE INDEX idx_announcement_reads_driver ON public.announcement_reads(driver_id);

ALTER TABLE public.announcement_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Block anonymous access to announcement_reads"
ON public.announcement_reads FOR ALL TO anon
USING (false) WITH CHECK (false);

-- Drivers can INSERT their own reads
CREATE POLICY "Drivers can mark announcements as read"
ON public.announcement_reads FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM drivers d
    WHERE d.id = announcement_reads.driver_id
    AND d.auth_user_id = auth.uid()
  )
);

-- Drivers can view their own reads
CREATE POLICY "Drivers can view their reads"
ON public.announcement_reads FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM drivers d
    WHERE d.id = announcement_reads.driver_id
    AND d.auth_user_id = auth.uid()
  )
);

-- Managers can view all reads in their company
CREATE POLICY "Company users can view announcement reads"
ON public.announcement_reads FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM announcements a
    WHERE a.id = announcement_reads.announcement_id
    AND user_has_company_access(auth.uid(), a.company_id)
  )
);

-- =============================================
-- INCIDENTS (Ocorrências)
-- =============================================
CREATE TABLE public.incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  driver_id uuid NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  vehicle_id uuid REFERENCES public.vehicles(id),
  journey_id uuid REFERENCES public.journeys(id),
  incident_type text NOT NULL,
  description text NOT NULL,
  photo_url text,
  status text NOT NULL DEFAULT 'open',
  resolution_notes text,
  resolved_by uuid,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_incidents_company ON public.incidents(company_id);
CREATE INDEX idx_incidents_driver ON public.incidents(driver_id);
CREATE INDEX idx_incidents_status ON public.incidents(status);
CREATE INDEX idx_incidents_created ON public.incidents(created_at DESC);

ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Block anonymous access to incidents"
ON public.incidents FOR ALL TO anon
USING (false) WITH CHECK (false);

-- Managers can do everything in their company
CREATE POLICY "Company users can manage incidents"
ON public.incidents FOR ALL TO authenticated
USING (user_has_company_access(auth.uid(), company_id))
WITH CHECK (user_has_company_access(auth.uid(), company_id));

-- Drivers can INSERT their own incidents
CREATE POLICY "Drivers can create incidents"
ON public.incidents FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM drivers d
    WHERE d.id = incidents.driver_id
    AND d.auth_user_id = auth.uid()
    AND d.company_id = incidents.company_id
  )
);

-- Drivers can view their own incidents
CREATE POLICY "Drivers can view their incidents"
ON public.incidents FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM drivers d
    WHERE d.id = incidents.driver_id
    AND d.auth_user_id = auth.uid()
  )
);

-- Trigger for updated_at on incidents
CREATE TRIGGER update_incidents_updated_at
BEFORE UPDATE ON public.incidents
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
