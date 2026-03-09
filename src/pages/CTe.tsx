import { useState, useEffect } from 'react';
import { Plus, FileText, Truck, Settings, History, Wand2, AlertCircle } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { FiscalDocumentsDashboard } from '@/components/cte/FiscalDocumentsDashboard';
import { CTeWizard } from '@/components/cte/CTeWizard';
import { CTeList } from '@/components/cte/CTeList';
import { MDFeWizard } from '@/components/cte/MDFeWizard';
import { CTeSettings } from '@/components/cte/CTeSettings';
import { CertificateManager } from '@/components/cte/CertificateManager';
import { CTeOnboardingWizard } from '@/components/cte/CTeOnboardingWizard';
import { useCTeOnboarding } from '@/hooks/useCTeOnboarding';
import { usePlanFeaturesContext } from '@/contexts/PlanFeaturesContext';
import { UpgradePrompt } from '@/components/subscription/UpgradePrompt';

export default function CTe() {
  const { hasCTeModule, isLoading: planLoading, planName } = usePlanFeaturesContext();
  const [showNewCTe, setShowNewCTe] = useState(false);
  const [showNewMDFe, setShowNewMDFe] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [mdfeInitialData, setMdfeInitialData] = useState<{ cteKey: string; cteData: any } | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  
  const { needsOnboarding, loading: onboardingLoading, status, refreshStatus } = useCTeOnboarding();

  // Show onboarding automatically if needed
  useEffect(() => {
    if (!onboardingLoading && needsOnboarding && hasCTeModule) {
      setShowOnboarding(true);
    }
  }, [onboardingLoading, needsOnboarding, hasCTeModule]);

  // Loading state
  if (planLoading) {
    return (
      <div className="container mx-auto py-6 space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  // Module not enabled - show upgrade prompt
  if (!hasCTeModule) {
    return (
      <div className="container mx-auto py-6">
        <UpgradePrompt
          featureName="Emissão de CT-e"
          requiredPlan="Módulo Adicional"
          currentPlan={planName}
        />
      </div>
    );
  }

  const handleNewCTe = () => {
    if (needsOnboarding) {
      setShowOnboarding(true);
      return;
    }
    setShowNewCTe(true);
  };

  const handleNewMDFe = () => {
    if (needsOnboarding) {
      setShowOnboarding(true);
      return;
    }
    setShowNewMDFe(true);
  };

  const handleCreateMDFeFromCTe = (cteKey: string, cteData: any) => {
    setMdfeInitialData({ cteKey, cteData });
    setShowNewCTe(false);
    setShowNewMDFe(true);
  };

  const handleGoToSettings = () => {
    setShowNewCTe(false);
    setActiveTab('settings');
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Emissor Fiscal</h1>
          <p className="text-muted-foreground">
            Gestão completa de CT-e e MDF-e
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleNewCTe}>
            <Plus className="h-4 w-4 mr-2" />
            Novo CT-e
          </Button>
          <Button variant="outline" onClick={handleNewMDFe}>
            <Truck className="h-4 w-4 mr-2" />
            Novo MDF-e
          </Button>
        </div>
      </div>

      {/* Onboarding Alert */}
      {!onboardingLoading && needsOnboarding && (
        <Alert className="border-amber-500/50 bg-amber-500/10">
          <AlertCircle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="flex items-center justify-between">
            <span>
              Configure o certificado digital e a série antes de emitir seu primeiro CT-e.
            </span>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setShowOnboarding(true)}
              className="ml-4"
            >
              <Wand2 className="h-4 w-4 mr-2" />
              Configurar
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="dashboard" className="gap-2">
            <FileText className="h-4 w-4" />
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <History className="h-4 w-4" />
            Histórico
          </TabsTrigger>
          <TabsTrigger value="settings" className="gap-2">
            <Settings className="h-4 w-4" />
            Configurações
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard">
          <FiscalDocumentsDashboard />
        </TabsContent>

        <TabsContent value="history">
          <CTeList onEdit={() => {}} />
        </TabsContent>

        <TabsContent value="settings" className="space-y-6">
          <CertificateManager />
          <CTeSettings />
        </TabsContent>
      </Tabs>

      <Dialog open={showNewCTe} onOpenChange={setShowNewCTe}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <CTeWizard 
            onCreateMDFe={handleCreateMDFeFromCTe} 
            onGoToSettings={handleGoToSettings}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={showNewMDFe} onOpenChange={(open) => {
        setShowNewMDFe(open);
        if (!open) setMdfeInitialData(null);
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <MDFeWizard 
            initialCTeData={mdfeInitialData}
            onClose={() => setShowNewMDFe(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Onboarding Wizard */}
      <CTeOnboardingWizard
        open={showOnboarding}
        onOpenChange={setShowOnboarding}
        onComplete={() => {
          refreshStatus();
          setShowOnboarding(false);
        }}
        initialStatus={status}
      />
    </div>
  );
}
