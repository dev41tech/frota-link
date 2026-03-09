-- Fase 1: Migration de estrutura e dados para sistema de categorias dinâmicas

-- 1. Garantir que todas as empresas existentes tenham categorias padrão
DO $$
DECLARE
  company_record RECORD;
BEGIN
  FOR company_record IN 
    SELECT DISTINCT c.id as company_id, p.user_id
    FROM companies c
    LEFT JOIN profiles p ON p.company_id = c.id
    WHERE NOT EXISTS (
      SELECT 1 FROM expense_categories ec WHERE ec.company_id = c.id
    )
    LIMIT 1
  LOOP
    PERFORM seed_default_categories(company_record.company_id, company_record.user_id);
  END LOOP;
END $$;

-- 2. Adicionar novas colunas nas tabelas
ALTER TABLE expenses 
ADD COLUMN IF NOT EXISTS category_id UUID,
ADD COLUMN IF NOT EXISTS is_direct BOOLEAN;

ALTER TABLE revenue 
ADD COLUMN IF NOT EXISTS category_id UUID;

ALTER TABLE accounts_payable 
ADD COLUMN IF NOT EXISTS category_id UUID;

-- 3. Criar função helper para mapear categorias TEXT para UUID
CREATE OR REPLACE FUNCTION map_category_to_uuid(
  p_company_id UUID,
  p_category_text TEXT,
  p_table_type TEXT -- 'expense' ou 'revenue'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_category_id UUID;
  v_category_name TEXT;
BEGIN
  -- Normalizar nome da categoria (remover acentos, lowercase, etc)
  v_category_name := CASE p_category_text
    -- Mapeamento de despesas
    WHEN 'combustivel' THEN 'Combustível'
    WHEN 'pedagio' THEN 'Pedágio'
    WHEN 'alimentacao' THEN 'Alimentação'
    WHEN 'hospedagem' THEN 'Hospedagem'
    WHEN 'manutencao' THEN 'Manutenção'
    WHEN 'borracharia' THEN 'Borracharia'
    WHEN 'seguro' THEN 'Seguro'
    WHEN 'impostos' THEN 'Impostos'
    WHEN 'estacionamento' THEN 'Estacionamento'
    WHEN 'outros' THEN 'Outros'
    -- Mapeamento de receitas
    WHEN 'carga' THEN 'Carga'
    WHEN 'frete' THEN 'Frete'
    WHEN 'bonificacao' THEN 'Bonificação'
    ELSE 'Outros'
  END;
  
  -- Buscar categoria correspondente
  IF p_table_type = 'expense' THEN
    SELECT id INTO v_category_id
    FROM expense_categories
    WHERE company_id = p_company_id 
    AND name = v_category_name
    LIMIT 1;
  ELSIF p_table_type = 'revenue' THEN
    SELECT id INTO v_category_id
    FROM revenue_categories
    WHERE company_id = p_company_id 
    AND name = v_category_name
    LIMIT 1;
  END IF;
  
  -- Se não encontrou, buscar categoria "Outros"
  IF v_category_id IS NULL THEN
    IF p_table_type = 'expense' THEN
      SELECT id INTO v_category_id
      FROM expense_categories
      WHERE company_id = p_company_id 
      AND name = 'Outros'
      LIMIT 1;
    ELSIF p_table_type = 'revenue' THEN
      SELECT id INTO v_category_id
      FROM revenue_categories
      WHERE company_id = p_company_id 
      AND name = 'Outros'
      LIMIT 1;
    END IF;
  END IF;
  
  RETURN v_category_id;
END;
$$;

-- 4. Migrar dados de expenses
UPDATE expenses e
SET 
  category_id = map_category_to_uuid(e.company_id, e.category, 'expense'),
  is_direct = CASE 
    WHEN e.journey_id IS NOT NULL THEN true
    ELSE (
      SELECT ec.classification = 'direct'
      FROM expense_categories ec
      WHERE ec.id = map_category_to_uuid(e.company_id, e.category, 'expense')
    )
  END
WHERE category_id IS NULL;

-- 5. Migrar dados de revenue
UPDATE revenue r
SET category_id = map_category_to_uuid(r.company_id, COALESCE(r.category, 'carga'), 'revenue')
WHERE category_id IS NULL;

-- 6. Migrar dados de accounts_payable
UPDATE accounts_payable ap
SET category_id = map_category_to_uuid(ap.company_id, ap.category, 'expense')
WHERE category_id IS NULL;

-- 7. Adicionar FKs (após migração de dados)
ALTER TABLE expenses
ADD CONSTRAINT expenses_category_id_fkey 
FOREIGN KEY (category_id) 
REFERENCES expense_categories(id)
ON DELETE SET NULL;

ALTER TABLE revenue
ADD CONSTRAINT revenue_category_id_fkey 
FOREIGN KEY (category_id) 
REFERENCES revenue_categories(id)
ON DELETE SET NULL;

ALTER TABLE accounts_payable
ADD CONSTRAINT accounts_payable_category_id_fkey 
FOREIGN KEY (category_id) 
REFERENCES expense_categories(id)
ON DELETE SET NULL;

-- 8. Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_expenses_category_id ON expenses(category_id);
CREATE INDEX IF NOT EXISTS idx_revenue_category_id ON revenue(category_id);
CREATE INDEX IF NOT EXISTS idx_accounts_payable_category_id ON accounts_payable(category_id);

-- 9. Criar trigger para seeding automático de categorias em novas empresas
CREATE OR REPLACE FUNCTION trigger_seed_categories_for_new_company()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Aguardar um pouco para garantir que o usuário foi criado
  PERFORM pg_sleep(0.5);
  
  -- Seed categorias padrão para nova empresa
  PERFORM seed_default_categories(
    NEW.id,
    COALESCE(
      (SELECT user_id FROM profiles WHERE company_id = NEW.id LIMIT 1),
      auth.uid()
    )
  );
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS seed_categories_on_company_insert ON companies;
CREATE TRIGGER seed_categories_on_company_insert
AFTER INSERT ON companies
FOR EACH ROW
EXECUTE FUNCTION trigger_seed_categories_for_new_company();

-- 10. Comentários para documentação
COMMENT ON COLUMN expenses.category_id IS 'Referência à categoria de despesa (substitui category TEXT)';
COMMENT ON COLUMN expenses.is_direct IS 'Indica se é despesa direta (vinculada a viagem) ou indireta (fixa/administrativa)';
COMMENT ON COLUMN revenue.category_id IS 'Referência à categoria de receita (substitui category TEXT)';
COMMENT ON COLUMN accounts_payable.category_id IS 'Referência à categoria de despesa (substitui category TEXT)';