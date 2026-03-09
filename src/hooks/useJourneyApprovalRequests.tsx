import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useMultiTenant } from '@/hooks/useMultiTenant';
import { useStaffAccess } from '@/hooks/useStaffAccess';

export function useJourneyApprovalRequests() {
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const { currentCompany } = useMultiTenant();
  const { staffContext } = useStaffAccess();
  
  const effectiveCompanyId = staffContext?.company_id || currentCompany?.id;

  const fetchCount = useCallback(async () => {
    if (!effectiveCompanyId) {
      setCount(0);
      setLoading(false);
      return;
    }

    try {
      const { count: requestCount, error } = await supabase
        .from('journeys')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', effectiveCompanyId)
        .eq('status', 'pending_approval');

      if (error) throw error;
      setCount(requestCount || 0);
    } catch (error) {
      console.error('Erro ao contar jornadas pendentes:', error);
    } finally {
      setLoading(false);
    }
  }, [effectiveCompanyId]);

  useEffect(() => {
    fetchCount();
    const interval = setInterval(fetchCount, 30000);
    return () => clearInterval(interval);
  }, [fetchCount]);

  return { count, loading, refresh: fetchCount };
}
