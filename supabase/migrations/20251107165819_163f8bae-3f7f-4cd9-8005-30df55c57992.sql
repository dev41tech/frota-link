-- Adicionar coluna de categoria na tabela revenue
ALTER TABLE revenue ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'carga';

-- Criar índice para performance
CREATE INDEX IF NOT EXISTS idx_revenue_category ON revenue(category);

-- Adicionar comentário explicativo
COMMENT ON COLUMN revenue.category IS 'Categoria da receita: carga, frete, bonificacao, outros';