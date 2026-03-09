import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

type TableName = 
  | 'expenses' 
  | 'revenue' 
  | 'fuel_expenses' 
  | 'journeys' 
  | 'vehicle_maintenances' 
  | 'accounts_payable' 
  | 'bank_transactions';

interface SoftDeleteOptions {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
  confirmMessage?: string;
}

interface UseSoftDeleteReturn {
  softDelete: (id: string, options?: SoftDeleteOptions) => Promise<boolean>;
  restore: (id: string, options?: SoftDeleteOptions) => Promise<boolean>;
  isDeleting: boolean;
  isRestoring: boolean;
}

/**
 * Hook centralizado para operações de Soft Delete
 * Substitui o hard delete por uma marcação de deleted_at
 * Mantém histórico auditável de todos os registros
 */
export function useSoftDelete(tableName: TableName): UseSoftDeleteReturn {
  const { toast } = useToast();
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  const getTableLabel = (table: TableName): string => {
    const labels: Record<TableName, string> = {
      expenses: 'despesa',
      revenue: 'receita',
      fuel_expenses: 'abastecimento',
      journeys: 'jornada',
      vehicle_maintenances: 'manutenção',
      accounts_payable: 'conta a pagar',
      bank_transactions: 'transação bancária',
    };
    return labels[table] || 'registro';
  };

  const softDelete = async (id: string, options?: SoftDeleteOptions): Promise<boolean> => {
    const label = getTableLabel(tableName);
    const confirmMsg = options?.confirmMessage || `Tem certeza que deseja excluir esta ${label}?`;

    if (!confirm(confirmMsg)) {
      return false;
    }

    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from(tableName)
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Sucesso',
        description: `${label.charAt(0).toUpperCase() + label.slice(1)} excluída com sucesso!`,
      });

      options?.onSuccess?.();
      return true;
    } catch (error: any) {
      console.error(`Erro ao excluir ${label}:`, error);
      toast({
        title: 'Erro',
        description: error.message || `Falha ao excluir ${label}`,
        variant: 'destructive',
      });
      options?.onError?.(error);
      return false;
    } finally {
      setIsDeleting(false);
    }
  };

  const restore = async (id: string, options?: SoftDeleteOptions): Promise<boolean> => {
    const label = getTableLabel(tableName);

    setIsRestoring(true);
    try {
      const { error } = await supabase
        .from(tableName)
        .update({ deleted_at: null })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Sucesso',
        description: `${label.charAt(0).toUpperCase() + label.slice(1)} restaurada com sucesso!`,
      });

      options?.onSuccess?.();
      return true;
    } catch (error: any) {
      console.error(`Erro ao restaurar ${label}:`, error);
      toast({
        title: 'Erro',
        description: error.message || `Falha ao restaurar ${label}`,
        variant: 'destructive',
      });
      options?.onError?.(error);
      return false;
    } finally {
      setIsRestoring(false);
    }
  };

  return { softDelete, restore, isDeleting, isRestoring };
}

/**
 * Helper para adicionar filtro de soft delete em queries
 * Uso: query.is('deleted_at', null) ou withSoftDeleteFilter(query)
 */
export function withSoftDeleteFilter<T extends { is: (column: string, value: null) => T }>(query: T): T {
  return query.is('deleted_at', null);
}
