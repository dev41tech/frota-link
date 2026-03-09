export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      accounts_payable: {
        Row: {
          amount: number
          attachment_url: string | null
          bank_transaction_id: string | null
          category: string
          category_id: string | null
          company_id: string
          created_at: string
          deleted_at: string | null
          description: string
          driver_id: string | null
          due_date: string
          expense_id: string | null
          id: string
          invoice_number: string | null
          invoice_url: string | null
          is_direct: boolean | null
          journey_id: string | null
          maintenance_id: string | null
          notes: string | null
          payment_date: string | null
          payment_method: string | null
          receipt_url: string | null
          reconciled_at: string | null
          status: string | null
          supplier: string | null
          supplier_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          attachment_url?: string | null
          bank_transaction_id?: string | null
          category: string
          category_id?: string | null
          company_id: string
          created_at?: string
          deleted_at?: string | null
          description: string
          driver_id?: string | null
          due_date: string
          expense_id?: string | null
          id?: string
          invoice_number?: string | null
          invoice_url?: string | null
          is_direct?: boolean | null
          journey_id?: string | null
          maintenance_id?: string | null
          notes?: string | null
          payment_date?: string | null
          payment_method?: string | null
          receipt_url?: string | null
          reconciled_at?: string | null
          status?: string | null
          supplier?: string | null
          supplier_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          attachment_url?: string | null
          bank_transaction_id?: string | null
          category?: string
          category_id?: string | null
          company_id?: string
          created_at?: string
          deleted_at?: string | null
          description?: string
          driver_id?: string | null
          due_date?: string
          expense_id?: string | null
          id?: string
          invoice_number?: string | null
          invoice_url?: string | null
          is_direct?: boolean | null
          journey_id?: string | null
          maintenance_id?: string | null
          notes?: string | null
          payment_date?: string | null
          payment_method?: string | null
          receipt_url?: string | null
          reconciled_at?: string | null
          status?: string | null
          supplier?: string | null
          supplier_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounts_payable_bank_transaction_id_fkey"
            columns: ["bank_transaction_id"]
            isOneToOne: false
            referencedRelation: "bank_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_payable_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "expense_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_payable_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_payable_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_payable_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_payable_journey_id_fkey"
            columns: ["journey_id"]
            isOneToOne: false
            referencedRelation: "journeys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_payable_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "parties"
            referencedColumns: ["id"]
          },
        ]
      }
      announcement_reads: {
        Row: {
          announcement_id: string
          driver_id: string
          id: string
          read_at: string
        }
        Insert: {
          announcement_id: string
          driver_id: string
          id?: string
          read_at?: string
        }
        Update: {
          announcement_id?: string
          driver_id?: string
          id?: string
          read_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcement_reads_announcement_id_fkey"
            columns: ["announcement_id"]
            isOneToOne: false
            referencedRelation: "announcements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcement_reads_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
        ]
      }
      announcement_targets: {
        Row: {
          announcement_id: string
          driver_id: string
          id: string
        }
        Insert: {
          announcement_id: string
          driver_id: string
          id?: string
        }
        Update: {
          announcement_id?: string
          driver_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcement_targets_announcement_id_fkey"
            columns: ["announcement_id"]
            isOneToOne: false
            referencedRelation: "announcements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcement_targets_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
        ]
      }
      announcements: {
        Row: {
          company_id: string
          created_at: string
          id: string
          message: string
          priority: string
          target_type: string
          title: string
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          message: string
          priority?: string
          target_type?: string
          title: string
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          message?: string
          priority?: string
          target_type?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcements_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          company_id: string | null
          created_at: string
          id: string
          new_values: Json | null
          old_values: Json | null
          record_id: string | null
          table_name: string | null
          user_id: string
        }
        Insert: {
          action: string
          company_id?: string | null
          created_at?: string
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          record_id?: string | null
          table_name?: string | null
          user_id: string
        }
        Update: {
          action?: string
          company_id?: string | null
          created_at?: string
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          record_id?: string | null
          table_name?: string | null
          user_id?: string
        }
        Relationships: []
      }
      audit_user_roles_cleanup: {
        Row: {
          cleaned_at: string | null
          company_id: string | null
          created_at: string | null
          id: string | null
          role: Database["public"]["Enums"]["app_role"] | null
          user_id: string | null
        }
        Insert: {
          cleaned_at?: string | null
          company_id?: string | null
          created_at?: string | null
          id?: string | null
          role?: Database["public"]["Enums"]["app_role"] | null
          user_id?: string | null
        }
        Update: {
          cleaned_at?: string | null
          company_id?: string | null
          created_at?: string | null
          id?: string | null
          role?: Database["public"]["Enums"]["app_role"] | null
          user_id?: string | null
        }
        Relationships: []
      }
      bank_reconciliations: {
        Row: {
          accounts_payable_id: string | null
          bank_transaction_id: string
          company_id: string
          created_at: string
          expense_id: string | null
          fuel_expense_id: string | null
          id: string
          match_confidence: number | null
          match_type: string
          notes: string | null
          reconciled_at: string
          reconciled_by: string
          revenue_id: string | null
        }
        Insert: {
          accounts_payable_id?: string | null
          bank_transaction_id: string
          company_id: string
          created_at?: string
          expense_id?: string | null
          fuel_expense_id?: string | null
          id?: string
          match_confidence?: number | null
          match_type: string
          notes?: string | null
          reconciled_at?: string
          reconciled_by: string
          revenue_id?: string | null
        }
        Update: {
          accounts_payable_id?: string | null
          bank_transaction_id?: string
          company_id?: string
          created_at?: string
          expense_id?: string | null
          fuel_expense_id?: string | null
          id?: string
          match_confidence?: number | null
          match_type?: string
          notes?: string | null
          reconciled_at?: string
          reconciled_by?: string
          revenue_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bank_reconciliations_accounts_payable_id_fkey"
            columns: ["accounts_payable_id"]
            isOneToOne: false
            referencedRelation: "accounts_payable"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_reconciliations_bank_transaction_id_fkey"
            columns: ["bank_transaction_id"]
            isOneToOne: false
            referencedRelation: "bank_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_reconciliations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_reconciliations_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_reconciliations_fuel_expense_id_fkey"
            columns: ["fuel_expense_id"]
            isOneToOne: false
            referencedRelation: "fuel_expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_reconciliations_revenue_id_fkey"
            columns: ["revenue_id"]
            isOneToOne: false
            referencedRelation: "revenue"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_transactions: {
        Row: {
          amount: number
          bank_reference: string | null
          company_id: string
          created_at: string
          deleted_at: string | null
          description: string
          file_name: string | null
          file_type: string | null
          id: string
          import_batch_id: string
          status: string
          transaction_date: string
          transaction_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          bank_reference?: string | null
          company_id: string
          created_at?: string
          deleted_at?: string | null
          description: string
          file_name?: string | null
          file_type?: string | null
          id?: string
          import_batch_id?: string
          status?: string
          transaction_date: string
          transaction_type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          bank_reference?: string | null
          company_id?: string
          created_at?: string
          deleted_at?: string | null
          description?: string
          file_name?: string | null
          file_type?: string | null
          id?: string
          import_batch_id?: string
          status?: string
          transaction_date?: string
          transaction_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_transactions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      bpo_company_access: {
        Row: {
          bpo_user_id: string
          company_id: string
          created_at: string
          granted_at: string
          granted_by: string
          id: string
          notes: string | null
          revoked_at: string | null
          updated_at: string
        }
        Insert: {
          bpo_user_id: string
          company_id: string
          created_at?: string
          granted_at?: string
          granted_by: string
          id?: string
          notes?: string | null
          revoked_at?: string | null
          updated_at?: string
        }
        Update: {
          bpo_user_id?: string
          company_id?: string
          created_at?: string
          granted_at?: string
          granted_by?: string
          id?: string
          notes?: string | null
          revoked_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bpo_company_access_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          address: string
          asaas_customer_id: string | null
          asaas_subscription_id: string | null
          billing_cpf_cnpj: string | null
          billing_email: string | null
          city: string | null
          cnpj: string
          consumption_alert_threshold: number | null
          contracted_price_per_vehicle: number | null
          coupling_asset_limit: number | null
          coupling_module_enabled: boolean | null
          created_at: string
          cte_module_enabled: boolean | null
          cte_monthly_limit: number | null
          default_target_consumption: number | null
          email: string | null
          id: string
          name: string
          next_billing_date: string | null
          phone: string | null
          responsible_cpf: string
          responsible_name: string
          slug: string | null
          state: string | null
          status: string
          subscription_plan_id: string | null
          subscription_started_at: string | null
          subscription_status: string | null
          updated_at: string
          vehicle_limit: number | null
          zip_code: string | null
        }
        Insert: {
          address: string
          asaas_customer_id?: string | null
          asaas_subscription_id?: string | null
          billing_cpf_cnpj?: string | null
          billing_email?: string | null
          city?: string | null
          cnpj: string
          consumption_alert_threshold?: number | null
          contracted_price_per_vehicle?: number | null
          coupling_asset_limit?: number | null
          coupling_module_enabled?: boolean | null
          created_at?: string
          cte_module_enabled?: boolean | null
          cte_monthly_limit?: number | null
          default_target_consumption?: number | null
          email?: string | null
          id?: string
          name: string
          next_billing_date?: string | null
          phone?: string | null
          responsible_cpf: string
          responsible_name: string
          slug?: string | null
          state?: string | null
          status?: string
          subscription_plan_id?: string | null
          subscription_started_at?: string | null
          subscription_status?: string | null
          updated_at?: string
          vehicle_limit?: number | null
          zip_code?: string | null
        }
        Update: {
          address?: string
          asaas_customer_id?: string | null
          asaas_subscription_id?: string | null
          billing_cpf_cnpj?: string | null
          billing_email?: string | null
          city?: string | null
          cnpj?: string
          consumption_alert_threshold?: number | null
          contracted_price_per_vehicle?: number | null
          coupling_asset_limit?: number | null
          coupling_module_enabled?: boolean | null
          created_at?: string
          cte_module_enabled?: boolean | null
          cte_monthly_limit?: number | null
          default_target_consumption?: number | null
          email?: string | null
          id?: string
          name?: string
          next_billing_date?: string | null
          phone?: string | null
          responsible_cpf?: string
          responsible_name?: string
          slug?: string | null
          state?: string | null
          status?: string
          subscription_plan_id?: string | null
          subscription_started_at?: string | null
          subscription_status?: string | null
          updated_at?: string
          vehicle_limit?: number | null
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "companies_subscription_plan_id_fkey"
            columns: ["subscription_plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      cte_anulacao_documents: {
        Row: {
          authorization_date: string | null
          cancellation_reason: string
          company_id: string
          created_at: string
          cte_key: string | null
          cte_number: string | null
          emission_date: string | null
          freight_value: number | null
          id: string
          nuvem_fiscal_id: string | null
          original_cte_id: string | null
          pdf_url: string | null
          recipient_address: string
          recipient_document: string
          recipient_name: string
          sender_address: string
          sender_document: string
          sender_name: string
          serie: string
          status: string
          substitute_cte_key: string | null
          updated_at: string
          user_id: string
          xml_content: string | null
        }
        Insert: {
          authorization_date?: string | null
          cancellation_reason: string
          company_id: string
          created_at?: string
          cte_key?: string | null
          cte_number?: string | null
          emission_date?: string | null
          freight_value?: number | null
          id?: string
          nuvem_fiscal_id?: string | null
          original_cte_id?: string | null
          pdf_url?: string | null
          recipient_address: string
          recipient_document: string
          recipient_name: string
          sender_address: string
          sender_document: string
          sender_name: string
          serie?: string
          status?: string
          substitute_cte_key?: string | null
          updated_at?: string
          user_id: string
          xml_content?: string | null
        }
        Update: {
          authorization_date?: string | null
          cancellation_reason?: string
          company_id?: string
          created_at?: string
          cte_key?: string | null
          cte_number?: string | null
          emission_date?: string | null
          freight_value?: number | null
          id?: string
          nuvem_fiscal_id?: string | null
          original_cte_id?: string | null
          pdf_url?: string | null
          recipient_address?: string
          recipient_document?: string
          recipient_name?: string
          sender_address?: string
          sender_document?: string
          sender_name?: string
          serie?: string
          status?: string
          substitute_cte_key?: string | null
          updated_at?: string
          user_id?: string
          xml_content?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cte_anulacao_documents_original_cte_id_fkey"
            columns: ["original_cte_id"]
            isOneToOne: false
            referencedRelation: "cte_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      cte_documents: {
        Row: {
          authorization_date: string | null
          cancellation_date: string | null
          cancellation_reason: string | null
          cargo_info: Json | null
          cfop: string | null
          company_id: string
          created_at: string
          cte_key: string | null
          cte_number: string | null
          deleted_at: string | null
          draft_converted_at: string | null
          draft_converted_from: string | null
          driver_info: Json | null
          emission_date: string | null
          environment: string
          error_message: string | null
          freight_value: number | null
          icms_value: number | null
          id: string
          is_draft: boolean | null
          journey_id: string | null
          linked_documents: Json | null
          nuvem_fiscal_id: string | null
          operation_type: string | null
          pdf_url: string | null
          recipient_address: string
          recipient_document: string
          recipient_full: Json | null
          recipient_name: string
          referenced_cte_key: string | null
          sender_address: string
          sender_document: string
          sender_full: Json | null
          sender_name: string
          series: string
          status: string
          tax_info: Json | null
          updated_at: string
          user_id: string
          vehicle_info: Json | null
          xml_content: string | null
        }
        Insert: {
          authorization_date?: string | null
          cancellation_date?: string | null
          cancellation_reason?: string | null
          cargo_info?: Json | null
          cfop?: string | null
          company_id: string
          created_at?: string
          cte_key?: string | null
          cte_number?: string | null
          deleted_at?: string | null
          draft_converted_at?: string | null
          draft_converted_from?: string | null
          driver_info?: Json | null
          emission_date?: string | null
          environment?: string
          error_message?: string | null
          freight_value?: number | null
          icms_value?: number | null
          id?: string
          is_draft?: boolean | null
          journey_id?: string | null
          linked_documents?: Json | null
          nuvem_fiscal_id?: string | null
          operation_type?: string | null
          pdf_url?: string | null
          recipient_address: string
          recipient_document: string
          recipient_full?: Json | null
          recipient_name: string
          referenced_cte_key?: string | null
          sender_address: string
          sender_document: string
          sender_full?: Json | null
          sender_name: string
          series?: string
          status?: string
          tax_info?: Json | null
          updated_at?: string
          user_id: string
          vehicle_info?: Json | null
          xml_content?: string | null
        }
        Update: {
          authorization_date?: string | null
          cancellation_date?: string | null
          cancellation_reason?: string | null
          cargo_info?: Json | null
          cfop?: string | null
          company_id?: string
          created_at?: string
          cte_key?: string | null
          cte_number?: string | null
          deleted_at?: string | null
          draft_converted_at?: string | null
          draft_converted_from?: string | null
          driver_info?: Json | null
          emission_date?: string | null
          environment?: string
          error_message?: string | null
          freight_value?: number | null
          icms_value?: number | null
          id?: string
          is_draft?: boolean | null
          journey_id?: string | null
          linked_documents?: Json | null
          nuvem_fiscal_id?: string | null
          operation_type?: string | null
          pdf_url?: string | null
          recipient_address?: string
          recipient_document?: string
          recipient_full?: Json | null
          recipient_name?: string
          referenced_cte_key?: string | null
          sender_address?: string
          sender_document?: string
          sender_full?: Json | null
          sender_name?: string
          series?: string
          status?: string
          tax_info?: Json | null
          updated_at?: string
          user_id?: string
          vehicle_info?: Json | null
          xml_content?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cte_documents_draft_converted_from_fkey"
            columns: ["draft_converted_from"]
            isOneToOne: false
            referencedRelation: "cte_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cte_documents_journey_id_fkey"
            columns: ["journey_id"]
            isOneToOne: false
            referencedRelation: "journeys"
            referencedColumns: ["id"]
          },
        ]
      }
      cte_series: {
        Row: {
          company_id: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean | null
          next_number: number
          series: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          next_number?: number
          series: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          next_number?: number
          series?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cte_series_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      cte_settings: {
        Row: {
          auto_emit_enabled: boolean
          certificate_expires_at: string | null
          certificate_name: string | null
          company_id: string
          created_at: string
          default_series: string
          environment: string
          id: string
          ie_emitente: string | null
          nuvem_fiscal_company_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          auto_emit_enabled?: boolean
          certificate_expires_at?: string | null
          certificate_name?: string | null
          company_id: string
          created_at?: string
          default_series?: string
          environment?: string
          id?: string
          ie_emitente?: string | null
          nuvem_fiscal_company_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          auto_emit_enabled?: boolean
          certificate_expires_at?: string | null
          certificate_name?: string | null
          company_id?: string
          created_at?: string
          default_series?: string
          environment?: string
          id?: string
          ie_emitente?: string | null
          nuvem_fiscal_company_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      customer_portal_tokens: {
        Row: {
          company_id: string
          created_at: string
          expires_at: string | null
          id: string
          is_active: boolean
          last_accessed_at: string | null
          party_id: string
          short_code: string | null
          token: string
        }
        Insert: {
          company_id: string
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          last_accessed_at?: string | null
          party_id: string
          short_code?: string | null
          token?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          last_accessed_at?: string | null
          party_id?: string
          short_code?: string | null
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_portal_tokens_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_portal_tokens_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: false
            referencedRelation: "parties"
            referencedColumns: ["id"]
          },
        ]
      }
      digital_certificates: {
        Row: {
          certificate_name: string
          company_id: string
          created_at: string
          expires_at: string
          id: string
          nuvem_fiscal_certificate_id: string | null
          status: string
          updated_at: string
          uploaded_at: string
          user_id: string
        }
        Insert: {
          certificate_name: string
          company_id: string
          created_at?: string
          expires_at: string
          id?: string
          nuvem_fiscal_certificate_id?: string | null
          status?: string
          updated_at?: string
          uploaded_at?: string
          user_id: string
        }
        Update: {
          certificate_name?: string
          company_id?: string
          created_at?: string
          expires_at?: string
          id?: string
          nuvem_fiscal_certificate_id?: string | null
          status?: string
          updated_at?: string
          uploaded_at?: string
          user_id?: string
        }
        Relationships: []
      }
      driver_messages: {
        Row: {
          attachment_url: string | null
          company_id: string
          created_at: string
          driver_id: string | null
          id: string
          is_from_driver: boolean
          journey_id: string | null
          message: string
          read_at: string | null
          user_id: string | null
        }
        Insert: {
          attachment_url?: string | null
          company_id: string
          created_at?: string
          driver_id?: string | null
          id?: string
          is_from_driver?: boolean
          journey_id?: string | null
          message: string
          read_at?: string | null
          user_id?: string | null
        }
        Update: {
          attachment_url?: string | null
          company_id?: string
          created_at?: string
          driver_id?: string | null
          id?: string
          is_from_driver?: boolean
          journey_id?: string | null
          message?: string
          read_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "driver_messages_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_messages_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_messages_journey_id_fkey"
            columns: ["journey_id"]
            isOneToOne: false
            referencedRelation: "journeys"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_performance_history: {
        Row: {
          company_id: string
          completion_rate: number | null
          created_at: string
          driver_id: string
          fuel_efficiency: number | null
          id: string
          performance_score: number | null
          period_end: string
          period_start: string
          rank_position: number | null
          revenue_per_km: number | null
          total_distance: number | null
          total_expenses: number | null
          total_fuel_cost: number | null
          total_journeys: number
          total_revenue: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          company_id: string
          completion_rate?: number | null
          created_at?: string
          driver_id: string
          fuel_efficiency?: number | null
          id?: string
          performance_score?: number | null
          period_end: string
          period_start: string
          rank_position?: number | null
          revenue_per_km?: number | null
          total_distance?: number | null
          total_expenses?: number | null
          total_fuel_cost?: number | null
          total_journeys?: number
          total_revenue?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          company_id?: string
          completion_rate?: number | null
          created_at?: string
          driver_id?: string
          fuel_efficiency?: number | null
          id?: string
          performance_score?: number | null
          period_end?: string
          period_start?: string
          rank_position?: number | null
          revenue_per_km?: number | null
          total_distance?: number | null
          total_expenses?: number | null
          total_fuel_cost?: number | null
          total_journeys?: number
          total_revenue?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "driver_performance_history_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_performance_history_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_vehicles: {
        Row: {
          assigned_at: string | null
          assigned_by: string | null
          company_id: string
          created_at: string | null
          driver_id: string
          id: string
          status: string | null
          updated_at: string | null
          vehicle_id: string
        }
        Insert: {
          assigned_at?: string | null
          assigned_by?: string | null
          company_id: string
          created_at?: string | null
          driver_id: string
          id?: string
          status?: string | null
          updated_at?: string | null
          vehicle_id: string
        }
        Update: {
          assigned_at?: string | null
          assigned_by?: string | null
          company_id?: string
          created_at?: string | null
          driver_id?: string
          id?: string
          status?: string | null
          updated_at?: string | null
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "driver_vehicles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_vehicles_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_vehicles_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      drivers: {
        Row: {
          address: string | null
          auth_user_id: string | null
          can_add_revenue: boolean
          can_auto_close_journey: boolean
          can_create_journey_without_approval: boolean
          can_start_journey: boolean
          cnh: string | null
          cnh_category: string | null
          cnh_expiry: string | null
          company_id: string
          cpf: string | null
          created_at: string
          email: string | null
          emergency_contact: string | null
          emergency_phone: string | null
          id: string
          name: string
          phone: string | null
          status: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          auth_user_id?: string | null
          can_add_revenue?: boolean
          can_auto_close_journey?: boolean
          can_create_journey_without_approval?: boolean
          can_start_journey?: boolean
          cnh?: string | null
          cnh_category?: string | null
          cnh_expiry?: string | null
          company_id: string
          cpf?: string | null
          created_at?: string
          email?: string | null
          emergency_contact?: string | null
          emergency_phone?: string | null
          id?: string
          name: string
          phone?: string | null
          status?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          auth_user_id?: string | null
          can_add_revenue?: boolean
          can_auto_close_journey?: boolean
          can_create_journey_without_approval?: boolean
          can_start_journey?: boolean
          cnh?: string | null
          cnh_category?: string | null
          cnh_expiry?: string | null
          company_id?: string
          cpf?: string | null
          created_at?: string
          email?: string | null
          emergency_contact?: string | null
          emergency_phone?: string | null
          id?: string
          name?: string
          phone?: string | null
          status?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "drivers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_categories: {
        Row: {
          classification: string
          color: string | null
          company_id: string
          created_at: string
          icon: string | null
          id: string
          is_active: boolean | null
          is_system: boolean | null
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          classification: string
          color?: string | null
          company_id: string
          created_at?: string
          icon?: string | null
          id?: string
          is_active?: boolean | null
          is_system?: boolean | null
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          classification?: string
          color?: string | null
          company_id?: string
          created_at?: string
          icon?: string | null
          id?: string
          is_active?: boolean | null
          is_system?: boolean | null
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "expense_categories_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          accounts_payable_id: string | null
          amount: number
          bank_transaction_id: string | null
          category: string
          category_id: string | null
          company_id: string
          created_at: string
          date: string
          deleted_at: string | null
          description: string
          id: string
          is_direct: boolean | null
          is_ignored: boolean | null
          journey_id: string | null
          journey_leg_id: string | null
          location_address: string | null
          location_lat: number | null
          location_lng: number | null
          notes: string | null
          payment_method: string | null
          payment_status: string | null
          receipt_number: string | null
          receipt_url: string | null
          reconciled_at: string | null
          status: string | null
          supplier: string | null
          supplier_id: string | null
          updated_at: string
          user_id: string
          vehicle_id: string | null
        }
        Insert: {
          accounts_payable_id?: string | null
          amount: number
          bank_transaction_id?: string | null
          category: string
          category_id?: string | null
          company_id: string
          created_at?: string
          date?: string
          deleted_at?: string | null
          description: string
          id?: string
          is_direct?: boolean | null
          is_ignored?: boolean | null
          journey_id?: string | null
          journey_leg_id?: string | null
          location_address?: string | null
          location_lat?: number | null
          location_lng?: number | null
          notes?: string | null
          payment_method?: string | null
          payment_status?: string | null
          receipt_number?: string | null
          receipt_url?: string | null
          reconciled_at?: string | null
          status?: string | null
          supplier?: string | null
          supplier_id?: string | null
          updated_at?: string
          user_id: string
          vehicle_id?: string | null
        }
        Update: {
          accounts_payable_id?: string | null
          amount?: number
          bank_transaction_id?: string | null
          category?: string
          category_id?: string | null
          company_id?: string
          created_at?: string
          date?: string
          deleted_at?: string | null
          description?: string
          id?: string
          is_direct?: boolean | null
          is_ignored?: boolean | null
          journey_id?: string | null
          journey_leg_id?: string | null
          location_address?: string | null
          location_lat?: number | null
          location_lng?: number | null
          notes?: string | null
          payment_method?: string | null
          payment_status?: string | null
          receipt_number?: string | null
          receipt_url?: string | null
          reconciled_at?: string | null
          status?: string | null
          supplier?: string | null
          supplier_id?: string | null
          updated_at?: string
          user_id?: string
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_accounts_payable_id_fkey"
            columns: ["accounts_payable_id"]
            isOneToOne: false
            referencedRelation: "accounts_payable"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_bank_transaction_id_fkey"
            columns: ["bank_transaction_id"]
            isOneToOne: false
            referencedRelation: "bank_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "expense_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_journey_id_fkey"
            columns: ["journey_id"]
            isOneToOne: false
            referencedRelation: "journeys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_journey_leg_id_fkey"
            columns: ["journey_leg_id"]
            isOneToOne: false
            referencedRelation: "journey_legs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "parties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      fiscal_audit_logs: {
        Row: {
          action: string
          action_status: string
          company_id: string
          created_at: string
          document_id: string
          document_key: string | null
          document_number: string | null
          document_type: string
          error_message: string | null
          id: string
          request_payload: Json | null
          response_payload: Json | null
          user_id: string
        }
        Insert: {
          action: string
          action_status: string
          company_id: string
          created_at?: string
          document_id: string
          document_key?: string | null
          document_number?: string | null
          document_type: string
          error_message?: string | null
          id?: string
          request_payload?: Json | null
          response_payload?: Json | null
          user_id: string
        }
        Update: {
          action?: string
          action_status?: string
          company_id?: string
          created_at?: string
          document_id?: string
          document_key?: string | null
          document_number?: string | null
          document_type?: string
          error_message?: string | null
          id?: string
          request_payload?: Json | null
          response_payload?: Json | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fiscal_audit_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      fiscal_document_lookups: {
        Row: {
          access_key: string
          company_id: string
          created_at: string
          document_type: string
          error_message: string | null
          id: string
          parsed_data: Json | null
          raw_xml: string | null
          success: boolean
          user_id: string
        }
        Insert: {
          access_key: string
          company_id: string
          created_at?: string
          document_type: string
          error_message?: string | null
          id?: string
          parsed_data?: Json | null
          raw_xml?: string | null
          success?: boolean
          user_id: string
        }
        Update: {
          access_key?: string
          company_id?: string
          created_at?: string
          document_type?: string
          error_message?: string | null
          id?: string
          parsed_data?: Json | null
          raw_xml?: string | null
          success?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fiscal_document_lookups_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      fiscal_party_templates: {
        Row: {
          address_city: string | null
          address_complement: string | null
          address_district: string | null
          address_number: string | null
          address_state: string | null
          address_street: string | null
          address_zip: string | null
          company_id: string
          created_at: string
          document: string
          email: string | null
          id: string
          ie: string | null
          name: string
          phone: string | null
          type: string
          updated_at: string
        }
        Insert: {
          address_city?: string | null
          address_complement?: string | null
          address_district?: string | null
          address_number?: string | null
          address_state?: string | null
          address_street?: string | null
          address_zip?: string | null
          company_id: string
          created_at?: string
          document: string
          email?: string | null
          id?: string
          ie?: string | null
          name: string
          phone?: string | null
          type: string
          updated_at?: string
        }
        Update: {
          address_city?: string | null
          address_complement?: string | null
          address_district?: string | null
          address_number?: string | null
          address_state?: string | null
          address_street?: string | null
          address_zip?: string | null
          company_id?: string
          created_at?: string
          document?: string
          email?: string | null
          id?: string
          ie?: string | null
          name?: string
          phone?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      freight_pricing_settings: {
        Row: {
          avg_consumption_kml: number | null
          avg_diesel_price: number | null
          company_id: string
          created_at: string
          default_axles: number
          driver_commission: number
          id: string
          profit_margin: number
          toll_cost_per_axle_km: number
          updated_at: string
        }
        Insert: {
          avg_consumption_kml?: number | null
          avg_diesel_price?: number | null
          company_id: string
          created_at?: string
          default_axles?: number
          driver_commission?: number
          id?: string
          profit_margin?: number
          toll_cost_per_axle_km?: number
          updated_at?: string
        }
        Update: {
          avg_consumption_kml?: number | null
          avg_diesel_price?: number | null
          company_id?: string
          created_at?: string
          default_axles?: number
          driver_commission?: number
          id?: string
          profit_margin?: number
          toll_cost_per_axle_km?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "freight_pricing_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      freight_rates: {
        Row: {
          company_id: string
          created_at: string
          cubage_factor: number | null
          destination_city: string | null
          destination_state: string | null
          id: string
          is_active: boolean
          max_weight_kg: number
          min_weight_kg: number
          minimum_freight: number
          origin_city: string | null
          origin_state: string | null
          rate_per_kg: number
          updated_at: string
          volume_rate: number | null
        }
        Insert: {
          company_id: string
          created_at?: string
          cubage_factor?: number | null
          destination_city?: string | null
          destination_state?: string | null
          id?: string
          is_active?: boolean
          max_weight_kg?: number
          min_weight_kg?: number
          minimum_freight?: number
          origin_city?: string | null
          origin_state?: string | null
          rate_per_kg?: number
          updated_at?: string
          volume_rate?: number | null
        }
        Update: {
          company_id?: string
          created_at?: string
          cubage_factor?: number | null
          destination_city?: string | null
          destination_state?: string | null
          id?: string
          is_active?: boolean
          max_weight_kg?: number
          min_weight_kg?: number
          minimum_freight?: number
          origin_city?: string | null
          origin_state?: string | null
          rate_per_kg?: number
          updated_at?: string
          volume_rate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "freight_rates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      freight_requests: {
        Row: {
          approved_at: string | null
          approved_by_operator_at: string | null
          cargo_description: string | null
          cargo_value: number | null
          cargo_weight_kg: number | null
          collection_address: string | null
          collection_date: string | null
          collection_notes: string | null
          company_id: string
          created_at: string
          cte_document_id: string | null
          customer_notes: string | null
          destination_city: string | null
          destination_state: string | null
          driver_id: string | null
          freight_rate_id: string | null
          freight_value: number | null
          id: string
          journey_id: string | null
          nfe_access_key: string | null
          nfe_number: string | null
          nfe_xml_data: Json | null
          operator_notes: string | null
          origin_city: string | null
          origin_state: string | null
          party_id: string
          request_number: string | null
          status: string
          token_id: string
          updated_at: string
          vehicle_id: string | null
          vehicle_type_requested: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by_operator_at?: string | null
          cargo_description?: string | null
          cargo_value?: number | null
          cargo_weight_kg?: number | null
          collection_address?: string | null
          collection_date?: string | null
          collection_notes?: string | null
          company_id: string
          created_at?: string
          cte_document_id?: string | null
          customer_notes?: string | null
          destination_city?: string | null
          destination_state?: string | null
          driver_id?: string | null
          freight_rate_id?: string | null
          freight_value?: number | null
          id?: string
          journey_id?: string | null
          nfe_access_key?: string | null
          nfe_number?: string | null
          nfe_xml_data?: Json | null
          operator_notes?: string | null
          origin_city?: string | null
          origin_state?: string | null
          party_id: string
          request_number?: string | null
          status?: string
          token_id: string
          updated_at?: string
          vehicle_id?: string | null
          vehicle_type_requested?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by_operator_at?: string | null
          cargo_description?: string | null
          cargo_value?: number | null
          cargo_weight_kg?: number | null
          collection_address?: string | null
          collection_date?: string | null
          collection_notes?: string | null
          company_id?: string
          created_at?: string
          cte_document_id?: string | null
          customer_notes?: string | null
          destination_city?: string | null
          destination_state?: string | null
          driver_id?: string | null
          freight_rate_id?: string | null
          freight_value?: number | null
          id?: string
          journey_id?: string | null
          nfe_access_key?: string | null
          nfe_number?: string | null
          nfe_xml_data?: Json | null
          operator_notes?: string | null
          origin_city?: string | null
          origin_state?: string | null
          party_id?: string
          request_number?: string | null
          status?: string
          token_id?: string
          updated_at?: string
          vehicle_id?: string | null
          vehicle_type_requested?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "freight_requests_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "freight_requests_cte_document_id_fkey"
            columns: ["cte_document_id"]
            isOneToOne: false
            referencedRelation: "cte_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "freight_requests_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "freight_requests_freight_rate_id_fkey"
            columns: ["freight_rate_id"]
            isOneToOne: false
            referencedRelation: "freight_rates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "freight_requests_journey_id_fkey"
            columns: ["journey_id"]
            isOneToOne: false
            referencedRelation: "journeys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "freight_requests_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: false
            referencedRelation: "parties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "freight_requests_token_id_fkey"
            columns: ["token_id"]
            isOneToOne: false
            referencedRelation: "customer_portal_tokens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "freight_requests_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      fuel_expenses: {
        Row: {
          bank_transaction_id: string | null
          company_id: string
          created_at: string
          date: string
          deleted_at: string | null
          distance_traveled: number | null
          fuel_consumed: number | null
          gas_station_id: string | null
          id: string
          is_ignored: boolean | null
          journey_id: string | null
          journey_leg_id: string | null
          liters: number
          location_address: string | null
          location_lat: number | null
          location_lng: number | null
          notes: string | null
          odometer: number | null
          odometer_final: number | null
          payment_method: string | null
          price_per_liter: number
          receipt_number: string | null
          receipt_url: string | null
          reconciled_at: string | null
          tank_level_after: number | null
          tank_level_before: number | null
          total_amount: number
          updated_at: string
          user_id: string
          vehicle_id: string
        }
        Insert: {
          bank_transaction_id?: string | null
          company_id: string
          created_at?: string
          date?: string
          deleted_at?: string | null
          distance_traveled?: number | null
          fuel_consumed?: number | null
          gas_station_id?: string | null
          id?: string
          is_ignored?: boolean | null
          journey_id?: string | null
          journey_leg_id?: string | null
          liters: number
          location_address?: string | null
          location_lat?: number | null
          location_lng?: number | null
          notes?: string | null
          odometer?: number | null
          odometer_final?: number | null
          payment_method?: string | null
          price_per_liter: number
          receipt_number?: string | null
          receipt_url?: string | null
          reconciled_at?: string | null
          tank_level_after?: number | null
          tank_level_before?: number | null
          total_amount: number
          updated_at?: string
          user_id: string
          vehicle_id: string
        }
        Update: {
          bank_transaction_id?: string | null
          company_id?: string
          created_at?: string
          date?: string
          deleted_at?: string | null
          distance_traveled?: number | null
          fuel_consumed?: number | null
          gas_station_id?: string | null
          id?: string
          is_ignored?: boolean | null
          journey_id?: string | null
          journey_leg_id?: string | null
          liters?: number
          location_address?: string | null
          location_lat?: number | null
          location_lng?: number | null
          notes?: string | null
          odometer?: number | null
          odometer_final?: number | null
          payment_method?: string | null
          price_per_liter?: number
          receipt_number?: string | null
          receipt_url?: string | null
          reconciled_at?: string | null
          tank_level_after?: number | null
          tank_level_before?: number | null
          total_amount?: number
          updated_at?: string
          user_id?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fuel_expenses_bank_transaction_id_fkey"
            columns: ["bank_transaction_id"]
            isOneToOne: false
            referencedRelation: "bank_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fuel_expenses_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fuel_expenses_gas_station_id_fkey"
            columns: ["gas_station_id"]
            isOneToOne: false
            referencedRelation: "gas_stations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fuel_expenses_journey_id_fkey"
            columns: ["journey_id"]
            isOneToOne: false
            referencedRelation: "journeys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fuel_expenses_journey_leg_id_fkey"
            columns: ["journey_leg_id"]
            isOneToOne: false
            referencedRelation: "journey_legs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fuel_expenses_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      gas_stations: {
        Row: {
          address: string | null
          city: string | null
          cnpj: string | null
          company_id: string
          created_at: string
          id: string
          name: string
          phone: string | null
          state: string | null
          status: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          cnpj?: string | null
          company_id: string
          created_at?: string
          id?: string
          name: string
          phone?: string | null
          state?: string | null
          status?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          city?: string | null
          cnpj?: string | null
          company_id?: string
          created_at?: string
          id?: string
          name?: string
          phone?: string | null
          state?: string | null
          status?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gas_stations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      incidents: {
        Row: {
          company_id: string
          created_at: string
          description: string
          driver_id: string
          id: string
          incident_type: string
          journey_id: string | null
          photo_url: string | null
          resolution_notes: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: string
          updated_at: string
          vehicle_id: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          description: string
          driver_id: string
          id?: string
          incident_type: string
          journey_id?: string | null
          photo_url?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          updated_at?: string
          vehicle_id?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          description?: string
          driver_id?: string
          id?: string
          incident_type?: string
          journey_id?: string | null
          photo_url?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          updated_at?: string
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "incidents_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_journey_id_fkey"
            columns: ["journey_id"]
            isOneToOne: false
            referencedRelation: "journeys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_items: {
        Row: {
          category: string | null
          company_id: string | null
          description: string | null
          id: string
          location: string | null
          min_stock: number | null
          name: string
          quantity: number | null
          sku: string | null
          unit: string | null
          unit_price: number | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          category?: string | null
          company_id?: string | null
          description?: string | null
          id?: string
          location?: string | null
          min_stock?: number | null
          name: string
          quantity?: number | null
          sku?: string | null
          unit?: string | null
          unit_price?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          category?: string | null
          company_id?: string | null
          description?: string | null
          id?: string
          location?: string | null
          min_stock?: number | null
          name?: string
          quantity?: number | null
          sku?: string | null
          unit?: string | null
          unit_price?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount: number
          asaas_customer_id: string | null
          asaas_invoice_url: string | null
          asaas_payment_id: string | null
          billing_kind: string | null
          billing_period_end: string
          billing_period_start: string
          company_id: string
          created_at: string
          deleted_at: string | null
          due_date: string
          id: string
          paid_date: string | null
          payment_method: string | null
          plan_id: string
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          asaas_customer_id?: string | null
          asaas_invoice_url?: string | null
          asaas_payment_id?: string | null
          billing_kind?: string | null
          billing_period_end: string
          billing_period_start: string
          company_id: string
          created_at?: string
          deleted_at?: string | null
          due_date: string
          id?: string
          paid_date?: string | null
          payment_method?: string | null
          plan_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          asaas_customer_id?: string | null
          asaas_invoice_url?: string | null
          asaas_payment_id?: string | null
          billing_kind?: string | null
          billing_period_end?: string
          billing_period_start?: string
          company_id?: string
          created_at?: string
          deleted_at?: string | null
          due_date?: string
          id?: string
          paid_date?: string | null
          payment_method?: string | null
          plan_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      journey_checklists: {
        Row: {
          checklist_type: string
          company_id: string
          completed_at: string | null
          created_at: string
          driver_id: string
          id: string
          items: Json
          journey_id: string
          location_address: string | null
          location_lat: number | null
          location_lng: number | null
          notes: string | null
          photos: Json | null
          updated_at: string
          vehicle_id: string
        }
        Insert: {
          checklist_type: string
          company_id: string
          completed_at?: string | null
          created_at?: string
          driver_id: string
          id?: string
          items?: Json
          journey_id: string
          location_address?: string | null
          location_lat?: number | null
          location_lng?: number | null
          notes?: string | null
          photos?: Json | null
          updated_at?: string
          vehicle_id: string
        }
        Update: {
          checklist_type?: string
          company_id?: string
          completed_at?: string | null
          created_at?: string
          driver_id?: string
          id?: string
          items?: Json
          journey_id?: string
          location_address?: string | null
          location_lat?: number | null
          location_lng?: number | null
          notes?: string | null
          photos?: Json | null
          updated_at?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "journey_checklists_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journey_checklists_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journey_checklists_journey_id_fkey"
            columns: ["journey_id"]
            isOneToOne: false
            referencedRelation: "journeys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journey_checklists_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      journey_legs: {
        Row: {
          company_id: string
          created_at: string
          customer_id: string | null
          destination: string
          distance: number | null
          freight_due_date: string | null
          freight_received_date: string | null
          freight_status: string | null
          freight_value: number | null
          id: string
          journey_id: string
          leg_number: number
          origin: string
          status: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          customer_id?: string | null
          destination: string
          distance?: number | null
          freight_due_date?: string | null
          freight_received_date?: string | null
          freight_status?: string | null
          freight_value?: number | null
          id?: string
          journey_id: string
          leg_number: number
          origin: string
          status?: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          customer_id?: string | null
          destination?: string
          distance?: number | null
          freight_due_date?: string | null
          freight_received_date?: string | null
          freight_status?: string | null
          freight_value?: number | null
          id?: string
          journey_id?: string
          leg_number?: number
          origin?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "journey_legs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journey_legs_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "parties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journey_legs_journey_id_fkey"
            columns: ["journey_id"]
            isOneToOne: false
            referencedRelation: "journeys"
            referencedColumns: ["id"]
          },
        ]
      }
      journeys: {
        Row: {
          advance_value: number | null
          closed_at: string | null
          closed_by: string | null
          closure_notes: string | null
          closure_requested_at: string | null
          closure_requested_by: string | null
          commission_percentage: number | null
          commission_value: number | null
          company_id: string
          coupling_id: string | null
          created_at: string
          created_by_driver: boolean
          customer_id: string | null
          deleted_at: string | null
          destination: string
          distance: number | null
          driver_id: string | null
          end_date: string | null
          end_km: number | null
          end_location_address: string | null
          end_location_lat: number | null
          end_location_lng: number | null
          freight_due_date: string | null
          freight_received_date: string | null
          freight_status: string | null
          freight_value: number | null
          id: string
          journey_number: string
          notes: string | null
          origin: string
          start_date: string | null
          start_km: number | null
          start_location_address: string | null
          start_location_lat: number | null
          start_location_lng: number | null
          status: string | null
          updated_at: string
          user_id: string
          vehicle_id: string
        }
        Insert: {
          advance_value?: number | null
          closed_at?: string | null
          closed_by?: string | null
          closure_notes?: string | null
          closure_requested_at?: string | null
          closure_requested_by?: string | null
          commission_percentage?: number | null
          commission_value?: number | null
          company_id: string
          coupling_id?: string | null
          created_at?: string
          created_by_driver?: boolean
          customer_id?: string | null
          deleted_at?: string | null
          destination: string
          distance?: number | null
          driver_id?: string | null
          end_date?: string | null
          end_km?: number | null
          end_location_address?: string | null
          end_location_lat?: number | null
          end_location_lng?: number | null
          freight_due_date?: string | null
          freight_received_date?: string | null
          freight_status?: string | null
          freight_value?: number | null
          id?: string
          journey_number: string
          notes?: string | null
          origin: string
          start_date?: string | null
          start_km?: number | null
          start_location_address?: string | null
          start_location_lat?: number | null
          start_location_lng?: number | null
          status?: string | null
          updated_at?: string
          user_id: string
          vehicle_id: string
        }
        Update: {
          advance_value?: number | null
          closed_at?: string | null
          closed_by?: string | null
          closure_notes?: string | null
          closure_requested_at?: string | null
          closure_requested_by?: string | null
          commission_percentage?: number | null
          commission_value?: number | null
          company_id?: string
          coupling_id?: string | null
          created_at?: string
          created_by_driver?: boolean
          customer_id?: string | null
          deleted_at?: string | null
          destination?: string
          distance?: number | null
          driver_id?: string | null
          end_date?: string | null
          end_km?: number | null
          end_location_address?: string | null
          end_location_lat?: number | null
          end_location_lng?: number | null
          freight_due_date?: string | null
          freight_received_date?: string | null
          freight_status?: string | null
          freight_value?: number | null
          id?: string
          journey_number?: string
          notes?: string | null
          origin?: string
          start_date?: string | null
          start_km?: number | null
          start_location_address?: string | null
          start_location_lat?: number | null
          start_location_lng?: number | null
          status?: string | null
          updated_at?: string
          user_id?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "journeys_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journeys_coupling_id_fkey"
            columns: ["coupling_id"]
            isOneToOne: false
            referencedRelation: "vehicle_couplings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journeys_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "parties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journeys_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journeys_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_parts: {
        Row: {
          cfop: string | null
          company_id: string
          created_at: string
          description: string
          id: string
          maintenance_id: string
          ncm: string | null
          origin: string | null
          part_code: string | null
          quantity: number
          total_price: number
          unit: string | null
          unit_price: number
          updated_at: string
          user_id: string
        }
        Insert: {
          cfop?: string | null
          company_id: string
          created_at?: string
          description: string
          id?: string
          maintenance_id: string
          ncm?: string | null
          origin?: string | null
          part_code?: string | null
          quantity?: number
          total_price?: number
          unit?: string | null
          unit_price?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          cfop?: string | null
          company_id?: string
          created_at?: string
          description?: string
          id?: string
          maintenance_id?: string
          ncm?: string | null
          origin?: string | null
          part_code?: string | null
          quantity?: number
          total_price?: number
          unit?: string | null
          unit_price?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_parts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_parts_maintenance_id_fkey"
            columns: ["maintenance_id"]
            isOneToOne: false
            referencedRelation: "vehicle_maintenances"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_schedules: {
        Row: {
          alert_days_before: number | null
          alert_km_before: number | null
          company_id: string
          created_at: string
          id: string
          interval_km: number | null
          interval_months: number | null
          is_active: boolean | null
          notes: string | null
          service_category: string
          service_name: string
          updated_at: string
          user_id: string
          vehicle_id: string | null
        }
        Insert: {
          alert_days_before?: number | null
          alert_km_before?: number | null
          company_id: string
          created_at?: string
          id?: string
          interval_km?: number | null
          interval_months?: number | null
          is_active?: boolean | null
          notes?: string | null
          service_category: string
          service_name: string
          updated_at?: string
          user_id: string
          vehicle_id?: string | null
        }
        Update: {
          alert_days_before?: number | null
          alert_km_before?: number | null
          company_id?: string
          created_at?: string
          id?: string
          interval_km?: number | null
          interval_months?: number | null
          is_active?: boolean | null
          notes?: string | null
          service_category?: string
          service_name?: string
          updated_at?: string
          user_id?: string
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_schedules_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_schedules_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      mdfe_cte_links: {
        Row: {
          created_at: string
          cte_id: string | null
          cte_key: string
          id: string
          mdfe_id: string
          value: number | null
          weight: number | null
        }
        Insert: {
          created_at?: string
          cte_id?: string | null
          cte_key: string
          id?: string
          mdfe_id: string
          value?: number | null
          weight?: number | null
        }
        Update: {
          created_at?: string
          cte_id?: string | null
          cte_key?: string
          id?: string
          mdfe_id?: string
          value?: number | null
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "mdfe_cte_links_cte_id_fkey"
            columns: ["cte_id"]
            isOneToOne: false
            referencedRelation: "cte_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mdfe_cte_links_mdfe_id_fkey"
            columns: ["mdfe_id"]
            isOneToOne: false
            referencedRelation: "mdfe_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      mdfe_documents: {
        Row: {
          closure_date: string | null
          company_id: string
          created_at: string
          driver_cpf: string
          driver_name: string
          emission_date: string | null
          id: string
          mdfe_key: string | null
          mdfe_number: string | null
          nuvem_fiscal_id: string | null
          pdf_url: string | null
          serie: string
          status: string
          total_value: number | null
          total_weight: number | null
          uf_end: string
          uf_start: string
          updated_at: string
          user_id: string
          vehicle_plate: string
          xml_content: string | null
        }
        Insert: {
          closure_date?: string | null
          company_id: string
          created_at?: string
          driver_cpf: string
          driver_name: string
          emission_date?: string | null
          id?: string
          mdfe_key?: string | null
          mdfe_number?: string | null
          nuvem_fiscal_id?: string | null
          pdf_url?: string | null
          serie?: string
          status?: string
          total_value?: number | null
          total_weight?: number | null
          uf_end: string
          uf_start: string
          updated_at?: string
          user_id: string
          vehicle_plate: string
          xml_content?: string | null
        }
        Update: {
          closure_date?: string | null
          company_id?: string
          created_at?: string
          driver_cpf?: string
          driver_name?: string
          emission_date?: string | null
          id?: string
          mdfe_key?: string | null
          mdfe_number?: string | null
          nuvem_fiscal_id?: string | null
          pdf_url?: string | null
          serie?: string
          status?: string
          total_value?: number | null
          total_weight?: number | null
          uf_end?: string
          uf_start?: string
          updated_at?: string
          user_id?: string
          vehicle_plate?: string
          xml_content?: string | null
        }
        Relationships: []
      }
      parties: {
        Row: {
          address_city: string | null
          address_complement: string | null
          address_district: string | null
          address_number: string | null
          address_state: string | null
          address_street: string | null
          address_zip: string | null
          company_id: string
          created_at: string
          document: string | null
          email: string | null
          id: string
          ie: string | null
          is_active: boolean
          name: string
          notes: string | null
          phone: string | null
          portal_enabled: boolean
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          address_city?: string | null
          address_complement?: string | null
          address_district?: string | null
          address_number?: string | null
          address_state?: string | null
          address_street?: string | null
          address_zip?: string | null
          company_id: string
          created_at?: string
          document?: string | null
          email?: string | null
          id?: string
          ie?: string | null
          is_active?: boolean
          name: string
          notes?: string | null
          phone?: string | null
          portal_enabled?: boolean
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          address_city?: string | null
          address_complement?: string | null
          address_district?: string | null
          address_number?: string | null
          address_state?: string | null
          address_street?: string | null
          address_zip?: string | null
          company_id?: string
          created_at?: string
          document?: string | null
          email?: string | null
          id?: string
          ie?: string | null
          is_active?: boolean
          name?: string
          notes?: string | null
          phone?: string | null
          portal_enabled?: boolean
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "parties_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          company_id: string | null
          company_name: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          password_change_required: boolean
          phone: string | null
          role: Database["public"]["Enums"]["app_role"] | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          company_id?: string | null
          company_name?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          password_change_required?: boolean
          phone?: string | null
          role?: Database["public"]["Enums"]["app_role"] | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          company_id?: string | null
          company_name?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          password_change_required?: boolean
          phone?: string | null
          role?: Database["public"]["Enums"]["app_role"] | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      report_history: {
        Row: {
          company_id: string
          created_at: string | null
          filters_summary: string | null
          id: string
          report_type: string
          user_id: string | null
        }
        Insert: {
          company_id: string
          created_at?: string | null
          filters_summary?: string | null
          id?: string
          report_type: string
          user_id?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string | null
          filters_summary?: string | null
          id?: string
          report_type?: string
          user_id?: string | null
        }
        Relationships: []
      }
      revenue: {
        Row: {
          amount: number
          bank_transaction_id: string | null
          category: string | null
          category_id: string | null
          client: string | null
          company_id: string
          created_at: string
          customer_id: string | null
          date: string
          deleted_at: string | null
          description: string
          id: string
          invoice_number: string | null
          journey_id: string | null
          journey_leg_id: string | null
          notes: string | null
          payment_date: string | null
          payment_method: string | null
          receipt_url: string | null
          reconciled_at: string | null
          status: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          bank_transaction_id?: string | null
          category?: string | null
          category_id?: string | null
          client?: string | null
          company_id: string
          created_at?: string
          customer_id?: string | null
          date?: string
          deleted_at?: string | null
          description: string
          id?: string
          invoice_number?: string | null
          journey_id?: string | null
          journey_leg_id?: string | null
          notes?: string | null
          payment_date?: string | null
          payment_method?: string | null
          receipt_url?: string | null
          reconciled_at?: string | null
          status?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          bank_transaction_id?: string | null
          category?: string | null
          category_id?: string | null
          client?: string | null
          company_id?: string
          created_at?: string
          customer_id?: string | null
          date?: string
          deleted_at?: string | null
          description?: string
          id?: string
          invoice_number?: string | null
          journey_id?: string | null
          journey_leg_id?: string | null
          notes?: string | null
          payment_date?: string | null
          payment_method?: string | null
          receipt_url?: string | null
          reconciled_at?: string | null
          status?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "revenue_bank_transaction_id_fkey"
            columns: ["bank_transaction_id"]
            isOneToOne: false
            referencedRelation: "bank_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "revenue_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "revenue_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "revenue_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "revenue_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "parties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "revenue_journey_id_fkey"
            columns: ["journey_id"]
            isOneToOne: false
            referencedRelation: "journeys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "revenue_journey_leg_id_fkey"
            columns: ["journey_leg_id"]
            isOneToOne: false
            referencedRelation: "journey_legs"
            referencedColumns: ["id"]
          },
        ]
      }
      revenue_categories: {
        Row: {
          color: string | null
          company_id: string
          created_at: string
          icon: string | null
          id: string
          is_active: boolean | null
          is_system: boolean | null
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          color?: string | null
          company_id: string
          created_at?: string
          icon?: string | null
          id?: string
          is_active?: boolean | null
          is_system?: boolean | null
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          color?: string | null
          company_id?: string
          created_at?: string
          icon?: string | null
          id?: string
          is_active?: boolean | null
          is_system?: boolean | null
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "revenue_categories_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_couplings: {
        Row: {
          company_id: string
          coupling_type: string
          created_at: string | null
          created_by: string | null
          id: string
          is_active: boolean | null
          name: string
          trailer_ids: string[]
          truck_id: string
          updated_at: string | null
        }
        Insert: {
          company_id: string
          coupling_type: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          trailer_ids: string[]
          truck_id: string
          updated_at?: string | null
        }
        Update: {
          company_id?: string
          coupling_type?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          trailer_ids?: string[]
          truck_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "saved_couplings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_couplings_truck_id_fkey"
            columns: ["truck_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          company_id: string
          created_at: string
          id: string
          item_id: string | null
          item_name: string | null
          notes: string | null
          quantity: number
          type: string | null
          vehicle_id: string | null
          vehicle_plate: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          item_id?: string | null
          item_name?: string | null
          notes?: string | null
          quantity: number
          type?: string | null
          vehicle_id?: string | null
          vehicle_plate?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          item_id?: string | null
          item_name?: string | null
          notes?: string | null
          quantity?: number
          type?: string | null
          vehicle_id?: string | null
          vehicle_plate?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_plans: {
        Row: {
          created_at: string | null
          features: Json | null
          has_ai: boolean | null
          has_copilot: boolean | null
          has_dedicated_support: boolean | null
          has_geolocation: boolean | null
          has_pwa_driver: boolean | null
          has_simulator: boolean | null
          id: string
          is_active: boolean | null
          min_price: number | null
          monthly_price: number
          name: string
          price_per_vehicle: number | null
          pricing_model: string | null
          updated_at: string | null
          vehicle_limit: number
        }
        Insert: {
          created_at?: string | null
          features?: Json | null
          has_ai?: boolean | null
          has_copilot?: boolean | null
          has_dedicated_support?: boolean | null
          has_geolocation?: boolean | null
          has_pwa_driver?: boolean | null
          has_simulator?: boolean | null
          id?: string
          is_active?: boolean | null
          min_price?: number | null
          monthly_price: number
          name: string
          price_per_vehicle?: number | null
          pricing_model?: string | null
          updated_at?: string | null
          vehicle_limit: number
        }
        Update: {
          created_at?: string | null
          features?: Json | null
          has_ai?: boolean | null
          has_copilot?: boolean | null
          has_dedicated_support?: boolean | null
          has_geolocation?: boolean | null
          has_pwa_driver?: boolean | null
          has_simulator?: boolean | null
          id?: string
          is_active?: boolean | null
          min_price?: number | null
          monthly_price?: number
          name?: string
          price_per_vehicle?: number | null
          pricing_model?: string | null
          updated_at?: string | null
          vehicle_limit?: number
        }
        Relationships: []
      }
      system_alerts: {
        Row: {
          alert_type: string
          company_id: string | null
          created_at: string
          description: string
          id: string
          metadata: Json | null
          resolved_at: string | null
          resolved_by: string | null
          severity: string
          status: string
          title: string
        }
        Insert: {
          alert_type: string
          company_id?: string | null
          created_at?: string
          description: string
          id?: string
          metadata?: Json | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity: string
          status?: string
          title: string
        }
        Update: {
          alert_type?: string
          company_id?: string | null
          created_at?: string
          description?: string
          id?: string
          metadata?: Json | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "system_alerts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      system_settings: {
        Row: {
          description: string | null
          id: string
          setting_key: string
          setting_type: string
          setting_value: Json
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          description?: string | null
          id?: string
          setting_key: string
          setting_type: string
          setting_value: Json
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          description?: string | null
          id?: string
          setting_key?: string
          setting_type?: string
          setting_value?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      tire_assets: {
        Row: {
          alert_replacement_km: number | null
          alert_rotation_km: number | null
          brand: string | null
          company_id: string | null
          condition: string | null
          cost: number | null
          created_at: string | null
          current_position: string | null
          current_vehicle_id: string | null
          dot: string | null
          fire_number: string | null
          id: string
          installation_km: number | null
          last_rotation_date: string | null
          last_rotation_km: number | null
          life_count: number | null
          model: string | null
          notes: string | null
          original_tread_depth_mm: number | null
          purchase_date: string | null
          serial_number: string
          size: string | null
          status: string | null
          total_km: number | null
          tread_depth_mm: number | null
          user_id: string | null
        }
        Insert: {
          alert_replacement_km?: number | null
          alert_rotation_km?: number | null
          brand?: string | null
          company_id?: string | null
          condition?: string | null
          cost?: number | null
          created_at?: string | null
          current_position?: string | null
          current_vehicle_id?: string | null
          dot?: string | null
          fire_number?: string | null
          id?: string
          installation_km?: number | null
          last_rotation_date?: string | null
          last_rotation_km?: number | null
          life_count?: number | null
          model?: string | null
          notes?: string | null
          original_tread_depth_mm?: number | null
          purchase_date?: string | null
          serial_number: string
          size?: string | null
          status?: string | null
          total_km?: number | null
          tread_depth_mm?: number | null
          user_id?: string | null
        }
        Update: {
          alert_replacement_km?: number | null
          alert_rotation_km?: number | null
          brand?: string | null
          company_id?: string | null
          condition?: string | null
          cost?: number | null
          created_at?: string | null
          current_position?: string | null
          current_vehicle_id?: string | null
          dot?: string | null
          fire_number?: string | null
          id?: string
          installation_km?: number | null
          last_rotation_date?: string | null
          last_rotation_km?: number | null
          life_count?: number | null
          model?: string | null
          notes?: string | null
          original_tread_depth_mm?: number | null
          purchase_date?: string | null
          serial_number?: string
          size?: string | null
          status?: string | null
          total_km?: number | null
          tread_depth_mm?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tire_assets_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tire_assets_current_vehicle_id_fkey"
            columns: ["current_vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      tire_history: {
        Row: {
          action: string
          company_id: string
          created_at: string | null
          id: string
          km_at_action: number | null
          km_driven: number | null
          notes: string | null
          position: string | null
          tire_id: string
          user_id: string
          vehicle_id: string | null
          vehicle_plate: string | null
        }
        Insert: {
          action: string
          company_id: string
          created_at?: string | null
          id?: string
          km_at_action?: number | null
          km_driven?: number | null
          notes?: string | null
          position?: string | null
          tire_id: string
          user_id: string
          vehicle_id?: string | null
          vehicle_plate?: string | null
        }
        Update: {
          action?: string
          company_id?: string
          created_at?: string | null
          id?: string
          km_at_action?: number | null
          km_driven?: number | null
          notes?: string | null
          position?: string | null
          tire_id?: string
          user_id?: string
          vehicle_id?: string | null
          vehicle_plate?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tire_history_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tire_history_tire_id_fkey"
            columns: ["tire_id"]
            isOneToOne: false
            referencedRelation: "tire_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tire_history_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      tire_logs: {
        Row: {
          action_type: string | null
          company_id: string | null
          cost_amount: number | null
          created_at: string | null
          id: string
          measured_tread_depth_mm: number | null
          notes: string | null
          odometer_reading: number | null
          tire_id: string
          vehicle_id: string | null
        }
        Insert: {
          action_type?: string | null
          company_id?: string | null
          cost_amount?: number | null
          created_at?: string | null
          id?: string
          measured_tread_depth_mm?: number | null
          notes?: string | null
          odometer_reading?: number | null
          tire_id: string
          vehicle_id?: string | null
        }
        Update: {
          action_type?: string | null
          company_id?: string | null
          cost_amount?: number | null
          created_at?: string | null
          id?: string
          measured_tread_depth_mm?: number | null
          notes?: string | null
          odometer_reading?: number | null
          tire_id?: string
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tire_logs_tire_id_fkey"
            columns: ["tire_id"]
            isOneToOne: false
            referencedRelation: "tire_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tire_logs_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      usage_logs: {
        Row: {
          action: string
          company_id: string
          created_at: string
          id: string
          metadata: Json | null
          module: string
          user_id: string
        }
        Insert: {
          action: string
          company_id: string
          created_at?: string
          id?: string
          metadata?: Json | null
          module: string
          user_id: string
        }
        Update: {
          action?: string
          company_id?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          module?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "usage_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          company_id: string | null
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      vehicle_consumption_history: {
        Row: {
          calculated_consumption: number | null
          company_id: string
          created_at: string | null
          id: string
          period_end: string
          period_start: string
          status: string | null
          target_consumption: number | null
          total_distance: number | null
          total_liters: number | null
          user_id: string
          variance_percent: number | null
          vehicle_id: string
        }
        Insert: {
          calculated_consumption?: number | null
          company_id: string
          created_at?: string | null
          id?: string
          period_end: string
          period_start: string
          status?: string | null
          target_consumption?: number | null
          total_distance?: number | null
          total_liters?: number | null
          user_id: string
          variance_percent?: number | null
          vehicle_id: string
        }
        Update: {
          calculated_consumption?: number | null
          company_id?: string
          created_at?: string | null
          id?: string
          period_end?: string
          period_start?: string
          status?: string | null
          target_consumption?: number | null
          total_distance?: number | null
          total_liters?: number | null
          user_id?: string
          variance_percent?: number | null
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_consumption_history_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_consumption_history_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_consumption_references: {
        Row: {
          brand: string
          created_at: string
          expected_consumption: number
          id: string
          max_consumption: number | null
          min_consumption: number | null
          model_pattern: string
          updated_at: string
          vehicle_category: string
        }
        Insert: {
          brand: string
          created_at?: string
          expected_consumption: number
          id?: string
          max_consumption?: number | null
          min_consumption?: number | null
          model_pattern: string
          updated_at?: string
          vehicle_category?: string
        }
        Update: {
          brand?: string
          created_at?: string
          expected_consumption?: number
          id?: string
          max_consumption?: number | null
          min_consumption?: number | null
          model_pattern?: string
          updated_at?: string
          vehicle_category?: string
        }
        Relationships: []
      }
      vehicle_coupling_items: {
        Row: {
          coupling_id: string
          created_at: string
          id: string
          position: number
          trailer_id: string
        }
        Insert: {
          coupling_id: string
          created_at?: string
          id?: string
          position?: number
          trailer_id: string
        }
        Update: {
          coupling_id?: string
          created_at?: string
          id?: string
          position?: number
          trailer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_coupling_items_coupling_id_fkey"
            columns: ["coupling_id"]
            isOneToOne: false
            referencedRelation: "vehicle_couplings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_coupling_items_trailer_id_fkey"
            columns: ["trailer_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_couplings: {
        Row: {
          company_id: string
          coupled_at: string
          coupled_by: string | null
          coupling_type: string
          created_at: string
          decoupled_at: string | null
          decoupled_by: string | null
          id: string
          notes: string | null
          truck_id: string
          updated_at: string
        }
        Insert: {
          company_id: string
          coupled_at?: string
          coupled_by?: string | null
          coupling_type?: string
          created_at?: string
          decoupled_at?: string | null
          decoupled_by?: string | null
          id?: string
          notes?: string | null
          truck_id: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          coupled_at?: string
          coupled_by?: string | null
          coupling_type?: string
          created_at?: string
          decoupled_at?: string | null
          decoupled_by?: string | null
          id?: string
          notes?: string | null
          truck_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_couplings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_couplings_truck_id_fkey"
            columns: ["truck_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_maintenances: {
        Row: {
          company_id: string
          created_at: string
          deleted_at: string | null
          description: string
          expense_id: string | null
          id: string
          invoice_date: string | null
          invoice_key: string | null
          invoice_number: string | null
          invoice_xml_url: string | null
          labor_cost: number | null
          maintenance_type: string
          next_due_date: string | null
          next_due_km: number | null
          notes: string | null
          odometer_at_service: number | null
          parts_cost: number | null
          provider_cnpj: string | null
          provider_name: string | null
          receipt_url: string | null
          service_category: string
          service_date: string
          status: string | null
          total_cost: number
          updated_at: string
          user_id: string
          vehicle_id: string
          workshop_id: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          deleted_at?: string | null
          description: string
          expense_id?: string | null
          id?: string
          invoice_date?: string | null
          invoice_key?: string | null
          invoice_number?: string | null
          invoice_xml_url?: string | null
          labor_cost?: number | null
          maintenance_type: string
          next_due_date?: string | null
          next_due_km?: number | null
          notes?: string | null
          odometer_at_service?: number | null
          parts_cost?: number | null
          provider_cnpj?: string | null
          provider_name?: string | null
          receipt_url?: string | null
          service_category: string
          service_date: string
          status?: string | null
          total_cost?: number
          updated_at?: string
          user_id: string
          vehicle_id: string
          workshop_id?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          deleted_at?: string | null
          description?: string
          expense_id?: string | null
          id?: string
          invoice_date?: string | null
          invoice_key?: string | null
          invoice_number?: string | null
          invoice_xml_url?: string | null
          labor_cost?: number | null
          maintenance_type?: string
          next_due_date?: string | null
          next_due_km?: number | null
          notes?: string | null
          odometer_at_service?: number | null
          parts_cost?: number | null
          provider_cnpj?: string | null
          provider_name?: string | null
          receipt_url?: string | null
          service_category?: string
          service_date?: string
          status?: string | null
          total_cost?: number
          updated_at?: string
          user_id?: string
          vehicle_id?: string
          workshop_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_maintenances_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_maintenances_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_maintenances_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_maintenances_workshop_id_fkey"
            columns: ["workshop_id"]
            isOneToOne: false
            referencedRelation: "workshops"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicles: {
        Row: {
          actual_consumption: number | null
          avg_consumption: number | null
          axle_count: number | null
          brand: string | null
          chassis: string | null
          company_id: string
          consumption_last_updated: string | null
          created_at: string
          current_fuel_level: number | null
          current_value: number | null
          fuel_level_last_updated: string | null
          fuel_type: string | null
          id: string
          insurance_company: string | null
          insurance_expiry: string | null
          insurance_policy: string | null
          load_capacity: number | null
          model: string
          plate: string
          purchase_date: string | null
          purchase_value: number | null
          renavam: string | null
          status: string | null
          tank_capacity: number | null
          target_consumption: number | null
          trailer_type: string | null
          updated_at: string
          user_id: string
          vehicle_type: string | null
          year: number | null
        }
        Insert: {
          actual_consumption?: number | null
          avg_consumption?: number | null
          axle_count?: number | null
          brand?: string | null
          chassis?: string | null
          company_id: string
          consumption_last_updated?: string | null
          created_at?: string
          current_fuel_level?: number | null
          current_value?: number | null
          fuel_level_last_updated?: string | null
          fuel_type?: string | null
          id?: string
          insurance_company?: string | null
          insurance_expiry?: string | null
          insurance_policy?: string | null
          load_capacity?: number | null
          model: string
          plate: string
          purchase_date?: string | null
          purchase_value?: number | null
          renavam?: string | null
          status?: string | null
          tank_capacity?: number | null
          target_consumption?: number | null
          trailer_type?: string | null
          updated_at?: string
          user_id: string
          vehicle_type?: string | null
          year?: number | null
        }
        Update: {
          actual_consumption?: number | null
          avg_consumption?: number | null
          axle_count?: number | null
          brand?: string | null
          chassis?: string | null
          company_id?: string
          consumption_last_updated?: string | null
          created_at?: string
          current_fuel_level?: number | null
          current_value?: number | null
          fuel_level_last_updated?: string | null
          fuel_type?: string | null
          id?: string
          insurance_company?: string | null
          insurance_expiry?: string | null
          insurance_policy?: string | null
          load_capacity?: number | null
          model?: string
          plate?: string
          purchase_date?: string | null
          purchase_value?: number | null
          renavam?: string | null
          status?: string | null
          tank_capacity?: number | null
          target_consumption?: number | null
          trailer_type?: string | null
          updated_at?: string
          user_id?: string
          vehicle_type?: string | null
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      workshops: {
        Row: {
          address: string | null
          city: string | null
          cnpj: string | null
          company_id: string
          created_at: string
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          rating: number | null
          specialties: string[] | null
          state: string | null
          status: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          cnpj?: string | null
          company_id: string
          created_at?: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          rating?: number | null
          specialties?: string[] | null
          state?: string | null
          status?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          city?: string | null
          cnpj?: string | null
          company_id?: string
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          rating?: number | null
          specialties?: string[] | null
          state?: string | null
          status?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workshops_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      bpo_has_company_access: {
        Args: { company_uuid: string; user_uuid: string }
        Returns: boolean
      }
      calculate_vehicle_consumption: {
        Args: { p_vehicle_id: string }
        Returns: undefined
      }
      generate_company_slug: { Args: { company_name: string }; Returns: string }
      generate_short_code: { Args: never; Returns: string }
      get_consumption_status: {
        Args: { p_actual: number; p_target: number; p_threshold?: number }
        Returns: string
      }
      get_cron_jobs: {
        Args: never
        Returns: {
          active: boolean
          command: string
          database: string
          jobid: number
          jobname: string
          nodename: string
          nodeport: number
          schedule: string
          username: string
        }[]
      }
      get_driver_id: { Args: { user_uuid: string }; Returns: string }
      get_expected_consumption: {
        Args: { p_brand: string; p_model: string }
        Returns: number
      }
      get_fleet_dashboard_metrics: {
        Args: { p_company_id: string }
        Returns: Json
      }
      get_user_company_id: { Args: { user_uuid: string }; Returns: string }
      get_user_role: {
        Args: { company_uuid: string; user_uuid: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      is_bpo_user: { Args: { user_uuid: string }; Returns: boolean }
      is_bpo_with_company_access: {
        Args: { _company_id: string; _user_id: string }
        Returns: boolean
      }
      is_driver_user: { Args: { user_uuid: string }; Returns: boolean }
      is_internal_staff: { Args: { user_uuid: string }; Returns: boolean }
      is_master_user: { Args: { user_uuid: string }; Returns: boolean }
      is_support_user: { Args: { user_uuid: string }; Returns: boolean }
      map_category_to_uuid: {
        Args: {
          p_category_text: string
          p_company_id: string
          p_table_type: string
        }
        Returns: string
      }
      seed_default_categories: {
        Args: { p_company_id: string; p_user_id: string }
        Returns: undefined
      }
      staff_has_company_access: {
        Args: { company_uuid: string; user_uuid: string }
        Returns: boolean
      }
      user_has_company_access: {
        Args: { company_uuid: string; user_uuid: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role:
        | "master"
        | "admin"
        | "gestor"
        | "motorista"
        | "driver"
        | "bpo"
        | "suporte"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "master",
        "admin",
        "gestor",
        "motorista",
        "driver",
        "bpo",
        "suporte",
      ],
    },
  },
} as const
