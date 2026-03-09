-- Permitir revenue sem jornada vinculada (lançamentos avulsos)
ALTER TABLE revenue ALTER COLUMN journey_id DROP NOT NULL;

COMMENT ON COLUMN revenue.journey_id IS 'ID da jornada vinculada (opcional para lançamentos avulsos)';