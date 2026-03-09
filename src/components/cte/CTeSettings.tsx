import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMultiTenant } from '@/hooks/useMultiTenant';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, Save, RefreshCw, Settings2, Eye, EyeOff } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { CTeSeriesManager } from './CTeSeriesManager';

const settingsSchema = z.object({
  nuvemFiscalCompanyId: z.string().optional(),
  environment: z.enum(['homologacao', 'producao']),
  defaultSeries: z.string().min(1, 'Série padrão é obrigatória'),
  autoEmitEnabled: z.boolean(),
});

type SettingsFormData = z.infer<typeof settingsSchema>;

interface NuvemFiscalCompany {
  id: string;
  nome: string;
  cnpj: string;
}

export function CTeSettings() {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [companies, setCompanies] = useState<NuvemFiscalCompany[]>([]);
  const [settings, setSettings] = useState<any>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const { currentCompany, isMaster } = useMultiTenant();
  const { toast } = useToast();

  const form = useForm<SettingsFormData>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      nuvemFiscalCompanyId: '',
      environment: 'homologacao',
      defaultSeries: '1',
      autoEmitEnabled: false,
    },
  });

  useEffect(() => {
    if (currentCompany) {
      fetchSettings();
      if (isMaster) {
        fetchNuvemFiscalCompanies();
      }
    }
  }, [currentCompany, isMaster]);

  const fetchSettings = async () => {
    try {
      if (!currentCompany) return;

      const { data, error } = await supabase
        .from('cte_settings')
        .select('*')
        .eq('company_id', currentCompany.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;

      if (data) {
        setSettings(data);
        form.reset({
          nuvemFiscalCompanyId: data.nuvem_fiscal_company_id,
          environment: data.environment as 'homologacao' | 'producao',
          defaultSeries: data.default_series,
          autoEmitEnabled: data.auto_emit_enabled,
        });
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar configurações",
        variant: "destructive",
      });
    }
  };

  const fetchNuvemFiscalCompanies = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke('nuvem-fiscal-companies');

      if (error) throw error;
      setCompanies(data.companies || []);
    } catch (error) {
      console.error('Error fetching Nuvem Fiscal companies:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar empresas da Nuvem Fiscal",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (data: SettingsFormData) => {
    try {
      setSaving(true);

      if (settings) {
        // Update existing settings
        const { error } = await supabase
          .from('cte_settings')
          .update({
            nuvem_fiscal_company_id: data.nuvemFiscalCompanyId,
            environment: data.environment,
            default_series: data.defaultSeries,
            auto_emit_enabled: data.autoEmitEnabled,
            updated_at: new Date().toISOString(),
          })
          .eq('id', settings.id);

        if (error) throw error;
      } else {
        // Create new settings
        const { data: { user } } = await supabase.auth.getUser();
        const { error } = await supabase
          .from('cte_settings')
          .insert({
            nuvem_fiscal_company_id: data.nuvemFiscalCompanyId,
            environment: data.environment,
            default_series: data.defaultSeries,
            auto_emit_enabled: data.autoEmitEnabled,
            user_id: user?.id || '',
            company_id: currentCompany?.id || '',
          });

        if (error) throw error;
      }

      toast({
        title: "Sucesso",
        description: "Configurações salvas com sucesso",
      });

      fetchSettings();
    } catch (error) {
      console.error('Error saving settings:', error);
      toast({
        title: "Erro",
        description: "Erro ao salvar configurações",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const isConfigured = !!settings?.nuvem_fiscal_company_id;

  // Non-Master users see simplified message
  if (!isMaster) {
    return (
      <div className="space-y-4">
        <Alert>
          <Settings2 className="h-4 w-4" />
          <AlertDescription>
            As configurações de emissão são gerenciadas pelo administrador do sistema.
            Para emitir documentos fiscais, basta ter o certificado digital configurado na aba "Certificado Digital".
          </AlertDescription>
        </Alert>

        {isConfigured && (
          <div className="rounded-lg border p-4 bg-muted/50">
            <div className="flex items-center gap-2">
              <Badge variant="default" className="bg-green-600">✓ Sistema configurado</Badge>
              <span className="text-sm text-muted-foreground">
                Pronto para emitir documentos fiscais
              </span>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Master users see full configuration
  return (
    <div className="space-y-6">
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Configure os parâmetros de emissão de documentos fiscais.
          A integração é configurada automaticamente ao enviar o certificado digital.
        </AlertDescription>
      </Alert>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Emission Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings2 className="h-5 w-5" />
                Configurações de Emissão
              </CardTitle>
              <CardDescription>
                Parâmetros padrão para emissão de CT-e
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="environment"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ambiente</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="homologacao">Homologação (testes)</SelectItem>
                        <SelectItem value="producao">Produção</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      {field.value === 'homologacao' 
                        ? '⚠️ Documentos emitidos em homologação não têm validade fiscal'
                        : '✅ Documentos emitidos em produção têm validade fiscal'}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="defaultSeries"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Série Padrão</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormDescription>
                      Série padrão para emissão de CT-e
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="autoEmitEnabled"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">
                        Emissão Automática
                      </FormLabel>
                      <FormDescription>
                        Emitir CT-e automaticamente quando uma jornada for concluída
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Series Management */}
          <CTeSeriesManager />

          {/* Advanced Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  Configurações Avançadas
                  <Badge variant="secondary">Admin</Badge>
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="gap-1"
                >
                  {showAdvanced ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  {showAdvanced ? 'Ocultar' : 'Mostrar'}
                </Button>
              </CardTitle>
              <CardDescription>
                Configurações técnicas da integração com Nuvem Fiscal
              </CardDescription>
            </CardHeader>
            {showAdvanced && (
              <CardContent className="space-y-4">
                <div className="rounded-lg border p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Status da Integração</span>
                    {isConfigured ? (
                      <Badge variant="default" className="bg-green-600">Conectado</Badge>
                    ) : (
                      <Badge variant="outline">Não configurado</Badge>
                    )}
                  </div>
                  {settings?.nuvem_fiscal_company_id && (
                    <div className="text-xs text-muted-foreground font-mono">
                      ID: {settings.nuvem_fiscal_company_id}
                    </div>
                  )}
                </div>

                <FormField
                  control={form.control}
                  name="nuvemFiscalCompanyId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>ID da Empresa (Nuvem Fiscal)</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || ''}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione ou deixe em branco para auto-configurar" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {companies.map((company) => (
                            <SelectItem key={company.id} value={company.id}>
                              {company.nome} - {company.cnpj}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Empresa cadastrada manualmente na Nuvem Fiscal (opcional - auto-configurado no upload do certificado)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex gap-4">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={fetchNuvemFiscalCompanies}
                    disabled={loading}
                    className="gap-2"
                  >
                    <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                    Recarregar Empresas
                  </Button>
                </div>
              </CardContent>
            )}
          </Card>

          <div className="flex justify-end">
            <Button type="submit" disabled={saving} className="gap-2">
              <Save className="h-4 w-4" />
              {saving ? 'Salvando...' : 'Salvar Configurações'}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}