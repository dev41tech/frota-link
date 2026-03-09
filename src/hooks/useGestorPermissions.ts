import { useState, useEffect } from 'react';
import { api } from '@/lib/apiClient';

export function useGestorPermissions(targetUserId: string, companyId: string) {
  const [permissions, setPermissions] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!targetUserId) return;
    setIsLoading(true);
    api.fetch(`/gestor-permissions?userId=${targetUserId}`)
      .then(data => setPermissions(data || {}))
      .catch(() => setPermissions({}))
      .finally(() => setIsLoading(false));
  }, [targetUserId]);

  const savePermissions = async (permsArray: Array<{ module_key: string; enabled: boolean }>) => {
    await api.fetch(`/gestor-permissions/${targetUserId}`, {
      method: 'PUT',
      body: JSON.stringify({ permissions: permsArray }),
    });
    // Refresh
    const data = await api.fetch(`/gestor-permissions?userId=${targetUserId}`);
    setPermissions(data || {});
  };

  return { permissions, isLoading, savePermissions };
}
