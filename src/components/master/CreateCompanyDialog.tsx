import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, FileText, Link2 } from "lucide-react";

interface SubscriptionPlan {
  id: string;
  name: string;
  vehicle_limit: number;
  monthly_price: number;
  features: string[] | any;
}

const companySchema = z.object({
  // Dados da empresa
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  cnpj: z.string().min(14, "CNPJ deve ter 14 dígitos").max(18, "CNPJ inválido"),
  address: z.string().min(5, "Endereço deve ter pelo menos 5 caracteres"),
  city: z.string().min(2, "Cidade deve ter pelo menos 2 caracteres"),
  state: z.string().min(2, "Estado deve ter pelo menos 2 caracteres"),
  zip_code: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  
  // Responsável legal
  responsible_name: z.string().min(2, "Nome do responsável é obrigatório"),
  responsible_cpf: z.string().min(11, "CPF deve ter 11 dígitos"),
  
  // Plano
  subscription_plan_id: z.string().min(1, "Selecione um plano"),
  
  // Usuário admin
  admin_name: z.string().min(2, "Nome do admin é obrigatório"),
  admin_email: z.string().email("Email do admin inválido"),
  admin_phone: z.string().optional(),
  
  // Módulos Adicionais
  cte_module_enabled: z.boolean().default(false),
  cte_monthly_limit: z.number().min(1).nullable().optional(),
  coupling_module_enabled: z.boolean().default(false),
  coupling_asset_limit: z.number().min(1).nullable().optional(),
});

type CompanyFormData = z.infer<typeof companySchema>;

interface CreateCompanyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export default function CreateCompanyDialog({ open, onOpenChange, onSuccess }: CreateCompanyDialogProps) {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  const form = useForm<CompanyFormData>({
    resolver: zodResolver(companySchema),
    defaultValues: {
      name: "",
      cnpj: "",
      address: "",
      city: "",
      state: "",
      zip_code: "",
      phone: "",
      email: "",
      responsible_name: "",
      responsible_cpf: "",
      subscription_plan_id: "",
      admin_name: "",
      admin_email: "",
      admin_phone: "",
      // Módulos Adicionais
      cte_module_enabled: false,
      cte_monthly_limit: null,
      coupling_module_enabled: false,
      coupling_asset_limit: null,
    }
  });

  const fetchPlans = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('subscription_plans')
        .select('*')
        .eq('is_active', true)
        .order('vehicle_limit', { ascending: true });

      if (error) throw error;
      setPlans((data || []).map(p => ({
        ...p,
        features: Array.isArray(p.features) ? p.features : []
      })));
    } catch (error: any) {
      toast({
        title: "Erro ao carregar planos",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchPlans();
    }
  }, [open]);

  const handleSubmit = async (data: CompanyFormData) => {
    setSubmitting(true);
    try {
      // Get selected plan details
      const selectedPlan = plans.find(p => p.id === data.subscription_plan_id);
      if (!selectedPlan) throw new Error("Plano selecionado não encontrado");

      // Create company
      const { data: company, error: companyError } = await supabase
        .from('companies')
        .insert([{
          name: data.name,
          cnpj: data.cnpj.replace(/\D/g, ''),
          address: data.address,
          city: data.city,
          state: data.state,
          zip_code: data.zip_code || null,
          phone: data.phone || null,
          email: data.email || null,
          responsible_name: data.responsible_name,
          responsible_cpf: data.responsible_cpf.replace(/\D/g, ''),
          subscription_plan_id: data.subscription_plan_id,
          vehicle_limit: selectedPlan.vehicle_limit,
          subscription_status: 'active',
          // Módulos Adicionais
          cte_module_enabled: data.cte_module_enabled,
          cte_monthly_limit: data.cte_module_enabled ? data.cte_monthly_limit : null,
          coupling_module_enabled: data.coupling_module_enabled,
          coupling_asset_limit: data.coupling_module_enabled ? data.coupling_asset_limit : null,
        }])
        .select()
        .single();

      if (companyError) throw companyError;

      // Create admin user via edge function
      const { data: userResult, error: userError } = await supabase.functions.invoke('create-user', {
        body: {
          email: data.admin_email,
          full_name: data.admin_name,
          phone: data.admin_phone || null,
          company_id: company.id,
          role: 'admin'
        }
      });

      if (userError) throw userError;

      toast({
        title: "Empresa criada com sucesso",
        description: `Empresa ${data.name} e usuário admin criados. Credenciais enviadas por email.`
      });

      form.reset();
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      toast({
        title: "Erro ao criar empresa",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setSubmitting(false);
    }
  };

  const selectedPlan = plans.find(p => p.id === form.watch('subscription_plan_id'));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova Empresa</DialogTitle>
          <DialogDescription>
            Crie uma nova empresa e seu usuário administrador
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            {/* Dados da Empresa */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Dados da Empresa</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome da Empresa</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Ex: Transportes ABC Ltda" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="cnpj"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>CNPJ</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="00.000.000/0001-00" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>Endereço</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Rua, número, bairro" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="city"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cidade</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="São Paulo" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="state"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Estado</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="SP" maxLength={2} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="zip_code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>CEP</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="00000-000" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Telefone</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="(11) 99999-9999" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input {...field} type="email" placeholder="contato@empresa.com" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Responsável Legal */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Responsável Legal</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="responsible_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome Completo</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="João da Silva" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="responsible_cpf"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>CPF</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="000.000.000-00" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Plano */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Plano de Assinatura</h3>
              <FormField
                control={form.control}
                name="subscription_plan_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Selecione o Plano</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="bg-background">
                          <SelectValue placeholder="Escolha um plano" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="bg-background border z-50">
                        {loading ? (
                          <SelectItem value="loading" disabled>Carregando planos...</SelectItem>
                        ) : (
                          plans.map((plan) => (
                            <SelectItem key={plan.id} value={plan.id}>
                              {plan.name} - Até {plan.vehicle_limit} placas - R$ {plan.monthly_price.toFixed(2)}/mês
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {selectedPlan && (
                <div className="p-3 bg-muted rounded-lg">
                  <h4 className="font-medium mb-2">Recursos do plano {selectedPlan.name}:</h4>
                  <ul className="text-sm space-y-1">
                    {selectedPlan.features.map((feature, index) => (
                      <li key={index}>• {feature}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Usuário Admin */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Usuário Administrador</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="admin_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome Completo</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Maria Santos" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="admin_email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input {...field} type="email" placeholder="admin@empresa.com" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="admin_phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Telefone</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="(11) 99999-9999" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
            </div>

            {/* Módulos Adicionais */}
            <div className="space-y-4">
              <Separator />
              <h3 className="text-lg font-medium flex items-center gap-2">
                Módulos Adicionais
              </h3>
              <p className="text-sm text-muted-foreground">
                Habilite módulos extras independentes do plano base
              </p>
              
              {/* Grupo A: CT-e */}
              <div className="border rounded-lg p-4 space-y-4">
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  <span className="font-medium">Emissão de CT-e</span>
                </div>
                
                <FormField
                  control={form.control}
                  name="cte_module_enabled"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Habilitar Módulo CT-e</FormLabel>
                        <p className="text-sm text-muted-foreground">
                          Permite emissão de Conhecimento de Transporte Eletrônico
                        </p>
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
                
                {form.watch('cte_module_enabled') && (
                  <div className="space-y-3">
                    <FormLabel>Pacote de Emissões CT-e</FormLabel>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { limit: 20, label: 'Pacote P', price: 'R$ 69,90/mês' },
                        { limit: 50, label: 'Pacote M', price: 'R$ 99,90/mês' },
                        { limit: 200, label: 'Pacote G', price: 'R$ 249,90/mês' },
                      ].map((pkg) => {
                        const isSelected = form.watch('cte_monthly_limit') === pkg.limit;
                        return (
                          <button
                            key={pkg.limit}
                            type="button"
                            onClick={() => form.setValue('cte_monthly_limit', pkg.limit)}
                            className={`p-3 rounded-lg border-2 text-left transition-all ${
                              isSelected 
                                ? 'border-primary bg-primary/5' 
                                : 'border-border hover:border-primary/50'
                            }`}
                          >
                            <div className="font-medium text-sm">{pkg.label}</div>
                            <div className="text-xs text-muted-foreground">{pkg.limit} CT-e/mês</div>
                            <div className="text-xs font-semibold text-primary mt-1">{pkg.price}</div>
                          </button>
                        );
                      })}
                      <button
                        type="button"
                        onClick={() => form.setValue('cte_monthly_limit', null)}
                        className={`p-3 rounded-lg border-2 text-left transition-all ${
                          form.watch('cte_monthly_limit') !== 20 && 
                          form.watch('cte_monthly_limit') !== 50 && 
                          form.watch('cte_monthly_limit') !== 200
                            ? 'border-primary bg-primary/5' 
                            : 'border-border hover:border-primary/50'
                        }`}
                      >
                        <div className="font-medium text-sm">Personalizado</div>
                        <div className="text-xs text-muted-foreground">Limite livre</div>
                        <div className="text-xs font-semibold text-primary mt-1">Valor sob consulta</div>
                      </button>
                    </div>
                    {form.watch('cte_monthly_limit') !== 20 && 
                     form.watch('cte_monthly_limit') !== 50 && 
                     form.watch('cte_monthly_limit') !== 200 && (
                      <FormField
                        control={form.control}
                        name="cte_monthly_limit"
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Input 
                                type="number" 
                                min={1}
                                value={field.value ?? ''}
                                onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : null)}
                                placeholder="Digite o limite personalizado"
                              />
                            </FormControl>
                            <p className="text-xs text-muted-foreground">
                              Deixe vazio para ilimitado
                            </p>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}
                  </div>
                )}
              </div>
              
              {/* Grupo B: Engates */}
              <div className="border rounded-lg p-4 space-y-4">
                <div className="flex items-center gap-2">
                  <Link2 className="h-5 w-5 text-primary" />
                  <span className="font-medium">Gestão de Engates</span>
                </div>
                
                <FormField
                  control={form.control}
                  name="coupling_module_enabled"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Habilitar Gestão de Engates</FormLabel>
                        <p className="text-sm text-muted-foreground">
                          Permite gerenciar engates entre cavalos e carretas
                        </p>
                        <p className="text-xs font-medium text-primary">
                          Custo base: R$ 29,90 por carreta cadastrada
                        </p>
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
                
                {form.watch('coupling_module_enabled') && (
                  <FormField
                    control={form.control}
                    name="coupling_asset_limit"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Limite de Engates/Reboques</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            min={1}
                            value={field.value ?? ''}
                            onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : null)}
                            placeholder="Deixe vazio para ilimitado"
                          />
                        </FormControl>
                        <p className="text-xs text-muted-foreground">
                          Quantidade máxima de engates permitidos (vazio = ilimitado)
                        </p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>
            </div>
            </div>

            <div className="flex gap-3 pt-4">
              <Button type="submit" disabled={submitting} className="flex-1">
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {submitting ? 'Criando...' : 'Criar Empresa'}
              </Button>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}