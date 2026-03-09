
-- Corrigir INSERT
DROP POLICY IF EXISTS "Block anonymous insert to journey_legs" ON journey_legs;
CREATE POLICY "Block anonymous insert to journey_legs" ON journey_legs
  AS RESTRICTIVE FOR INSERT TO public
  WITH CHECK (auth.uid() IS NOT NULL);

-- Corrigir SELECT
DROP POLICY IF EXISTS "Block anonymous access to journey_legs" ON journey_legs;
CREATE POLICY "Block anonymous access to journey_legs" ON journey_legs
  AS RESTRICTIVE FOR SELECT TO public
  USING (auth.uid() IS NOT NULL);

-- Corrigir UPDATE
DROP POLICY IF EXISTS "Block anonymous update to journey_legs" ON journey_legs;
CREATE POLICY "Block anonymous update to journey_legs" ON journey_legs
  AS RESTRICTIVE FOR UPDATE TO public
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- Corrigir DELETE
DROP POLICY IF EXISTS "Block anonymous delete to journey_legs" ON journey_legs;
CREATE POLICY "Block anonymous delete to journey_legs" ON journey_legs
  AS RESTRICTIVE FOR DELETE TO public
  USING (auth.uid() IS NOT NULL);
