import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useMultiTenant } from '@/hooks/useMultiTenant';
import { useStaffAccess } from '@/hooks/useStaffAccess';
import { useToast } from '@/hooks/use-toast';

export interface PortalToken {
  id: string;
  company_id: string;
  party_id: string;
  token: string;
  short_code: string | null;
  is_active: boolean;
  expires_at: string | null;
  last_accessed_at: string | null;
  created_at: string;
}

export function useCustomerPortalTokens() {
  const { user } = useAuth();
  const { currentCompany } = useMultiTenant();
  const { staffContext } = useStaffAccess();
  const { toast } = useToast();
  const [tokens, setTokens] = useState<PortalToken[]>([]);
  const [companySlug, setCompanySlug] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const companyId = staffContext?.company_id || currentCompany?.id;

  const fetchTokens = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('customer_portal_tokens')
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setTokens((data as any[]) || []);

      // Fetch company slug
      const { data: company } = await supabase
        .from('companies')
        .select('slug')
        .eq('id', companyId)
        .single();
      setCompanySlug((company as any)?.slug || null);
    } catch (err: any) {
      toast({ title: 'Erro ao carregar tokens', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [companyId, toast]);

  useEffect(() => {
    fetchTokens();
  }, [fetchTokens]);

  const generateToken = async (partyId: string): Promise<PortalToken | null> => {
    if (!companyId) return null;
    try {
      const existing = tokens.find(t => t.party_id === partyId && t.is_active);
      if (existing) return existing;

      const { data, error } = await supabase
        .from('customer_portal_tokens')
        .insert({
          company_id: companyId,
          party_id: partyId,
          is_active: true,
        })
        .select()
        .single();

      if (error) throw error;
      await fetchTokens();
      toast({ title: 'Link do portal gerado com sucesso' });
      return data as any;
    } catch (err: any) {
      toast({ title: 'Erro ao gerar token', description: err.message, variant: 'destructive' });
      return null;
    }
  };

  const toggleToken = async (tokenId: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from('customer_portal_tokens')
        .update({ is_active: isActive })
        .eq('id', tokenId);
      if (error) throw error;
      await fetchTokens();
      toast({ title: isActive ? 'Acesso reativado' : 'Acesso desativado' });
    } catch (err: any) {
      toast({ title: 'Erro ao atualizar token', description: err.message, variant: 'destructive' });
    }
  };

  const getTokenForParty = (partyId: string) => {
    return tokens.find(t => t.party_id === partyId);
  };

  const getPortalUrl = (token: PortalToken) => {
    if (companySlug && token.short_code) {
      return `${window.location.origin}/portal/${companySlug}/${token.short_code}`;
    }
    // Fallback to legacy URL
    return `${window.location.origin}/portal/${token.token}`;
  };

  return { tokens, loading, companySlug, generateToken, toggleToken, getTokenForParty, getPortalUrl, fetchTokens };
}
