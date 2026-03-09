import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { 
  ChevronLeft, ChevronRight, Send, Package, FileText, Route, 
  Truck, Shield, CheckCircle2, AlertCircle, Upload, ClipboardList 
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useMultiTenant } from '@/hooks/useMultiTenant';
import { MDFeCTeSelector, CTeInfo } from './MDFeCTeSelector';
import { MDFeRouteStep, MDFeRouteData, emptyRouteData, MunicipioDescarga } from './MDFeRouteStep';
import { MDFeSeguroStep, MDFeSeguroData, emptySeguroData } from './MDFeSeguroStep';
import { VehicleDriverStep, VehicleDriverData, emptyVehicleDriver } from './VehicleDriverStep';

type WizardStep = 'dataSource' | 'ctes' | 'route' | 'vehicleDriver' | 'totals' | 'seguro' | 'review';

interface MDFeWizardProps {
  initialCTeData?: {
    cteKey: string;
    cteData: any;
  } | null;
  onClose?: () => void;
  onSuccess?: (mdfeId: string) => void;
}

export function MDFeWizard({ initialCTeData, onClose, onSuccess }: MDFeWizardProps) {
  const [currentStep, setCurrentStep] = useState<WizardStep>(initialCTeData ? 'ctes' : 'dataSource');
  const [loading, setLoading] = useState(false);
  const { currentCompany } = useMultiTenant();
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    dataSource: 'select' as 'select' | 'import' | 'manual',
    ctes: [] as CTeInfo[],
    route: emptyRouteData as MDFeRouteData,
    vehicleDriver: emptyVehicleDriver as VehicleDriverData,
    totalPeso: '',
    totalValor: '',
    seguro: emptySeguroData as MDFeSeguroData,
    observacoes: ''
  });

  // Process initial CT-e data when coming from CTeWizard
  useEffect(() => {
    if (initialCTeData) {
      const cteInfo: CTeInfo = {
        id: initialCTeData.cteKey,
        cteKey: initialCTeData.cteKey,
        cteNumber: initialCTeData.cteData?.cteNumber || '',
        senderName: initialCTeData.cteData?.senderName || '',
        recipientName: initialCTeData.cteData?.recipientName || '',
        freightValue: initialCTeData.cteData?.freightValue || 0,
        weight: initialCTeData.cteData?.weight || 0,
        originUf: initialCTeData.cteData?.originUf || '',
        originCity: initialCTeData.cteData?.originCity || '',
        originCityCode: initialCTeData.cteData?.originCityCode || '',
        destUf: initialCTeData.cteData?.destUf || '',
        destCity: initialCTeData.cteData?.destCity || '',
        destCityCode: initialCTeData.cteData?.destCityCode || '',
        emissionDate: new Date().toISOString().split('T')[0]
      };
      
      setFormData(prev => ({
        ...prev,
        ctes: [cteInfo],
        route: {
          ...prev.route,
          ufCarregamento: initialCTeData.cteData?.originUf || '',
          municipioCarregamento: initialCTeData.cteData?.originCity || '',
          codigoMunicipioCarregamento: initialCTeData.cteData?.originCityCode || ''
        }
      }));
    }
  }, [initialCTeData]);

  // Auto-calculate totals and auto-fill route when CTes change
  useEffect(() => {
    if (formData.ctes.length > 0) {
      const totalPeso = formData.ctes.reduce((sum, c) => sum + c.weight, 0);
      const totalValor = formData.ctes.reduce((sum, c) => sum + c.freightValue, 0);
      
      // Build auto-filled route data
      let newRoute = { ...formData.route };
      const firstCte = formData.ctes[0];
      
      // Auto-fill loading location if empty
      if (!formData.route.ufCarregamento && firstCte.originUf) {
        newRoute.ufCarregamento = firstCte.originUf;
        newRoute.municipioCarregamento = firstCte.originCity || '';
        newRoute.codigoMunicipioCarregamento = firstCte.originCityCode || '';
      }
      
      // Auto-fill unloading municipalities if empty
      if (formData.route.municipiosDescarregamento.length === 0) {
        const destinos = new Map<string, MunicipioDescarga>();
        
        formData.ctes.forEach(cte => {
          const cityCode = cte.destCityCode || cte.destCity;
          if (!cityCode || !cte.destUf) return;
          
          if (!destinos.has(cityCode)) {
            destinos.set(cityCode, {
              codigo: cte.destCityCode || '',
              nome: cte.destCity || '',
              uf: cte.destUf,
              cteKeys: [cte.cteKey]
            });
          } else {
            destinos.get(cityCode)!.cteKeys.push(cte.cteKey);
          }
        });
        
        if (destinos.size > 0) {
          newRoute.municipiosDescarregamento = Array.from(destinos.values());
        }
      }
      
      setFormData(prev => ({
        ...prev,
        totalPeso: totalPeso.toString(),
        totalValor: totalValor.toFixed(2),
        route: newRoute
      }));
    }
  }, [formData.ctes.length]); // Only trigger on ctes array length change to avoid loops

  const steps: { id: WizardStep; title: string; icon: React.ReactNode; progress: number }[] = [
    { id: 'dataSource', title: 'Origem', icon: <Upload className="h-4 w-4" />, progress: 14 },
    { id: 'ctes', title: 'CT-es', icon: <FileText className="h-4 w-4" />, progress: 28 },
    { id: 'route', title: 'Percurso', icon: <Route className="h-4 w-4" />, progress: 42 },
    { id: 'vehicleDriver', title: 'Veículo', icon: <Truck className="h-4 w-4" />, progress: 56 },
    { id: 'totals', title: 'Totais', icon: <Package className="h-4 w-4" />, progress: 70 },
    { id: 'seguro', title: 'Seguro', icon: <Shield className="h-4 w-4" />, progress: 85 },
    { id: 'review', title: 'Revisão', icon: <CheckCircle2 className="h-4 w-4" />, progress: 100 }
  ];

  const currentStepIndex = steps.findIndex(s => s.id === currentStep);
  const currentProgress = steps[currentStepIndex]?.progress || 0;

  const handleNext = () => {
    if (currentStepIndex < steps.length - 1) {
      setCurrentStep(steps[currentStepIndex + 1].id);
    }
  };

  const handlePrevious = () => {
    if (currentStepIndex > 0) {
      setCurrentStep(steps[currentStepIndex - 1].id);
    }
  };

  const canProceed = (): boolean => {
    switch (currentStep) {
      case 'dataSource':
        return true;
      case 'ctes':
        return formData.ctes.length > 0;
      case 'route':
        return !!(
          formData.route.ufCarregamento && 
          formData.route.municipioCarregamento &&
          formData.route.codigoMunicipioCarregamento &&
          formData.route.municipiosDescarregamento.length > 0
        );
      case 'vehicleDriver':
        return !!(
          formData.vehicleDriver.vehiclePlate &&
          formData.vehicleDriver.driverName &&
          formData.vehicleDriver.driverCpf
        );
      case 'totals':
        return !!(formData.totalPeso && formData.totalValor);
      case 'seguro':
        return !!formData.seguro.seguroResponsavel;
      default:
        return true;
    }
  };

  const handleSubmit = async () => {
    if (!currentCompany) return;

    try {
      setLoading(true);

      const payload = {
        // CT-es
        cte_keys: formData.ctes.map(c => c.cteKey),
        nfe_keys: [],
        
        // Route
        uf_carregamento: formData.route.ufCarregamento,
        municipio_carregamento: formData.route.municipioCarregamento,
        codigo_municipio_carregamento: formData.route.codigoMunicipioCarregamento,
        ufs_percurso: formData.route.ufsPercurso,
        municipios_descarregamento: formData.route.municipiosDescarregamento.map(m => ({
          codigo_municipio: m.codigo,
          nome_municipio: m.nome,
          uf: m.uf,
          cte_keys: m.cteKeys
        })),
        
        // Vehicle/Driver
        vehicle_plate: formData.vehicleDriver.vehiclePlate,
        vehicle_renavam: formData.vehicleDriver.vehicleRenavam,
        vehicle_uf: formData.vehicleDriver.vehicleUf,
        vehicle_rntrc: formData.vehicleDriver.vehicleRntrc,
        vehicle_tara: parseInt(formData.vehicleDriver.vehicleTara) || 0,
        vehicle_capacidade: parseInt(formData.vehicleDriver.vehicleCapacidade) || 0,
        driver_name: formData.vehicleDriver.driverName,
        driver_cpf: formData.vehicleDriver.driverCpf,
        
        // Totals
        total_peso: parseFloat(formData.totalPeso) || 0,
        total_valor: parseFloat(formData.totalValor.replace(',', '.')) || 0,
        
        // Insurance
        seguro_responsavel: formData.seguro.seguroResponsavel,
        seguradora_cnpj: formData.seguro.seguradoraCnpj,
        seguro_apolice: formData.seguro.apolice,
        seguro_averbacao: formData.seguro.averbacao,
        ciot: formData.seguro.ciot,
        
        // Notes
        observacoes: formData.observacoes
      };

      const { data, error } = await supabase.functions.invoke('mdfe-issue', {
        body: payload
      });

      if (error) throw error;

      toast({
        title: "MDF-e emitido com sucesso!",
        description: `Número: ${data.mdfe_number} | Chave: ${data.mdfe_key?.slice(0, 15)}...`
      });

      onSuccess?.(data.id);
      onClose?.();

    } catch (error: any) {
      console.error('MDF-e emission error:', error);
      toast({
        title: "Erro ao emitir MDF-e",
        description: error.message || "Tente novamente",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: string | number) => {
    const num = typeof value === 'string' ? parseFloat(value.replace(',', '.')) : value;
    return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5" />
          Emissão de MDF-e
        </CardTitle>
        <CardDescription>
          Manifesto Eletrônico de Documentos Fiscais
        </CardDescription>
        <div className="pt-4">
          <div className="flex justify-between text-sm text-muted-foreground mb-2">
            <span>Passo {currentStepIndex + 1} de {steps.length}</span>
            <span className="flex items-center gap-2">
              {steps[currentStepIndex]?.icon}
              {steps[currentStepIndex]?.title}
            </span>
          </div>
          <Progress value={currentProgress} />
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Step: Data Source */}
        {currentStep === 'dataSource' && (
          <div className="space-y-4">
            <h3 className="font-semibold">Como deseja criar o MDF-e?</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card 
                className={`cursor-pointer transition-all hover:border-primary ${
                  formData.dataSource === 'select' ? 'border-primary bg-primary/5' : ''
                }`}
                onClick={() => setFormData({ ...formData, dataSource: 'select' })}
              >
                <CardContent className="pt-6 text-center">
                  <ClipboardList className="h-8 w-8 mx-auto mb-3 text-primary" />
                  <h4 className="font-medium mb-2">Selecionar CT-es</h4>
                  <p className="text-sm text-muted-foreground">
                    Escolha CT-es já emitidos para agrupar no MDF-e
                  </p>
                </CardContent>
              </Card>

              <Card 
                className={`cursor-pointer transition-all hover:border-primary ${
                  formData.dataSource === 'import' ? 'border-primary bg-primary/5' : ''
                }`}
                onClick={() => setFormData({ ...formData, dataSource: 'import' })}
              >
                <CardContent className="pt-6 text-center">
                  <Upload className="h-8 w-8 mx-auto mb-3 text-primary" />
                  <h4 className="font-medium mb-2">Importar XML</h4>
                  <p className="text-sm text-muted-foreground">
                    Importe XMLs de CT-es de outros emissores
                  </p>
                </CardContent>
              </Card>

              <Card 
                className={`cursor-pointer transition-all hover:border-primary ${
                  formData.dataSource === 'manual' ? 'border-primary bg-primary/5' : ''
                }`}
                onClick={() => setFormData({ ...formData, dataSource: 'manual' })}
              >
                <CardContent className="pt-6 text-center">
                  <FileText className="h-8 w-8 mx-auto mb-3 text-primary" />
                  <h4 className="font-medium mb-2">Chaves Manuais</h4>
                  <p className="text-sm text-muted-foreground">
                    Digite as chaves de acesso dos CT-es
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* Step: CT-e Selection */}
        {currentStep === 'ctes' && (
          <div className="space-y-4">
            <h3 className="font-semibold">CT-es que compõem este MDF-e</h3>
            <MDFeCTeSelector
              selectedCTes={formData.ctes}
              onChange={(ctes) => setFormData({ ...formData, ctes })}
              initialCTeKey={initialCTeData?.cteKey}
            />
          </div>
        )}

        {/* Step: Route */}
        {currentStep === 'route' && (
          <div className="space-y-4">
            <h3 className="font-semibold">Definição do Percurso</h3>
            <MDFeRouteStep
              value={formData.route}
              onChange={(route) => setFormData({ ...formData, route })}
              ctes={formData.ctes}
            />
          </div>
        )}

        {/* Step: Vehicle/Driver */}
        {currentStep === 'vehicleDriver' && (
          <VehicleDriverStep
            value={formData.vehicleDriver}
            onChange={(vehicleDriver) => setFormData({ ...formData, vehicleDriver })}
          />
        )}

        {/* Step: Totals */}
        {currentStep === 'totals' && (
          <div className="space-y-4">
            <h3 className="font-semibold">Totais da Carga</h3>
            
            <Alert className="bg-blue-50 dark:bg-blue-950/30 border-blue-200">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Os valores foram calculados automaticamente com base nos CT-es selecionados. 
                Ajuste se necessário.
              </AlertDescription>
            </Alert>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardContent className="pt-4">
                  <div className="space-y-2">
                    <Label>Peso Total Bruto (kg) *</Label>
                    <Input
                      value={formData.totalPeso}
                      onChange={(e) => setFormData({ 
                        ...formData, 
                        totalPeso: e.target.value.replace(/[^0-9.,]/g, '') 
                      })}
                      placeholder="0"
                    />
                    <p className="text-xs text-muted-foreground">
                      Soma do peso bruto de todas as cargas
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-4">
                  <div className="space-y-2">
                    <Label>Valor Total da Carga (R$) *</Label>
                    <Input
                      value={formData.totalValor}
                      onChange={(e) => setFormData({ 
                        ...formData, 
                        totalValor: e.target.value.replace(/[^0-9.,]/g, '') 
                      })}
                      placeholder="0,00"
                    />
                    <p className="text-xs text-muted-foreground">
                      Soma do valor de todas as mercadorias
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardContent className="pt-4">
                <div className="space-y-2">
                  <Label>Observações</Label>
                  <Input
                    value={formData.observacoes}
                    onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                    placeholder="Informações adicionais (opcional)"
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Step: Insurance */}
        {currentStep === 'seguro' && (
          <MDFeSeguroStep
            value={formData.seguro}
            onChange={(seguro) => setFormData({ ...formData, seguro })}
            totalValue={parseFloat(formData.totalValor.replace(',', '.')) || 0}
          />
        )}

        {/* Step: Review */}
        {currentStep === 'review' && (
          <div className="space-y-4">
            <Alert className="bg-green-50 dark:bg-green-950/30 border-green-200">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertTitle className="text-green-700 dark:text-green-300">
                Pronto para emitir
              </AlertTitle>
              <AlertDescription className="text-green-600 dark:text-green-400">
                Revise os dados abaixo e clique em "Emitir MDF-e" para transmitir à SEFAZ.
              </AlertDescription>
            </Alert>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* CT-es */}
              <Card>
                <CardContent className="pt-4">
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <FileText className="h-4 w-4 text-primary" />
                    CT-es ({formData.ctes.length})
                  </h4>
                  <div className="space-y-1">
                    {formData.ctes.slice(0, 3).map(cte => (
                      <p key={cte.cteKey} className="text-sm">
                        CT-e {cte.cteNumber} - {cte.originUf}→{cte.destUf}
                      </p>
                    ))}
                    {formData.ctes.length > 3 && (
                      <p className="text-xs text-muted-foreground">
                        +{formData.ctes.length - 3} outros
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Route */}
              <Card>
                <CardContent className="pt-4">
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <Route className="h-4 w-4 text-primary" />
                    Percurso
                  </h4>
                  <p className="text-sm">
                    {formData.route.municipioCarregamento}/{formData.route.ufCarregamento}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    UFs: {[formData.route.ufCarregamento, ...formData.route.ufsPercurso].join(' → ')}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formData.route.municipiosDescarregamento.length} municípios de descarga
                  </p>
                </CardContent>
              </Card>

              {/* Vehicle */}
              <Card>
                <CardContent className="pt-4">
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <Truck className="h-4 w-4 text-primary" />
                    Veículo/Motorista
                  </h4>
                  <p className="text-sm">Placa: {formData.vehicleDriver.vehiclePlate}</p>
                  <p className="text-xs text-muted-foreground">
                    {formData.vehicleDriver.driverName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    RNTRC: {formData.vehicleDriver.vehicleRntrc || 'N/I'}
                  </p>
                </CardContent>
              </Card>

              {/* Totals */}
              <Card>
                <CardContent className="pt-4">
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <Package className="h-4 w-4 text-primary" />
                    Totais
                  </h4>
                  <p className="text-sm font-medium">
                    {formatCurrency(formData.totalValor)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Peso: {parseFloat(formData.totalPeso || '0').toLocaleString('pt-BR')} kg
                  </p>
                </CardContent>
              </Card>

              {/* Insurance */}
              <Card>
                <CardContent className="pt-4">
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <Shield className="h-4 w-4 text-primary" />
                    Seguro
                  </h4>
                  <p className="text-sm">
                    Resp: {formData.seguro.seguroResponsavel === '4' ? 'Emitente' : 'Outro'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formData.seguro.apolice ? `Apólice: ${formData.seguro.apolice}` : 'Sem apólice'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formData.seguro.ciot ? `CIOT: ${formData.seguro.ciot}` : 'Sem CIOT'}
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between pt-6 border-t">
          <Button
            variant="outline"
            onClick={handlePrevious}
            disabled={currentStepIndex === 0 || loading}
          >
            <ChevronLeft className="h-4 w-4 mr-2" />
            Anterior
          </Button>

          <div className="flex gap-2">
            {currentStepIndex < steps.length - 1 ? (
              <Button onClick={handleNext} disabled={!canProceed() || loading}>
                Próximo
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            ) : (
              <Button onClick={handleSubmit} disabled={loading}>
                <Send className="h-4 w-4 mr-2" />
                {loading ? 'Emitindo...' : 'Emitir MDF-e'}
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
