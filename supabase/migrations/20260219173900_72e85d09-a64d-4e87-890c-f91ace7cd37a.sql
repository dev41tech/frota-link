-- Add status column to journey_legs
ALTER TABLE journey_legs ADD COLUMN status text NOT NULL DEFAULT 'in_progress';

-- Completed journeys: all legs become completed
UPDATE journey_legs jl SET status = 'completed'
FROM journeys j
WHERE jl.journey_id = j.id AND j.status = 'completed';

-- In-progress journeys with multiple legs: only first is in_progress, rest are pending
UPDATE journey_legs SET status = 'pending'
WHERE journey_id IN (
  SELECT journey_id FROM journey_legs GROUP BY journey_id HAVING COUNT(*) > 1
)
AND leg_number > 1
AND status != 'completed';