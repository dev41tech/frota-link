-- Remove obsolete CHECK constraint from expenses.category field
-- The system now uses dynamic categories via category_id (foreign key to expense_categories)
-- The category text field is kept for backward compatibility and query convenience
ALTER TABLE expenses DROP CONSTRAINT IF EXISTS expenses_category_check;

-- Add comment to document the change
COMMENT ON COLUMN expenses.category IS 'Legacy text field for category name. Use category_id for validated categories.';
COMMENT ON COLUMN expenses.category_id IS 'Foreign key to expense_categories table. Source of truth for category validation.';