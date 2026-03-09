import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/apiClient';
import { useMultiTenant } from './useMultiTenant';

export interface FinancialAccount {
  id: string;
  company_id: string;
  name: string;
  type: 'checking' | 'savings' | 'cash' | 'reserve';
  initial_balance: number;
  initial_balance_date: string;
  color: string;
  is_active: boolean;
  current_balance?: number;
  created_at: string;
  updated_at: string;
}

export interface CreateAccountData {
  name: string;
  type: 'checking' | 'savings' | 'cash' | 'reserve';
  initial_balance: number;
  initial_balance_date: string;
  color?: string;
}

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  checking: 'Conta Corrente',
  savings: 'Conta Poupança',
  cash: 'Dinheiro Físico',
  reserve: 'Reserva / Caixinha',
};

export function getAccountTypeLabel(type: string): string {
  return ACCOUNT_TYPE_LABELS[type] || type;
}

export function useFinancialAccounts() {
  const queryClient = useQueryClient();
  const { currentCompany } = useMultiTenant();

  const query = useQuery<FinancialAccount[]>({
    queryKey: ['financial_accounts', currentCompany?.id],
    queryFn: async () => {
      // Usar endpoint customizado que já calcula current_balance
      const { data, error } = await api.from<FinancialAccount>('financial-accounts').select('*');
      if (error) throw error;
      return (data as FinancialAccount[]) || [];
    },
    enabled: !!currentCompany?.id,
  });

  const createMutation = useMutation({
    mutationFn: async (data: CreateAccountData) => {
      const result = await api.from('financial-accounts').insert(data);
      if (result.error) throw result.error;
      return result.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['financial_accounts'] }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: Partial<CreateAccountData> & { id: string }) => {
      const result = await api.from('financial-accounts').update(data).eq('id', id);
      if (result.error) throw result.error;
      return result.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['financial_accounts'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const result = await api.from('financial-accounts').delete().eq('id', id);
      if (result.error) throw result.error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['financial_accounts'] }),
  });

  const totalBalance = (query.data || []).reduce((sum, acc) => sum + (acc.current_balance ?? acc.initial_balance), 0);

  return {
    accounts: query.data || [],
    isLoading: query.isLoading,
    totalBalance,
    createAccount: createMutation.mutateAsync,
    updateAccount: updateMutation.mutateAsync,
    deleteAccount: deleteMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
  };
}
