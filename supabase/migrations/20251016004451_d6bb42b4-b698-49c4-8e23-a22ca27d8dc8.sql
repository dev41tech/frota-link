-- Create fiscal_document_lookups table for audit
CREATE TABLE IF NOT EXISTS fiscal_document_lookups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  access_key text NOT NULL,
  document_type text NOT NULL CHECK (document_type IN ('nfe', 'cte')),
  success boolean NOT NULL DEFAULT false,
  error_message text,
  raw_xml text,
  parsed_data jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for better performance
CREATE INDEX idx_fiscal_lookups_company ON fiscal_document_lookups(company_id);
CREATE INDEX idx_fiscal_lookups_access_key ON fiscal_document_lookups(access_key);
CREATE INDEX idx_fiscal_lookups_created_at ON fiscal_document_lookups(created_at DESC);
CREATE INDEX idx_fiscal_lookups_user ON fiscal_document_lookups(user_id);

-- Enable RLS
ALTER TABLE fiscal_document_lookups ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Block anonymous access to fiscal_document_lookups"
  ON fiscal_document_lookups
  FOR ALL
  TO anon
  USING (false)
  WITH CHECK (false);

CREATE POLICY "Users can view lookups from their company"
  ON fiscal_document_lookups
  FOR SELECT
  TO authenticated
  USING (user_has_company_access(auth.uid(), company_id));

CREATE POLICY "Users can insert lookups"
  ON fiscal_document_lookups
  FOR INSERT
  TO authenticated
  WITH CHECK (user_has_company_access(auth.uid(), company_id));