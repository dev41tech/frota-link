ALTER TABLE journeys DROP CONSTRAINT journeys_status_check;
ALTER TABLE journeys ADD CONSTRAINT journeys_status_check 
  CHECK (status = ANY (ARRAY['planned', 'in_progress', 'completed', 'cancelled', 'pending_approval']));