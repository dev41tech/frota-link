import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { ChevronLeft, ChevronRight, Save, Send, AlertCircle, FileText, CheckCircle2, Truck, AlertTriangle, Eye, Settings, Loader2, Copy } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useMultiTenant } from '@/hooks/useMultiTenant';
import { LinkedDocumentsManager, LinkedDocument } from './LinkedDocumentsManager';
import { DocumentLookupStep } from './DocumentLookupStep';
import { AddressForm, AddressData, emptyAddress } from './AddressForm';
import { TomadorStep, TomadorData, emptyTomador } from './TomadorStep';
import { CargoInfoStep, CargoData, emptyCargo } from './CargoInfoStep';
import { VehicleDriverStep, VehicleDriverData, emptyVehicleDriver } from './VehicleDriverStep';
import { TaxCalculationStep, TaxData, emptyTax } from './TaxCalculationStep';
import { CTePreview } from './CTePreview';
import { suggestCFOP, getCFOPDescription } from '@/lib/xmlParser';

type WizardStep = 
  | 'dataSource'
  | 'operation' 
  | 'sender' 
  | 'recipient' 
  | 'tomador'
  | 'cargo'
  | 'vehicleDriver'
  | 'documents'
  | 'values' 
  | 'taxes'
  | 'notes' 
  | 'review';

interface PartyData {
  nome: string;
  documento: string;
  ie: string;
  endereco: AddressData;
}

interface CTeWizardProps {
  onCreateMDFe?: (cteKey: string, cteData: any) => void;
  onGoToSettings?: () => void;
}

export function CTeWizard({ onCreateMDFe, onGoToSettings }: CTeWizardProps) {
  const [currentStep, setCurrentStep] = useState<WizardStep>('dataSource');
  const [loading, setLoading] = useState(false);
  const [checkingSettings, setCheckingSettings] = useState(true);
  const [settingsConfigured, setSettingsConfigured] = useState<boolean | null>(null);
  const [certificateValid, setCertificateValid] = useState<boolean | null>(null);
  const [emittedCTe, setEmittedCTe] = useState<{ 
    key: string; 
    number: string;
    senderName: string;
    recipientName: string;
    originUf: string;
    originCity: string;
    originCityCode: string;
    destUf: string;
    destCity: string;
    destCityCode: string;
    freightValue: number;
    weight: number;
  } | null>(null);
  const { currentCompany } = useMultiTenant();
  const { toast } = useToast();

  // Check if CT-e settings and certificate are configured, and load series
  useEffect(() => {
    const checkConfiguration = async () => {
      if (!currentCompany) return;
      
      setCheckingSettings(true);
      try {
        // Check CT-e settings and get default series
        const { data: settings } = await supabase
          .from('cte_settings')
          .select('id, nuvem_fiscal_company_id, default_series')
          .eq('company_id', currentCompany.id)
          .maybeSingle();
        
        setSettingsConfigured(!!settings?.nuvem_fiscal_company_id);
        
        // Set default series from settings
        if (settings?.default_series) {
          setDefaultSeries(settings.default_series);
          setFormData(prev => ({ ...prev, series: settings.default_series }));
        }

        // Load available series
        const { data: seriesList } = await supabase
          .from('cte_series')
          .select('series, next_number')
          .eq('company_id', currentCompany.id)
          .eq('is_active', true)
          .order('series');
        
        setAvailableSeries(seriesList || []);

        // Check valid certificate
        const { data: certificate } = await supabase
          .from('digital_certificates')
          .select('id')
          .eq('company_id', currentCompany.id)
          .eq('status', 'active')
          .gt('expires_at', new Date().toISOString())
          .maybeSingle();
        
        setCertificateValid(!!certificate);
      } catch (error) {
        console.error('Error checking configuration:', error);
        setSettingsConfigured(false);
        setCertificateValid(false);
      } finally {
        setCheckingSettings(false);
      }
    };

    checkConfiguration();
  }, [currentCompany]);

  // States for series selection
  const [availableSeries, setAvailableSeries] = useState<{series: string, next_number: number}[]>([]);
  const [defaultSeries, setDefaultSeries] = useState<string>('1');

  const [formData, setFormData] = useState({
    operationType: 'normal',
    emissionType: 'production' as 'production' | 'draft',
    series: '1', // Série do CT-e
    // Remetente
    sender: {
      nome: '',
      documento: '',
      ie: '',
      endereco: emptyAddress
    } as PartyData,
    // Destinatário
    recipient: {
      nome: '',
      documento: '',
      ie: '',
      endereco: emptyAddress
    } as PartyData,
    // Tomador
    tomador: emptyTomador as TomadorData,
    // Carga
    cargo: emptyCargo as CargoData,
    // Veículo e Motorista
    vehicleDriver: emptyVehicleDriver as VehicleDriverData,
    // Documentos
    linkedDocuments: [] as LinkedDocument[],
    // Valores
    freightValue: '',
    cfop: '',
    // Impostos
    taxes: emptyTax as TaxData,
    // Outros
    notes: '',
    dataSource: 'manual' as 'manual' | 'import' | 'upload',
    importedDocumentKey: ''
  });

  const steps: { id: WizardStep; title: string; progress: number }[] = [
    { id: 'dataSource', title: 'Origem dos Dados', progress: 8 },
    { id: 'operation', title: 'Tipo de Operação', progress: 16 },
    { id: 'sender', title: 'Remetente', progress: 24 },
    { id: 'recipient', title: 'Destinatário', progress: 32 },
    { id: 'tomador', title: 'Tomador do Serviço', progress: 40 },
    { id: 'cargo', title: 'Informações da Carga', progress: 48 },
    { id: 'vehicleDriver', title: 'Veículo e Motorista', progress: 56 },
    { id: 'documents', title: 'Documentos Vinculados', progress: 64 },
    { id: 'values', title: 'Valores', progress: 72 },
    { id: 'taxes', title: 'Impostos', progress: 80 },
    { id: 'notes', title: 'Observações', progress: 90 },
    { id: 'review', title: 'Revisão Final', progress: 100 }
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

  const [loadingType, setLoadingType] = useState<'emit' | 'draft' | null>(null);
  const [savedDraftId, setSavedDraftId] = useState<string | null>(null);

  const formatAddress = (addr: AddressData) => {
    const parts = [
      addr.logradouro,
      addr.numero && `nº ${addr.numero}`,
      addr.complemento,
      addr.bairro,
      addr.cidade && addr.uf && `${addr.cidade}/${addr.uf}`,
      addr.cep && `CEP: ${addr.cep}`
    ].filter(Boolean);
    return parts.join(', ');
  };

  // Função para gerar o payload (usada tanto para emissão quanto para prévia)
  const generatePayload = (isDraft: boolean = false) => {
    return {
      series: formData.series || '1',
      operation_type: formData.operationType,
      is_draft: isDraft,
      // Remetente
      sender_name: formData.sender.nome,
      sender_document: formData.sender.documento,
      sender_ie: formData.sender.ie,
      sender_address: formatAddress(formData.sender.endereco),
      sender_address_data: formData.sender.endereco,
      // Destinatário
      recipient_name: formData.recipient.nome,
      recipient_document: formData.recipient.documento,
      recipient_ie: formData.recipient.ie,
      recipient_address: formatAddress(formData.recipient.endereco),
      recipient_address_data: formData.recipient.endereco,
      // Tomador
      tomador_tipo: formData.tomador.tipo,
      tomador_outros_nome: formData.tomador.outrosNome,
      tomador_outros_documento: formData.tomador.outrosDocumento,
      tomador_outros_endereco: formData.tomador.outrosEndereco,
      // Carga
      cargo_natureza: formData.cargo.natureza,
      cargo_peso_bruto: parseFloat(formData.cargo.pesoBruto.replace(',', '.')) || 0,
      cargo_peso_liquido: parseFloat(formData.cargo.pesoLiquido.replace(',', '.')) || null,
      cargo_valor: parseFloat(formData.cargo.valorCarga.replace(',', '.')) || 0,
      cargo_quantidade: parseInt(formData.cargo.quantidade) || 1,
      cargo_unidade: formData.cargo.unidadeMedida,
      cargo_cubagem: parseFloat(formData.cargo.cubagem.replace(',', '.')) || null,
      cargo_produto_predominante: formData.cargo.produtoPredominante,
      // Veículo e Motorista
      vehicle_plate: formData.vehicleDriver.vehiclePlate,
      vehicle_renavam: formData.vehicleDriver.vehicleRenavam,
      vehicle_uf: formData.vehicleDriver.vehicleUf,
      vehicle_rntrc: formData.vehicleDriver.vehicleRntrc,
      vehicle_tara: parseInt(formData.vehicleDriver.vehicleTara) || null,
      vehicle_capacidade: parseInt(formData.vehicleDriver.vehicleCapacidade) || null,
      driver_name: formData.vehicleDriver.driverName,
      driver_cpf: formData.vehicleDriver.driverCpf,
      // Valores
      freight_value: parseFloat(formData.freightValue.replace(',', '.')) || 0,
      cfop: formData.cfop,
      // Impostos
      cst: formData.taxes.cst,
      icms_base_calculo: parseFloat(formData.taxes.baseCalculo.replace(',', '.')) || 0,
      icms_aliquota: parseFloat(formData.taxes.aliquota) || 0,
      icms_valor: parseFloat(formData.taxes.valorIcms.replace(',', '.')) || 0,
      simples_nacional: formData.taxes.simplesNacional,
      // Documentos
      linked_documents: formData.linkedDocuments,
      // Outros
      notes: formData.notes,
      data_source: formData.dataSource,
      imported_document_key: formData.importedDocumentKey || null
    };
  };

  const handleSubmit = async (isDraft: boolean = false) => {
    if (!currentCompany) return;

    try {
      setLoading(true);
      setLoadingType(isDraft ? 'draft' : 'emit');

      const payload = generatePayload(isDraft);

      const { data, error } = await supabase.functions.invoke('cte-issue', {
        body: payload
      });

      if (error) throw error;

      if (isDraft) {
        // Save draft ID for viewing
        setSavedDraftId(data.cte_id);
        toast({
          title: "Rascunho salvo com sucesso!",
          description: "O CT-e foi emitido em homologação sem valor fiscal. Clique para visualizar.",
          action: (
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => {
                // Open draft viewer - for now just show the emitted alert
                setEmittedCTe({ 
                  key: data.cte_key, 
                  number: data.cte_number,
                  senderName: formData.sender.nome,
                  recipientName: formData.recipient.nome,
                  originUf: formData.sender.endereco.uf,
                  originCity: formData.sender.endereco.cidade,
                  originCityCode: formData.sender.endereco.codigoIBGE,
                  destUf: formData.recipient.endereco.uf,
                  destCity: formData.recipient.endereco.cidade,
                  destCityCode: formData.recipient.endereco.codigoIBGE,
                  freightValue: parseFloat(formData.freightValue.replace(',', '.')) || 0,
                  weight: parseFloat(formData.cargo.pesoBruto.replace(',', '.')) || 0
                });
              }}
            >
              <Eye className="h-4 w-4 mr-2" />
              Visualizar
            </Button>
          ),
        });
      } else {
        toast({
          title: "CT-e emitido com sucesso!",
          description: `Número: ${data.cte_number}`
        });
      }

      // Save emitted CT-e data for MDF-e creation
      setEmittedCTe({ 
        key: data.cte_key, 
        number: data.cte_number,
        senderName: formData.sender.nome,
        recipientName: formData.recipient.nome,
        originUf: formData.sender.endereco.uf,
        originCity: formData.sender.endereco.cidade,
        originCityCode: formData.sender.endereco.codigoIBGE,
        destUf: formData.recipient.endereco.uf,
        destCity: formData.recipient.endereco.cidade,
        destCityCode: formData.recipient.endereco.codigoIBGE,
        freightValue: parseFloat(formData.freightValue.replace(',', '.')) || 0,
        weight: parseFloat(formData.cargo.pesoBruto.replace(',', '.')) || 0
      });
      setFormData({
        operationType: 'normal',
        emissionType: 'production',
        series: defaultSeries,
        sender: { nome: '', documento: '', ie: '', endereco: emptyAddress },
        recipient: { nome: '', documento: '', ie: '', endereco: emptyAddress },
        tomador: emptyTomador,
        cargo: emptyCargo,
        vehicleDriver: emptyVehicleDriver,
        linkedDocuments: [],
        freightValue: '',
        cfop: '',
        taxes: emptyTax,
        notes: '',
        dataSource: 'manual',
        importedDocumentKey: ''
      });
      setCurrentStep('dataSource');

    } catch (error: any) {
      toast({
        title: "Erro ao emitir CT-e",
        description: error.message || "Tente novamente",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
      setLoadingType(null);
    }
  };

  const handleEmit = () => handleSubmit(false);
  const handleSaveDraftAndShow = () => handleSubmit(true);

  const formatDocument = (doc: string) => {
    const cleaned = doc.replace(/\D/g, '');
    if (cleaned.length <= 11) {
      return cleaned
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    }
    return cleaned
      .replace(/(\d{2})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1/$2')
      .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
  };

  const handleCreateMDFe = () => {
    if (emittedCTe && onCreateMDFe) {
      onCreateMDFe(emittedCTe.key, {
        cteNumber: emittedCTe.number,
        senderName: emittedCTe.senderName,
        recipientName: emittedCTe.recipientName,
        originUf: emittedCTe.originUf,
        originCity: emittedCTe.originCity,
        originCityCode: emittedCTe.originCityCode,
        destUf: emittedCTe.destUf,
        destCity: emittedCTe.destCity,
        destCityCode: emittedCTe.destCityCode,
        freightValue: emittedCTe.freightValue,
        weight: emittedCTe.weight
      });
      setEmittedCTe(null);
    }
  };

  // Show loading while checking configuration
  if (checkingSettings) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="flex flex-col items-center justify-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-muted-foreground">Verificando configurações...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Show configuration warning if not properly set up
  if (!settingsConfigured || !certificateValid) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Emissão de CT-e Normal</CardTitle>
          <CardDescription>
            Configure o emissor fiscal para começar a emitir documentos
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Configuração Necessária</AlertTitle>
            <AlertDescription className="mt-2">
              {!certificateValid ? (
                <p>Envie seu <strong>Certificado Digital A1</strong> na aba Configurações para habilitar a emissão de documentos fiscais.</p>
              ) : (
                <p>Aguarde a configuração do sistema ser concluída. Se o problema persistir, entre em contato com o suporte.</p>
              )}
            </AlertDescription>
          </Alert>
          
          <div className="flex flex-col sm:flex-row gap-3">
            <Button 
              onClick={onGoToSettings}
              className="gap-2"
            >
              <Settings className="h-4 w-4" />
              Ir para Configurações
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Emissão de CT-e Normal</CardTitle>
        <CardDescription>
          Preencha os dados para emitir um Conhecimento de Transporte Eletrônico
        </CardDescription>
        <div className="pt-4">
          <div className="flex justify-between text-sm text-muted-foreground mb-2">
            <span>Passo {currentStepIndex + 1} de {steps.length}</span>
            <span>{steps[currentStepIndex]?.title}</span>
          </div>
          <Progress value={currentProgress} />
        </div>

        {/* Prompt to create MDF-e after CT-e emission */}
        {emittedCTe && (
          <Alert className="mt-4 bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800">
            <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
            <div className="flex flex-col gap-3">
              <div>
                <p className="font-medium text-green-700 dark:text-green-300">
                  CT-e {emittedCTe.number} emitido com sucesso!
                </p>
                {emittedCTe.key && (
                  <div className="mt-2 p-2 bg-white dark:bg-gray-900 rounded border border-green-200 dark:border-green-800">
                    <p className="text-xs text-muted-foreground mb-1">Chave de Acesso:</p>
                    <div className="flex items-center gap-2">
                      <code className="text-xs font-mono break-all flex-1 text-green-800 dark:text-green-300">
                        {emittedCTe.key}
                      </code>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          navigator.clipboard.writeText(emittedCTe.key);
                          toast({
                            title: "Copiado",
                            description: "Chave de acesso copiada para a área de transferência",
                          });
                        }}
                        className="shrink-0"
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                )}
                <p className="text-sm text-green-600 dark:text-green-400 mt-2">
                  Deseja criar um MDF-e para este CT-e?
                </p>
              </div>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setEmittedCTe(null)}
                >
                  Não, obrigado
                </Button>
                {onCreateMDFe && (
                  <Button 
                    size="sm" 
                    onClick={handleCreateMDFe}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <Truck className="h-4 w-4 mr-1" />
                    Criar MDF-e
                  </Button>
                )}
              </div>
            </div>
          </Alert>
        )}
      </CardHeader>
      <CardContent className="space-y-6">
        {currentStep === 'dataSource' && (
          <DocumentLookupStep
            selectedMode={formData.dataSource}
            onModeSelected={(mode) => {
              setFormData({ ...formData, dataSource: mode });
            }}
            onDataImported={(data) => {
              // Merge imported data with existing formData
              setFormData({
                ...formData,
                operationType: data.operationType || formData.operationType,
                sender: data.sender ? { ...formData.sender, ...data.sender } : formData.sender,
                recipient: data.recipient ? { ...formData.recipient, ...data.recipient } : formData.recipient,
                cargo: data.cargo ? { ...formData.cargo, ...data.cargo } : formData.cargo,
                linkedDocuments: data.linkedDocuments || formData.linkedDocuments,
                freightValue: data.freightValue || formData.freightValue,
                cfop: data.cfop || formData.cfop,
                dataSource: data.dataSource || formData.dataSource,
                importedDocumentKey: data.importedDocumentKey || ''
              });
              
              // For upload mode, go to operation step to review type
              // For import mode (SEFAZ lookup), go directly to review
              if (data.dataSource === 'upload') {
                setCurrentStep('operation');
              } else {
                setCurrentStep('review');
              }
            }}
          />
        )}

        {currentStep === 'operation' && (
          <div className="space-y-6">
            <div className="space-y-2">
              <Label>Tipo de Operação *</Label>
              <Select
                value={formData.operationType}
                onValueChange={(value) => setFormData({ ...formData, operationType: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">Prestação de Serviço Normal</SelectItem>
                  <SelectItem value="subcontratacao">Subcontratação</SelectItem>
                  <SelectItem value="redespacho">Redespacho</SelectItem>
                  <SelectItem value="redespacho_intermediario">Redespacho Intermediário</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Série do CT-e *</Label>
              <Select
                value={formData.series}
                onValueChange={(value) => setFormData({ ...formData, series: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a série" />
                </SelectTrigger>
                <SelectContent>
                  {availableSeries.length > 0 ? (
                    availableSeries.map((s) => (
                      <SelectItem key={s.series} value={s.series}>
                        Série {s.series} (próximo: {s.next_number})
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="1">Série 1 (padrão)</SelectItem>
                  )}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Série padrão: {defaultSeries}. Configure séries adicionais na aba Configurações.
              </p>
            </div>
          </div>
        )}

        {currentStep === 'sender' && (
          <div className="space-y-4">
            <h3 className="font-semibold">Dados do Remetente</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nome/Razão Social *</Label>
                <Input
                  value={formData.sender.nome}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    sender: { ...formData.sender, nome: e.target.value }
                  })}
                  placeholder="Nome do remetente"
                />
              </div>
              <div className="space-y-2">
                <Label>CPF/CNPJ *</Label>
                <Input
                  value={formatDocument(formData.sender.documento)}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    sender: { ...formData.sender, documento: e.target.value.replace(/\D/g, '') }
                  })}
                  placeholder="000.000.000-00 ou 00.000.000/0000-00"
                  maxLength={18}
                />
              </div>
            </div>
            <AddressForm
              label="Endereço do Remetente"
              value={formData.sender.endereco}
              onChange={(endereco) => setFormData({
                ...formData,
                sender: { ...formData.sender, endereco }
              })}
              showIE={true}
            />
          </div>
        )}

        {currentStep === 'recipient' && (
          <div className="space-y-4">
            <h3 className="font-semibold">Dados do Destinatário</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nome/Razão Social *</Label>
                <Input
                  value={formData.recipient.nome}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    recipient: { ...formData.recipient, nome: e.target.value }
                  })}
                  placeholder="Nome do destinatário"
                />
              </div>
              <div className="space-y-2">
                <Label>CPF/CNPJ *</Label>
                <Input
                  value={formatDocument(formData.recipient.documento)}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    recipient: { ...formData.recipient, documento: e.target.value.replace(/\D/g, '') }
                  })}
                  placeholder="00.000.000/0000-00"
                  maxLength={18}
                />
              </div>
            </div>
            <AddressForm
              label="Endereço do Destinatário"
              value={formData.recipient.endereco}
              onChange={(endereco) => setFormData({
                ...formData,
                recipient: { ...formData.recipient, endereco }
              })}
              showIE={true}
            />
          </div>
        )}

        {currentStep === 'tomador' && (
          <TomadorStep
            value={formData.tomador}
            onChange={(tomador) => setFormData({ ...formData, tomador })}
          />
        )}

        {currentStep === 'cargo' && (
          <CargoInfoStep
            value={formData.cargo}
            onChange={(cargo) => setFormData({ ...formData, cargo })}
          />
        )}

        {currentStep === 'vehicleDriver' && (
          <VehicleDriverStep
            value={formData.vehicleDriver}
            onChange={(vehicleDriver) => setFormData({ ...formData, vehicleDriver })}
          />
        )}

        {currentStep === 'documents' && (
          <LinkedDocumentsManager
            documents={formData.linkedDocuments}
            onChange={(docs) => setFormData({ ...formData, linkedDocuments: docs })}
            operationType={formData.operationType}
            allowMultiple={true}
            showValueFields={true}
          />
        )}

        {currentStep === 'values' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Valor do Frete (R$) *</Label>
              <Input
                value={formData.freightValue}
                onChange={(e) => setFormData({ ...formData, freightValue: e.target.value.replace(/[^0-9,]/g, '') })}
                placeholder="0,00"
              />
            </div>

            <div className="space-y-2">
              <Label>CFOP (Código Fiscal de Operações) *</Label>
              <div className="flex gap-2">
                <Input
                  value={formData.cfop}
                  onChange={(e) => setFormData({ ...formData, cfop: e.target.value })}
                  placeholder="Ex: 6.352"
                  maxLength={6}
                />
                {!formData.cfop && formData.sender.endereco.uf && formData.recipient.endereco.uf && (
                  <Button
                    variant="outline"
                    size="sm"
                    type="button"
                    onClick={() => {
                      const suggested = suggestCFOP(
                        formData.operationType as any, 
                        formData.sender.endereco.uf, 
                        formData.recipient.endereco.uf
                      );
                      setFormData({ ...formData, cfop: suggested });
                      toast({
                        title: "CFOP sugerido aplicado",
                        description: getCFOPDescription(suggested)
                      });
                    }}
                  >
                    Sugerir CFOP
                  </Button>
                )}
              </div>
              {formData.cfop && (
                <p className="text-sm text-muted-foreground">
                  {getCFOPDescription(formData.cfop)}
                </p>
              )}
            </div>
          </div>
        )}

        {currentStep === 'taxes' && (
          <TaxCalculationStep
            value={formData.taxes}
            onChange={(taxes) => setFormData({ ...formData, taxes })}
            freightValue={formData.freightValue}
            originUf={formData.sender.endereco.uf}
            destUf={formData.recipient.endereco.uf}
          />
        )}

        {currentStep === 'notes' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Informações adicionais sobre o transporte..."
                rows={5}
              />
            </div>
          </div>
        )}

        {currentStep === 'review' && (
          <CTePreview
            formData={formData}
            onEmit={handleEmit}
            onSaveDraft={handleSaveDraftAndShow}
            onBack={handlePrevious}
            loading={loading}
            loadingType={loadingType}
            onGeneratePreviewPayload={() => generatePayload(true)}
          />
        )}

        {/* Hide footer on review step since CTePreview has its own buttons */}
        {currentStep !== 'review' && (
          <div className="flex items-center justify-between pt-6 border-t">
            <Button
              variant="outline"
              onClick={handlePrevious}
              disabled={currentStepIndex === 0 || loading}
            >
              <ChevronLeft className="h-4 w-4 mr-2" />
              Anterior
            </Button>

            <Button onClick={handleNext} disabled={loading}>
              Próximo
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
