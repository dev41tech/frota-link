import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useMultiTenant } from '@/hooks/useMultiTenant';

interface UnreadCount {
  driverId: string;
  driverName: string;
  count: number;
}

interface UseUnreadMessagesResult {
  totalUnread: number;
  unreadByDriver: UnreadCount[];
  isLoading: boolean;
  refresh: () => void;
}

export function useUnreadMessages(): UseUnreadMessagesResult {
  const { currentCompany } = useMultiTenant();
  const [totalUnread, setTotalUnread] = useState(0);
  const [unreadByDriver, setUnreadByDriver] = useState<UnreadCount[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUnreadCounts = useCallback(async () => {
    if (!currentCompany?.id) {
      setIsLoading(false);
      return;
    }

    try {
      // Count open incidents
      const { count: openIncidents, error: incErr } = await supabase
        .from('incidents')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', currentCompany.id)
        .in('status', ['open', 'in_progress']);

      if (incErr) {
        console.error('[useUnreadMessages] Incidents error:', incErr);
      }

      setTotalUnread(openIncidents || 0);
      setUnreadByDriver([]);
    } catch (err) {
      console.error('[useUnreadMessages] Exception:', err);
    } finally {
      setIsLoading(false);
    }
  }, [currentCompany?.id]);

  useEffect(() => {
    fetchUnreadCounts();

    if (!currentCompany?.id) return;

    const channel = supabase
      .channel('unread-incidents')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'incidents',
          filter: `company_id=eq.${currentCompany.id}`,
        },
        () => fetchUnreadCounts()
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'announcements',
          filter: `company_id=eq.${currentCompany.id}`,
        },
        () => fetchUnreadCounts()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentCompany?.id, fetchUnreadCounts]);

  return {
    totalUnread,
    unreadByDriver,
    isLoading,
    refresh: fetchUnreadCounts,
  };
}
