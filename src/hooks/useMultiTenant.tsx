import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export type UserRole = 'master' | 'admin' | 'gestor' | 'motorista' | 'driver' | 'bpo' | 'suporte';

interface Company {
  id: string;
  cnpj: string;
  name: string;
  responsible_name: string;
  responsible_cpf: string;
  address: string;
  city?: string;
  state?: string;
  zip_code?: string;
  phone?: string;
  email?: string;
  status: string;
  created_at: string;
  updated_at: string;
}

interface UserProfile {
  id: string;
  user_id: string;
  full_name?: string;
  email?: string;
  phone?: string;
  role: UserRole;
  company_id?: string;
  company_name?: string;
  created_at: string;
  updated_at: string;
}

interface MultiTenantContextType {
  userProfile: UserProfile | null;
  currentCompany: Company | null;
  availableCompanies: Company[];
  isMaster: boolean;
  isLoading: boolean;
  tenantId?: string;
  switchCompany: (companyId: string) => Promise<void>;
  fetchUserProfile: () => Promise<void>;
  fetchCompanies: () => Promise<void>;
  createCompany: (companyData: Omit<Company, 'id' | 'created_at' | 'updated_at'>) => Promise<{ error: any }>;
  hasPermission: (permission: string) => boolean;
}

const MultiTenantContext = createContext<MultiTenantContextType | undefined>(undefined);

export function MultiTenantProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [currentCompany, setCurrentCompany] = useState<Company | null>(null);
  const [availableCompanies, setAvailableCompanies] = useState<Company[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const isMaster = userProfile?.role === 'master';

  const fetchUserProfile = async () => {
    if (!user) return;

    try {
      console.log('MultiTenant: Starting profile load for user:', user.id);

      // 1) Determine master role first (bypasses RLS)
      let isMasterRole = false;
      try {
        const { data, error } = await supabase.rpc('is_master_user', { user_uuid: user.id });
        if (error) {
          console.warn('MultiTenant: is_master_user RPC error:', error);
        }
        isMasterRole = !!data;
        console.log('MultiTenant: User is master (RPC):', isMasterRole);
      } catch (rpcErr) {
        console.warn('MultiTenant: RPC threw unexpectedly:', rpcErr);
        isMasterRole = false;
      }

      // 2) Try to fetch profile, but never throw - we can operate with fallback
      let profile: any = null;
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select(`
            *,
            companies!profiles_company_id_fkey (
              id,
              name,
              cnpj
            )
          `)
          .eq('user_id', user.id)
          .single();

        if (error) {
          // PGRST116 = No rows found for single()
          if ((error as any).code === 'PGRST116') {
            console.warn('MultiTenant: No profile row found (PGRST116). Proceeding with fallback.');
          } else {
            console.warn('MultiTenant: Profile fetch error (non-fatal):', error);
          }
        } else {
          profile = data;
        }
      } catch (pfErr) {
        console.warn('MultiTenant: Profile fetch threw (non-fatal):', pfErr);
      }

      // PHASE 2: Dual-read - Try user_roles first, fallback to profiles.role
      let userRole: UserRole = 'admin'; // Default
      
      if (isMasterRole) {
        userRole = 'master';
      } else {
        // Try to get role from user_roles table
        try {
          // Buscar todos os roles do usuário
          const { data: rolesData } = await supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', user.id);

          // Ordenar manualmente por prioridade (master > admin > gestor > motorista > driver)
          const rolePriority: Record<string, number> = {
            'master': 1,
            'admin': 2,
            'gestor': 3,
            'motorista': 4,
            'driver': 5
          };

          const roleData = rolesData && rolesData.length > 0
            ? [...rolesData].sort((a, b) => 
                (rolePriority[a.role] || 99) - (rolePriority[b.role] || 99)
              )[0]
            : null;
          
          if (roleData?.role) {
            userRole = roleData.role as UserRole;
            console.log('✅ MultiTenant: Role loaded from user_roles:', userRole);
          } else if (profile?.role) {
            userRole = profile.role as UserRole;
            console.log('⚠️ MultiTenant: Fallback to profiles.role:', userRole);
          }
        } catch (roleErr) {
          console.warn('MultiTenant: Role fetch error, using profile fallback:', roleErr);
          if (profile?.role) {
            userRole = profile.role as UserRole;
          }
        }
      }

      // 3) Resolve profile with role from dual-read
      let resolvedProfile: UserProfile;
      if (profile) {
        resolvedProfile = {
          ...profile,
          company_name: (profile as any).companies?.name,
          role: userRole,
        } as UserProfile;
      } else {
        resolvedProfile = {
          id: user.id,
          user_id: user.id,
          full_name: user.user_metadata?.full_name,
          email: user.email ?? undefined,
          phone: undefined,
          role: userRole,
          company_id: undefined,
          company_name: undefined,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        } as UserProfile;
      }

      setUserProfile(resolvedProfile);
      console.log('MultiTenant: Resolved user profile:', resolvedProfile);
    } catch (error) {
      console.error('MultiTenant: Unexpected error in fetchUserProfile:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCompanies = async () => {
    if (!user) return;

    try {
      console.log('MultiTenant: Fetching companies for isMaster:', isMaster);
      
      // Check for staff context first (BPO/Support accessing client company)
      const staffContextStr = sessionStorage.getItem('staff_context');
      if (staffContextStr) {
        try {
          const staffCtx = JSON.parse(staffContextStr);
          console.log('MultiTenant: Staff context detected, loading company:', staffCtx.company_id);
          
          const { data: staffCompany, error } = await supabase
            .from('companies')
            .select('*')
            .eq('id', staffCtx.company_id)
            .maybeSingle();
          
          if (!error && staffCompany) {
            console.log('MultiTenant: Setting staff accessed company:', staffCompany.name);
            setAvailableCompanies([staffCompany]);
            setCurrentCompany(staffCompany);
            setIsLoading(false);
            return; // Skip normal company loading when staff is accessing
          }
        } catch (parseErr) {
          console.warn('MultiTenant: Failed to parse staff context:', parseErr);
          sessionStorage.removeItem('staff_context');
        }
      }
      
      if (isMaster) {
        // Master can see all companies
        const { data: companies, error } = await supabase
          .from('companies')
          .select('*')
          .eq('status', 'active')
          .order('name');

        if (error) throw error;
        console.log('MultiTenant: Companies fetched for master:', companies?.length || 0);
        setAvailableCompanies(companies || []);
        
        // For master users, if no company is selected and there are companies available,
        // don't auto-select one to allow viewing all data
        if (!currentCompany && companies && companies.length > 0) {
          const savedCompanyId = localStorage.getItem('selectedCompanyId');
          if (savedCompanyId && companies.find(c => c.id === savedCompanyId)) {
            setCurrentCompany(companies.find(c => c.id === savedCompanyId)!);
          }
        }
      } else if (userProfile?.company_id) {
        // Regular users can only see their own company
        const { data: company, error } = await supabase
          .from('companies')
          .select('*')
          .eq('id', userProfile.company_id)
          .single();

        if (error) throw error;
        setAvailableCompanies(company ? [company] : []);
        setCurrentCompany(company);
      }
      
      // Always set loading to false after fetching companies
      setIsLoading(false);
      console.log('MultiTenant: Companies fetch completed, loading set to false');
      
    } catch (error) {
      console.error('Error fetching companies:', error);
      setIsLoading(false); // Ensure loading stops even on error
    }
  };

  const switchCompany = async (companyId: string) => {
    if (!isMaster) return;

    try {
      if (companyId === "all") {
        setCurrentCompany(null);
        localStorage.removeItem('selectedCompanyId');
      } else {
        const company = availableCompanies.find(c => c.id === companyId);
        if (company) {
          setCurrentCompany(company);
          localStorage.setItem('selectedCompanyId', companyId);
        }
      }
    } catch (error) {
      console.error('Error switching company:', error);
    }
  };

  const createCompany = async (companyData: Omit<Company, 'id' | 'created_at' | 'updated_at'>) => {
    if (!isMaster) {
      return { error: 'Acesso negado: apenas usuários master podem criar empresas' };
    }

    try {
      const { data, error } = await supabase
        .from('companies')
        .insert([companyData])
        .select()
        .single();

      if (error) throw error;

      // Refresh companies list
      await fetchCompanies();

      return { error: null };
    } catch (error) {
      console.error('Error creating company:', error);
      return { error };
    }
  };

  const hasPermission = (permission: string): boolean => {
    if (!userProfile) return false;

    const rolePermissions: Record<string, string[]> = {
      master: ['*'], // All permissions
      admin: ['manage_users', 'view_reports', 'manage_fleet', 'manage_finance'],
      gestor: ['view_reports', 'manage_fleet'],
      motorista: ['create_expenses', 'view_journeys'],
      driver: ['create_expenses', 'view_journeys'],
      bpo: ['view_reports', 'manage_fleet', 'manage_finance'],
      suporte: ['view_reports', 'manage_fleet']
    };

    const userPermissions = rolePermissions[userProfile.role] || [];
    return userPermissions.includes('*') || userPermissions.includes(permission);
  };

  useEffect(() => {
    if (user && !userProfile) {
      fetchUserProfile();
    } else if (!user) {
      setUserProfile(null);
      setCurrentCompany(null);
      setAvailableCompanies([]);
      setIsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    console.log('MultiTenant: userProfile changed:', userProfile?.role);
    if (userProfile && availableCompanies.length === 0) {
      fetchCompanies();
      
      // For master users, restore selected company after profile is loaded
      if (userProfile.role === 'master') {
        const savedCompanyId = localStorage.getItem('selectedCompanyId');
        console.log('MultiTenant: Restoring company for master:', savedCompanyId);
        if (savedCompanyId && savedCompanyId !== 'all') {
          // Will be set when companies are fetched
        }
      }
    }
  }, [userProfile?.id]);

  // Separate effect to handle loading state (avoid infinite loading when profile is missing)
  useEffect(() => {
    if (!user) {
      console.log('MultiTenant: No user, setting loading false');
      setIsLoading(false);
    }
  }, [user]);

  // Safety timeout to prevent infinite loading
  useEffect(() => {
    const timer = setTimeout(() => {
      if (isLoading && user) {
        console.warn('MultiTenant: Loading timeout reached, forcing loading to false');
        setIsLoading(false);
      }
    }, 3000); // Reduced from 5000ms to 3000ms

    return () => clearTimeout(timer);
  }, [isLoading, user]);

  // Listen for staff_context changes (BPO/Support switching companies)
  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === 'staff_context') {
        console.log('MultiTenant: staff_context changed via StorageEvent, refetching companies');
        fetchCompanies();
      }
    };

    // Also detect manual dispatched events (same-window storage updates)
    const handleCustomStorageUpdate = () => {
      console.log('MultiTenant: staff_context_updated event received, refetching companies');
      fetchCompanies();
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('staff_context_updated', handleCustomStorageUpdate);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('staff_context_updated', handleCustomStorageUpdate);
    };
  }, [userProfile?.id]);

  // Detect context mismatch and refetch if needed
  useEffect(() => {
    const currentContextStr = sessionStorage.getItem('staff_context');
    if (currentContextStr) {
      try {
        const currentContextId = JSON.parse(currentContextStr)?.company_id;
        if (currentContextId && currentCompany?.id !== currentContextId) {
          console.log('MultiTenant: Context mismatch detected, refetching');
          fetchCompanies();
        }
      } catch (e) {
        console.warn('MultiTenant: Failed to parse staff_context');
      }
    }
  }, [currentCompany?.id]);

  const value = {
    tenantId: currentCompany?.id,
    userProfile,
    currentCompany,
    availableCompanies,
    isMaster,
    isLoading,
    switchCompany,
    fetchUserProfile,
    fetchCompanies,
    createCompany,
    hasPermission
  };

  return (
    <MultiTenantContext.Provider value={value}>
      {children}
    </MultiTenantContext.Provider>
  );
}

export function useMultiTenant() {
  const context = useContext(MultiTenantContext);
  if (context === undefined) {
    throw new Error('useMultiTenant must be used within a MultiTenantProvider');
  }
  return context;
}