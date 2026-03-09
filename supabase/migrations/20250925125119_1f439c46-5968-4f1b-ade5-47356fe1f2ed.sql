-- Clean up all data except Master user
-- First, find the master user
DO $$
DECLARE
    master_user_id uuid;
    master_company_id uuid;
BEGIN
    -- Get master user ID
    SELECT user_id INTO master_user_id 
    FROM user_roles 
    WHERE role = 'master' 
    LIMIT 1;
    
    -- Get master company ID (if exists)
    SELECT company_id INTO master_company_id 
    FROM profiles 
    WHERE user_id = master_user_id 
    LIMIT 1;
    
    -- Clean operational data
    DELETE FROM cte_documents;
    DELETE FROM accounts_payable;
    DELETE FROM fuel_expenses;
    DELETE FROM revenue;
    DELETE FROM expenses;
    DELETE FROM journeys;
    DELETE FROM drivers;
    DELETE FROM vehicles;
    DELETE FROM gas_stations;
    DELETE FROM cte_settings;
    DELETE FROM digital_certificates;
    
    -- Clean audit logs (keep some for compliance)
    DELETE FROM audit_logs WHERE created_at < NOW() - INTERVAL '30 days';
    
    -- Clean user roles except master
    DELETE FROM user_roles WHERE role != 'master';
    
    -- Clean profiles except master
    DELETE FROM profiles WHERE user_id != master_user_id;
    
    -- Clean companies except master's company (if exists)
    IF master_company_id IS NOT NULL THEN
        DELETE FROM companies WHERE id != master_company_id;
    ELSE
        DELETE FROM companies;
    END IF;
END $$;

-- Create subscription plans table
CREATE TABLE IF NOT EXISTS subscription_plans (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    vehicle_limit integer NOT NULL CHECK (vehicle_limit > 0),
    monthly_price numeric(10,2) NOT NULL CHECK (monthly_price >= 0),
    features jsonb DEFAULT '[]'::jsonb,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on subscription_plans
ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;

-- Master users can manage all subscription plans
CREATE POLICY "Master users can manage subscription plans" ON subscription_plans
FOR ALL USING (is_master_user(auth.uid()));

-- Add subscription columns to companies table
ALTER TABLE companies 
ADD COLUMN IF NOT EXISTS subscription_plan_id uuid REFERENCES subscription_plans(id),
ADD COLUMN IF NOT EXISTS vehicle_limit integer DEFAULT 5 CHECK (vehicle_limit > 0),
ADD COLUMN IF NOT EXISTS subscription_status text DEFAULT 'active' CHECK (subscription_status IN ('trial', 'active', 'suspended', 'cancelled')),
ADD COLUMN IF NOT EXISTS subscription_started_at timestamp with time zone DEFAULT now(),
ADD COLUMN IF NOT EXISTS next_billing_date date DEFAULT (CURRENT_DATE + INTERVAL '30 days');

-- Create default subscription plans
INSERT INTO subscription_plans (name, vehicle_limit, monthly_price, features) VALUES
('Starter', 5, 99.00, '["Gestão básica de veículos", "Relatórios simples", "Até 5 placas"]'),
('Professional', 15, 249.00, '["Relatórios avançados", "CT-e automático", "API de integração", "Até 15 placas", "Suporte prioritário"]'),
('Enterprise', 50, 599.00, '["Recursos completos", "Integração ERP", "Relatórios personalizados", "Até 50 placas", "Suporte dedicado", "Multi-usuários ilimitado"]');

-- Create policy to enforce vehicle limits
CREATE OR REPLACE FUNCTION check_vehicle_limit()
RETURNS trigger AS $$
DECLARE
    current_count integer;
    company_limit integer;
BEGIN
    -- Get current vehicle count for the company
    SELECT COUNT(*) INTO current_count
    FROM vehicles 
    WHERE company_id = NEW.company_id;
    
    -- Get company vehicle limit
    SELECT COALESCE(c.vehicle_limit, sp.vehicle_limit, 5) INTO company_limit
    FROM companies c 
    LEFT JOIN subscription_plans sp ON c.subscription_plan_id = sp.id
    WHERE c.id = NEW.company_id;
    
    -- Check if adding this vehicle would exceed the limit
    IF current_count >= company_limit THEN
        RAISE EXCEPTION 'Vehicle limit exceeded. Current plan allows up to % vehicles.', company_limit;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to check vehicle limit on insert
DROP TRIGGER IF EXISTS enforce_vehicle_limit ON vehicles;
CREATE TRIGGER enforce_vehicle_limit
    BEFORE INSERT ON vehicles
    FOR EACH ROW
    EXECUTE FUNCTION check_vehicle_limit();

-- Add trigger for updated_at on subscription_plans
CREATE TRIGGER update_subscription_plans_updated_at
    BEFORE UPDATE ON subscription_plans
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();