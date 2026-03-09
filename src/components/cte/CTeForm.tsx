import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMultiTenant } from '@/hooks/useMultiTenant';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { FileText, Save, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { validateCTeRequirements } from '@/lib/cteValidations';
import { CTeViewer } from './CTeViewer';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

const cteFormSchema = z.object({
  journeyId: z.string().optional(),
  createJourney: z.boolean().default(false),
  journeyNumber: z.string().optional(),
  origin: z.string().optional(),
  destination: z.string().optional(),
  series: z.string().min(1, 'Série é obrigatória'),
  recipientName: z.string().min(1, 'Nome do destinatário é obrigatório'),
  recipientDocument: z.string().min(1, 'Documento do destinatário é obrigatório'),
  recipientAddress: z.string().min(1, 'Endereço do destinatário é obrigatório'),
  senderName: z.string().min(1, 'Nome do remetente é obrigatório'),
  senderDocument: z.string().min(1, 'Documento do remetente é obrigatório'),
  senderAddress: z.string().min(1, 'Endereço do remetente é obrigatório'),
  freightValue: z.string().min(1, 'Valor do frete é obrigatório'),
  icmsValue: z.string().optional(),
});

type CTeFormData = z.infer<typeof cteFormSchema>;

interface CTeFormProps {
  onCancel: () => void;
  journeyId?: string;
}

export function CTeForm({ onCancel, journeyId }: CTeFormProps) {
  const [loading, setLoading] = useState(false);
  const [journeys, setJourneys] = useState<Array<{ id: string; journey_number: string; destination: string }>>([]);
  const [emittedCTe, setEmittedCTe] = useState<any>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const { currentCompany } = useMultiTenant();
  const { toast } = useToast();

  const form = useForm<CTeFormData>({
    resolver: zodResolver(cteFormSchema),
    defaultValues: {
      journeyId: journeyId || '',
      createJourney: false,
      journeyNumber: '',
      origin: '',
      destination: '',
      series: '1',
      recipientName: '',
      recipientDocument: '',
      recipientAddress: '',
      senderName: '',
      senderDocument: '',
      senderAddress: '',
      freightValue: '',
      icmsValue: '',
    },
  });

  useEffect(() => {
    if (currentCompany) {
      fetchJourneys();
      if (journeyId) {
        prefillFromJourney(journeyId);
      }
    }
  }, [currentCompany, journeyId]);

  const fetchJourneys = async () => {
    try {
      let query = supabase
        .from('journeys')
        .select('id, journey_number, destination, freight_value')
        .order('created_at', { ascending: false });

      if (currentCompany) {
        query = query.eq('company_id', currentCompany.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      setJourneys(data || []);
    } catch (error) {
      console.error('Error fetching journeys:', error);
    }
  };

  const prefillFromJourney = async (selectedJourneyId: string) => {
    try {
      const { data: journey, error } = await supabase
        .from('journeys')
        .select('*')
        .eq('id', selectedJourneyId)
        .single();

      if (error) throw error;

      if (journey) {
        // Prefill all available fields from journey
        form.setValue('freightValue', journey.freight_value?.toString() || '');
        form.setValue('origin', journey.origin || '');
        form.setValue('destination', journey.destination || '');
        
        // Set journey-based addresses if available
        if (journey.origin) {
          form.setValue('senderAddress', journey.origin);
        }
        if (journey.destination) {
          form.setValue('recipientAddress', journey.destination);
        }
      }
    } catch (error) {
      console.error('Error fetching journey details:', error);
    }
  };

  const onSubmit = async (data: CTeFormData) => {
    try {
      setLoading(true);
      setValidationErrors([]);

      // Pre-emission validations
      if (!currentCompany?.id) {
        throw new Error('Empresa não identificada');
      }

      const validation = await validateCTeRequirements(currentCompany.id);
      
      if (!validation.valid) {
        setValidationErrors(validation.errors);
        toast({
          title: "Validação falhou",
          description: "Verifique os requisitos antes de emitir o CT-e",
          variant: "destructive",
        });
        return;
      }

      const { data: response, error } = await supabase.functions.invoke('cte-issue', {
        body: {
          journeyId: data.journeyId || null,
          createJourney: data.createJourney,
          journeyData: data.createJourney ? {
            journeyNumber: data.journeyNumber,
            origin: data.origin,
            destination: data.destination,
            freightValue: parseFloat(data.freightValue),
          } : null,
          series: data.series,
          recipientName: data.recipientName,
          recipientDocument: data.recipientDocument,
          recipientAddress: data.recipientAddress,
          senderName: data.senderName,
          senderDocument: data.senderDocument,
          senderAddress: data.senderAddress,
          freightValue: parseFloat(data.freightValue),
          icmsValue: data.icmsValue ? parseFloat(data.icmsValue) : null,
        }
      });

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "CT-e emitido com sucesso",
      });

      // Show CT-e details
      if (response?.cte) {
        setEmittedCTe(response.cte);
      }
    } catch (error: any) {
      console.error('Error issuing CT-e:', error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao emitir CT-e",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // If CT-e was emitted successfully, show viewer
  if (emittedCTe) {
    return (
      <div className="space-y-6">
        <CTeViewer 
          cteData={emittedCTe} 
          onClose={() => {
            setEmittedCTe(null);
            onCancel();
          }} 
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          <h3 className="text-lg font-semibold">Novo CT-e</h3>
        </div>
        <Button variant="ghost" size="sm" onClick={onCancel}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {validationErrors.length > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <ul className="list-disc list-inside space-y-1">
              {validationErrors.map((error, index) => (
                <li key={index}>{error}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="journeyId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Jornada Existente (opcional)</FormLabel>
                  <Select 
                    onValueChange={(value) => {
                      field.onChange(value);
                      if (value) {
                        form.setValue('createJourney', false);
                        prefillFromJourney(value);
                      }
                    }} 
                    defaultValue={field.value}
                    disabled={form.watch('createJourney')}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione uma jornada" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {journeys.map((journey) => (
                        <SelectItem key={journey.id} value={journey.id}>
                          {journey.journey_number} - {journey.destination}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="series"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Série</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="createJourney"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <FormLabel className="text-base">
                    Criar Nova Jornada
                  </FormLabel>
                  <p className="text-sm text-muted-foreground">
                    Criar automaticamente uma nova jornada com os dados do CT-e
                  </p>
                </div>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={(checked) => {
                      field.onChange(checked);
                      if (checked) {
                        form.setValue('journeyId', '');
                      }
                    }}
                  />
                </FormControl>
              </FormItem>
            )}
          />

          {form.watch('createJourney') && (
            <Card>
              <CardHeader>
                <CardTitle>Dados da Nova Jornada</CardTitle>
                <CardDescription>Informações para criar a jornada automaticamente</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="journeyNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Número da Jornada</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Ex: J-2024-001" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="origin"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Origem</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Cidade de origem" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="destination"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Destino</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Cidade de destino" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Destinatário</CardTitle>
              <CardDescription>Informações do destinatário da carga</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="recipientName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome/Razão Social</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="recipientDocument"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>CPF/CNPJ</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="recipientAddress"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Endereço</FormLabel>
                    <FormControl>
                      <Textarea {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Remetente</CardTitle>
              <CardDescription>Informações do remetente da carga</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="senderName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome/Razão Social</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="senderDocument"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>CPF/CNPJ</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="senderAddress"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Endereço</FormLabel>
                    <FormControl>
                      <Textarea {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Valores</CardTitle>
              <CardDescription>Informações sobre valores do transporte</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="freightValue"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Valor do Frete</FormLabel>
                      <FormControl>
                        <Input {...field} type="number" step="0.01" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="icmsValue"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Valor do ICMS (opcional)</FormLabel>
                      <FormControl>
                        <Input {...field} type="number" step="0.01" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          <Separator />

          <div className="flex justify-end gap-4">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading} className="gap-2">
              <Save className="h-4 w-4" />
              {loading ? 'Emitindo...' : 'Emitir CT-e'}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}