-- Fix RLS policies for inventory_items and stock_movements tables
-- to enable XML import and stock operations

-- 1. Drop problematic policies from inventory_items
DROP POLICY IF EXISTS "Acesso restrito inventario" ON inventory_items;

-- 2. Drop overly permissive policy from stock_movements
DROP POLICY IF EXISTS "Permitir acesso total a stock_movements" ON stock_movements;

-- 3. Create correct policies for inventory_items
-- Block anonymous access
CREATE POLICY "Block anonymous access to inventory_items"
ON inventory_items FOR ALL
TO anon
USING (false)
WITH CHECK (false);

-- Allow authenticated users to manage inventory items in their company
CREATE POLICY "Users can manage inventory items in their company"
ON inventory_items FOR ALL
TO authenticated
USING (user_has_company_access(auth.uid(), company_id))
WITH CHECK (user_has_company_access(auth.uid(), company_id));

-- 4. Create correct policies for stock_movements
-- Block anonymous access
CREATE POLICY "Block anonymous access to stock_movements"
ON stock_movements FOR ALL
TO anon
USING (false)
WITH CHECK (false);

-- Allow authenticated users to manage stock movements in their company
CREATE POLICY "Users can manage stock movements in their company"
ON stock_movements FOR ALL
TO authenticated
USING (user_has_company_access(auth.uid(), company_id))
WITH CHECK (user_has_company_access(auth.uid(), company_id));