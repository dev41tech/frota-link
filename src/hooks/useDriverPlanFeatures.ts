import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface DriverPlanFeatures {
  hasGeolocation: boolean;
  hasPWADriver: boolean;
  isLoading: boolean;
}

export function useDriverPlanFeatures(companyId: string | undefined): DriverPlanFeatures {
  const [features, setFeatures] = useState<DriverPlanFeatures>({
    hasGeolocation: false,
    hasPWADriver: false,
    isLoading: true,
  });

  useEffect(() => {
    const fetchFeatures = async () => {
      if (!companyId) {
        setFeatures(prev => ({ ...prev, isLoading: false }));
        return;
      }

      try {
        // Get company subscription plan
        const { data: companyData, error: companyError } = await supabase
          .from('companies')
          .select('subscription_plan_id')
          .eq('id', companyId)
          .single();

        if (companyError || !companyData?.subscription_plan_id) {
          setFeatures(prev => ({ ...prev, isLoading: false }));
          return;
        }

        // Get plan features - cast to any to handle new column not in types yet
        const { data: planData, error: planError } = await supabase
          .from('subscription_plans')
          .select('has_geolocation, has_pwa_driver')
          .eq('id', companyData.subscription_plan_id)
          .single();

        if (planError || !planData) {
          setFeatures(prev => ({ ...prev, isLoading: false }));
          return;
        }

        const plan = planData as any;
        setFeatures({
          hasGeolocation: plan.has_geolocation ?? false,
          hasPWADriver: plan.has_pwa_driver ?? false,
          isLoading: false,
        });
      } catch (error) {
        console.error('[useDriverPlanFeatures] Error:', error);
        setFeatures(prev => ({ ...prev, isLoading: false }));
      }
    };

    fetchFeatures();
  }, [companyId]);

  return features;
}
