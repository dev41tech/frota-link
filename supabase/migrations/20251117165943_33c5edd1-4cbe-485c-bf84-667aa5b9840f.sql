-- Add is_direct column to accounts_payable table
ALTER TABLE accounts_payable 
ADD COLUMN is_direct BOOLEAN;

-- Populate existing records based on category classification
UPDATE accounts_payable ap
SET is_direct = (
  SELECT ec.classification = 'direct'
  FROM expense_categories ec
  WHERE ec.id = ap.category_id
)
WHERE ap.category_id IS NOT NULL;

-- Set to false for records without category (default to indirect)
UPDATE accounts_payable 
SET is_direct = false
WHERE is_direct IS NULL;