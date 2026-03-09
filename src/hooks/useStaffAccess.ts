import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export type StaffRole = 'master' | 'bpo' | 'suporte';

export interface StaffContext {
  company_id: string;
  company_name: string;
  accessed_as: StaffRole;
  accessed_by: string;
  accessed_at: string;
}

interface BPOCompanyAccess {
  id: string;
  company_id: string;
  granted_at: string;
  company: {
    id: string;
    name: string;
    cnpj: string;
    status: string;
    subscription_plan?: {
      name: string;
    };
  };
}

interface UseStaffAccessReturn {
  staffRole: StaffRole | null;
  isInternalStaff: boolean;
  isBPO: boolean;
  isSupport: boolean;
  staffContext: StaffContext | null;
  accessibleCompanies: BPOCompanyAccess[];
  isLoading: boolean;
  setCompanyContext: (companyId: string, companyName: string) => Promise<void>;
  clearCompanyContext: () => Promise<void>;
  fetchAccessibleCompanies: () => Promise<void>;
}

export function useStaffAccess(): UseStaffAccessReturn {
  const { user } = useAuth();
  const [staffRole, setStaffRole] = useState<StaffRole | null>(null);
  const [staffContext, setStaffContext] = useState<StaffContext | null>(null);
  const [accessibleCompanies, setAccessibleCompanies] = useState<BPOCompanyAccess[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const isInternalStaff = staffRole !== null;
  const isBPO = staffRole === 'bpo';
  const isSupport = staffRole === 'suporte';

  // Check user role on mount
  useEffect(() => {
    const checkStaffRole = async () => {
      if (!user) {
        setStaffRole(null);
        setIsLoading(false);
        return;
      }

      try {
        // Check roles in order of priority
        const { data: roles, error: rolesError } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id);

        console.log('useStaffAccess: user_roles query result:', { roles, error: rolesError?.message });

        if (roles && roles.length > 0) {
          const roleSet = new Set(roles.map(r => r.role));
          console.log('useStaffAccess: detected roles:', Array.from(roleSet));
          
          if (roleSet.has('master')) {
            setStaffRole('master');
          } else if (roleSet.has('suporte')) {
            setStaffRole('suporte');
          } else if (roleSet.has('bpo')) {
            setStaffRole('bpo');
          } else {
            setStaffRole(null);
          }
        } else {
          console.log('useStaffAccess: no staff roles found');
          setStaffRole(null);
        }

        // Check for existing context in sessionStorage
        const savedContext = sessionStorage.getItem('staff_context');
        if (savedContext) {
          try {
            setStaffContext(JSON.parse(savedContext));
          } catch {
            sessionStorage.removeItem('staff_context');
          }
        }
      } catch (error) {
        console.error('Error checking staff role:', error);
        setStaffRole(null);
      } finally {
        setIsLoading(false);
      }
    };

    checkStaffRole();
  }, [user?.id]);

  // Fetch accessible companies for BPO users
  const fetchAccessibleCompanies = useCallback(async () => {
    if (!user || !isBPO) {
      setAccessibleCompanies([]);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('bpo_company_access')
        .select(`
          id,
          company_id,
          granted_at,
          company:companies (
            id,
            name,
            cnpj,
            status,
            subscription_plan:subscription_plans (name)
          )
        `)
        .eq('bpo_user_id', user.id)
        .is('revoked_at', null);

      if (error) throw error;

      // Transform the data to match expected interface
      const transformed = (data || []).map((item: any) => ({
        id: item.id,
        company_id: item.company_id,
        granted_at: item.granted_at,
        company: {
          id: item.company?.id,
          name: item.company?.name,
          cnpj: item.company?.cnpj,
          status: item.company?.status,
          subscription_plan: item.company?.subscription_plan
        }
      }));

      setAccessibleCompanies(transformed);
    } catch (error) {
      console.error('Error fetching BPO accessible companies:', error);
      setAccessibleCompanies([]);
    }
  }, [user?.id, isBPO]);

  useEffect(() => {
    if (isBPO) {
      fetchAccessibleCompanies();
    }
  }, [isBPO, fetchAccessibleCompanies]);

  // Set company context (for BPO/Support accessing a company)
  const setCompanyContext = useCallback(async (companyId: string, companyName: string) => {
    if (!user || !staffRole) return;

    try {
      // Log access start
      await supabase.from('audit_logs').insert({
        user_id: user.id,
        company_id: companyId,
        action: `${staffRole}_access_start`,
        table_name: 'companies',
        record_id: companyId,
        new_values: { 
          access_type: staffRole,
          company_name: companyName
        }
      });

      const context: StaffContext = {
        company_id: companyId,
        company_name: companyName,
        accessed_as: staffRole,
        accessed_by: user.id,
        accessed_at: new Date().toISOString()
      };

      setStaffContext(context);
      sessionStorage.setItem('staff_context', JSON.stringify(context));

      // Dispatch custom event to notify other hooks (same-window updates)
      console.log('StaffAccess: Dispatching staff_context_updated event');
      window.dispatchEvent(new CustomEvent('staff_context_updated', {
        detail: { companyId, companyName }
      }));

      // Also try standard StorageEvent for cross-tab sync
      try {
        window.dispatchEvent(new StorageEvent('storage', {
          key: 'staff_context',
          newValue: JSON.stringify(context),
          storageArea: sessionStorage
        }));
      } catch (e) {
        console.log('StaffAccess: StorageEvent dispatch not fully supported');
      }
    } catch (error) {
      console.error('Error setting company context:', error);
      throw error;
    }
  }, [user?.id, staffRole]);

  // Clear company context
  const clearCompanyContext = useCallback(async () => {
    if (!user || !staffContext) return;

    try {
      // Log access end
      const duration = Math.round(
        (Date.now() - new Date(staffContext.accessed_at).getTime()) / 60000
      );

      await supabase.from('audit_logs').insert({
        user_id: user.id,
        company_id: staffContext.company_id,
        action: `${staffContext.accessed_as}_access_end`,
        table_name: 'companies',
        record_id: staffContext.company_id,
        new_values: { 
          access_type: staffContext.accessed_as,
          duration_minutes: duration
        }
      });

      setStaffContext(null);
      sessionStorage.removeItem('staff_context');
    } catch (error) {
      console.error('Error clearing company context:', error);
      throw error;
    }
  }, [user?.id, staffContext]);

  return {
    staffRole,
    isInternalStaff,
    isBPO,
    isSupport,
    staffContext,
    accessibleCompanies,
    isLoading,
    setCompanyContext,
    clearCompanyContext,
    fetchAccessibleCompanies
  };
}
