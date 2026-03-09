
-- Enable unaccent extension first
CREATE EXTENSION IF NOT EXISTS unaccent;

-- Add slug column to companies
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS slug text;

-- Add short_code column to customer_portal_tokens
ALTER TABLE public.customer_portal_tokens ADD COLUMN IF NOT EXISTS short_code text;

-- Create unique indexes
CREATE UNIQUE INDEX IF NOT EXISTS companies_slug_unique ON public.companies (slug) WHERE slug IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS customer_portal_tokens_short_code_unique ON public.customer_portal_tokens (short_code) WHERE short_code IS NOT NULL;

-- Function to generate slug from company name
CREATE OR REPLACE FUNCTION public.generate_company_slug(company_name text)
RETURNS text
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  base_slug text;
  final_slug text;
  counter integer := 0;
BEGIN
  base_slug := lower(unaccent(company_name));
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

-- Function to generate random short code (8 chars)
CREATE OR REPLACE FUNCTION public.generate_short_code()
RETURNS text
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  chars text := 'abcdefghijklmnopqrstuvwxyz0123456789';
  result text := '';
  i integer;
  code text;
BEGIN
  LOOP
    result := '';
    FOR i IN 1..8 LOOP
      result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
    END LOOP;
    code := result;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.customer_portal_tokens WHERE short_code = code);
  END LOOP;
  RETURN code;
END;
$$;

-- Trigger function for company slug
CREATE OR REPLACE FUNCTION public.set_company_slug()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.slug IS NULL OR (TG_OP = 'UPDATE' AND OLD.name IS DISTINCT FROM NEW.name AND NEW.slug = OLD.slug) THEN
    NEW.slug := public.generate_company_slug(NEW.name);
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger function for token short_code
CREATE OR REPLACE FUNCTION public.set_token_short_code()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.short_code IS NULL THEN
    NEW.short_code := public.generate_short_code();
  END IF;
  RETURN NEW;
END;
$$;

-- Create triggers
DROP TRIGGER IF EXISTS trigger_set_company_slug ON public.companies;
CREATE TRIGGER trigger_set_company_slug
  BEFORE INSERT OR UPDATE ON public.companies
  FOR EACH ROW
  EXECUTE FUNCTION public.set_company_slug();

DROP TRIGGER IF EXISTS trigger_set_token_short_code ON public.customer_portal_tokens;
CREATE TRIGGER trigger_set_token_short_code
  BEFORE INSERT ON public.customer_portal_tokens
  FOR EACH ROW
  EXECUTE FUNCTION public.set_token_short_code();

-- Backfill existing companies with slugs
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id, name FROM public.companies WHERE slug IS NULL LOOP
    UPDATE public.companies SET slug = public.generate_company_slug(r.name) WHERE id = r.id;
  END LOOP;
END;
$$;

-- Backfill existing tokens with short_codes
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.customer_portal_tokens WHERE short_code IS NULL LOOP
    UPDATE public.customer_portal_tokens SET short_code = public.generate_short_code() WHERE id = r.id;
  END LOOP;
END;
$$;
