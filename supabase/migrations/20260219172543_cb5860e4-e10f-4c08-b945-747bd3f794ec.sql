
-- Adicionar coluna journey_leg_id nas 3 tabelas
ALTER TABLE expenses ADD COLUMN journey_leg_id uuid REFERENCES journey_legs(id);
ALTER TABLE fuel_expenses ADD COLUMN journey_leg_id uuid REFERENCES journey_legs(id);
ALTER TABLE revenue ADD COLUMN journey_leg_id uuid REFERENCES journey_legs(id);

-- Indices para performance
CREATE INDEX idx_expenses_journey_leg_id ON expenses(journey_leg_id);
CREATE INDEX idx_fuel_expenses_journey_leg_id ON fuel_expenses(journey_leg_id);
CREATE INDEX idx_revenue_journey_leg_id ON revenue(journey_leg_id);

-- Migrar dados existentes: vincular ao leg 1 quando journey_id existe
UPDATE expenses SET journey_leg_id = jl.id
FROM journey_legs jl
WHERE expenses.journey_id = jl.journey_id AND jl.leg_number = 1
AND expenses.journey_leg_id IS NULL AND expenses.journey_id IS NOT NULL;

UPDATE fuel_expenses SET journey_leg_id = jl.id
FROM journey_legs jl
WHERE fuel_expenses.journey_id = jl.journey_id AND jl.leg_number = 1
AND fuel_expenses.journey_leg_id IS NULL AND fuel_expenses.journey_id IS NOT NULL;

UPDATE revenue SET journey_leg_id = jl.id
FROM journey_legs jl
WHERE revenue.journey_id = jl.journey_id AND jl.leg_number = 1
AND revenue.journey_leg_id IS NULL AND revenue.journey_id IS NOT NULL;
