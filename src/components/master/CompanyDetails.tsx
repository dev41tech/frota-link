import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Building2, Users, Car, DollarSign, Activity, Loader2, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface CompanyDetailsProps {
  companyId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRefresh?: () => void;
}

interface CompanyDetail {
  id: string;
  name: string;
  cnpj: string;
  status: string;
  address: string;
  city: string;
  state: string;
  responsible_name: string;
  responsible_cpf: string;
  email: string;
  phone: string;
  subscription_plan: {
    name: string;
    monthly_price: number;
    price_per_vehicle: number;
  } | null;
  vehicle_count: number;
  vehicle_limit: number;
  user_count: number;
  journey_count: number;
  total_revenue: number;
  total_expenses: number;
  created_at: string;
  subscription_started_at: string;
  next_billing_date: string;
}

export function CompanyDetails({ companyId, open, onOpenChange, onRefresh }: CompanyDetailsProps) {
  const [company, setCompany] = useState<CompanyDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [vehicleLimit, setVehicleLimit] = useState<number>(5);
  const [savingLimit, setSavingLimit] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (companyId && open) {
      fetchCompanyDetails();
    }
  }, [companyId, open]);

  const fetchCompanyDetails = async () => {
    if (!companyId) return;
    
    setLoading(true);
    try {
      const { data: companyData, error: companyError } = await supabase
        .from("companies")
        .select(`
          *,
          subscription_plan:subscription_plans(name, monthly_price, price_per_vehicle)
        `)
        .eq("id", companyId)
        .single();

      if (companyError) throw companyError;

      const { count: vehicleCount } = await supabase
        .from("vehicles")
        .select("*", { count: "exact", head: true })
        .eq("company_id", companyId);

      const { count: userCount } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .eq("company_id", companyId);

      const { count: journeyCount } = await supabase
        .from("journeys")
        .select("*", { count: "exact", head: true })
        .eq("company_id", companyId);

      const { data: revenueData } = await supabase
        .from("revenue")
        .select("amount")
        .eq("company_id", companyId);

      const { data: expensesData } = await supabase
        .from("expenses")
        .select("amount")
        .eq("company_id", companyId);

      const totalRevenue = revenueData?.reduce((sum, r) => sum + Number(r.amount), 0) || 0;
      const totalExpenses = expensesData?.reduce((sum, e) => sum + Number(e.amount), 0) || 0;

      const companyDetail = {
        ...companyData,
        subscription_plan: companyData.subscription_plan,
        vehicle_count: vehicleCount || 0,
        vehicle_limit: companyData.vehicle_limit || 5,
        user_count: userCount || 0,
        journey_count: journeyCount || 0,
        total_revenue: totalRevenue,
        total_expenses: totalExpenses,
      };
      setCompany(companyDetail);
      setVehicleLimit(companyDetail.vehicle_limit);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar detalhes",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const updateVehicleLimit = async () => {
    if (!company) return;
    
    setSavingLimit(true);
    try {
      const { error } = await supabase
        .from("companies")
        .update({ vehicle_limit: vehicleLimit })
        .eq("id", company.id);

      if (error) throw error;

      setCompany({ ...company, vehicle_limit: vehicleLimit });
      toast({
        title: "Limite atualizado",
        description: `Limite de veículos alterado para ${vehicleLimit === 999 ? "ilimitado" : vehicleLimit}`,
      });
      onRefresh?.();
    } catch (error: any) {
      toast({
        title: "Erro ao atualizar limite",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSavingLimit(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("pt-BR");
  };

  if (!company && !loading) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Detalhes da Empresa
          </SheetTitle>
        </SheetHeader>

        {loading ? (
          <div className="space-y-4 mt-6">
            <div className="h-20 bg-muted animate-pulse rounded-lg" />
            <div className="h-20 bg-muted animate-pulse rounded-lg" />
            <div className="h-20 bg-muted animate-pulse rounded-lg" />
          </div>
        ) : company ? (
          <div className="space-y-6 mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Informações Gerais</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-sm text-muted-foreground">Nome</p>
                  <p className="font-medium">{company.name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">CNPJ</p>
                  <p className="font-medium">{company.cnpj}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <Badge variant={company.status === "active" ? "default" : "destructive"}>
                    {company.status === "active" ? "Ativo" : "Suspenso"}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Responsável</p>
                  <p className="font-medium">{company.responsible_name}</p>
                  <p className="text-sm text-muted-foreground">CPF: {company.responsible_cpf}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Endereço</p>
                  <p className="font-medium">
                    {company.address}, {company.city} - {company.state}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Contato</p>
                  <p className="font-medium">{company.email}</p>
                  <p className="text-sm text-muted-foreground">{company.phone}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Assinatura</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-sm text-muted-foreground">Plano</p>
                  <p className="font-medium">{company.subscription_plan?.name || "Sem plano"}</p>
                </div>
                {company.subscription_plan?.price_per_vehicle && (
                  <div>
                    <p className="text-sm text-muted-foreground">Preço por Placa</p>
                    <p className="font-medium">
                      {formatCurrency(Number(company.subscription_plan.price_per_vehicle))}
                    </p>
                  </div>
                )}
                <div>
                  <p className="text-sm text-muted-foreground">Limite de Veículos</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Input
                      type="number"
                      value={vehicleLimit}
                      onChange={(e) => setVehicleLimit(parseInt(e.target.value) || 0)}
                      className="w-24"
                      min={1}
                      max={999}
                    />
                    <Button 
                      size="sm" 
                      onClick={updateVehicleLimit}
                      disabled={savingLimit || vehicleLimit === company.vehicle_limit}
                    >
                      {savingLimit ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Usando: {company.vehicle_count} de {company.vehicle_limit === 999 ? "∞" : company.vehicle_limit} placas
                  </p>
                  {company.vehicle_count >= company.vehicle_limit && company.vehicle_limit !== 999 && (
                    <Badge variant="destructive" className="mt-1">Limite atingido</Badge>
                  )}
                </div>
                {company.subscription_plan?.price_per_vehicle && (
                  <div>
                    <p className="text-sm text-muted-foreground">Valor Mensal Contratado</p>
                    <p className="font-medium">
                      {company.vehicle_limit === 999 ? "Ilimitado" : company.vehicle_limit} × {formatCurrency(Number(company.subscription_plan.price_per_vehicle))} = {" "}
                      <span className="text-primary font-bold">
                        {company.vehicle_limit === 999 
                          ? "Sob consulta" 
                          : formatCurrency(company.vehicle_limit * Number(company.subscription_plan.price_per_vehicle))}
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Placas em uso: {company.vehicle_count} de {company.vehicle_limit === 999 ? "∞" : company.vehicle_limit}
                    </p>
                  </div>
                )}
                <div>
                  <p className="text-sm text-muted-foreground">Iniciado em</p>
                  <p className="font-medium">{formatDate(company.subscription_started_at)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Próxima cobrança</p>
                  <p className="font-medium">{formatDate(company.next_billing_date)}</p>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-2 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2">
                    <Car className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-2xl font-bold">{company.vehicle_count}</p>
                      <p className="text-sm text-muted-foreground">Veículos</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-2xl font-bold">{company.user_count}</p>
                      <p className="text-sm text-muted-foreground">Usuários</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2">
                    <Activity className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-2xl font-bold">{company.journey_count}</p>
                      <p className="text-sm text-muted-foreground">Viagens</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-2xl font-bold">
                        {formatCurrency(company.total_revenue - company.total_expenses)}
                      </p>
                      <p className="text-sm text-muted-foreground">Lucro Total</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Financeiro</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-sm text-muted-foreground">Receita Total</p>
                  <p className="font-medium text-green-600">
                    {formatCurrency(company.total_revenue)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Despesas Totais</p>
                  <p className="font-medium text-red-600">
                    {formatCurrency(company.total_expenses)}
                  </p>
                </div>
              </CardContent>
            </Card>

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  // Implementar edição
                  toast({
                    title: "Em desenvolvimento",
                    description: "Função de edição em breve",
                  });
                }}
              >
                Editar
              </Button>
              <Button
                variant={company.status === "active" ? "destructive" : "default"}
                className="flex-1"
                onClick={() => {
                  // Implementar toggle status
                  toast({
                    title: "Em desenvolvimento",
                    description: "Função de suspender/ativar em breve",
                  });
                }}
              >
                {company.status === "active" ? "Suspender" : "Ativar"}
              </Button>
            </div>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
