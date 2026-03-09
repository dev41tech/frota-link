import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useMultiTenant } from './useMultiTenant';

interface OnboardingStatus {
  hasCertificate: boolean;
  hasSeries: boolean;
  hasSettings: boolean;
  certificateExpired: boolean;
}

export function useCTeOnboarding() {
  const { currentCompany } = useMultiTenant();
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<OnboardingStatus>({
    hasCertificate: false,
    hasSeries: false,
    hasSettings: false,
    certificateExpired: false,
  });

  const checkOnboardingStatus = async () => {
    if (!currentCompany) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // Check for valid certificate
      const { data: certificate } = await supabase
        .from('digital_certificates')
        .select('id, expires_at, status')
        .eq('company_id', currentCompany.id)
        .eq('status', 'active')
        .gte('expires_at', new Date().toISOString())
        .maybeSingle();

      const hasCertificate = !!certificate;
      const certificateExpired = !hasCertificate;

      // Check for series configuration
      const { data: series } = await supabase
        .from('cte_series')
        .select('id')
        .eq('company_id', currentCompany.id)
        .eq('is_active', true)
        .limit(1);

      const hasSeries = (series?.length || 0) > 0;

      // Check for CT-e settings
      const { data: settings } = await supabase
        .from('cte_settings')
        .select('id, nuvem_fiscal_company_id')
        .eq('company_id', currentCompany.id)
        .maybeSingle();

      const hasSettings = !!settings?.nuvem_fiscal_company_id;

      const newStatus = {
        hasCertificate,
        hasSeries,
        hasSettings,
        certificateExpired,
      };

      setStatus(newStatus);

      // Needs onboarding if missing certificate, series, or settings
      const needsSetup = !hasCertificate || !hasSeries || !hasSettings;
      setNeedsOnboarding(needsSetup);
    } catch (error) {
      console.error('Error checking onboarding status:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkOnboardingStatus();
  }, [currentCompany]);

  const refreshStatus = () => {
    checkOnboardingStatus();
  };

  return {
    needsOnboarding,
    loading,
    status,
    refreshStatus,
  };
}
