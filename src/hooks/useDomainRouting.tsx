import { useMemo } from 'react';

export type AppDomain = 'landing' | 'client' | 'master';

export interface DomainConfig {
  type: AppDomain;
  hostname: string;
  redirectUrl?: string;
}

const DOMAIN_CONFIG: Record<string, DomainConfig> = {
  // Production domains
  'linkfrota.com.br': { type: 'landing', hostname: 'linkfrota.com.br' },
  'app.linkfrota.com.br': { type: 'client', hostname: 'app.linkfrota.com.br' },
  'admin.linkfrota.com.br': { type: 'master', hostname: 'admin.linkfrota.com.br' },
  
  // Development domains (for local testing)
  'localhost': { type: 'landing', hostname: 'localhost' },
  '127.0.0.1': { type: 'landing', hostname: '127.0.0.1' },
};

export function useDomainRouting() {
  const currentDomain = useMemo(() => {
    if (typeof window === 'undefined') return null;
    
    const hostname = window.location.hostname;
    
    // Check for exact matches first
    if (DOMAIN_CONFIG[hostname]) {
      return DOMAIN_CONFIG[hostname];
    }
    
    // Check for subdomain patterns - Lovable preview domains default to client
    if (hostname.includes('lovableproject.com')) {
      return { type: 'client' as AppDomain, hostname };
    }
    
    // Default to client page for unknown domains
    return { type: 'client' as AppDomain, hostname };
  }, []);

  const isLandingDomain = currentDomain?.type === 'landing';
  const isClientDomain = currentDomain?.type === 'client';
  const isMasterDomain = currentDomain?.type === 'master';

  const getRedirectUrl = (targetDomain: AppDomain, path?: string) => {
    const configs = Object.values(DOMAIN_CONFIG);
    const targetConfig = configs.find(config => config.type === targetDomain);
    
    if (!targetConfig) return '/';
    
    const protocol = window.location.protocol;
    const port = window.location.port && !['80', '443'].includes(window.location.port) 
      ? `:${window.location.port}` 
      : '';
    
    return `${protocol}//${targetConfig.hostname}${port}${path || '/'}`;
  };

  const redirectTo = (targetDomain: AppDomain, path?: string) => {
    window.location.href = getRedirectUrl(targetDomain, path);
  };

  return {
    currentDomain: currentDomain?.type || 'client',
    hostname: currentDomain?.hostname || '',
    isLandingDomain,
    isClientDomain,
    isMasterDomain,
    getRedirectUrl,
    redirectTo,
  };
}