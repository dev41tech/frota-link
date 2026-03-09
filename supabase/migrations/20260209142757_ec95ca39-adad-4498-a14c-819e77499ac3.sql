
-- fuel_expenses
ALTER TABLE fuel_expenses DROP CONSTRAINT IF EXISTS fuel_expenses_payment_method_check;
ALTER TABLE fuel_expenses ADD CONSTRAINT fuel_expenses_payment_method_check 
  CHECK (payment_method IN ('cash', 'card', 'pix', 'credit', 'tag'));

-- expenses
ALTER TABLE expenses DROP CONSTRAINT IF EXISTS expenses_payment_method_check;
ALTER TABLE expenses ADD CONSTRAINT expenses_payment_method_check 
  CHECK (payment_method IN ('cash', 'card', 'pix', 'credit', 'bank_transfer', 'boleto', 'tag'));

-- accounts_payable
ALTER TABLE accounts_payable DROP CONSTRAINT IF EXISTS accounts_payable_payment_method_check;
ALTER TABLE accounts_payable ADD CONSTRAINT accounts_payable_payment_method_check 
  CHECK (payment_method IN ('cash', 'card', 'pix', 'bank_transfer', 'check', 'boleto', 'tag'));

-- revenue (correct table name)
ALTER TABLE revenue DROP CONSTRAINT IF EXISTS revenues_payment_method_check;
ALTER TABLE revenue DROP CONSTRAINT IF EXISTS revenue_payment_method_check;
ALTER TABLE revenue ADD CONSTRAINT revenue_payment_method_check 
  CHECK (payment_method IN ('cash', 'card', 'pix', 'bank_transfer', 'check', 'tag'));
