-- Add new columns to cte_documents for complete data storage
ALTER TABLE cte_documents ADD COLUMN IF NOT EXISTS cargo_info jsonb;
ALTER TABLE cte_documents ADD COLUMN IF NOT EXISTS vehicle_info jsonb;
ALTER TABLE cte_documents ADD COLUMN IF NOT EXISTS driver_info jsonb;
ALTER TABLE cte_documents ADD COLUMN IF NOT EXISTS tax_info jsonb;
ALTER TABLE cte_documents ADD COLUMN IF NOT EXISTS sender_full jsonb;
ALTER TABLE cte_documents ADD COLUMN IF NOT EXISTS recipient_full jsonb;
ALTER TABLE cte_documents ADD COLUMN IF NOT EXISTS cfop text;
ALTER TABLE cte_documents ADD COLUMN IF NOT EXISTS operation_type text;
ALTER TABLE cte_documents ADD COLUMN IF NOT EXISTS error_message text;

-- Create fiscal audit logs table
CREATE TABLE IF NOT EXISTS fiscal_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id),
  user_id uuid NOT NULL,
  document_type text NOT NULL,
  document_id text NOT NULL,
  document_key text,
  document_number text,
  action text NOT NULL,
  action_status text NOT NULL,
  request_payload jsonb,
  response_payload jsonb,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS on fiscal_audit_logs
ALTER TABLE fiscal_audit_logs ENABLE ROW LEVEL SECURITY;

-- Block anonymous access
CREATE POLICY "Block anonymous access on fiscal_audit_logs" ON fiscal_audit_logs
  AS RESTRICTIVE FOR ALL TO anon USING (false);

-- Users can view audit logs in their company
CREATE POLICY "Users can view fiscal audit logs in their company" ON fiscal_audit_logs
  FOR SELECT USING (user_has_company_access(auth.uid(), company_id));

-- System can insert audit logs
CREATE POLICY "System can insert fiscal audit logs" ON fiscal_audit_logs
  FOR INSERT WITH CHECK (true);

-- Create indexes for audit logs
CREATE INDEX IF NOT EXISTS idx_fiscal_audit_company ON fiscal_audit_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_fiscal_audit_document ON fiscal_audit_logs(document_type, document_id);
CREATE INDEX IF NOT EXISTS idx_fiscal_audit_date ON fiscal_audit_logs(created_at DESC);

-- Add WITH CHECK to cte_documents policies
DROP POLICY IF EXISTS "Users can manage CT-e documents in their company" ON cte_documents;
CREATE POLICY "Users can manage CT-e documents in their company" ON cte_documents
  FOR ALL USING (user_has_company_access(auth.uid(), company_id))
  WITH CHECK (user_has_company_access(auth.uid(), company_id));

-- Add WITH CHECK to cte_anulacao_documents policies
DROP POLICY IF EXISTS "Users can manage CT-e anulacao in their company" ON cte_anulacao_documents;
CREATE POLICY "Users can manage CT-e anulacao in their company" ON cte_anulacao_documents
  FOR ALL USING (user_has_company_access(auth.uid(), company_id))
  WITH CHECK (user_has_company_access(auth.uid(), company_id));

-- Add WITH CHECK to mdfe_documents policies
DROP POLICY IF EXISTS "Users can manage MDF-e in their company" ON mdfe_documents;
CREATE POLICY "Users can manage MDF-e in their company" ON mdfe_documents
  FOR ALL USING (user_has_company_access(auth.uid(), company_id))
  WITH CHECK (user_has_company_access(auth.uid(), company_id));