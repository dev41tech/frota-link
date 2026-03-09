import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useMultiTenant } from './useMultiTenant';
import { toast } from 'sonner';

export interface FreightRate {
  id: string;
  company_id: string;
  origin_state: string | null;
  destination_state: string | null;
  origin_city: string | null;
  destination_city: string | null;
  min_weight_kg: number;
  max_weight_kg: number;
  rate_per_kg: number;
  minimum_freight: number;
  cubage_factor: number | null;
  volume_rate: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface FreightRateFormData {
  origin_state?: string | null;
  destination_state?: string | null;
  origin_city?: string | null;
  destination_city?: string | null;
  min_weight_kg: number;
  max_weight_kg: number;
  rate_per_kg: number;
  minimum_freight: number;
  cubage_factor?: number | null;
  volume_rate?: number | null;
  is_active?: boolean;
}

export function useFreightRates() {
  const { currentCompany } = useMultiTenant();
  const [rates, setRates] = useState<FreightRate[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRates = useCallback(async () => {
    if (!currentCompany?.id) return;
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('freight_rates')
        .select('*')
        .eq('company_id', currentCompany.id)
        .order('origin_state', { ascending: true });

      if (error) throw error;
      setRates((data as FreightRate[]) || []);
    } catch (err: any) {
      console.error('Error fetching freight rates:', err);
      toast.error('Erro ao carregar tabela de frete');
    } finally {
      setLoading(false);
    }
  }, [currentCompany?.id]);

  useEffect(() => {
    if (currentCompany?.id) fetchRates();
  }, [currentCompany?.id, fetchRates]);

  const createRate = async (formData: FreightRateFormData): Promise<boolean> => {
    if (!currentCompany?.id) return false;
    try {
      const { error } = await supabase.from('freight_rates').insert({
        company_id: currentCompany.id,
        origin_state: formData.origin_state || null,
        destination_state: formData.destination_state || null,
        origin_city: formData.origin_city || null,
        destination_city: formData.destination_city || null,
        min_weight_kg: formData.min_weight_kg,
        max_weight_kg: formData.max_weight_kg,
        rate_per_kg: formData.rate_per_kg,
        minimum_freight: formData.minimum_freight,
        cubage_factor: formData.cubage_factor ?? 300,
        volume_rate: formData.volume_rate || null,
        is_active: formData.is_active ?? true,
      });
      if (error) throw error;
      toast.success('Regra de frete criada com sucesso');
      await fetchRates();
      return true;
    } catch (err: any) {
      toast.error(`Erro ao criar regra: ${err.message}`);
      return false;
    }
  };

  const updateRate = async (id: string, formData: Partial<FreightRateFormData>): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('freight_rates')
        .update({ ...formData, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
      toast.success('Regra atualizada com sucesso');
      await fetchRates();
      return true;
    } catch (err: any) {
      toast.error(`Erro ao atualizar: ${err.message}`);
      return false;
    }
  };

  const deleteRate = async (id: string): Promise<boolean> => {
    try {
      const { error } = await supabase.from('freight_rates').delete().eq('id', id);
      if (error) throw error;
      toast.success('Regra excluída com sucesso');
      await fetchRates();
      return true;
    } catch (err: any) {
      toast.error(`Erro ao excluir: ${err.message}`);
      return false;
    }
  };

  const toggleActive = async (id: string, isActive: boolean): Promise<boolean> => {
    return updateRate(id, { is_active: isActive });
  };

  return { rates, loading, refetch: fetchRates, createRate, updateRate, deleteRate, toggleActive };
}
