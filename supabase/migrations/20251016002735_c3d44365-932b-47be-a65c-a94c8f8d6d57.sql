-- FASE 3: Adicionar suporte a documentos vinculados no CT-e

-- Adicionar coluna para armazenar documentos vinculados (NF-e, CT-e)
ALTER TABLE cte_documents 
ADD COLUMN IF NOT EXISTS linked_documents jsonb DEFAULT '[]'::jsonb;

-- Adicionar coluna para CT-e de referência (casos de complemento/anulação/subcontratação)
ALTER TABLE cte_documents
ADD COLUMN IF NOT EXISTS referenced_cte_key text;

-- Índice GIN para buscar por documentos vinculados
CREATE INDEX IF NOT EXISTS idx_cte_documents_linked_docs 
ON cte_documents USING GIN (linked_documents);

-- Comentários explicativos
COMMENT ON COLUMN cte_documents.linked_documents IS 'Array JSON de NF-es e CT-es vinculados ao documento';
COMMENT ON COLUMN cte_documents.referenced_cte_key IS 'Chave do CT-e de referência para complemento/anulação/subcontratação';