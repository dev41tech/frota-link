import { ReactNode } from 'react';
import { usePlanFeatures } from '@/hooks/usePlanFeatures';
import { UpgradePrompt } from './UpgradePrompt';
import { Skeleton } from '@/components/ui/skeleton';

export type FeatureKey = 'simulator' | 'ai' | 'copilot' | 'pwaDriver' | 'dedicatedSupport' | 'geolocation';

interface FeatureGateProps {
  feature: FeatureKey;
  children: ReactNode;
  fallback?: 'hide' | 'upgrade';
}

const featureToCheck: Record<FeatureKey, keyof ReturnType<typeof usePlanFeatures>> = {
  simulator: 'hasSimulator',
  ai: 'hasAI',
  copilot: 'hasCopilot',
  pwaDriver: 'hasPWADriver',
  dedicatedSupport: 'hasDedicatedSupport',
  geolocation: 'hasGeolocation',
};

const featureLabels: Record<FeatureKey, { name: string; requiredPlan: string }> = {
  simulator: { name: 'Simulador de Frete', requiredPlan: 'Pro' },
  ai: { name: 'Assistente IA', requiredPlan: 'Pro' },
  copilot: { name: 'Copilot Flutuante', requiredPlan: 'Pro' },
  pwaDriver: { name: 'App Motorista (PWA)', requiredPlan: 'Enterprise' },
  dedicatedSupport: { name: 'Suporte Dedicado', requiredPlan: 'Concierge' },
  geolocation: { name: 'Geolocalização', requiredPlan: 'Pro' },
};

export function FeatureGate({ feature, children, fallback = 'upgrade' }: FeatureGateProps) {
  const planFeatures = usePlanFeatures();
  const { isLoading, planName } = planFeatures;

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const checkKey = featureToCheck[feature];
  const hasAccess = planFeatures[checkKey] as boolean;

  if (hasAccess) {
    return <>{children}</>;
  }

  if (fallback === 'hide') {
    return null;
  }

  const { name, requiredPlan } = featureLabels[feature];

  return (
    <UpgradePrompt
      featureName={name}
      requiredPlan={requiredPlan}
      currentPlan={planName}
    />
  );
}
