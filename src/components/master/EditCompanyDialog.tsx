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
  price_per_vehicle?: number;
}


const companySchema = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  cnpj: z.string().min(14, "CNPJ deve ter 14 dígitos").max(18, "CNPJ inválido"),
  address: z.string().min(5, "Endereço deve ter pelo menos 5 caracteres"),
  city: z.string().min(2, "Cidade deve ter pelo menos 2 caracteres"),
  state: z.string().min(2, "Estado deve ter pelo menos 2 caracteres"),
  zip_code: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  responsible_name: z.string().min(2, "Nome do responsável é obrigatório"),
  responsible_cpf: z.string().min(11, "CPF deve ter 11 dígitos"),
  subscription_plan_id: z.string().optional(),
  vehicle_limit: z.number().min(1, "Mínimo 1 veículo").max(999, "Máximo 999"),
  contracted_price_per_vehicle: z.number().min(0).optional(),
  status: z.enum(['active', 'suspended', 'inactive']),
  // Módulos Adicionais
  cte_module_enabled: z.boolean().default(false),
  cte_monthly_limit: z.number().min(1).nullable().optional(),
  coupling_module_enabled: z.boolean().default(false),
  coupling_asset_limit: z.number().min(1).nullable().optional(),
});

type CompanyFormData = z.infer<typeof companySchema>;

interface Company {
  id: string;
  name: string;
  cnpj: string;
  address: string;
  city?: string;
  state?: string;
  zip_code?: string;
  phone?: string;
  email?: string;
  responsible_name: string;
  responsible_cpf: string;
  status: string;
  subscription_plan_id?: string;
  vehicle_limit?: number;
  contracted_price_per_vehicle?: number;
  // Módulos Adicionais
  cte_module_enabled?: boolean;
  cte_monthly_limit?: number | null;
  coupling_module_enabled?: boolean;
  coupling_asset_limit?: number | null;
}

interface EditCompanyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  company: Company | null;
}

export default function EditCompanyDialog({ open, onOpenChange, onSuccess, company }: EditCompanyDialogProps) {
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
      vehicle_limit: 5,
      contracted_price_per_vehicle: 0,
      status: "active",
      // Módulos Adicionais
      cte_module_enabled: false,
      cte_monthly_limit: null,
      coupling_module_enabled: false,
      coupling_asset_limit: null,
    }
  });

  useEffect(() => {
    if (open && company) {
      form.reset({
        name: company.name,
        cnpj: company.cnpj,
        address: company.address,
        city: company.city || "",
        state: company.state || "",
        zip_code: company.zip_code || "",
        phone: company.phone || "",
        email: company.email || "",
        responsible_name: company.responsible_name,
        responsible_cpf: company.responsible_cpf,
        subscription_plan_id: company.subscription_plan_id || "",
        vehicle_limit: company.vehicle_limit || 5,
        contracted_price_per_vehicle: company.contracted_price_per_vehicle || 0,
        status: company.status as 'active' | 'suspended' | 'inactive',
        // Módulos Adicionais
        cte_module_enabled: company.cte_module_enabled || false,
        cte_monthly_limit: company.cte_monthly_limit || null,
        coupling_module_enabled: company.coupling_module_enabled || false,
        coupling_asset_limit: company.coupling_asset_limit || null,
      });
    }
  }, [open, company, form]);

  const fetchPlans = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('subscription_plans')
        .select('*')
        .eq('is_active', true)
        .order('vehicle_limit', { ascending: true });

      if (error) throw error;
      setPlans(data || []);
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
    if (!company) return;

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('companies')
        .update({
          name: data.name,
          cnpj: data.cnpj,
          address: data.address,
          city: data.city,
          state: data.state,
          zip_code: data.zip_code,
          phone: data.phone,
          email: data.email,
          responsible_name: data.responsible_name,
          responsible_cpf: data.responsible_cpf,
          subscription_plan_id: data.subscription_plan_id || null,
          vehicle_limit: data.vehicle_limit,
          contracted_price_per_vehicle: data.contracted_price_per_vehicle || null,
          status: data.status,
          // Módulos Adicionais - limpa limite se módulo desabilitado
          cte_module_enabled: data.cte_module_enabled,
          cte_monthly_limit: data.cte_module_enabled ? data.cte_monthly_limit : null,
          coupling_module_enabled: data.coupling_module_enabled,
          coupling_asset_limit: data.coupling_module_enabled ? data.coupling_asset_limit : null,
        })
        .eq('id', company.id);

      if (error) throw error;

      toast({
        title: "Sucesso!",
        description: "Empresa atualizada com sucesso"
      });

      form.reset();
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      toast({
        title: "Erro ao atualizar empresa",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Empresa</DialogTitle>
          <DialogDescription>
            Atualize as informações da empresa
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Dados da Empresa</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome da Empresa</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Nome da empresa" />
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
                        <Input {...field} placeholder="00.000.000/0000-00" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Endereço</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Rua, número, complemento" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="city"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cidade</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Cidade" />
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
                        <Input {...field} placeholder="UF" maxLength={2} />
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
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Telefone</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="(00) 00000-0000" />
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
                        <Input {...field} type="email" placeholder="email@empresa.com" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Responsável Legal</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="responsible_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome do Responsável</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Nome completo" />
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
                      <FormLabel>CPF do Responsável</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="000.000.000-00" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Plano e Status</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="subscription_plan_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Plano de Assinatura</FormLabel>
                      <Select 
                        onValueChange={(value) => {
                          field.onChange(value);
                          const selectedPlan = plans.find(p => p.id === value);
                          if (selectedPlan) {
                            const price = selectedPlan.price_per_vehicle || selectedPlan.monthly_price;
                            form.setValue('contracted_price_per_vehicle', price);
                          }
                        }} 
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione um plano" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {loading ? (
                            <SelectItem value="loading" disabled>Carregando...</SelectItem>
                          ) : (
                            plans.map(plan => (
                              <SelectItem key={plan.id} value={plan.id}>
                                {plan.name}
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="contracted_price_per_vehicle"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Valor por Placa (R$)</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          step="0.01"
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                          placeholder="0.00"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="vehicle_limit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Limite de Veículos</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 5)}
                          min={1}
                          max={999}
                          placeholder="999 = ilimitado"
                        />
                      </FormControl>
                      <p className="text-xs text-muted-foreground">Use 999 para ilimitado</p>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormItem>
                  <FormLabel>Valor Total Mensal</FormLabel>
                  <div className="h-10 px-3 py-2 bg-muted rounded-md text-lg font-semibold flex items-center">
                    R$ {((form.watch('contracted_price_per_vehicle') || 0) * (form.watch('vehicle_limit') || 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </FormItem>
              </div>

              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="active">Ativo</SelectItem>
                        <SelectItem value="suspended">Suspenso</SelectItem>
                        <SelectItem value="inactive">Inativo</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Módulos Adicionais */}
            <div className="space-y-4">
              <Separator />
              <h3 className="text-lg font-semibold flex items-center gap-2">
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

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={submitting}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar Alterações
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
