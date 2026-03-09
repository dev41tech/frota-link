-- Enable required extensions for cron jobs
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Schedule daily notifications for due accounts (runs every day at 8 AM)
SELECT cron.schedule(
  'notify-due-accounts-daily',
  '0 8 * * *', -- 8 AM every day (cron format: minute hour day month weekday)
  $$
  SELECT
    net.http_post(
      url:='https://hxfhubhijampubrsqfhg.supabase.co/functions/v1/notify-due-accounts',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh4Zmh1YmhpamFtcHVicnNxZmhnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc5NDM1OTEsImV4cCI6MjA3MzUxOTU5MX0.vV_rbFX1GodmiqpfitTLvd_RyIQ0qe8ZFMwgM3mmTHA"}'::jsonb,
      body:='{}'::jsonb
    ) as request_id;
  $$
);

-- Create a function to check cron job status (useful for debugging)
CREATE OR REPLACE FUNCTION public.get_cron_jobs()
RETURNS TABLE (
  jobid bigint,
  schedule text,
  command text,
  nodename text,
  nodeport integer,
  database text,
  username text,
  active boolean,
  jobname text
) 
LANGUAGE sql
SECURITY DEFINER
SET search_path = extensions, pg_catalog, public
AS $$
  SELECT * FROM cron.job;
$$;