
-- Move unaccent extension to extensions schema
DROP EXTENSION IF EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS unaccent SCHEMA extensions;

-- Update generate_company_slug to use extensions.unaccent
CREATE OR REPLACE FUNCTION public.generate_company_slug(company_name text)
RETURNS text
LANGUAGE plpgsql
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  base_slug text;
  final_slug text;
  counter integer := 0;
BEGIN
  base_slug := lower(extensions.unaccent(company_name));
  base_slug := regexp_replace(base_slug, '\s*(ltda|me|epp|eireli|s\.?a\.?|s/a)\s*$', '', 'i');
  base_slug := regexp_replace(base_slug, '[^a-z0-9]+', '-', 'g');
  base_slug := trim(both '-' from base_slug);
  base_slug := left(base_slug, 50);
  
  final_slug := base_slug;
  
  WHILE EXISTS (SELECT 1 FROM public.companies WHERE slug = final_slug) LOOP
    counter := counter + 1;
    final_slug := base_slug || '-' || counter;
  END LOOP;
  
  RETURN final_slug;
END;
$$;
