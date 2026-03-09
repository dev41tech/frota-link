-- Add columns for draft CT-e functionality
ALTER TABLE cte_documents ADD COLUMN IF NOT EXISTS is_draft BOOLEAN DEFAULT false;
ALTER TABLE cte_documents ADD COLUMN IF NOT EXISTS draft_converted_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE cte_documents ADD COLUMN IF NOT EXISTS draft_converted_from UUID REFERENCES cte_documents(id);

-- Add comment for documentation
COMMENT ON COLUMN cte_documents.is_draft IS 'Indica se o CT-e foi emitido como rascunho (homologação sem valor fiscal)';
COMMENT ON COLUMN cte_documents.draft_converted_at IS 'Data em que o rascunho foi convertido para emissão real';
COMMENT ON COLUMN cte_documents.draft_converted_from IS 'ID do rascunho original que originou este CT-e';

-- Create index for faster filtering of drafts
CREATE INDEX IF NOT EXISTS idx_cte_documents_is_draft ON cte_documents(is_draft) WHERE is_draft = true;