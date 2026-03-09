import { useState, useEffect, useCallback } from 'react';
import { useMultiTenant } from './useMultiTenant';
import { supabase } from '@/integrations/supabase/client';

interface PlanFeatures {
  hasSimulator: boolean;
  hasAI: boolean;
  hasCopilot: boolean;
  hasPWADriver: boolean;
  hasDedicatedSupport: boolean;
  hasGeolocation: boolean;
  pricePerVehicle: number;
  minPrice: number;
  planName: string | null;
  vehicleLimit: number;
  vehicleCount: number;
  isAtLimit: boolean;
  isLoading: boolean;
  // Módulos Add-on (independentes do plano)
  hasCTeModule: boolean;
  cteMonthlyLimit: number | null;
  hasCouplingModule: boolean;
  couplingAssetLimit: number | null;
}

interface SubscriptionPlanData {
  name: string;
  price_per_vehicle: number | null;
  min_price: number | null;
  has_simulator: boolean | null;
  has_ai: boolean | null;
  has_copilot: boolean | null;
  has_pwa_driver: boolean | null;
  has_dedicated_support: boolean | null;
  has_geolocation: boolean | null;
}

export function usePlanFeatures(): PlanFeatures {
  const { currentCompany } = useMultiTenant();
  const [features, setFeatures] = useState<PlanFeatures>({
    hasSimulator: false,
    hasAI: false,
    hasCopilot: false,
    hasPWADriver: false,
    hasDedicatedSupport: false,
    hasGeolocation: false,
    pricePerVehicle: 0,
    minPrice: 0,
    planName: null,
    vehicleLimit: 999,
    vehicleCount: 0,
    isAtLimit: false,
    isLoading: true,
    // Módulos Add-on
    hasCTeModule: false,
    cteMonthlyLimit: null,
    hasCouplingModule: false,
    couplingAssetLimit: null,
  });

  const fetchPlanFeatures = useCallback(async () => {
    if (!currentCompany?.id) {
      console.log('[usePlanFeatures] No currentCompany, skipping fetch');
      setFeatures(prev => ({ ...prev, isLoading: false }));
      return;
    }

    console.log('[usePlanFeatures] Fetching features for company:', currentCompany.id);

    try {
      // Get company with subscription plan and add-on modules
      const { data: companyData, error: companyError } = await supabase
        .from('companies')
        .select('subscription_plan_id, vehicle_limit, cte_module_enabled, cte_monthly_limit, coupling_module_enabled, coupling_asset_limit')
        .eq('id', currentCompany.id)
        .single();

      if (companyError) {
        console.error('[usePlanFeatures] Error fetching company:', companyError);
        setFeatures(prev => ({ ...prev, isLoading: false }));
        return;
      }

      if (!companyData?.subscription_plan_id) {
        console.log('[usePlanFeatures] No subscription_plan_id found');
        setFeatures(prev => ({ ...prev, isLoading: false }));
        return;
      }

      console.log('[usePlanFeatures] subscription_plan_id:', companyData.subscription_plan_id);

      // Get plan features
      const { data: planData, error: planError } = await supabase
        .from('subscription_plans')
        .select('name, price_per_vehicle, min_price, has_simulator, has_ai, has_copilot, has_pwa_driver, has_dedicated_support, has_geolocation')
        .eq('id', companyData.subscription_plan_id)
        .single();

      if (planError) {
        console.error('[usePlanFeatures] Error fetching plan:', planError);
        setFeatures(prev => ({ ...prev, isLoading: false }));
        return;
      }

      if (!planData) {
        console.log('[usePlanFeatures] No plan data found');
        setFeatures(prev => ({ ...prev, isLoading: false }));
        return;
      }

      const plan = planData as unknown as SubscriptionPlanData;
      console.log('[usePlanFeatures] Plan loaded:', plan.name, {
        hasSimulator: plan.has_simulator,
        hasAI: plan.has_ai,
        hasCopilot: plan.has_copilot,
        hasPWADriver: plan.has_pwa_driver,
        hasDedicatedSupport: plan.has_dedicated_support,
      });

      // Get vehicle count for this company
      const { count: vehicleCount } = await supabase
        .from('vehicles')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', currentCompany.id);

      // Get vehicle limit from company
      const vehicleLimit = companyData.vehicle_limit ?? 999;
      const actualCount = vehicleCount ?? 0;

      const newFeatures: PlanFeatures = {
        hasSimulator: plan.has_simulator ?? false,
        hasAI: plan.has_ai ?? false,
        hasCopilot: plan.has_copilot ?? false,
        hasPWADriver: plan.has_pwa_driver ?? false,
        hasDedicatedSupport: plan.has_dedicated_support ?? false,
        hasGeolocation: plan.has_geolocation ?? false,
        pricePerVehicle: plan.price_per_vehicle ?? 0,
        minPrice: plan.min_price ?? 0,
        planName: plan.name,
        vehicleLimit,
        vehicleCount: actualCount,
        isAtLimit: actualCount >= vehicleLimit,
        isLoading: false,
        // Módulos Add-on (independentes do plano)
        hasCTeModule: companyData.cte_module_enabled ?? false,
        cteMonthlyLimit: companyData.cte_monthly_limit ?? null,
        hasCouplingModule: companyData.coupling_module_enabled ?? false,
        couplingAssetLimit: companyData.coupling_asset_limit ?? null,
      };

      console.log('[usePlanFeatures] Features updated:', newFeatures);
      setFeatures(newFeatures);
    } catch (error) {
      console.error('[usePlanFeatures] Error fetching plan features:', error);
      setFeatures(prev => ({ ...prev, isLoading: false }));
    }
  }, [currentCompany?.id]);

  // Initial fetch
  useEffect(() => {
    fetchPlanFeatures();
  }, [fetchPlanFeatures]);

  // Real-time subscription for plan changes
  useEffect(() => {
    if (!currentCompany?.id) return;

    console.log('[usePlanFeatures] Setting up realtime subscription for company:', currentCompany.id);

    const channel = supabase
      .channel(`company-plan-${currentCompany.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'companies',
          filter: `id=eq.${currentCompany.id}`
        },
        (payload) => {
          console.log('[usePlanFeatures] Realtime update received:', payload);
          fetchPlanFeatures();
        }
      )
      .subscribe((status) => {
        console.log('[usePlanFeatures] Realtime subscription status:', status);
      });

    return () => {
      console.log('[usePlanFeatures] Cleaning up realtime subscription');
      supabase.removeChannel(channel);
    };
  }, [currentCompany?.id, fetchPlanFeatures]);

  return features;
}

// Utility function to calculate monthly price
export function calculateMonthlyPrice(
  pricePerVehicle: number,
  vehicleCount: number,
  minPrice: number = 0
): number {
  const calculated = pricePerVehicle * vehicleCount;
  return Math.max(calculated, minPrice);
}
