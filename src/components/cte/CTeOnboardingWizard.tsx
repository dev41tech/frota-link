import { useState, useRef } from 'react';
import { Check, ChevronRight, ChevronLeft, Upload, Shield, Hash, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useMultiTenant } from '@/hooks/useMultiTenant';
import { supabase } from '@/integrations/supabase/client';

type OnboardingStep = 'welcome' | 'certificate' | 'series' | 'complete';

interface CTeOnboardingWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
  initialStatus?: {
    hasCertificate: boolean;
    hasSeries: boolean;
    hasSettings: boolean;
  };
}

export function CTeOnboardingWizard({ 
  open, 
  onOpenChange, 
  onComplete,
  initialStatus 
}: CTeOnboardingWizardProps) {
  const { currentCompany } = useMultiTenant();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Determine initial step based on status
  const getInitialStep = (): OnboardingStep => {
    if (!initialStatus) return 'welcome';
    if (!initialStatus.hasCertificate) return 'certificate';
    if (!initialStatus.hasSeries) return 'series';
    return 'welcome';
  };

  const [currentStep, setCurrentStep] = useState<OnboardingStep>(getInitialStep());
  
  // Certificate state
  const [certificateFile, setCertificateFile] = useState<File | null>(null);
  const [certificatePassword, setCertificatePassword] = useState('');
  const [uploadingCertificate, setUploadingCertificate] = useState(false);
  const [certificateUploaded, setCertificateUploaded] = useState(initialStatus?.hasCertificate || false);
  const [certificateExpiry, setCertificateExpiry] = useState<string | null>(null);

  // Series state
  const [seriesNumber, setSeriesNumber] = useState('1');
  const [isMigrating, setIsMigrating] = useState(false);
  const [nextNumber, setNextNumber] = useState(1);
  const [seriesDescription, setSeriesDescription] = useState('Série principal');
  const [savingSeries, setSavingSeries] = useState(false);
  const [seriesSaved, setSeriesSaved] = useState(initialStatus?.hasSeries || false);

  const steps: { id: OnboardingStep; label: string; icon: React.ReactNode }[] = [
    { id: 'welcome', label: 'Início', icon: <Shield className="h-4 w-4" /> },
    { id: 'certificate', label: 'Certificado', icon: <Upload className="h-4 w-4" /> },
    { id: 'series', label: 'Série', icon: <Hash className="h-4 w-4" /> },
    { id: 'complete', label: 'Pronto', icon: <Check className="h-4 w-4" /> },
  ];

  const currentStepIndex = steps.findIndex(s => s.id === currentStep);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const validTypes = ['.p12', '.pfx'];
      const extension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
      
      if (!validTypes.includes(extension)) {
        toast({
          title: 'Arquivo inválido',
          description: 'Selecione um arquivo de certificado .p12 ou .pfx',
          variant: 'destructive',
        });
        return;
      }
      setCertificateFile(file);
    }
  };

  const handleUploadCertificate = async () => {
    if (!certificateFile || !certificatePassword || !currentCompany) {
      toast({
        title: 'Dados incompletos',
        description: 'Selecione o arquivo e informe a senha do certificado',
        variant: 'destructive',
      });
      return;
    }

    setUploadingCertificate(true);
    try {
      // Convert file to base64
      const reader = new FileReader();
      const fileContent = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(certificateFile);
      });

      const { data, error } = await supabase.functions.invoke('certificate-upload', {
        body: {
          companyId: currentCompany.id,
          fileName: certificateFile.name,
          fileContent: fileContent,
          password: certificatePassword,
        },
      });

      if (error) throw error;

      if (data?.certificate?.expires_at) {
        setCertificateExpiry(new Date(data.certificate.expires_at).toLocaleDateString('pt-BR'));
      }

      setCertificateUploaded(true);
      toast({
        title: 'Certificado enviado',
        description: 'Seu certificado digital foi cadastrado com sucesso',
      });
    } catch (error: any) {
      console.error('Error uploading certificate:', error);
      toast({
        title: 'Erro ao enviar certificado',
        description: error.message || 'Não foi possível enviar o certificado',
        variant: 'destructive',
      });
    } finally {
      setUploadingCertificate(false);
    }
  };

  const handleSaveSeries = async () => {
    if (!currentCompany) return;

    setSavingSeries(true);
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error('Usuário não autenticado');

      // Check if series already exists
      const { data: existingSeries } = await supabase
        .from('cte_series')
        .select('id')
        .eq('company_id', currentCompany.id)
        .eq('series', seriesNumber)
        .maybeSingle();

      if (existingSeries) {
        // Update existing series
        const { error } = await supabase
          .from('cte_series')
          .update({
            next_number: isMigrating ? nextNumber : 1,
            description: seriesDescription,
            is_active: true,
          })
          .eq('id', existingSeries.id);

        if (error) throw error;
      } else {
        // Create new series
        const { error } = await supabase
          .from('cte_series')
          .insert({
            company_id: currentCompany.id,
            series: seriesNumber,
            next_number: isMigrating ? nextNumber : 1,
            description: seriesDescription,
            is_active: true,
          });

        if (error) throw error;
      }

      // Update or create cte_settings with default series
      const { data: existingSettings } = await supabase
        .from('cte_settings')
        .select('id')
        .eq('company_id', currentCompany.id)
        .maybeSingle();

      if (existingSettings) {
        await supabase
          .from('cte_settings')
          .update({ default_series: seriesNumber })
          .eq('id', existingSettings.id);
      } else {
        await supabase
          .from('cte_settings')
          .insert({
            company_id: currentCompany.id,
            user_id: user.user.id,
            default_series: seriesNumber,
            nuvem_fiscal_company_id: '', // Will be configured later
            environment: 'homologacao',
          });
      }

      setSeriesSaved(true);
      toast({
        title: 'Série configurada',
        description: `Série ${seriesNumber} configurada. Próximo número: ${isMigrating ? nextNumber : 1}`,
      });
    } catch (error: any) {
      console.error('Error saving series:', error);
      toast({
        title: 'Erro ao salvar série',
        description: error.message || 'Não foi possível salvar a configuração da série',
        variant: 'destructive',
      });
    } finally {
      setSavingSeries(false);
    }
  };

  const handleNext = () => {
    const stepOrder: OnboardingStep[] = ['welcome', 'certificate', 'series', 'complete'];
    const currentIndex = stepOrder.indexOf(currentStep);
    if (currentIndex < stepOrder.length - 1) {
      setCurrentStep(stepOrder[currentIndex + 1]);
    }
  };

  const handleBack = () => {
    const stepOrder: OnboardingStep[] = ['welcome', 'certificate', 'series', 'complete'];
    const currentIndex = stepOrder.indexOf(currentStep);
    if (currentIndex > 0) {
      setCurrentStep(stepOrder[currentIndex - 1]);
    }
  };

  const handleComplete = () => {
    onComplete();
    onOpenChange(false);
  };

  const canProceed = () => {
    switch (currentStep) {
      case 'welcome':
        return true;
      case 'certificate':
        return certificateUploaded || initialStatus?.hasCertificate;
      case 'series':
        return seriesSaved || initialStatus?.hasSeries;
      case 'complete':
        return true;
      default:
        return false;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Configuração Inicial do CT-e</DialogTitle>
          <DialogDescription>
            Configure os requisitos necessários para começar a emitir CT-e
          </DialogDescription>
        </DialogHeader>

        {/* Progress Steps */}
        <div className="flex items-center justify-between px-4 py-2">
          {steps.map((step, index) => {
            const isActive = step.id === currentStep;
            const isCompleted = index < currentStepIndex;
            
            return (
              <div key={step.id} className="flex items-center">
                <div className="flex flex-col items-center">
                  <div
                    className={`
                      flex items-center justify-center w-10 h-10 rounded-full border-2 transition-colors
                      ${isActive ? 'border-primary bg-primary text-primary-foreground' : ''}
                      ${isCompleted ? 'border-primary bg-primary text-primary-foreground' : ''}
                      ${!isActive && !isCompleted ? 'border-muted-foreground/30 text-muted-foreground' : ''}
                    `}
                  >
                    {isCompleted ? <Check className="h-5 w-5" /> : step.icon}
                  </div>
                  <span className={`text-xs mt-1 ${isActive || isCompleted ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                    {step.label}
                  </span>
                </div>
                {index < steps.length - 1 && (
                  <div className={`w-12 h-0.5 mx-2 ${index < currentStepIndex ? 'bg-primary' : 'bg-muted'}`} />
                )}
              </div>
            );
          })}
        </div>

        <div className="min-h-[300px] py-4">
          {/* Welcome Step */}
          {currentStep === 'welcome' && (
            <Card className="border-0 shadow-none">
              <CardHeader className="text-center">
                <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  <Shield className="h-8 w-8 text-primary" />
                </div>
                <CardTitle>Bem-vindo ao Emissor de CT-e</CardTitle>
                <CardDescription className="text-base">
                  Antes de começar a emitir documentos fiscais, precisamos configurar alguns itens essenciais.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3">
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                    <Upload className="h-5 w-5 text-primary mt-0.5" />
                    <div>
                      <p className="font-medium">Certificado Digital A1</p>
                      <p className="text-sm text-muted-foreground">
                        Necessário para assinar digitalmente seus documentos fiscais
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                    <Hash className="h-5 w-5 text-primary mt-0.5" />
                    <div>
                      <p className="font-medium">Série e Numeração</p>
                      <p className="text-sm text-muted-foreground">
                        Configure a série e o próximo número do CT-e a ser emitido
                      </p>
                    </div>
                  </div>
                </div>

                {isMigrating && (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Se você está migrando de outro sistema, poderá definir o número inicial para dar continuidade à sua sequência.
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          )}

          {/* Certificate Step */}
          {currentStep === 'certificate' && (
            <Card className="border-0 shadow-none">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="h-5 w-5" />
                  Certificado Digital A1
                </CardTitle>
                <CardDescription>
                  O certificado digital é necessário para assinar os documentos fiscais e garantir sua validade jurídica.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {certificateUploaded || initialStatus?.hasCertificate ? (
                  <div className="flex items-center gap-3 p-4 rounded-lg bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800">
                    <CheckCircle2 className="h-6 w-6 text-green-600" />
                    <div>
                      <p className="font-medium text-green-700 dark:text-green-300">Certificado configurado</p>
                      {certificateExpiry && (
                        <p className="text-sm text-green-600 dark:text-green-400">
                          Válido até: {certificateExpiry}
                        </p>
                      )}
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="space-y-2">
                      <Label>Arquivo do Certificado (.p12 ou .pfx)</Label>
                      <div 
                        className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary transition-colors"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept=".p12,.pfx"
                          onChange={handleFileSelect}
                          className="hidden"
                        />
                        {certificateFile ? (
                          <div className="flex items-center justify-center gap-2">
                            <Shield className="h-5 w-5 text-primary" />
                            <span className="font-medium">{certificateFile.name}</span>
                          </div>
                        ) : (
                          <>
                            <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                            <p className="text-sm text-muted-foreground">
                              Clique para selecionar ou arraste o arquivo aqui
                            </p>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="cert-password">Senha do Certificado</Label>
                      <Input
                        id="cert-password"
                        type="password"
                        value={certificatePassword}
                        onChange={(e) => setCertificatePassword(e.target.value)}
                        placeholder="Digite a senha do certificado"
                      />
                    </div>

                    <Button 
                      onClick={handleUploadCertificate} 
                      disabled={!certificateFile || !certificatePassword || uploadingCertificate}
                      className="w-full"
                    >
                      {uploadingCertificate ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Enviando...
                        </>
                      ) : (
                        <>
                          <Upload className="h-4 w-4 mr-2" />
                          Enviar Certificado
                        </>
                      )}
                    </Button>
                  </>
                )}

                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Use um certificado digital A1 válido. O arquivo deve ter extensão .p12 ou .pfx.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          )}

          {/* Series Step */}
          {currentStep === 'series' && (
            <Card className="border-0 shadow-none">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Hash className="h-5 w-5" />
                  Configuração da Série
                </CardTitle>
                <CardDescription>
                  Configure a série e o número inicial do seu CT-e. Se estiver migrando de outro sistema, informe o próximo número disponível.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {seriesSaved || initialStatus?.hasSeries ? (
                  <div className="flex items-center gap-3 p-4 rounded-lg bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800">
                    <CheckCircle2 className="h-6 w-6 text-green-600" />
                    <div>
                      <p className="font-medium text-green-700 dark:text-green-300">Série configurada</p>
                      <p className="text-sm text-green-600 dark:text-green-400">
                        Série {seriesNumber} - Próximo número: {isMigrating ? nextNumber : 1}
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="series-number">Número da Série</Label>
                        <Input
                          id="series-number"
                          value={seriesNumber}
                          onChange={(e) => setSeriesNumber(e.target.value)}
                          placeholder="1"
                        />
                        <p className="text-xs text-muted-foreground">
                          Geralmente é "1" para a série principal
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="series-desc">Descrição (opcional)</Label>
                        <Input
                          id="series-desc"
                          value={seriesDescription}
                          onChange={(e) => setSeriesDescription(e.target.value)}
                          placeholder="Série principal"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                      <div>
                        <Label htmlFor="migrating" className="font-medium">Migrando de outro sistema?</Label>
                        <p className="text-sm text-muted-foreground">
                          Ative esta opção para definir o número inicial
                        </p>
                      </div>
                      <Switch
                        id="migrating"
                        checked={isMigrating}
                        onCheckedChange={setIsMigrating}
                      />
                    </div>

                    {isMigrating && (
                      <div className="space-y-2">
                        <Label htmlFor="next-number">Próximo Número a Emitir</Label>
                        <Input
                          id="next-number"
                          type="number"
                          min={1}
                          value={nextNumber}
                          onChange={(e) => setNextNumber(parseInt(e.target.value) || 1)}
                          placeholder="Ex: 501"
                        />
                        <Alert>
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription>
                            Informe o próximo número disponível. Por exemplo, se o último CT-e emitido foi o 500, informe 501.
                          </AlertDescription>
                        </Alert>
                      </div>
                    )}

                    <Button 
                      onClick={handleSaveSeries} 
                      disabled={!seriesNumber || savingSeries}
                      className="w-full"
                    >
                      {savingSeries ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Salvando...
                        </>
                      ) : (
                        <>
                          <Check className="h-4 w-4 mr-2" />
                          Salvar Configuração
                        </>
                      )}
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {/* Complete Step */}
          {currentStep === 'complete' && (
            <Card className="border-0 shadow-none">
              <CardHeader className="text-center">
                <div className="mx-auto w-16 h-16 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center mb-4">
                  <CheckCircle2 className="h-8 w-8 text-green-600" />
                </div>
                <CardTitle>Configuração Concluída!</CardTitle>
                <CardDescription className="text-base">
                  Você está pronto para começar a emitir CT-e.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3">
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-green-50 dark:bg-green-950">
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                    <span>Certificado digital configurado</span>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-green-50 dark:bg-green-950">
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                    <span>Série {seriesNumber} configurada</span>
                  </div>
                </div>

                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Ambiente de Homologação:</strong> Seus primeiros CT-e serão emitidos em ambiente de teste. 
                    Após validar o processo, acesse as Configurações para mudar para Produção.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Navigation Buttons */}
        <div className="flex justify-between pt-4 border-t">
          <Button
            variant="ghost"
            onClick={handleBack}
            disabled={currentStep === 'welcome'}
          >
            <ChevronLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>

          {currentStep === 'complete' ? (
            <Button onClick={handleComplete}>
              Começar a Emitir
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          ) : (
            <Button onClick={handleNext} disabled={!canProceed()}>
              {currentStep === 'series' ? 'Concluir' : 'Próximo'}
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
