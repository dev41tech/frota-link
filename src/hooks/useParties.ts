import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useMultiTenant } from './useMultiTenant';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export interface Party {
  id: string;
  company_id: string;
  user_id: string;
  type: 'customer' | 'supplier';
  name: string;
  document: string | null;
  email: string | null;
  phone: string | null;
  address_street: string | null;
  address_number: string | null;
  address_complement: string | null;
  address_district: string | null;
  address_city: string | null;
  address_state: string | null;
  address_zip: string | null;
  ie: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PartyFormData {
  type: 'customer' | 'supplier';
  name: string;
  document?: string;
  email?: string;
  phone?: string;
  address_street?: string;
  address_number?: string;
  address_complement?: string;
  address_district?: string;
  address_city?: string;
  address_state?: string;
  address_zip?: string;
  ie?: string;
  notes?: string;
  is_active?: boolean;
}

export function useParties(type?: 'customer' | 'supplier') {
  const { currentCompany } = useMultiTenant();
  const { user } = useAuth();
  const [parties, setParties] = useState<Party[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchParties = useCallback(async () => {
    if (!currentCompany?.id) return;

    try {
      setLoading(true);
      setError(null);

      let query = supabase
        .from('parties')
        .select('*')
        .eq('company_id', currentCompany.id)
        .order('name', { ascending: true });

      if (type) {
        query = query.eq('type', type);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;

      setParties(data as Party[] || []);
    } catch (err: any) {
      console.error('Error fetching parties:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [currentCompany?.id, type]);

  useEffect(() => {
    if (currentCompany?.id) {
      fetchParties();
    }
  }, [currentCompany?.id, fetchParties]);

  const createParty = async (formData: PartyFormData): Promise<Party | null> => {
    if (!currentCompany?.id || !user?.id) {
      toast.error('Empresa ou usuário não identificado');
      return null;
    }

    try {
      const { data, error } = await supabase
        .from('parties')
        .insert({
          company_id: currentCompany.id,
          user_id: user.id,
          type: formData.type,
          name: formData.name,
          document: formData.document || null,
          email: formData.email || null,
          phone: formData.phone || null,
          address_street: formData.address_street || null,
          address_number: formData.address_number || null,
          address_complement: formData.address_complement || null,
          address_district: formData.address_district || null,
          address_city: formData.address_city || null,
          address_state: formData.address_state || null,
          address_zip: formData.address_zip || null,
          ie: formData.ie || null,
          notes: formData.notes || null,
          is_active: formData.is_active ?? true,
        })
        .select()
        .single();

      if (error) throw error;

      toast.success(`${formData.type === 'customer' ? 'Cliente' : 'Fornecedor'} cadastrado com sucesso`);
      await fetchParties();
      return data as Party;
    } catch (err: any) {
      console.error('Error creating party:', err);
      toast.error(`Erro ao cadastrar: ${err.message}`);
      return null;
    }
  };

  const updateParty = async (id: string, formData: Partial<PartyFormData>): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('parties')
        .update({
          ...formData,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;

      toast.success('Registro atualizado com sucesso');
      await fetchParties();
      return true;
    } catch (err: any) {
      console.error('Error updating party:', err);
      toast.error(`Erro ao atualizar: ${err.message}`);
      return false;
    }
  };

  const deleteParty = async (id: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('parties')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success('Registro excluído com sucesso');
      await fetchParties();
      return true;
    } catch (err: any) {
      console.error('Error deleting party:', err);
      toast.error(`Erro ao excluir: ${err.message}`);
      return false;
    }
  };

  const toggleActive = async (id: string, isActive: boolean): Promise<boolean> => {
    return updateParty(id, { is_active: isActive });
  };

  return {
    parties,
    customers: parties.filter(p => p.type === 'customer'),
    suppliers: parties.filter(p => p.type === 'supplier'),
    loading,
    error,
    refetch: fetchParties,
    createParty,
    updateParty,
    deleteParty,
    toggleActive,
  };
}
