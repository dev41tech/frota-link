import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/apiClient';
import { useMultiTenant } from './useMultiTenant';

export interface FinancialReserve {
  id: string;
  company_id: string;
  name: string;
  description?: string;
  default_percentage?: number;
  color: string;
  current_balance: number;
  created_at: string;
}

export interface ReserveEntry {
  id: string;
  reserve_id: string;
  reserve_name?: string;
  amount: number;
  percentage_applied?: number;
  description?: string;
  entry_type: 'journey_contribution' | 'manual_deposit' | 'withdrawal';
  date: string;
  created_at: string;
}

export function useFinancialReserves() {
  const queryClient = useQueryClient();
  const { currentCompany } = useMultiTenant();

  const reservesQuery = useQuery<FinancialReserve[]>({
    queryKey: ['financial_reserves', currentCompany?.id],
    queryFn: async () => {
      const { data, error } = await api.from('financial-reserves').select('*');
      if (error) throw error;
      return (data as FinancialReserve[]) || [];
    },
    enabled: !!currentCompany?.id,
  });

  const entriesQuery = useQuery<ReserveEntry[]>({
    queryKey: ['reserve_entries', currentCompany?.id],
    queryFn: async () => {
      const data = await api.fetch('/financial-reserves/entries');
      return (data as ReserveEntry[]) || [];
    },
    enabled: !!currentCompany?.id,
  });

  const createReserve = useMutation({
    mutationFn: async (data: Partial<FinancialReserve>) => {
      const result = await api.from('financial-reserves').insert(data);
      if (result.error) throw result.error;
      return result.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['financial_reserves'] }),
  });

  const updateReserve = useMutation({
    mutationFn: async ({ id, ...data }: Partial<FinancialReserve> & { id: string }) => {
      const result = await api.from('financial-reserves').update(data).eq('id', id);
      if (result.error) throw result.error;
      return result.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['financial_reserves'] }),
  });

  const deleteReserve = useMutation({
    mutationFn: async (id: string) => {
      const result = await api.from('financial-reserves').delete().eq('id', id);
      if (result.error) throw result.error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['financial_reserves'] }),
  });

  const addEntry = useMutation({
    mutationFn: async (entry: {
      reserve_id: string;
      amount: number;
      entry_type: string;
      description?: string;
      date?: string;
      percentage_applied?: number;
    }) => {
      const data = await api.fetch('/financial-reserves/entries', {
        method: 'POST',
        body: JSON.stringify(entry),
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['financial_reserves'] });
      queryClient.invalidateQueries({ queryKey: ['reserve_entries'] });
    },
  });

  return {
    reserves: reservesQuery.data || [],
    entries: entriesQuery.data || [],
    isLoading: reservesQuery.isLoading,
    isLoadingEntries: entriesQuery.isLoading,
    createReserve: createReserve.mutateAsync,
    updateReserve: updateReserve.mutateAsync,
    deleteReserve: deleteReserve.mutateAsync,
    addEntry: addEntry.mutateAsync,
    isCreating: createReserve.isPending,
    isAddingEntry: addEntry.isPending,
  };
}
