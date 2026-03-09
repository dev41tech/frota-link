import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMultiTenant } from "./useMultiTenant";

export interface RevenueCategory {
  id: string;
  name: string;
  icon: string;
  color: string;
  is_active: boolean;
  is_system: boolean;
}

export const useRevenueCategories = (activeOnly: boolean = true) => {
  const { currentCompany } = useMultiTenant();
  const companyId = currentCompany?.id;

  return useQuery({
    queryKey: ['revenue-categories', companyId, activeOnly],
    queryFn: async () => {
      if (!companyId) throw new Error('Company ID not found');

      let query = supabase
        .from('revenue_categories')
        .select('*')
        .eq('company_id', companyId)
        .order('name');

      if (activeOnly) {
        query = query.eq('is_active', true);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as RevenueCategory[];
    },
    enabled: !!companyId,
  });
};
