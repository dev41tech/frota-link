
-- Add expense_id column to vehicle_maintenances for bidirectional traceability
ALTER TABLE public.vehicle_maintenances
ADD COLUMN expense_id uuid REFERENCES public.expenses(id) ON DELETE SET NULL;

-- Create index for faster lookups
CREATE INDEX idx_vehicle_maintenances_expense_id ON public.vehicle_maintenances(expense_id);
