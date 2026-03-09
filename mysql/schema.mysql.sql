-- =============================================================
-- FROTA-LINK – Schema MySQL 8.0
-- Gerado a partir das migrations Supabase (PostgreSQL)
-- Referência: supabase/migrations/ (120+ arquivos)
-- Decisões de tipo: ver /mysql/type-mapping.md
-- =============================================================

SET NAMES utf8mb4;
SET time_zone = '+00:00';
SET foreign_key_checks = 0;   -- desabilitado durante criação; reabilitado no final
SET sql_mode = 'STRICT_TRANS_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION';

-- =============================================================
-- SEQUÊNCIA PARA freight_requests (substitui pg SEQUENCE)
-- =============================================================
CREATE TABLE IF NOT EXISTS freight_request_sequences (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Tabela auxiliar que simula a SEQUENCE freight_request_number_seq do Postgres';

-- =============================================================
-- 1. SUBSCRIPTION_PLANS
-- =============================================================
CREATE TABLE IF NOT EXISTS subscription_plans (
  id             CHAR(36)      NOT NULL DEFAULT (UUID()) PRIMARY KEY,
  name           TEXT          NOT NULL,
  vehicle_limit  INT           NOT NULL,
  monthly_price  DECIMAL(10,2) NOT NULL,
  price_per_vehicle DECIMAL(10,2) NULL,
  pricing_model  TEXT          NULL,
  features       JSON          NULL,
  is_active      TINYINT(1)    NOT NULL DEFAULT 1,
  has_simulator  TINYINT(1)    NOT NULL DEFAULT 0,
  has_ai         TINYINT(1)    NOT NULL DEFAULT 0,
  has_copilot    TINYINT(1)    NOT NULL DEFAULT 0,
  has_pwa_driver TINYINT(1)    NOT NULL DEFAULT 0,
  has_dedicated_support TINYINT(1) NOT NULL DEFAULT 0,
  has_geolocation TINYINT(1)  NOT NULL DEFAULT 0,
  min_price      DECIMAL(10,2) NULL,
  created_at     DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at     DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  CONSTRAINT subscription_plans_vehicle_limit_check CHECK (vehicle_limit > 0),
  CONSTRAINT subscription_plans_monthly_price_check CHECK (monthly_price >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================
-- 2. SYSTEM_SETTINGS
-- =============================================================
CREATE TABLE IF NOT EXISTS system_settings (
  id            CHAR(36) NOT NULL DEFAULT (UUID()) PRIMARY KEY,
  setting_key   TEXT     NOT NULL,
  setting_value JSON     NOT NULL,
  setting_type  TEXT     NOT NULL,
  description   TEXT     NULL,
  updated_by    CHAR(36) NULL,   -- ref auth.users (sem FK)
  updated_at    DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  UNIQUE KEY uq_setting_key (setting_key(255))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================
-- 3. VEHICLE_CONSUMPTION_REFERENCES
-- =============================================================
CREATE TABLE IF NOT EXISTS vehicle_consumption_references (
  id                   CHAR(36)      NOT NULL DEFAULT (UUID()) PRIMARY KEY,
  brand                TEXT          NOT NULL,
  model_pattern        TEXT          NOT NULL,
  vehicle_category     TEXT          NOT NULL DEFAULT 'medio',
  expected_consumption DECIMAL(10,4) NOT NULL,
  min_consumption      DECIMAL(10,4) NULL,
  max_consumption      DECIMAL(10,4) NULL,
  created_at           DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at           DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  UNIQUE KEY uq_brand_model_pattern (brand(100), model_pattern(100))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================
-- 4. COMPANIES
-- =============================================================
CREATE TABLE IF NOT EXISTS companies (
  id                           CHAR(36)      NOT NULL DEFAULT (UUID()) PRIMARY KEY,
  cnpj                         TEXT          NOT NULL,
  name                         TEXT          NOT NULL,
  responsible_name             TEXT          NOT NULL,
  responsible_cpf              TEXT          NOT NULL,
  address                      TEXT          NOT NULL,
  city                         TEXT          NULL,
  state                        TEXT          NULL,
  zip_code                     TEXT          NULL,
  phone                        TEXT          NULL,
  email                        TEXT          NULL,
  status                       TEXT          NOT NULL DEFAULT 'active',
  subscription_plan_id         CHAR(36)      NULL,
  vehicle_limit                INT           NOT NULL DEFAULT 5,
  subscription_status          TEXT          NOT NULL DEFAULT 'active',
  subscription_started_at      DATETIME(6)   NULL DEFAULT CURRENT_TIMESTAMP(6),
  next_billing_date            DATE          NULL,
  default_target_consumption   DECIMAL(5,2)  NULL DEFAULT 3.5,
  consumption_alert_threshold  DECIMAL(3,0)  NULL DEFAULT 15,
  asaas_customer_id            TEXT          NULL,
  asaas_subscription_id        TEXT          NULL,
  billing_email                TEXT          NULL,
  billing_cpf_cnpj             TEXT          NULL,
  contracted_price_per_vehicle DECIMAL(10,2) NULL,
  cte_module_enabled           TINYINT(1)    NOT NULL DEFAULT 0,
  cte_monthly_limit            INT           NULL,
  coupling_module_enabled      TINYINT(1)    NOT NULL DEFAULT 0,
  coupling_asset_limit         INT           NULL,
  slug                         TEXT          NULL,
  created_at                   DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at                   DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  UNIQUE KEY uq_companies_cnpj (cnpj(50)),
  UNIQUE KEY uq_companies_slug (slug(255)),
  CONSTRAINT companies_vehicle_limit_check CHECK (vehicle_limit > 0),
  CONSTRAINT companies_subscription_status_check CHECK (subscription_status IN ('trial','active','suspended','cancelled')),
  CONSTRAINT fk_companies_subscription_plan FOREIGN KEY (subscription_plan_id) REFERENCES subscription_plans(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_companies_status        ON companies(status);
CREATE INDEX idx_companies_subscription  ON companies(subscription_plan_id);

-- =============================================================
-- 5. PROFILES
-- =============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id                       CHAR(36)     NOT NULL DEFAULT (UUID()) PRIMARY KEY,
  user_id                  CHAR(36)     NOT NULL,   -- ref auth.users (sem FK: auth externo)
  full_name                TEXT         NULL,
  email                    TEXT         NULL,
  company_name             TEXT         NULL,
  phone                    TEXT         NULL,
  role                     ENUM('master','admin','gestor','motorista','bpo','suporte') NOT NULL DEFAULT 'admin',
  company_id               CHAR(36)     NULL,
  status                   TEXT         NULL DEFAULT 'active',
  password_change_required TINYINT(1)   NULL DEFAULT 0,
  created_at               DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at               DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  UNIQUE KEY uq_profiles_user_id (user_id),
  CONSTRAINT profiles_status_check CHECK (status IN ('active','inactive')),
  CONSTRAINT fk_profiles_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_profiles_company ON profiles(company_id);
CREATE INDEX idx_profiles_status  ON profiles(status);

-- =============================================================
-- 6. USER_ROLES
-- =============================================================
CREATE TABLE IF NOT EXISTS user_roles (
  id         CHAR(36)    NOT NULL DEFAULT (UUID()) PRIMARY KEY,
  user_id    CHAR(36)    NOT NULL,   -- ref auth.users (sem FK)
  company_id CHAR(36)    NOT NULL,
  role       ENUM('master','admin','gestor','motorista','bpo','suporte') NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  UNIQUE KEY uq_user_roles_user_company (user_id, company_id),
  CONSTRAINT fk_user_roles_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_user_roles_user    ON user_roles(user_id);
CREATE INDEX idx_user_roles_company ON user_roles(company_id);
CREATE INDEX idx_user_roles_role    ON user_roles(role);

-- =============================================================
-- 7. BPO_COMPANY_ACCESS
-- =============================================================
CREATE TABLE IF NOT EXISTS bpo_company_access (
  id          CHAR(36)    NOT NULL DEFAULT (UUID()) PRIMARY KEY,
  bpo_user_id CHAR(36)    NOT NULL,   -- ref auth.users (sem FK)
  company_id  CHAR(36)    NOT NULL,
  granted_by  CHAR(36)    NOT NULL,   -- ref auth.users (sem FK)
  granted_at  DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  revoked_at  DATETIME(6) NULL,
  notes       TEXT        NULL,
  created_at  DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at  DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  UNIQUE KEY uq_bpo_user_company (bpo_user_id, company_id),
  CONSTRAINT fk_bpo_company_access_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_bpo_company_access_bpo_user ON bpo_company_access(bpo_user_id);
CREATE INDEX idx_bpo_company_access_company  ON bpo_company_access(company_id);
CREATE INDEX idx_bpo_company_access_active   ON bpo_company_access(bpo_user_id, company_id, revoked_at);

-- =============================================================
-- 8. AUDIT_LOGS
-- =============================================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id         CHAR(36)    NOT NULL DEFAULT (UUID()) PRIMARY KEY,
  user_id    CHAR(36)    NOT NULL,   -- ref auth.users (sem FK)
  company_id CHAR(36)    NULL,
  action     TEXT        NOT NULL,
  table_name TEXT        NULL,
  record_id  CHAR(36)    NULL,
  old_values JSON        NULL,
  new_values JSON        NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  CONSTRAINT fk_audit_logs_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_audit_logs_company    ON audit_logs(company_id);
CREATE INDEX idx_audit_logs_user       ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);

-- =============================================================
-- 9. SYSTEM_ALERTS
-- =============================================================
CREATE TABLE IF NOT EXISTS system_alerts (
  id          CHAR(36)    NOT NULL DEFAULT (UUID()) PRIMARY KEY,
  company_id  CHAR(36)    NULL,
  alert_type  TEXT        NOT NULL,
  severity    TEXT        NOT NULL,
  title       TEXT        NOT NULL,
  description TEXT        NOT NULL,
  status      TEXT        NOT NULL DEFAULT 'active',
  metadata    JSON        NULL,
  created_at  DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  resolved_at DATETIME(6) NULL,
  resolved_by CHAR(36)    NULL,   -- ref auth.users (sem FK)
  CONSTRAINT fk_system_alerts_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_system_alerts_company ON system_alerts(company_id, status, created_at);

-- =============================================================
-- 10. USAGE_LOGS
-- =============================================================
CREATE TABLE IF NOT EXISTS usage_logs (
  id         CHAR(36)    NOT NULL DEFAULT (UUID()) PRIMARY KEY,
  company_id CHAR(36)    NOT NULL,
  user_id    CHAR(36)    NOT NULL,   -- ref auth.users (sem FK)
  action     TEXT        NOT NULL,
  module     TEXT        NOT NULL,
  metadata   JSON        NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  CONSTRAINT fk_usage_logs_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_usage_logs_company ON usage_logs(company_id);
CREATE INDEX idx_usage_logs_user    ON usage_logs(user_id);

-- =============================================================
-- 11. INVOICES
-- =============================================================
CREATE TABLE IF NOT EXISTS invoices (
  id                    CHAR(36)      NOT NULL DEFAULT (UUID()) PRIMARY KEY,
  company_id            CHAR(36)      NOT NULL,
  plan_id               CHAR(36)      NOT NULL,
  amount                DECIMAL(12,2) NOT NULL,
  due_date              DATE          NOT NULL,
  paid_date             DATE          NULL,
  status                TEXT          NOT NULL DEFAULT 'pending',
  billing_period_start  DATE          NOT NULL,
  billing_period_end    DATE          NOT NULL,
  asaas_payment_id      TEXT          NULL,
  asaas_invoice_url     TEXT          NULL,
  payment_method        TEXT          NULL,
  asaas_customer_id     TEXT          NULL,
  billing_kind          TEXT          NULL,
  deleted_at            DATETIME(6)   NULL,
  created_at            DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at            DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  CONSTRAINT fk_invoices_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  CONSTRAINT fk_invoices_plan    FOREIGN KEY (plan_id)    REFERENCES subscription_plans(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_invoices_company  ON invoices(company_id);
CREATE INDEX idx_invoices_status   ON invoices(status);
-- Unique parcial: asaas_payment_id WHERE NOT NULL (MySQL não suporta parcial; usamos índice UNIQUE nullable)
CREATE UNIQUE INDEX uq_invoices_asaas_payment ON invoices(asaas_payment_id);

-- =============================================================
-- 12. GAS_STATIONS
-- =============================================================
CREATE TABLE IF NOT EXISTS gas_stations (
  id         CHAR(36)    NOT NULL DEFAULT (UUID()) PRIMARY KEY,
  user_id    CHAR(36)    NOT NULL,   -- ref auth.users (sem FK)
  company_id CHAR(36)    NULL,
  name       TEXT        NOT NULL,
  address    TEXT        NULL,
  city       TEXT        NULL,
  state      TEXT        NULL,
  phone      TEXT        NULL,
  cnpj       TEXT        NULL,
  status     TEXT        NOT NULL DEFAULT 'active',
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  CONSTRAINT gas_stations_status_check CHECK (status IN ('active','inactive')),
  CONSTRAINT fk_gas_stations_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_gas_stations_company ON gas_stations(company_id);

-- =============================================================
-- 13. PARTIES (customers & suppliers)
-- =============================================================
CREATE TABLE IF NOT EXISTS parties (
  id                 CHAR(36)    NOT NULL DEFAULT (UUID()) PRIMARY KEY,
  company_id         CHAR(36)    NOT NULL,
  user_id            CHAR(36)    NOT NULL,   -- ref auth.users (sem FK)
  type               TEXT        NOT NULL,
  name               TEXT        NOT NULL,
  document           TEXT        NULL,
  email              TEXT        NULL,
  phone              TEXT        NULL,
  address_street     TEXT        NULL,
  address_number     TEXT        NULL,
  address_complement TEXT        NULL,
  address_district   TEXT        NULL,
  address_city       TEXT        NULL,
  address_state      TEXT        NULL,
  address_zip        TEXT        NULL,
  ie                 TEXT        NULL,
  notes              TEXT        NULL,
  is_active          TINYINT(1)  NOT NULL DEFAULT 1,
  portal_enabled     TINYINT(1)  NOT NULL DEFAULT 0,
  created_at         DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at         DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  CONSTRAINT parties_type_check CHECK (type IN ('customer','supplier')),
  CONSTRAINT fk_parties_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_parties_company  ON parties(company_id);
CREATE INDEX idx_parties_type     ON parties(type);
CREATE INDEX idx_parties_document ON parties(document(100));
CREATE INDEX idx_parties_name     ON parties(name(100));

-- =============================================================
-- 14. EXPENSE_CATEGORIES
-- =============================================================
CREATE TABLE IF NOT EXISTS expense_categories (
  id             CHAR(36)    NOT NULL DEFAULT (UUID()) PRIMARY KEY,
  company_id     CHAR(36)    NOT NULL,
  user_id        CHAR(36)    NOT NULL,   -- ref auth.users (sem FK)
  name           TEXT        NOT NULL,
  classification TEXT        NOT NULL,
  icon           TEXT        NULL DEFAULT 'Package',
  color          TEXT        NULL DEFAULT '#6B7280',
  is_active      TINYINT(1)  NOT NULL DEFAULT 1,
  is_system      TINYINT(1)  NOT NULL DEFAULT 0,
  created_at     DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at     DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  UNIQUE KEY uq_expense_categories_company_name (company_id, name(200)),
  CONSTRAINT expense_categories_classification_check CHECK (classification IN ('direct','indirect')),
  CONSTRAINT fk_expense_categories_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================
-- 15. REVENUE_CATEGORIES
-- =============================================================
CREATE TABLE IF NOT EXISTS revenue_categories (
  id         CHAR(36)    NOT NULL DEFAULT (UUID()) PRIMARY KEY,
  company_id CHAR(36)    NOT NULL,
  user_id    CHAR(36)    NOT NULL,   -- ref auth.users (sem FK)
  name       TEXT        NOT NULL,
  icon       TEXT        NULL DEFAULT 'DollarSign',
  color      TEXT        NULL DEFAULT '#10B981',
  is_active  TINYINT(1)  NOT NULL DEFAULT 1,
  is_system  TINYINT(1)  NOT NULL DEFAULT 0,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  UNIQUE KEY uq_revenue_categories_company_name (company_id, name(200)),
  CONSTRAINT fk_revenue_categories_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================
-- 16. WORKSHOPS
-- =============================================================
CREATE TABLE IF NOT EXISTS workshops (
  id          CHAR(36)      NOT NULL DEFAULT (UUID()) PRIMARY KEY,
  company_id  CHAR(36)      NOT NULL,
  user_id     CHAR(36)      NOT NULL,   -- ref auth.users (sem FK)
  name        TEXT          NOT NULL,
  cnpj        TEXT          NULL,
  phone       TEXT          NULL,
  email       TEXT          NULL,
  address     TEXT          NULL,
  city        TEXT          NULL,
  state       TEXT          NULL,
  specialties JSON          NULL COMMENT 'TEXT[] do Postgres convertido para JSON. Ex: ["funilaria","mecanica"]',
  rating      DECIMAL(2,1)  NULL,
  notes       TEXT          NULL,
  status      TEXT          NOT NULL DEFAULT 'active',
  created_at  DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at  DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  CONSTRAINT workshops_status_check  CHECK (status  IN ('active','inactive')),
  CONSTRAINT workshops_rating_check  CHECK (rating IS NULL OR (rating >= 1.0 AND rating <= 5.0)),
  CONSTRAINT fk_workshops_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_workshops_company ON workshops(company_id);
CREATE INDEX idx_workshops_status  ON workshops(status);

-- =============================================================
-- 17. CTE_SETTINGS
-- =============================================================
CREATE TABLE IF NOT EXISTS cte_settings (
  id                       CHAR(36)    NOT NULL DEFAULT (UUID()) PRIMARY KEY,
  company_id               CHAR(36)    NOT NULL,
  user_id                  CHAR(36)    NOT NULL,   -- ref auth.users (sem FK)
  nuvem_fiscal_company_id  TEXT        NOT NULL,
  environment              TEXT        NOT NULL DEFAULT 'homologacao',
  default_series           TEXT        NOT NULL DEFAULT '1',
  auto_emit_enabled        TINYINT(1)  NOT NULL DEFAULT 0,
  certificate_name         TEXT        NULL,
  certificate_expires_at   DATETIME(6) NULL,
  created_at               DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at               DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  UNIQUE KEY uq_cte_settings_company (company_id),
  CONSTRAINT fk_cte_settings_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================
-- 18. CTE_SERIES
-- =============================================================
CREATE TABLE IF NOT EXISTS cte_series (
  id          CHAR(36)    NOT NULL DEFAULT (UUID()) PRIMARY KEY,
  company_id  CHAR(36)    NOT NULL,
  series      TEXT        NOT NULL,
  next_number INT         NOT NULL DEFAULT 1,
  description TEXT        NULL,
  is_active   TINYINT(1)  NOT NULL DEFAULT 1,
  created_at  DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at  DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  UNIQUE KEY uq_cte_series_company_series (company_id, series(50)),
  CONSTRAINT fk_cte_series_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_cte_series_company_active ON cte_series(company_id, is_active);

-- =============================================================
-- 19. DIGITAL_CERTIFICATES
-- =============================================================
CREATE TABLE IF NOT EXISTS digital_certificates (
  id                          CHAR(36)    NOT NULL DEFAULT (UUID()) PRIMARY KEY,
  company_id                  CHAR(36)    NOT NULL,
  user_id                     CHAR(36)    NOT NULL,   -- ref auth.users (sem FK)
  certificate_name            TEXT        NOT NULL,
  nuvem_fiscal_certificate_id TEXT        NULL,
  expires_at                  DATETIME(6) NOT NULL,
  status                      TEXT        NOT NULL DEFAULT 'active',
  uploaded_at                 DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  created_at                  DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at                  DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  CONSTRAINT fk_digital_certificates_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_digital_certificates_company ON digital_certificates(company_id);

-- =============================================================
-- 20. FISCAL_PARTY_TEMPLATES
-- =============================================================
CREATE TABLE IF NOT EXISTS fiscal_party_templates (
  id                 CHAR(36)    NOT NULL DEFAULT (UUID()) PRIMARY KEY,
  company_id         CHAR(36)    NOT NULL,
  type               TEXT        NOT NULL,
  name               TEXT        NOT NULL,
  document           TEXT        NOT NULL,
  address_street     TEXT        NULL,
  address_number     TEXT        NULL,
  address_complement TEXT        NULL,
  address_district   TEXT        NULL,
  address_city       TEXT        NULL,
  address_state      TEXT        NULL,
  address_zip        TEXT        NULL,
  phone              TEXT        NULL,
  email              TEXT        NULL,
  ie                 TEXT        NULL,
  created_at         DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at         DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  CONSTRAINT fiscal_party_templates_type_check CHECK (type IN ('sender','recipient','carrier')),
  CONSTRAINT fk_fiscal_party_templates_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_fiscal_party_templates_company ON fiscal_party_templates(company_id);

-- =============================================================
-- 21. FREIGHT_RATES
-- =============================================================
CREATE TABLE IF NOT EXISTS freight_rates (
  id                  CHAR(36)      NOT NULL DEFAULT (UUID()) PRIMARY KEY,
  company_id          CHAR(36)      NOT NULL,
  origin_state        TEXT          NULL,
  destination_state   TEXT          NULL,
  origin_city         TEXT          NULL,
  destination_city    TEXT          NULL,
  min_weight_kg       DECIMAL(12,3) NOT NULL DEFAULT 0,
  max_weight_kg       DECIMAL(12,3) NOT NULL DEFAULT 999999,
  rate_per_kg         DECIMAL(12,4) NOT NULL DEFAULT 0,
  minimum_freight     DECIMAL(12,2) NOT NULL DEFAULT 0,
  cubage_factor       DECIMAL(10,2) NULL DEFAULT 300,
  volume_rate         DECIMAL(12,4) NULL,
  is_active           TINYINT(1)    NOT NULL DEFAULT 1,
  created_at          DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at          DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  CONSTRAINT fk_freight_rates_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_freight_rates_company ON freight_rates(company_id);

-- =============================================================
-- 22. FREIGHT_PRICING_SETTINGS
-- =============================================================
CREATE TABLE IF NOT EXISTS freight_pricing_settings (
  id                    CHAR(36)      NOT NULL DEFAULT (UUID()) PRIMARY KEY,
  company_id            CHAR(36)      NOT NULL,
  avg_consumption_kml   DECIMAL(10,4) NULL,
  avg_diesel_price      DECIMAL(10,4) NULL,
  driver_commission     DECIMAL(10,2) NOT NULL DEFAULT 12,
  profit_margin         DECIMAL(10,2) NOT NULL DEFAULT 30,
  default_axles         INT           NOT NULL DEFAULT 7,
  toll_cost_per_axle_km DECIMAL(10,4) NOT NULL DEFAULT 0.11,
  created_at            DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at            DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  UNIQUE KEY uq_freight_pricing_settings_company (company_id),
  CONSTRAINT fk_freight_pricing_settings_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================
-- 23. VEHICLES
-- =============================================================
CREATE TABLE IF NOT EXISTS vehicles (
  id                        CHAR(36)      NOT NULL DEFAULT (UUID()) PRIMARY KEY,
  user_id                   CHAR(36)      NOT NULL,   -- ref auth.users (sem FK)
  company_id                CHAR(36)      NULL,
  plate                     TEXT          NOT NULL,
  model                     TEXT          NOT NULL,
  brand                     TEXT          NULL,
  year                      INT           NULL,
  chassis                   TEXT          NULL,
  renavam                   TEXT          NULL,
  fuel_type                 TEXT          NOT NULL DEFAULT 'diesel',
  tank_capacity             DECIMAL(10,2) NULL,
  avg_consumption           DECIMAL(5,2)  NULL,
  target_consumption        DECIMAL(5,2)  NULL,
  actual_consumption        DECIMAL(5,2)  NULL,
  consumption_last_updated  DATETIME(6)   NULL,
  status                    TEXT          NOT NULL DEFAULT 'active',
  purchase_date             DATE          NULL,
  purchase_value            DECIMAL(12,2) NULL,
  current_value             DECIMAL(12,2) NULL,
  insurance_company         TEXT          NULL,
  insurance_policy          TEXT          NULL,
  insurance_expiry          DATE          NULL,
  vehicle_type              TEXT          NULL DEFAULT 'truck',
  trailer_type              TEXT          NULL,
  axle_count                INT           NULL,
  load_capacity             DECIMAL(12,2) NULL,
  created_at                DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at                DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  CONSTRAINT vehicles_fuel_type_check CHECK (fuel_type IN ('diesel','gasoline','ethanol','hybrid','electric')),
  CONSTRAINT vehicles_status_check    CHECK (status    IN ('active','inactive','maintenance','sold')),
  CONSTRAINT fk_vehicles_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_vehicles_user_id        ON vehicles(user_id);
CREATE INDEX idx_vehicles_company        ON vehicles(company_id);
CREATE INDEX idx_vehicles_status         ON vehicles(status);
CREATE INDEX idx_vehicles_type           ON vehicles(vehicle_type);
CREATE INDEX idx_vehicles_company_type   ON vehicles(company_id, vehicle_type);

-- =============================================================
-- 24. DRIVERS
-- =============================================================
CREATE TABLE IF NOT EXISTS drivers (
  id                              CHAR(36)    NOT NULL DEFAULT (UUID()) PRIMARY KEY,
  user_id                         CHAR(36)    NOT NULL,   -- ref auth.users (sem FK)
  company_id                      CHAR(36)    NULL,
  auth_user_id                    CHAR(36)    NULL,       -- ref auth.users (sem FK)
  name                            TEXT        NOT NULL,
  cpf                             TEXT        NULL,
  cnh                             TEXT        NULL,
  cnh_category                    TEXT        NULL,
  cnh_expiry                      DATE        NULL,
  phone                           TEXT        NULL,
  email                           TEXT        NULL,
  address                         TEXT        NULL,
  emergency_contact               TEXT        NULL,
  emergency_phone                 TEXT        NULL,
  status                          TEXT        NOT NULL DEFAULT 'active',
  can_add_revenue                 TINYINT(1)  NOT NULL DEFAULT 0,
  can_start_journey               TINYINT(1)  NOT NULL DEFAULT 1,
  can_auto_close_journey          TINYINT(1)  NOT NULL DEFAULT 0,
  can_create_journey_without_approval TINYINT(1) NOT NULL DEFAULT 0,
  created_at                      DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at                      DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  UNIQUE KEY uq_drivers_cpf (cpf(20)),
  UNIQUE KEY uq_drivers_cnh (cnh(20)),
  CONSTRAINT drivers_status_check CHECK (status IN ('active','inactive','suspended')),
  CONSTRAINT fk_drivers_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_drivers_user_id      ON drivers(user_id);
CREATE INDEX idx_drivers_company      ON drivers(company_id);
CREATE INDEX idx_drivers_auth_user_id ON drivers(auth_user_id);

-- =============================================================
-- 25. DRIVER_PERFORMANCE_HISTORY
-- =============================================================
CREATE TABLE IF NOT EXISTS driver_performance_history (
  id               CHAR(36)      NOT NULL DEFAULT (UUID()) PRIMARY KEY,
  driver_id        CHAR(36)      NOT NULL,
  company_id       CHAR(36)      NOT NULL,
  user_id          CHAR(36)      NOT NULL,   -- ref auth.users (sem FK)
  period_start     DATE          NOT NULL,
  period_end       DATE          NOT NULL,
  total_journeys   INT           NOT NULL DEFAULT 0,
  total_distance   DECIMAL(10,2) NULL DEFAULT 0,
  total_revenue    DECIMAL(10,2) NULL DEFAULT 0,
  total_fuel_cost  DECIMAL(10,2) NULL DEFAULT 0,
  total_expenses   DECIMAL(10,2) NULL DEFAULT 0,
  fuel_efficiency  DECIMAL(6,2)  NULL DEFAULT 0,
  revenue_per_km   DECIMAL(8,2)  NULL DEFAULT 0,
  completion_rate  DECIMAL(5,2)  NULL DEFAULT 0,
  performance_score DECIMAL(5,2) NULL DEFAULT 0,
  rank_position    INT           NULL,
  created_at       DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at       DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  CONSTRAINT fk_driver_perf_driver  FOREIGN KEY (driver_id)  REFERENCES drivers(id)  ON DELETE CASCADE,
  CONSTRAINT fk_driver_perf_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_driver_perf_driver_id  ON driver_performance_history(driver_id);
CREATE INDEX idx_driver_perf_company_id ON driver_performance_history(company_id);
CREATE INDEX idx_driver_perf_period     ON driver_performance_history(period_start, period_end);

-- =============================================================
-- 26. VEHICLE_CONSUMPTION_HISTORY
-- =============================================================
CREATE TABLE IF NOT EXISTS vehicle_consumption_history (
  id                    CHAR(36)      NOT NULL DEFAULT (UUID()) PRIMARY KEY,
  vehicle_id            CHAR(36)      NOT NULL,
  company_id            CHAR(36)      NOT NULL,
  user_id               CHAR(36)      NOT NULL,   -- ref auth.users (sem FK)
  period_start          DATE          NOT NULL,
  period_end            DATE          NOT NULL,
  total_distance        DECIMAL(10,2) NULL,
  total_liters          DECIMAL(10,2) NULL,
  calculated_consumption DECIMAL(5,2) NULL,
  target_consumption    DECIMAL(5,2)  NULL,
  variance_percent      DECIMAL(5,2)  NULL,
  status                TEXT          NULL,
  created_at            DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  CONSTRAINT vehicle_consumption_history_status_check CHECK (status IN ('excellent','good','warning','critical')),
  CONSTRAINT fk_vehicle_consumption_vehicle FOREIGN KEY (vehicle_id) REFERENCES vehicles(id)  ON DELETE CASCADE,
  CONSTRAINT fk_vehicle_consumption_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_vehicle_consumption_vehicle ON vehicle_consumption_history(vehicle_id);
CREATE INDEX idx_vehicle_consumption_period  ON vehicle_consumption_history(period_start, period_end);
CREATE INDEX idx_vehicle_consumption_company ON vehicle_consumption_history(company_id);

-- =============================================================
-- 27. VEHICLE_COUPLINGS
-- =============================================================
CREATE TABLE IF NOT EXISTS vehicle_couplings (
  id            CHAR(36)    NOT NULL DEFAULT (UUID()) PRIMARY KEY,
  company_id    CHAR(36)    NOT NULL,
  truck_id      CHAR(36)    NOT NULL,
  coupling_type TEXT        NOT NULL DEFAULT 'simple',
  coupled_at    DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  decoupled_at  DATETIME(6) NULL,
  coupled_by    CHAR(36)    NULL,   -- ref auth.users (sem FK)
  decoupled_by  CHAR(36)    NULL,   -- ref auth.users (sem FK)
  notes         TEXT        NULL,
  created_at    DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at    DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  CONSTRAINT fk_vehicle_couplings_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  CONSTRAINT fk_vehicle_couplings_truck   FOREIGN KEY (truck_id)   REFERENCES vehicles(id)  ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_vehicle_couplings_company ON vehicle_couplings(company_id);
CREATE INDEX idx_vehicle_couplings_truck   ON vehicle_couplings(truck_id);
-- Simula índice parcial WHERE decoupled_at IS NULL:
CREATE INDEX idx_vehicle_couplings_active  ON vehicle_couplings(truck_id, decoupled_at);

-- =============================================================
-- 28. VEHICLE_COUPLING_ITEMS
-- =============================================================
CREATE TABLE IF NOT EXISTS vehicle_coupling_items (
  id          CHAR(36)    NOT NULL DEFAULT (UUID()) PRIMARY KEY,
  coupling_id CHAR(36)    NOT NULL,
  trailer_id  CHAR(36)    NOT NULL,
  position    INT         NOT NULL DEFAULT 1,
  created_at  DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  CONSTRAINT fk_coupling_items_coupling FOREIGN KEY (coupling_id) REFERENCES vehicle_couplings(id) ON DELETE CASCADE,
  CONSTRAINT fk_coupling_items_trailer  FOREIGN KEY (trailer_id)  REFERENCES vehicles(id)          ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_coupling_items_coupling ON vehicle_coupling_items(coupling_id);
CREATE INDEX idx_coupling_items_trailer  ON vehicle_coupling_items(trailer_id);

-- =============================================================
-- 29. SAVED_COUPLINGS
-- =============================================================
CREATE TABLE IF NOT EXISTS saved_couplings (
  id            CHAR(36)    NOT NULL DEFAULT (UUID()) PRIMARY KEY,
  company_id    CHAR(36)    NOT NULL,
  name          TEXT        NOT NULL,
  truck_id      CHAR(36)    NOT NULL,
  coupling_type TEXT        NOT NULL,
  trailer_ids   JSON        NOT NULL COMMENT 'UUID[] do Postgres convertido para JSON. Ex: ["uuid1","uuid2"]',
  created_by    CHAR(36)    NULL,   -- ref auth.users (sem FK)
  is_active     TINYINT(1)  NOT NULL DEFAULT 1,
  created_at    DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at    DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  CONSTRAINT saved_couplings_coupling_type_check CHECK (coupling_type IN ('simple','bitrem','rodotrem')),
  CONSTRAINT fk_saved_couplings_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  CONSTRAINT fk_saved_couplings_truck   FOREIGN KEY (truck_id)   REFERENCES vehicles(id)  ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_saved_couplings_company ON saved_couplings(company_id);
CREATE INDEX idx_saved_couplings_truck   ON saved_couplings(truck_id);

-- =============================================================
-- 30. DRIVER_VEHICLES
-- =============================================================
CREATE TABLE IF NOT EXISTS driver_vehicles (
  id          CHAR(36)    NOT NULL DEFAULT (UUID()) PRIMARY KEY,
  driver_id   CHAR(36)    NOT NULL,
  vehicle_id  CHAR(36)    NOT NULL,
  company_id  CHAR(36)    NOT NULL,
  assigned_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  assigned_by CHAR(36)    NULL,   -- ref auth.users (sem FK)
  status      TEXT        NOT NULL DEFAULT 'active',
  created_at  DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at  DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  UNIQUE KEY uq_driver_vehicles_driver_vehicle (driver_id, vehicle_id),
  CONSTRAINT driver_vehicles_status_check CHECK (status IN ('active','inactive')),
  CONSTRAINT fk_driver_vehicles_driver  FOREIGN KEY (driver_id)  REFERENCES drivers(id)  ON DELETE CASCADE,
  CONSTRAINT fk_driver_vehicles_vehicle FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE,
  CONSTRAINT fk_driver_vehicles_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================
-- 31. TIRE_ASSETS
-- NOTE: Tabela não encontrada nas migrations locais.
-- Estrutura reconstruída do types.ts + ALTER TABLE migrations.
-- Valide contra a base Supabase antes de migrar os dados.
-- =============================================================
CREATE TABLE IF NOT EXISTS tire_assets (
  id                    CHAR(36)      NOT NULL DEFAULT (UUID()) PRIMARY KEY,
  company_id            CHAR(36)      NULL,
  user_id               CHAR(36)      NULL,   -- ref auth.users (sem FK)
  serial_number         TEXT          NOT NULL,
  brand                 TEXT          NULL,
  model                 TEXT          NULL,
  size                  TEXT          NULL,
  dot                   TEXT          NULL,
  fire_number           TEXT          NULL,
  condition             TEXT          NULL,
  status                TEXT          NULL,
  cost                  DECIMAL(12,2) NULL,
  purchase_date         DATE          NULL,
  life_count            INT           NULL,
  tread_depth_mm        DECIMAL(6,2)  NULL,
  original_tread_depth_mm DECIMAL(6,2) NULL,
  current_vehicle_id    CHAR(36)      NULL,
  current_position      TEXT          NULL,
  installation_km       INT           NULL DEFAULT 0,
  alert_rotation_km     INT           NULL DEFAULT 20000,
  alert_replacement_km  INT           NULL DEFAULT 80000,
  last_rotation_km      INT           NULL,
  last_rotation_date    DATE          NULL,
  notes                 TEXT          NULL,
  total_km              INT           NULL DEFAULT 0,
  created_at            DATETIME(6)   NULL DEFAULT CURRENT_TIMESTAMP(6),
  UNIQUE KEY uq_tire_assets_serial_number (serial_number(100)),
  CONSTRAINT fk_tire_assets_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL,
  CONSTRAINT fk_tire_assets_vehicle FOREIGN KEY (current_vehicle_id) REFERENCES vehicles(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_tire_assets_company ON tire_assets(company_id);
CREATE INDEX idx_tire_assets_vehicle ON tire_assets(current_vehicle_id);

-- =============================================================
-- 32. TIRE_LOGS
-- NOTE: Tabela não encontrada nas migrations locais.
-- Estrutura reconstruída do types.ts.
-- =============================================================
CREATE TABLE IF NOT EXISTS tire_logs (
  id                    CHAR(36)      NOT NULL DEFAULT (UUID()) PRIMARY KEY,
  tire_id               CHAR(36)      NOT NULL,
  vehicle_id            CHAR(36)      NULL,
  company_id            CHAR(36)      NULL,
  action_type           TEXT          NULL,
  cost_amount           DECIMAL(12,2) NULL,
  measured_tread_depth_mm DECIMAL(6,2) NULL,
  notes                 TEXT          NULL,
  odometer_reading      INT           NULL,
  created_at            DATETIME(6)   NULL DEFAULT CURRENT_TIMESTAMP(6),
  CONSTRAINT fk_tire_logs_tire    FOREIGN KEY (tire_id)   REFERENCES tire_assets(id) ON DELETE CASCADE,
  CONSTRAINT fk_tire_logs_vehicle FOREIGN KEY (vehicle_id) REFERENCES vehicles(id)   ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_tire_logs_tire    ON tire_logs(tire_id);
CREATE INDEX idx_tire_logs_vehicle ON tire_logs(vehicle_id);

-- =============================================================
-- 33. JOURNEYS
-- =============================================================
CREATE TABLE IF NOT EXISTS journeys (
  id                        CHAR(36)      NOT NULL DEFAULT (UUID()) PRIMARY KEY,
  user_id                   CHAR(36)      NOT NULL,   -- ref auth.users (sem FK)
  company_id                CHAR(36)      NULL,
  vehicle_id                CHAR(36)      NOT NULL,
  driver_id                 CHAR(36)      NULL,
  customer_id               CHAR(36)      NULL,
  coupling_id               CHAR(36)      NULL,
  journey_number            TEXT          NOT NULL,
  origin                    TEXT          NOT NULL,
  destination               TEXT          NOT NULL,
  distance                  DECIMAL(10,2) NULL,
  freight_value             DECIMAL(12,2) NULL,
  commission_percentage     DECIMAL(5,2)  NOT NULL DEFAULT 0,
  commission_value          DECIMAL(12,2) NOT NULL DEFAULT 0,
  advance_value             DECIMAL(12,2) NOT NULL DEFAULT 0,
  status                    TEXT          NOT NULL DEFAULT 'planned',
  freight_status            TEXT          NOT NULL DEFAULT 'pending',
  freight_received_date     DATETIME(6)   NULL,
  freight_due_date          DATETIME(6)   NULL,
  start_date                DATETIME(6)   NULL,
  end_date                  DATETIME(6)   NULL,
  start_km                  INT           NULL,
  end_km                    INT           NULL,
  notes                     TEXT          NULL,
  closure_requested_at      DATETIME(6)   NULL,
  closure_requested_by      CHAR(36)      NULL,   -- ref auth.users (sem FK)
  closed_at                 DATETIME(6)   NULL,
  closed_by                 CHAR(36)      NULL,   -- ref auth.users (sem FK)
  closure_notes             TEXT          NULL,
  start_location_lat        DECIMAL(10,6) NULL,
  start_location_lng        DECIMAL(10,6) NULL,
  start_location_address    TEXT          NULL,
  end_location_lat          DECIMAL(10,6) NULL,
  end_location_lng          DECIMAL(10,6) NULL,
  end_location_address      TEXT          NULL,
  created_by_driver         TINYINT(1)    NOT NULL DEFAULT 0,
  deleted_at                DATETIME(6)   NULL,
  created_at                DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at                DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  CONSTRAINT journeys_status_check         CHECK (status IN ('planned','in_progress','completed','cancelled','pending_approval')),
  CONSTRAINT journeys_freight_status_check CHECK (freight_status IN ('pending','received','invoiced')),
  CONSTRAINT fk_journeys_company  FOREIGN KEY (company_id)  REFERENCES companies(id)         ON DELETE SET NULL,
  CONSTRAINT fk_journeys_vehicle  FOREIGN KEY (vehicle_id)  REFERENCES vehicles(id)          ON DELETE CASCADE,
  CONSTRAINT fk_journeys_driver   FOREIGN KEY (driver_id)   REFERENCES drivers(id)           ON DELETE SET NULL,
  CONSTRAINT fk_journeys_customer FOREIGN KEY (customer_id) REFERENCES parties(id)           ON DELETE SET NULL,
  CONSTRAINT fk_journeys_coupling FOREIGN KEY (coupling_id) REFERENCES vehicle_couplings(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_journeys_user_id    ON journeys(user_id);
CREATE INDEX idx_journeys_company    ON journeys(company_id);
CREATE INDEX idx_journeys_vehicle    ON journeys(vehicle_id);
CREATE INDEX idx_journeys_driver     ON journeys(driver_id);
CREATE INDEX idx_journeys_status     ON journeys(status);
CREATE INDEX idx_journeys_customer   ON journeys(customer_id);
CREATE INDEX idx_journeys_coupling   ON journeys(coupling_id);
CREATE INDEX idx_journeys_deleted_at ON journeys(deleted_at);

-- =============================================================
-- 34. JOURNEY_LEGS
-- =============================================================
CREATE TABLE IF NOT EXISTS journey_legs (
  id                     CHAR(36)      NOT NULL DEFAULT (UUID()) PRIMARY KEY,
  journey_id             CHAR(36)      NOT NULL,
  company_id             CHAR(36)      NOT NULL,
  customer_id            CHAR(36)      NULL,
  leg_number             INT           NOT NULL,
  origin                 TEXT          NOT NULL,
  destination            TEXT          NOT NULL,
  freight_value          DECIMAL(12,2) NULL,
  freight_status         TEXT          NULL DEFAULT 'pending',
  freight_due_date       DATETIME(6)   NULL,
  freight_received_date  DATETIME(6)   NULL,
  distance               DECIMAL(10,2) NULL,
  status                 TEXT          NULL,
  created_at             DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at             DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  UNIQUE KEY uq_journey_legs_journey_leg (journey_id, leg_number),
  CONSTRAINT fk_journey_legs_journey  FOREIGN KEY (journey_id)  REFERENCES journeys(id)  ON DELETE CASCADE,
  CONSTRAINT fk_journey_legs_company  FOREIGN KEY (company_id)  REFERENCES companies(id) ON DELETE CASCADE,
  CONSTRAINT fk_journey_legs_customer FOREIGN KEY (customer_id) REFERENCES parties(id)   ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_journey_legs_journey  ON journey_legs(journey_id);
CREATE INDEX idx_journey_legs_company  ON journey_legs(company_id);

-- =============================================================
-- 35. JOURNEY_CHECKLISTS
-- =============================================================
CREATE TABLE IF NOT EXISTS journey_checklists (
  id               CHAR(36)      NOT NULL DEFAULT (UUID()) PRIMARY KEY,
  journey_id       CHAR(36)      NOT NULL,
  company_id       CHAR(36)      NOT NULL,
  vehicle_id       CHAR(36)      NOT NULL,
  driver_id        CHAR(36)      NOT NULL,
  checklist_type   TEXT          NOT NULL,
  items            JSON          NOT NULL,
  photos           JSON          NULL,
  notes            TEXT          NULL,
  location_lat     DECIMAL(10,6) NULL,
  location_lng     DECIMAL(10,6) NULL,
  location_address TEXT          NULL,
  completed_at     DATETIME(6)   NULL DEFAULT CURRENT_TIMESTAMP(6),
  created_at       DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at       DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  CONSTRAINT journey_checklists_type_check CHECK (checklist_type IN ('pre','post')),
  CONSTRAINT fk_journey_checklists_journey FOREIGN KEY (journey_id) REFERENCES journeys(id)  ON DELETE CASCADE,
  CONSTRAINT fk_journey_checklists_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  CONSTRAINT fk_journey_checklists_vehicle FOREIGN KEY (vehicle_id) REFERENCES vehicles(id)  ON DELETE CASCADE,
  CONSTRAINT fk_journey_checklists_driver  FOREIGN KEY (driver_id)  REFERENCES drivers(id)   ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_journey_checklists_journey ON journey_checklists(journey_id);
CREATE INDEX idx_journey_checklists_company ON journey_checklists(company_id);

-- =============================================================
-- 36. DRIVER_MESSAGES
-- =============================================================
CREATE TABLE IF NOT EXISTS driver_messages (
  id              CHAR(36)    NOT NULL DEFAULT (UUID()) PRIMARY KEY,
  company_id      CHAR(36)    NOT NULL,
  driver_id       CHAR(36)    NULL,
  user_id         CHAR(36)    NULL,   -- ref auth.users (sem FK)
  message         TEXT        NOT NULL,
  is_from_driver  TINYINT(1)  NOT NULL DEFAULT 0,
  read_at         DATETIME(6) NULL,
  journey_id      CHAR(36)    NULL,
  attachment_url  TEXT        NULL,
  created_at      DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  CONSTRAINT fk_driver_messages_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  CONSTRAINT fk_driver_messages_driver  FOREIGN KEY (driver_id)  REFERENCES drivers(id)  ON DELETE CASCADE,
  CONSTRAINT fk_driver_messages_journey FOREIGN KEY (journey_id) REFERENCES journeys(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_driver_messages_company ON driver_messages(company_id);
CREATE INDEX idx_driver_messages_driver  ON driver_messages(driver_id);
CREATE INDEX idx_driver_messages_created ON driver_messages(created_at DESC);

-- =============================================================
-- 37. BANK_TRANSACTIONS
-- =============================================================
CREATE TABLE IF NOT EXISTS bank_transactions (
  id               CHAR(36)      NOT NULL DEFAULT (UUID()) PRIMARY KEY,
  company_id       CHAR(36)      NOT NULL,
  user_id          CHAR(36)      NOT NULL,   -- ref auth.users (sem FK)
  import_batch_id  CHAR(36)      NOT NULL DEFAULT (UUID()),
  transaction_date DATE          NOT NULL,
  description      TEXT          NOT NULL,
  amount           DECIMAL(14,4) NOT NULL,
  transaction_type TEXT          NOT NULL,
  bank_reference   TEXT          NULL,
  file_name        TEXT          NULL,
  file_type        TEXT          NULL,
  status           TEXT          NOT NULL DEFAULT 'pending',
  deleted_at       DATETIME(6)   NULL,
  created_at       DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at       DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  CONSTRAINT bank_transactions_type_check   CHECK (transaction_type IN ('credit','debit')),
  CONSTRAINT bank_transactions_status_check CHECK (status IN ('pending','reconciled','ignored')),
  CONSTRAINT bank_transactions_file_type_check CHECK (file_type IS NULL OR file_type IN ('csv','ofx')),
  CONSTRAINT fk_bank_transactions_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_bank_transactions_company ON bank_transactions(company_id);
CREATE INDEX idx_bank_transactions_status  ON bank_transactions(status);
CREATE INDEX idx_bank_transactions_batch   ON bank_transactions(import_batch_id);
CREATE INDEX idx_bank_transactions_date    ON bank_transactions(transaction_date);

-- =============================================================
-- 38. FUEL_EXPENSES
-- =============================================================
CREATE TABLE IF NOT EXISTS fuel_expenses (
  id                  CHAR(36)      NOT NULL DEFAULT (UUID()) PRIMARY KEY,
  user_id             CHAR(36)      NOT NULL,   -- ref auth.users (sem FK)
  company_id          CHAR(36)      NULL,
  vehicle_id          CHAR(36)      NOT NULL,
  journey_id          CHAR(36)      NULL,
  journey_leg_id      CHAR(36)      NULL,
  gas_station_id      CHAR(36)      NULL,
  bank_transaction_id CHAR(36)      NULL,
  date                DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  liters              DECIMAL(10,3) NOT NULL,
  price_per_liter     DECIMAL(10,4) NOT NULL,
  total_amount        DECIMAL(12,2) NOT NULL,
  odometer            INT           NULL,
  odometer_final      INT           NULL,
  payment_method      TEXT          NOT NULL DEFAULT 'card',
  receipt_number      TEXT          NULL,
  receipt_url         TEXT          NULL,
  notes               TEXT          NULL,
  location_lat        DECIMAL(10,6) NULL,
  location_lng        DECIMAL(10,6) NULL,
  location_address    TEXT          NULL,
  reconciled_at       DATETIME(6)   NULL,
  is_ignored          TINYINT(1)    NOT NULL DEFAULT 0,
  deleted_at          DATETIME(6)   NULL,
  created_at          DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at          DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  CONSTRAINT fuel_expenses_payment_method_check CHECK (payment_method IN ('cash','card','pix','credit','tag')),
  CONSTRAINT fk_fuel_expenses_company     FOREIGN KEY (company_id)         REFERENCES companies(id)          ON DELETE SET NULL,
  CONSTRAINT fk_fuel_expenses_vehicle     FOREIGN KEY (vehicle_id)         REFERENCES vehicles(id)           ON DELETE CASCADE,
  CONSTRAINT fk_fuel_expenses_journey     FOREIGN KEY (journey_id)         REFERENCES journeys(id)           ON DELETE SET NULL,
  CONSTRAINT fk_fuel_expenses_journey_leg FOREIGN KEY (journey_leg_id)     REFERENCES journey_legs(id)       ON DELETE SET NULL,
  CONSTRAINT fk_fuel_expenses_gas_station FOREIGN KEY (gas_station_id)     REFERENCES gas_stations(id)       ON DELETE SET NULL,
  CONSTRAINT fk_fuel_expenses_bank_tx     FOREIGN KEY (bank_transaction_id) REFERENCES bank_transactions(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_fuel_expenses_company    ON fuel_expenses(company_id);
CREATE INDEX idx_fuel_expenses_user_id    ON fuel_expenses(user_id);
CREATE INDEX idx_fuel_expenses_vehicle    ON fuel_expenses(vehicle_id);
CREATE INDEX idx_fuel_expenses_journey    ON fuel_expenses(journey_id);
CREATE INDEX idx_fuel_expenses_date       ON fuel_expenses(date);
CREATE INDEX idx_fuel_expenses_reconciled ON fuel_expenses(reconciled_at);

-- =============================================================
-- 39. EXPENSES (sem FK circular para accounts_payable ainda)
-- =============================================================
CREATE TABLE IF NOT EXISTS expenses (
  id                   CHAR(36)      NOT NULL DEFAULT (UUID()) PRIMARY KEY,
  user_id              CHAR(36)      NOT NULL,   -- ref auth.users (sem FK)
  company_id           CHAR(36)      NULL,
  vehicle_id           CHAR(36)      NULL,
  journey_id           CHAR(36)      NULL,
  journey_leg_id       CHAR(36)      NULL,
  category_id          CHAR(36)      NULL,
  bank_transaction_id  CHAR(36)      NULL,
  supplier_id          CHAR(36)      NULL,
  accounts_payable_id  CHAR(36)      NULL,   -- FK adicionada via ALTER após criar accounts_payable
  category             TEXT          NOT NULL,
  description          TEXT          NOT NULL,
  amount               DECIMAL(12,2) NOT NULL,
  date                 DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  payment_method       TEXT          NOT NULL DEFAULT 'card',
  payment_status       TEXT          NOT NULL DEFAULT 'pending',
  supplier             TEXT          NULL,
  receipt_number       TEXT          NULL,
  receipt_url          TEXT          NULL,
  notes                TEXT          NULL,
  status               TEXT          NOT NULL DEFAULT 'pending',
  location_lat         DECIMAL(10,6) NULL,
  location_lng         DECIMAL(10,6) NULL,
  location_address     TEXT          NULL,
  reconciled_at        DATETIME(6)   NULL,
  is_ignored           TINYINT(1)    NOT NULL DEFAULT 0,
  deleted_at           DATETIME(6)   NULL,
  created_at           DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at           DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  CONSTRAINT expenses_payment_method_check CHECK (payment_method IN ('cash','card','pix','credit','bank_transfer','boleto','tag')),
  CONSTRAINT expenses_status_check         CHECK (status IN ('pending','paid','cancelled')),
  CONSTRAINT fk_expenses_company     FOREIGN KEY (company_id)        REFERENCES companies(id)          ON DELETE SET NULL,
  CONSTRAINT fk_expenses_vehicle     FOREIGN KEY (vehicle_id)        REFERENCES vehicles(id)           ON DELETE SET NULL,
  CONSTRAINT fk_expenses_journey     FOREIGN KEY (journey_id)        REFERENCES journeys(id)           ON DELETE SET NULL,
  CONSTRAINT fk_expenses_journey_leg FOREIGN KEY (journey_leg_id)    REFERENCES journey_legs(id)       ON DELETE SET NULL,
  CONSTRAINT fk_expenses_category    FOREIGN KEY (category_id)       REFERENCES expense_categories(id) ON DELETE SET NULL,
  CONSTRAINT fk_expenses_bank_tx     FOREIGN KEY (bank_transaction_id) REFERENCES bank_transactions(id) ON DELETE SET NULL,
  CONSTRAINT fk_expenses_supplier    FOREIGN KEY (supplier_id)       REFERENCES parties(id)            ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_expenses_company    ON expenses(company_id);
CREATE INDEX idx_expenses_user_id    ON expenses(user_id);
CREATE INDEX idx_expenses_vehicle    ON expenses(vehicle_id);
CREATE INDEX idx_expenses_journey    ON expenses(journey_id);
CREATE INDEX idx_expenses_status     ON expenses(status);
CREATE INDEX idx_expenses_reconciled ON expenses(reconciled_at);
CREATE INDEX idx_expenses_deleted_at ON expenses(deleted_at);
CREATE INDEX idx_expenses_ap_id      ON expenses(accounts_payable_id);

-- =============================================================
-- 40. ACCOUNTS_PAYABLE
-- =============================================================
CREATE TABLE IF NOT EXISTS accounts_payable (
  id                   CHAR(36)      NOT NULL DEFAULT (UUID()) PRIMARY KEY,
  user_id              CHAR(36)      NOT NULL,   -- ref auth.users (sem FK)
  company_id           CHAR(36)      NULL,
  expense_id           CHAR(36)      NULL,
  bank_transaction_id  CHAR(36)      NULL,
  category_id          CHAR(36)      NULL,
  supplier_id          CHAR(36)      NULL,
  journey_id           CHAR(36)      NULL,
  driver_id            CHAR(36)      NULL,
  description          TEXT          NOT NULL,
  amount               DECIMAL(12,2) NOT NULL,
  due_date             DATE          NOT NULL,
  payment_date         DATE          NULL,
  supplier             TEXT          NULL,
  category             TEXT          NOT NULL,
  status               TEXT          NOT NULL DEFAULT 'pending',
  payment_method       TEXT          NULL,
  notes                TEXT          NULL,
  is_direct            TINYINT(1)    NULL,
  reconciled_at        DATETIME(6)   NULL,
  deleted_at           DATETIME(6)   NULL,
  created_at           DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at           DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  UNIQUE KEY uq_accounts_payable_journey (journey_id),
  CONSTRAINT accounts_payable_status_check         CHECK (status         IN ('pending','paid','overdue','cancelled')),
  CONSTRAINT accounts_payable_payment_method_check CHECK (payment_method IS NULL OR payment_method IN ('cash','card','pix','bank_transfer','check','boleto','tag')),
  CONSTRAINT fk_ap_company     FOREIGN KEY (company_id)        REFERENCES companies(id)          ON DELETE SET NULL,
  CONSTRAINT fk_ap_expense     FOREIGN KEY (expense_id)        REFERENCES expenses(id)           ON DELETE SET NULL,
  CONSTRAINT fk_ap_bank_tx     FOREIGN KEY (bank_transaction_id) REFERENCES bank_transactions(id) ON DELETE SET NULL,
  CONSTRAINT fk_ap_category    FOREIGN KEY (category_id)       REFERENCES expense_categories(id) ON DELETE SET NULL,
  CONSTRAINT fk_ap_supplier    FOREIGN KEY (supplier_id)       REFERENCES parties(id)            ON DELETE SET NULL,
  CONSTRAINT fk_ap_journey     FOREIGN KEY (journey_id)        REFERENCES journeys(id)           ON DELETE SET NULL,
  CONSTRAINT fk_ap_driver      FOREIGN KEY (driver_id)         REFERENCES drivers(id)            ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_accounts_payable_company   ON accounts_payable(company_id);
CREATE INDEX idx_accounts_payable_user_id   ON accounts_payable(user_id);
CREATE INDEX idx_accounts_payable_status    ON accounts_payable(status);
CREATE INDEX idx_accounts_payable_due_date  ON accounts_payable(due_date);
CREATE INDEX idx_accounts_payable_journey   ON accounts_payable(journey_id);
CREATE INDEX idx_accounts_payable_supplier  ON accounts_payable(supplier_id);

-- ===== Fechar a FK circular expenses → accounts_payable =====
ALTER TABLE expenses
  ADD CONSTRAINT fk_expenses_accounts_payable
    FOREIGN KEY (accounts_payable_id) REFERENCES accounts_payable(id) ON DELETE SET NULL;

-- =============================================================
-- 41. REVENUE
-- =============================================================
CREATE TABLE IF NOT EXISTS revenue (
  id                   CHAR(36)      NOT NULL DEFAULT (UUID()) PRIMARY KEY,
  user_id              CHAR(36)      NOT NULL,   -- ref auth.users (sem FK)
  company_id           CHAR(36)      NULL,
  journey_id           CHAR(36)      NULL,
  journey_leg_id       CHAR(36)      NULL,
  category_id          CHAR(36)      NULL,
  bank_transaction_id  CHAR(36)      NULL,
  customer_id          CHAR(36)      NULL,
  description          TEXT          NOT NULL,
  amount               DECIMAL(12,2) NOT NULL,
  date                 DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  payment_method       TEXT          NOT NULL DEFAULT 'bank_transfer',
  category             TEXT          NULL DEFAULT 'carga',
  client               TEXT          NULL,
  invoice_number       TEXT          NULL,
  notes                TEXT          NULL,
  status               TEXT          NOT NULL DEFAULT 'received',
  reconciled_at        DATETIME(6)   NULL,
  deleted_at           DATETIME(6)   NULL,
  created_at           DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at           DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  CONSTRAINT revenue_payment_method_check CHECK (payment_method IN ('cash','card','pix','bank_transfer','check','tag')),
  CONSTRAINT revenue_status_check         CHECK (status IN ('pending','received','cancelled')),
  CONSTRAINT fk_revenue_company     FOREIGN KEY (company_id)        REFERENCES companies(id)          ON DELETE SET NULL,
  CONSTRAINT fk_revenue_journey     FOREIGN KEY (journey_id)        REFERENCES journeys(id)           ON DELETE SET NULL,
  CONSTRAINT fk_revenue_journey_leg FOREIGN KEY (journey_leg_id)    REFERENCES journey_legs(id)       ON DELETE SET NULL,
  CONSTRAINT fk_revenue_category    FOREIGN KEY (category_id)       REFERENCES revenue_categories(id) ON DELETE SET NULL,
  CONSTRAINT fk_revenue_bank_tx     FOREIGN KEY (bank_transaction_id) REFERENCES bank_transactions(id) ON DELETE SET NULL,
  CONSTRAINT fk_revenue_customer    FOREIGN KEY (customer_id)       REFERENCES parties(id)            ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_revenue_company    ON revenue(company_id);
CREATE INDEX idx_revenue_user_id    ON revenue(user_id);
CREATE INDEX idx_revenue_journey    ON revenue(journey_id);
CREATE INDEX idx_revenue_status     ON revenue(status);
CREATE INDEX idx_revenue_reconciled ON revenue(reconciled_at);
CREATE INDEX idx_revenue_customer   ON revenue(customer_id);
CREATE INDEX idx_revenue_deleted_at ON revenue(deleted_at);

-- =============================================================
-- 42. BANK_RECONCILIATIONS
-- =============================================================
CREATE TABLE IF NOT EXISTS bank_reconciliations (
  id                   CHAR(36)      NOT NULL DEFAULT (UUID()) PRIMARY KEY,
  company_id           CHAR(36)      NOT NULL,
  bank_transaction_id  CHAR(36)      NOT NULL,
  revenue_id           CHAR(36)      NULL,
  expense_id           CHAR(36)      NULL,
  accounts_payable_id  CHAR(36)      NULL,
  fuel_expense_id      CHAR(36)      NULL,
  match_type           TEXT          NOT NULL,
  match_confidence     DECIMAL(5,4)  NULL,
  reconciled_at        DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  reconciled_by        CHAR(36)      NOT NULL,   -- ref auth.users (sem FK)
  notes                TEXT          NULL,
  created_at           DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  CONSTRAINT bank_reconciliations_match_type_check CHECK (match_type IN ('auto','manual')),
  CONSTRAINT fk_bank_rec_company     FOREIGN KEY (company_id)        REFERENCES companies(id)          ON DELETE CASCADE,
  CONSTRAINT fk_bank_rec_bank_tx     FOREIGN KEY (bank_transaction_id) REFERENCES bank_transactions(id) ON DELETE CASCADE,
  CONSTRAINT fk_bank_rec_revenue     FOREIGN KEY (revenue_id)        REFERENCES revenue(id)             ON DELETE SET NULL,
  CONSTRAINT fk_bank_rec_expense     FOREIGN KEY (expense_id)        REFERENCES expenses(id)            ON DELETE SET NULL,
  CONSTRAINT fk_bank_rec_ap          FOREIGN KEY (accounts_payable_id) REFERENCES accounts_payable(id) ON DELETE SET NULL,
  CONSTRAINT fk_bank_rec_fuel        FOREIGN KEY (fuel_expense_id)   REFERENCES fuel_expenses(id)       ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_bank_rec_company ON bank_reconciliations(company_id);
CREATE INDEX idx_bank_rec_bank_tx ON bank_reconciliations(bank_transaction_id);

-- =============================================================
-- 43. CTE_DOCUMENTS
-- =============================================================
CREATE TABLE IF NOT EXISTS cte_documents (
  id                   CHAR(36)    NOT NULL DEFAULT (UUID()) PRIMARY KEY,
  company_id           CHAR(36)    NOT NULL,
  user_id              CHAR(36)    NOT NULL,   -- ref auth.users (sem FK)
  journey_id           CHAR(36)    NULL,
  cte_number           TEXT        NULL,
  cte_key              TEXT        NULL,
  series               TEXT        NOT NULL DEFAULT '1',
  referenced_cte_key   TEXT        NULL,
  xml_content          LONGTEXT    NULL,
  pdf_url              TEXT        NULL,
  status               TEXT        NOT NULL DEFAULT 'draft',
  environment          TEXT        NOT NULL DEFAULT 'homologacao',
  nuvem_fiscal_id      TEXT        NULL,
  emission_date        DATETIME(6) NULL,
  authorization_date   DATETIME(6) NULL,
  cancellation_date    DATETIME(6) NULL,
  cancellation_reason  TEXT        NULL,
  freight_value        DECIMAL(14,4) NULL,
  icms_value           DECIMAL(14,4) NULL,
  recipient_name       TEXT        NOT NULL,
  recipient_document   TEXT        NOT NULL,
  recipient_address    TEXT        NOT NULL,
  sender_name          TEXT        NOT NULL,
  sender_document      TEXT        NOT NULL,
  sender_address       TEXT        NOT NULL,
  linked_documents     JSON        NULL,
  cargo_info           JSON        NULL,
  vehicle_info         JSON        NULL,
  driver_info          JSON        NULL,
  tax_info             JSON        NULL,
  sender_full          JSON        NULL,
  recipient_full       JSON        NULL,
  cfop                 TEXT        NULL,
  operation_type       TEXT        NULL,
  error_message        TEXT        NULL,
  is_draft             TINYINT(1)  NULL DEFAULT 0,
  draft_converted_at   DATETIME(6) NULL,
  draft_converted_from CHAR(36)    NULL,
  deleted_at           DATETIME(6) NULL,
  created_at           DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at           DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  CONSTRAINT fk_cte_documents_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  CONSTRAINT fk_cte_documents_journey FOREIGN KEY (journey_id) REFERENCES journeys(id)  ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_cte_documents_company    ON cte_documents(company_id);
CREATE INDEX idx_cte_documents_status     ON cte_documents(status);
CREATE INDEX idx_cte_documents_journey    ON cte_documents(journey_id);
CREATE INDEX idx_cte_documents_is_draft   ON cte_documents(is_draft);
CREATE INDEX idx_cte_documents_deleted_at ON cte_documents(deleted_at);

-- =============================================================
-- 44. CTE_ANULACAO_DOCUMENTS
-- =============================================================
CREATE TABLE IF NOT EXISTS cte_anulacao_documents (
  id                   CHAR(36)    NOT NULL DEFAULT (UUID()) PRIMARY KEY,
  company_id           CHAR(36)    NOT NULL,
  user_id              CHAR(36)    NOT NULL,   -- ref auth.users (sem FK)
  original_cte_id      CHAR(36)    NULL,
  substitute_cte_key   TEXT        NULL,
  cte_number           TEXT        NULL,
  cte_key              TEXT        NULL,
  serie                TEXT        NOT NULL DEFAULT '2',
  emission_date        DATETIME(6) NULL,
  authorization_date   DATETIME(6) NULL,
  cancellation_reason  TEXT        NOT NULL,
  sender_name          TEXT        NOT NULL,
  sender_document      TEXT        NOT NULL,
  sender_address       TEXT        NOT NULL,
  recipient_name       TEXT        NOT NULL,
  recipient_document   TEXT        NOT NULL,
  recipient_address    TEXT        NOT NULL,
  freight_value        DECIMAL(14,4) NULL,
  status               TEXT        NOT NULL DEFAULT 'draft',
  nuvem_fiscal_id      TEXT        NULL,
  xml_content          LONGTEXT    NULL,
  pdf_url              TEXT        NULL,
  created_at           DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at           DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  CONSTRAINT fk_cte_anulacao_company      FOREIGN KEY (company_id)    REFERENCES companies(id)     ON DELETE CASCADE,
  CONSTRAINT fk_cte_anulacao_original_cte FOREIGN KEY (original_cte_id) REFERENCES cte_documents(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_cte_anulacao_company ON cte_anulacao_documents(company_id);

-- =============================================================
-- 45. MDFE_DOCUMENTS
-- =============================================================
CREATE TABLE IF NOT EXISTS mdfe_documents (
  id              CHAR(36)    NOT NULL DEFAULT (UUID()) PRIMARY KEY,
  company_id      CHAR(36)    NOT NULL,
  user_id         CHAR(36)    NOT NULL,   -- ref auth.users (sem FK)
  mdfe_number     TEXT        NULL,
  mdfe_key        TEXT        NULL,
  serie           TEXT        NOT NULL DEFAULT '1',
  emission_date   DATETIME(6) NULL,
  uf_start        TEXT        NOT NULL,
  uf_end          TEXT        NOT NULL,
  vehicle_plate   TEXT        NOT NULL,
  driver_cpf      TEXT        NOT NULL,
  driver_name     TEXT        NOT NULL,
  status          TEXT        NOT NULL DEFAULT 'draft',
  total_weight    DECIMAL(14,4) NULL,
  total_value     DECIMAL(14,4) NULL,
  closure_date    DATETIME(6) NULL,
  nuvem_fiscal_id TEXT        NULL,
  xml_content     LONGTEXT    NULL,
  pdf_url         TEXT        NULL,
  created_at      DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at      DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  CONSTRAINT fk_mdfe_documents_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_mdfe_documents_company ON mdfe_documents(company_id);
CREATE INDEX idx_mdfe_documents_status  ON mdfe_documents(status);

-- =============================================================
-- 46. MDFE_CTE_LINKS
-- =============================================================
CREATE TABLE IF NOT EXISTS mdfe_cte_links (
  id         CHAR(36)    NOT NULL DEFAULT (UUID()) PRIMARY KEY,
  mdfe_id    CHAR(36)    NOT NULL,
  cte_id     CHAR(36)    NULL,
  cte_key    TEXT        NOT NULL,
  weight     DECIMAL(14,4) NULL,
  value      DECIMAL(14,4) NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  CONSTRAINT fk_mdfe_cte_links_mdfe FOREIGN KEY (mdfe_id) REFERENCES mdfe_documents(id) ON DELETE CASCADE,
  CONSTRAINT fk_mdfe_cte_links_cte  FOREIGN KEY (cte_id)  REFERENCES cte_documents(id)  ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_mdfe_cte_links_mdfe ON mdfe_cte_links(mdfe_id);

-- =============================================================
-- 47. FISCAL_DOCUMENT_LOOKUPS
-- =============================================================
CREATE TABLE IF NOT EXISTS fiscal_document_lookups (
  id               CHAR(36)    NOT NULL DEFAULT (UUID()) PRIMARY KEY,
  company_id       CHAR(36)    NOT NULL,
  user_id          CHAR(36)    NOT NULL,   -- ref auth.users (sem FK)
  document_type    TEXT        NOT NULL,
  document_key     TEXT        NULL,
  document_number  TEXT        NULL,
  action           TEXT        NOT NULL,
  action_status    TEXT        NOT NULL,
  request_payload  JSON        NULL,
  response_payload JSON        NULL,
  error_message    TEXT        NULL,
  created_at       DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  CONSTRAINT fk_fiscal_lookups_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_fiscal_lookups_company ON fiscal_document_lookups(company_id);

-- =============================================================
-- 48. FISCAL_AUDIT_LOGS
-- =============================================================
CREATE TABLE IF NOT EXISTS fiscal_audit_logs (
  id               CHAR(36)    NOT NULL DEFAULT (UUID()) PRIMARY KEY,
  company_id       CHAR(36)    NOT NULL,
  user_id          CHAR(36)    NOT NULL,   -- ref auth.users (sem FK)
  document_type    TEXT        NOT NULL,
  document_id      TEXT        NOT NULL,
  document_key     TEXT        NULL,
  document_number  TEXT        NULL,
  action           TEXT        NOT NULL,
  action_status    TEXT        NOT NULL,
  request_payload  JSON        NULL,
  response_payload JSON        NULL,
  error_message    TEXT        NULL,
  created_at       DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  CONSTRAINT fk_fiscal_audit_logs_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_fiscal_audit_logs_company ON fiscal_audit_logs(company_id);

-- =============================================================
-- 49. CUSTOMER_PORTAL_TOKENS
-- =============================================================
CREATE TABLE IF NOT EXISTS customer_portal_tokens (
  id              CHAR(36)    NOT NULL DEFAULT (UUID()) PRIMARY KEY,
  company_id      CHAR(36)    NOT NULL,
  party_id        CHAR(36)    NOT NULL,
  token           TEXT        NOT NULL,
  short_code      TEXT        NULL,
  is_active       TINYINT(1)  NOT NULL DEFAULT 1,
  expires_at      DATETIME(6) NULL,
  last_accessed_at DATETIME(6) NULL,
  created_at      DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  UNIQUE KEY uq_customer_portal_tokens_token      (token(255)),
  UNIQUE KEY uq_customer_portal_tokens_short_code (short_code(50)),
  CONSTRAINT fk_portal_tokens_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  CONSTRAINT fk_portal_tokens_party   FOREIGN KEY (party_id)   REFERENCES parties(id)   ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_portal_tokens_company ON customer_portal_tokens(company_id);
CREATE INDEX idx_portal_tokens_party   ON customer_portal_tokens(party_id);

-- =============================================================
-- 50. FREIGHT_REQUESTS
-- =============================================================
CREATE TABLE IF NOT EXISTS freight_requests (
  id                         CHAR(36)      NOT NULL DEFAULT (UUID()) PRIMARY KEY,
  company_id                 CHAR(36)      NOT NULL,
  party_id                   CHAR(36)      NOT NULL,
  token_id                   CHAR(36)      NOT NULL,
  status                     TEXT          NOT NULL DEFAULT 'pending',
  request_number             TEXT          NULL,
  nfe_xml_data               JSON          NULL,
  nfe_access_key             TEXT          NULL,
  nfe_number                 TEXT          NULL,
  origin_city                TEXT          NULL,
  origin_state               TEXT          NULL,
  destination_city           TEXT          NULL,
  destination_state          TEXT          NULL,
  cargo_weight_kg            DECIMAL(12,3) NULL,
  cargo_value                DECIMAL(14,4) NULL,
  cargo_description          TEXT          NULL,
  vehicle_type_requested     TEXT          NULL,
  freight_value              DECIMAL(14,4) NULL,
  freight_rate_id            CHAR(36)      NULL,
  customer_notes             TEXT          NULL,
  operator_notes             TEXT          NULL,
  approved_at                DATETIME(6)   NULL,
  approved_by_operator_at    DATETIME(6)   NULL,
  collection_address         TEXT          NULL,
  collection_date            DATETIME(6)   NULL,
  collection_notes           TEXT          NULL,
  journey_id                 CHAR(36)      NULL,
  cte_document_id            CHAR(36)      NULL,
  vehicle_id                 CHAR(36)      NULL,
  driver_id                  CHAR(36)      NULL,
  created_at                 DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at                 DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  CONSTRAINT fk_freight_requests_company      FOREIGN KEY (company_id)     REFERENCES companies(id)              ON DELETE CASCADE,
  CONSTRAINT fk_freight_requests_party        FOREIGN KEY (party_id)       REFERENCES parties(id),
  CONSTRAINT fk_freight_requests_token        FOREIGN KEY (token_id)       REFERENCES customer_portal_tokens(id),
  CONSTRAINT fk_freight_requests_rate         FOREIGN KEY (freight_rate_id) REFERENCES freight_rates(id)          ON DELETE SET NULL,
  CONSTRAINT fk_freight_requests_journey      FOREIGN KEY (journey_id)     REFERENCES journeys(id)               ON DELETE SET NULL,
  CONSTRAINT fk_freight_requests_cte_document FOREIGN KEY (cte_document_id) REFERENCES cte_documents(id)         ON DELETE SET NULL,
  CONSTRAINT fk_freight_requests_vehicle      FOREIGN KEY (vehicle_id)     REFERENCES vehicles(id)               ON DELETE SET NULL,
  CONSTRAINT fk_freight_requests_driver       FOREIGN KEY (driver_id)      REFERENCES drivers(id)                ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_freight_requests_company ON freight_requests(company_id);
CREATE INDEX idx_freight_requests_party   ON freight_requests(party_id);
CREATE INDEX idx_freight_requests_status  ON freight_requests(status);

-- =============================================================
-- 51. TRIGGER: gerar request_number (substitui SEQUENCE Postgres)
-- =============================================================
DELIMITER $$
CREATE TRIGGER trg_freight_request_number
BEFORE INSERT ON freight_requests
FOR EACH ROW
BEGIN
  IF NEW.request_number IS NULL THEN
    INSERT INTO freight_request_sequences () VALUES ();
    SET NEW.request_number = CONCAT('FR-', LPAD(LAST_INSERT_ID(), 6, '0'));
  END IF;
END$$
DELIMITER ;

-- =============================================================
-- 52. VEHICLE_MAINTENANCES
-- =============================================================
CREATE TABLE IF NOT EXISTS vehicle_maintenances (
  id                CHAR(36)      NOT NULL DEFAULT (UUID()) PRIMARY KEY,
  company_id        CHAR(36)      NOT NULL,
  vehicle_id        CHAR(36)      NOT NULL,
  user_id           CHAR(36)      NOT NULL,   -- ref auth.users (sem FK)
  workshop_id       CHAR(36)      NULL,
  expense_id        CHAR(36)      NULL,
  maintenance_type  TEXT          NOT NULL,
  service_category  TEXT          NOT NULL,
  description       TEXT          NOT NULL,
  provider_name     TEXT          NULL,
  provider_cnpj     TEXT          NULL,
  labor_cost        DECIMAL(12,2) NOT NULL DEFAULT 0,
  parts_cost        DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_cost        DECIMAL(12,2) NOT NULL DEFAULT 0,
  service_date      DATE          NOT NULL,
  odometer_at_service INT         NULL,
  next_due_date     DATE          NULL,
  next_due_km       INT           NULL,
  status            TEXT          NOT NULL DEFAULT 'completed',
  receipt_url       TEXT          NULL,
  notes             TEXT          NULL,
  invoice_number    TEXT          NULL,
  invoice_key       TEXT          NULL,
  invoice_date      DATETIME(6)   NULL,
  invoice_xml_url   TEXT          NULL,
  deleted_at        DATETIME(6)   NULL,
  created_at        DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at        DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  CONSTRAINT vehicle_maintenances_type_check   CHECK (maintenance_type IN ('preventive','corrective')),
  CONSTRAINT vehicle_maintenances_status_check CHECK (status IN ('scheduled','in_progress','completed')),
  CONSTRAINT fk_vehicle_maint_company  FOREIGN KEY (company_id) REFERENCES companies(id)          ON DELETE CASCADE,
  CONSTRAINT fk_vehicle_maint_vehicle  FOREIGN KEY (vehicle_id) REFERENCES vehicles(id)           ON DELETE CASCADE,
  CONSTRAINT fk_vehicle_maint_workshop FOREIGN KEY (workshop_id) REFERENCES workshops(id)          ON DELETE SET NULL,
  CONSTRAINT fk_vehicle_maint_expense  FOREIGN KEY (expense_id) REFERENCES expenses(id)           ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_vehicle_maint_company     ON vehicle_maintenances(company_id);
CREATE INDEX idx_vehicle_maint_vehicle     ON vehicle_maintenances(vehicle_id);
CREATE INDEX idx_vehicle_maint_service_date ON vehicle_maintenances(service_date);
CREATE INDEX idx_vehicle_maint_next_due    ON vehicle_maintenances(next_due_date, next_due_km);
CREATE INDEX idx_vehicle_maint_workshop    ON vehicle_maintenances(workshop_id);

-- =============================================================
-- 53. MAINTENANCE_PARTS
-- =============================================================
CREATE TABLE IF NOT EXISTS maintenance_parts (
  id             CHAR(36)      NOT NULL DEFAULT (UUID()) PRIMARY KEY,
  maintenance_id CHAR(36)      NOT NULL,
  company_id     CHAR(36)      NOT NULL,
  user_id        CHAR(36)      NOT NULL,   -- ref auth.users (sem FK)
  description    TEXT          NOT NULL,
  part_code      TEXT          NULL,
  quantity       DECIMAL(10,3) NOT NULL DEFAULT 1,
  unit           TEXT          NULL DEFAULT 'UN',
  unit_price     DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_price    DECIMAL(12,2) NOT NULL DEFAULT 0,
  ncm            TEXT          NULL,
  cfop           TEXT          NULL,
  origin         TEXT          NULL,
  created_at     DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at     DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  CONSTRAINT fk_maint_parts_maintenance FOREIGN KEY (maintenance_id) REFERENCES vehicle_maintenances(id) ON DELETE CASCADE,
  CONSTRAINT fk_maint_parts_company     FOREIGN KEY (company_id)     REFERENCES companies(id)           ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_maint_parts_maintenance ON maintenance_parts(maintenance_id);
CREATE INDEX idx_maint_parts_company     ON maintenance_parts(company_id);

-- =============================================================
-- 54. MAINTENANCE_SCHEDULES
-- =============================================================
CREATE TABLE IF NOT EXISTS maintenance_schedules (
  id                CHAR(36)    NOT NULL DEFAULT (UUID()) PRIMARY KEY,
  company_id        CHAR(36)    NOT NULL,
  vehicle_id        CHAR(36)    NULL,
  user_id           CHAR(36)    NOT NULL,   -- ref auth.users (sem FK)
  service_category  TEXT        NOT NULL,
  service_name      TEXT        NOT NULL,
  interval_months   INT         NULL,
  interval_km       INT         NULL,
  alert_days_before INT         NOT NULL DEFAULT 7,
  alert_km_before   INT         NOT NULL DEFAULT 500,
  is_active         TINYINT(1)  NOT NULL DEFAULT 1,
  notes             TEXT        NULL,
  created_at        DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at        DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  -- Simula UNIQUE NULLS NOT DISTINCT (company_id, vehicle_id, service_category)
  -- MySQL 8 não tem NULLS NOT DISTINCT para UNIQUE; contornar na aplicação.
  CONSTRAINT fk_maint_schedules_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  CONSTRAINT fk_maint_schedules_vehicle FOREIGN KEY (vehicle_id) REFERENCES vehicles(id)  ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_maint_schedules_company  ON maintenance_schedules(company_id);
CREATE INDEX idx_maint_schedules_vehicle  ON maintenance_schedules(vehicle_id);
CREATE INDEX idx_maint_schedules_category ON maintenance_schedules(service_category(100));

-- =============================================================
-- 55. TIRE_HISTORY
-- =============================================================
CREATE TABLE IF NOT EXISTS tire_history (
  id            CHAR(36)    NOT NULL DEFAULT (UUID()) PRIMARY KEY,
  company_id    CHAR(36)    NOT NULL,
  tire_id       CHAR(36)    NOT NULL,
  vehicle_id    CHAR(36)    NULL,
  user_id       CHAR(36)    NOT NULL,   -- ref auth.users (sem FK)
  vehicle_plate TEXT        NULL,
  action        TEXT        NOT NULL,
  position      TEXT        NULL,
  km_at_action  INT         NULL,
  km_driven     INT         NULL,
  notes         TEXT        NULL,
  created_at    DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  CONSTRAINT fk_tire_history_company FOREIGN KEY (company_id) REFERENCES companies(id)   ON DELETE CASCADE,
  CONSTRAINT fk_tire_history_tire    FOREIGN KEY (tire_id)    REFERENCES tire_assets(id) ON DELETE CASCADE,
  CONSTRAINT fk_tire_history_vehicle FOREIGN KEY (vehicle_id) REFERENCES vehicles(id)    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_tire_history_tire    ON tire_history(tire_id);
CREATE INDEX idx_tire_history_company ON tire_history(company_id);
CREATE INDEX idx_tire_history_vehicle ON tire_history(vehicle_id);

-- =============================================================
-- 56. ANNOUNCEMENTS
-- =============================================================
CREATE TABLE IF NOT EXISTS announcements (
  id          CHAR(36)    NOT NULL DEFAULT (UUID()) PRIMARY KEY,
  company_id  CHAR(36)    NOT NULL,
  user_id     CHAR(36)    NOT NULL,   -- ref auth.users (sem FK)
  title       TEXT        NOT NULL,
  message     TEXT        NOT NULL,
  priority    TEXT        NOT NULL DEFAULT 'normal',
  target_type TEXT        NOT NULL DEFAULT 'all',
  created_at  DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  CONSTRAINT fk_announcements_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_announcements_company ON announcements(company_id);
CREATE INDEX idx_announcements_created ON announcements(created_at DESC);

-- =============================================================
-- 57. ANNOUNCEMENT_TARGETS
-- =============================================================
CREATE TABLE IF NOT EXISTS announcement_targets (
  id              CHAR(36)    NOT NULL DEFAULT (UUID()) PRIMARY KEY,
  announcement_id CHAR(36)    NOT NULL,
  driver_id       CHAR(36)    NOT NULL,
  UNIQUE KEY uq_announcement_targets (announcement_id, driver_id),
  CONSTRAINT fk_announcement_targets_announcement FOREIGN KEY (announcement_id) REFERENCES announcements(id) ON DELETE CASCADE,
  CONSTRAINT fk_announcement_targets_driver       FOREIGN KEY (driver_id)       REFERENCES drivers(id)       ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_announcement_targets_announcement ON announcement_targets(announcement_id);
CREATE INDEX idx_announcement_targets_driver       ON announcement_targets(driver_id);

-- =============================================================
-- 58. ANNOUNCEMENT_READS
-- =============================================================
CREATE TABLE IF NOT EXISTS announcement_reads (
  id              CHAR(36)    NOT NULL DEFAULT (UUID()) PRIMARY KEY,
  announcement_id CHAR(36)    NOT NULL,
  driver_id       CHAR(36)    NOT NULL,
  read_at         DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  UNIQUE KEY uq_announcement_reads (announcement_id, driver_id),
  CONSTRAINT fk_announcement_reads_announcement FOREIGN KEY (announcement_id) REFERENCES announcements(id) ON DELETE CASCADE,
  CONSTRAINT fk_announcement_reads_driver       FOREIGN KEY (driver_id)       REFERENCES drivers(id)       ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_announcement_reads_announcement ON announcement_reads(announcement_id);
CREATE INDEX idx_announcement_reads_driver       ON announcement_reads(driver_id);

-- =============================================================
-- 59. INCIDENTS
-- =============================================================
CREATE TABLE IF NOT EXISTS incidents (
  id               CHAR(36)    NOT NULL DEFAULT (UUID()) PRIMARY KEY,
  company_id       CHAR(36)    NOT NULL,
  driver_id        CHAR(36)    NOT NULL,
  vehicle_id       CHAR(36)    NULL,
  journey_id       CHAR(36)    NULL,
  incident_type    TEXT        NOT NULL,
  description      TEXT        NOT NULL,
  photo_url        TEXT        NULL,
  status           TEXT        NOT NULL DEFAULT 'open',
  resolution_notes TEXT        NULL,
  resolved_by      CHAR(36)    NULL,   -- ref auth.users (sem FK)
  resolved_at      DATETIME(6) NULL,
  created_at       DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at       DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  CONSTRAINT fk_incidents_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  CONSTRAINT fk_incidents_driver  FOREIGN KEY (driver_id)  REFERENCES drivers(id)  ON DELETE CASCADE,
  CONSTRAINT fk_incidents_vehicle FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE SET NULL,
  CONSTRAINT fk_incidents_journey FOREIGN KEY (journey_id) REFERENCES journeys(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_incidents_company ON incidents(company_id);
CREATE INDEX idx_incidents_driver  ON incidents(driver_id);
CREATE INDEX idx_incidents_status  ON incidents(status);
CREATE INDEX idx_incidents_created ON incidents(created_at DESC);

-- =============================================================
-- TRIGGERS updated_at (substitui update_updated_at_column() do Postgres)
-- Apenas para tabelas que não usam ON UPDATE CURRENT_TIMESTAMP(6)
-- (i.e., tabelas que foram criadas sem o ON UPDATE – verificar)
-- A maioria já usa ON UPDATE CURRENT_TIMESTAMP(6) acima, então
-- os triggers abaixo são opcionais / redundantes, mas incluídos
-- por completude em caso de updates via frameworks que não
-- trigam ON UPDATE.
-- =============================================================

-- Tabelas com audit_logs não têm updated_at – sem trigger necessário.

-- =============================================================
-- TRIGGER: enforce_vehicle_limit
-- Substitui o trigger check_vehicle_limit() do Postgres
-- =============================================================
DELIMITER $$
CREATE TRIGGER trg_check_vehicle_limit
BEFORE INSERT ON vehicles
FOR EACH ROW
BEGIN
  DECLARE v_count INT;
  DECLARE v_limit INT;

  SELECT COUNT(*) INTO v_count
  FROM vehicles
  WHERE company_id = NEW.company_id;

  SELECT COALESCE(c.vehicle_limit, sp.vehicle_limit, 5) INTO v_limit
  FROM companies c
  LEFT JOIN subscription_plans sp ON c.subscription_plan_id = sp.id
  WHERE c.id = NEW.company_id;

  IF v_count >= v_limit THEN
    SIGNAL SQLSTATE '45000'
    SET MESSAGE_TEXT = 'Vehicle limit exceeded for this subscription plan.';
  END IF;
END$$
DELIMITER ;

-- =============================================================
-- FEATURE UPDATES 2026-03-04
-- Contas e Saldos, Caixas de Reserva, Despesas Variáveis, Permissões Gestor
-- =============================================================

-- Feature A: Contas e Saldos (Carteiras)
CREATE TABLE IF NOT EXISTS financial_accounts (
  id                   CHAR(36)       NOT NULL DEFAULT (UUID()) PRIMARY KEY,
  company_id           CHAR(36)       NOT NULL,
  user_id              CHAR(36)       NOT NULL,
  name                 VARCHAR(255)   NOT NULL,
  type                 ENUM('checking','savings','cash','reserve') NOT NULL,
  initial_balance      DECIMAL(12,2)  NOT NULL DEFAULT 0,
  initial_balance_date DATE           NOT NULL,
  color                VARCHAR(7)     NOT NULL DEFAULT '#6366f1',
  is_active            TINYINT(1)     NOT NULL DEFAULT 1,
  created_at           DATETIME(6)    NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at           DATETIME(6)    NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  CONSTRAINT fk_fa_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Contas bancárias e carteiras (de onde/para onde o dinheiro vai)';

-- Adicionar account_id nas tabelas de movimentação
ALTER TABLE revenue
  ADD COLUMN IF NOT EXISTS account_id CHAR(36) NULL COMMENT 'Conta de destino da receita',
  ADD CONSTRAINT IF NOT EXISTS fk_revenue_account FOREIGN KEY (account_id) REFERENCES financial_accounts(id) ON DELETE SET NULL;

ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS account_id        CHAR(36)     NULL COMMENT 'Conta de origem da despesa',
  ADD COLUMN IF NOT EXISTS calculation_type  VARCHAR(20)  NOT NULL DEFAULT 'fixed' COMMENT 'fixed|per_km|percentage|reserve',
  ADD COLUMN IF NOT EXISTS unit_value        DECIMAL(10,2) NULL COMMENT 'Valor por KM (para tipo per_km)',
  ADD COLUMN IF NOT EXISTS percentage_value  DECIMAL(5,2)  NULL COMMENT 'Percentual aplicado',
  ADD COLUMN IF NOT EXISTS reserve_id        CHAR(36)     NULL COMMENT 'Caixa de reserva destino',
  ADD CONSTRAINT IF NOT EXISTS fk_expenses_account FOREIGN KEY (account_id) REFERENCES financial_accounts(id) ON DELETE SET NULL;

ALTER TABLE accounts_payable
  ADD COLUMN IF NOT EXISTS payment_account_id CHAR(36) NULL COMMENT 'Conta debitada na baixa',
  ADD CONSTRAINT IF NOT EXISTS fk_ap_payment_account FOREIGN KEY (payment_account_id) REFERENCES financial_accounts(id) ON DELETE SET NULL;

-- Feature C: Caixas de Reserva
CREATE TABLE IF NOT EXISTS financial_reserves (
  id                  CHAR(36)      NOT NULL DEFAULT (UUID()) PRIMARY KEY,
  company_id          CHAR(36)      NOT NULL,
  user_id             CHAR(36)      NOT NULL,
  name                VARCHAR(255)  NOT NULL,
  description         TEXT          NULL,
  default_percentage  DECIMAL(5,2)  NULL COMMENT 'Percentual padrão aplicado ao frete',
  color               VARCHAR(7)    NOT NULL DEFAULT '#6366f1',
  current_balance     DECIMAL(12,2) NOT NULL DEFAULT 0,
  created_at          DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at          DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  CONSTRAINT fk_fr_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Caixas de reserva financeira (manutenção, pneus, etc.)';

CREATE TABLE IF NOT EXISTS financial_reserve_entries (
  id                  CHAR(36)       NOT NULL DEFAULT (UUID()) PRIMARY KEY,
  company_id          CHAR(36)       NOT NULL,
  reserve_id          CHAR(36)       NOT NULL,
  journey_id          CHAR(36)       NULL,
  expense_id          CHAR(36)       NULL,
  amount              DECIMAL(12,2)  NOT NULL COMMENT 'Positivo=aporte, negativo=retirada',
  percentage_applied  DECIMAL(5,2)   NULL,
  description         TEXT           NULL,
  entry_type          VARCHAR(30)    NOT NULL DEFAULT 'journey_contribution' COMMENT 'journey_contribution|manual_deposit|withdrawal',
  date                DATE           NOT NULL DEFAULT (CURRENT_DATE),
  created_at          DATETIME(6)    NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  CONSTRAINT fk_fre_reserve FOREIGN KEY (reserve_id) REFERENCES financial_reserves(id) ON DELETE CASCADE,
  CONSTRAINT fk_fre_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Histórico de aportes e retiradas das caixas de reserva';

-- Adicionar reserve_id em expenses (FK)
ALTER TABLE expenses
  ADD CONSTRAINT IF NOT EXISTS fk_expenses_reserve FOREIGN KEY (reserve_id) REFERENCES financial_reserves(id) ON DELETE SET NULL;

-- Feature D: Permissões dinâmicas do Gestor
CREATE TABLE IF NOT EXISTS gestor_permissions (
  id          CHAR(36)     NOT NULL DEFAULT (UUID()) PRIMARY KEY,
  company_id  CHAR(36)     NOT NULL,
  user_id     CHAR(36)     NOT NULL COMMENT 'ID do usuário gestor',
  module_key  VARCHAR(50)  NOT NULL COMMENT 'Chave do módulo (ex: journeys, vehicles)',
  enabled     TINYINT(1)   NOT NULL DEFAULT 1,
  created_at  DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at  DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  UNIQUE KEY uk_gp_user_module (company_id, user_id, module_key),
  CONSTRAINT fk_gp_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Permissões de acesso a módulos por usuário gestor';

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_financial_accounts_company ON financial_accounts(company_id);
CREATE INDEX IF NOT EXISTS idx_financial_reserves_company ON financial_reserves(company_id);
CREATE INDEX IF NOT EXISTS idx_fre_reserve ON financial_reserve_entries(reserve_id);
CREATE INDEX IF NOT EXISTS idx_fre_company_date ON financial_reserve_entries(company_id, date);
CREATE INDEX IF NOT EXISTS idx_gestor_permissions_user ON gestor_permissions(company_id, user_id);

-- =============================================================
-- Reabilitar foreign key checks
-- =============================================================
SET foreign_key_checks = 1;
