import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Trash2, Users, Check, X, Truck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Separator } from "@/components/ui/separator";

interface SubscriptionPlan {
  id: string;
  name: string;
  vehicle_limit: number;
  monthly_price: number;
  price_per_vehicle: number;
  min_price: number;
  pricing_model: string;
  features: string[] | any;
  is_active: boolean;
  has_simulator: boolean;
  has_ai: boolean;
  has_copilot: boolean;
  has_pwa_driver: boolean;
  has_dedicated_support: boolean;
  companies_count?: number;
}

const planSchema = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  vehicle_limit: z.number().min(1, "Limite deve ser pelo menos 1"),
  price_per_vehicle: z.number().min(0, "Preço deve ser positivo"),
  min_price: z.number().min(0, "Preço mínimo deve ser positivo"),
  features: z.string(),
  is_active: z.boolean().default(true),
  has_simulator: z.boolean().default(false),
  has_ai: z.boolean().default(false),
  has_copilot: z.boolean().default(false),
  has_pwa_driver: z.boolean().default(false),
  has_dedicated_support: z.boolean().default(false),
});

type PlanFormData = z.infer<typeof planSchema>;

export default function Plans() {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<SubscriptionPlan | null>(null);
  const { toast } = useToast();

  const form = useForm<PlanFormData>({
    resolver: zodResolver(planSchema),
    defaultValues: {
      name: "",
      vehicle_limit: 999,
      price_per_vehicle: 0,
      min_price: 0,
      features: "",
      is_active: true,
      has_simulator: false,
      has_ai: false,
      has_copilot: false,
      has_pwa_driver: false,
      has_dedicated_support: false,
    }
  });

  const fetchPlans = async () => {
    try {
      const { data: plansData, error: plansError } = await supabase
        .from('subscription_plans')
        .select('*')
        .order('monthly_price', { ascending: true });

      if (plansError) throw plansError;

      // Get companies count for each plan
      const plansWithCounts = await Promise.all(
        (plansData || []).map(async (plan) => {
          const { count } = await supabase
            .from('companies')
            .select('*', { count: 'exact', head: true })
            .eq('subscription_plan_id', plan.id);
          
          return {
            ...plan,
            companies_count: count || 0
          };
        })
      );

      setPlans(plansWithCounts.map(p => ({
        ...p,
        features: Array.isArray(p.features) ? p.features : [],
        price_per_vehicle: (p as any).price_per_vehicle ?? 0,
        min_price: (p as any).min_price ?? 0,
        pricing_model: (p as any).pricing_model ?? 'per_vehicle',
        has_simulator: (p as any).has_simulator ?? false,
        has_ai: (p as any).has_ai ?? false,
        has_copilot: (p as any).has_copilot ?? false,
        has_pwa_driver: (p as any).has_pwa_driver ?? false,
        has_dedicated_support: (p as any).has_dedicated_support ?? false,
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
    fetchPlans();
  }, []);

  const handleSubmit = async (data: PlanFormData) => {
    try {
      const planData = {
        name: data.name,
        vehicle_limit: data.vehicle_limit,
        monthly_price: data.price_per_vehicle, // Keep for compatibility
        price_per_vehicle: data.price_per_vehicle,
        min_price: data.min_price,
        pricing_model: 'per_vehicle',
        features: data.features.split('\n').filter(f => f.trim()),
        is_active: data.is_active,
        has_simulator: data.has_simulator,
        has_ai: data.has_ai,
        has_copilot: data.has_copilot,
        has_pwa_driver: data.has_pwa_driver,
        has_dedicated_support: data.has_dedicated_support,
      };

      if (editingPlan) {
        const { error } = await supabase
          .from('subscription_plans')
          .update(planData)
          .eq('id', editingPlan.id);

        if (error) throw error;

        toast({
          title: "Plano atualizado",
          description: "O plano foi atualizado com sucesso."
        });
      } else {
        const { error } = await supabase
          .from('subscription_plans')
          .insert([planData]);

        if (error) throw error;

        toast({
          title: "Plano criado",
          description: "O novo plano foi criado com sucesso."
        });
      }

      setDialogOpen(false);
      setEditingPlan(null);
      form.reset();
      fetchPlans();
    } catch (error: any) {
      toast({
        title: "Erro ao salvar plano",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const handleEdit = (plan: SubscriptionPlan) => {
    setEditingPlan(plan);
    form.reset({
      name: plan.name,
      vehicle_limit: plan.vehicle_limit,
      price_per_vehicle: plan.price_per_vehicle || plan.monthly_price,
      min_price: plan.min_price || 0,
      features: plan.features.join('\n'),
      is_active: plan.is_active,
      has_simulator: plan.has_simulator,
      has_ai: plan.has_ai,
      has_copilot: plan.has_copilot,
      has_pwa_driver: plan.has_pwa_driver,
      has_dedicated_support: plan.has_dedicated_support,
    });
    setDialogOpen(true);
  };

  const handleDelete = async (planId: string) => {
    if (!confirm("Tem certeza que deseja excluir este plano?")) return;

    try {
      const { error } = await supabase
        .from('subscription_plans')
        .delete()
        .eq('id', planId);

      if (error) throw error;

      toast({
        title: "Plano excluído",
        description: "O plano foi excluído com sucesso."
      });
      fetchPlans();
    } catch (error: any) {
      toast({
        title: "Erro ao excluir plano",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const resetForm = () => {
    setEditingPlan(null);
    form.reset({
      name: "",
      vehicle_limit: 999,
      price_per_vehicle: 0,
      min_price: 0,
      features: "",
      is_active: true,
      has_simulator: false,
      has_ai: false,
      has_copilot: false,
      has_pwa_driver: false,
      has_dedicated_support: false,
    });
  };

  const FeatureIndicator = ({ enabled, label }: { enabled: boolean; label: string }) => (
    <div className="flex items-center gap-2 text-sm">
      {enabled ? (
        <Check className="h-4 w-4 text-green-500" />
      ) : (
        <X className="h-4 w-4 text-muted-foreground" />
      )}
      <span className={enabled ? 'text-foreground' : 'text-muted-foreground'}>
        {label}
      </span>
    </div>
  );

  if (loading) {
    return <div className="flex items-center justify-center p-8">Carregando planos...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Planos de Assinatura</h1>
          <p className="text-muted-foreground">Gerencie os planos por placa disponíveis para as empresas</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Novo Plano
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingPlan ? 'Editar Plano' : 'Novo Plano'}</DialogTitle>
              <DialogDescription>
                {editingPlan ? 'Edite as informações do plano' : 'Crie um novo plano de assinatura por placa'}
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome do Plano</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Ex: Pro, Enterprise" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="price_per_vehicle"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Preço por Placa (R$)</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            type="number" 
                            step="0.01"
                            min="0"
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                          />
                        </FormControl>
                        <FormDescription>Valor cobrado por veículo</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="min_price"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Preço Mínimo (R$)</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            type="number" 
                            step="0.01"
                            min="0"
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                          />
                        </FormControl>
                        <FormDescription>Valor mínimo mensal</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="vehicle_limit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Limite de Placas</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          type="number" 
                          min="1"
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormDescription>Use 999 para ilimitado</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Separator />
                
                <div className="space-y-3">
                  <h4 className="font-medium">Recursos do Plano</h4>
                  
                  <FormField
                    control={form.control}
                    name="has_simulator"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between">
                        <FormLabel className="font-normal">Simulador de Frete</FormLabel>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="has_ai"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between">
                        <FormLabel className="font-normal">Assistente IA</FormLabel>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="has_copilot"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between">
                        <FormLabel className="font-normal">Copilot Flutuante</FormLabel>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="has_pwa_driver"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between">
                        <FormLabel className="font-normal">PWA Motorista</FormLabel>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="has_dedicated_support"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between">
                        <FormLabel className="font-normal">Suporte Dedicado</FormLabel>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>

                <Separator />

                <FormField
                  control={form.control}
                  name="features"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Descrição Adicional (um por linha)</FormLabel>
                      <FormControl>
                        <Textarea 
                          {...field} 
                          placeholder="Gestão completa da frota&#10;Relatórios avançados&#10;Suporte prioritário"
                          rows={3}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="is_active"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between">
                      <FormLabel>Plano Ativo</FormLabel>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                
                <div className="flex gap-2 pt-4">
                  <Button type="submit" className="flex-1">
                    {editingPlan ? 'Atualizar' : 'Criar'} Plano
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setDialogOpen(false)}
                  >
                    Cancelar
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {plans.map((plan) => (
          <Card key={plan.id} className={`relative ${!plan.is_active ? 'opacity-60' : ''}`}>
            <CardHeader className="pb-2">
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    {plan.name}
                    {!plan.is_active && <Badge variant="secondary">Inativo</Badge>}
                  </CardTitle>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => handleEdit(plan)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => handleDelete(plan.id)}
                    disabled={plan.companies_count! > 0}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="mt-2">
                <p className="text-3xl font-bold text-primary">
                  R$ {(plan.price_per_vehicle || plan.monthly_price).toFixed(2)}
                </p>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <Truck className="h-3 w-3" />
                  por placa / mês
                </p>
                {plan.min_price > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Mínimo: R$ {plan.min_price.toFixed(2)}/mês
                  </p>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-sm text-muted-foreground flex items-center gap-1">
                <Users className="h-4 w-4" />
                {plan.companies_count} empresas usando
              </div>
              
              <Separator />
              
              <div className="space-y-2">
                <FeatureIndicator enabled={plan.has_simulator} label="Simulador de Frete" />
                <FeatureIndicator enabled={plan.has_ai} label="Assistente IA" />
                <FeatureIndicator enabled={plan.has_copilot} label="Copilot Flutuante" />
                <FeatureIndicator enabled={plan.has_pwa_driver} label="PWA Motorista" />
                <FeatureIndicator enabled={plan.has_dedicated_support} label="Suporte Dedicado" />
              </div>
              
              {plan.features.length > 0 && (
                <>
                  <Separator />
                  <div className="space-y-1">
                    {plan.features.map((feature: string, index: number) => (
                      <p key={index} className="text-sm text-muted-foreground flex items-start gap-2">
                        <Check className="h-3 w-3 text-green-500 mt-1 flex-shrink-0" />
                        {feature}
                      </p>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {plans.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground">
              Nenhum plano encontrado. Crie o primeiro plano para começar.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
