import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMultiTenant } from "./useMultiTenant";

export interface ExpenseCategory {
  id: string;
  name: string;
  classification: 'direct' | 'indirect';
  icon: string;
  color: string;
  is_active: boolean;
  is_system: boolean;
}

export const useExpenseCategories = (classification?: 'direct' | 'indirect', activeOnly: boolean = true) => {
  const { currentCompany } = useMultiTenant();
  const companyId = currentCompany?.id;

  return useQuery({
    queryKey: ['expense-categories', companyId, classification, activeOnly],
    queryFn: async () => {
      if (!companyId) throw new Error('Company ID not found');

      let query = supabase
        .from('expense_categories')
        .select('*')
        .eq('company_id', companyId)
        .order('name');

      if (classification) {
        query = query.eq('classification', classification);
      }

      if (activeOnly) {
        query = query.eq('is_active', true);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as ExpenseCategory[];
    },
    enabled: !!companyId,
  });
};
