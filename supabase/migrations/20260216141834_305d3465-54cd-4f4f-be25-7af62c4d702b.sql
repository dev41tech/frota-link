-- Fix mutable search_path on get_fleet_dashboard_metrics
ALTER FUNCTION public.get_fleet_dashboard_metrics(uuid) SET search_path = public;