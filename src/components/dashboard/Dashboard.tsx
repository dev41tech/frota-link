import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useMultiTenant } from "@/hooks/useMultiTenant";
import { useStaffAccess } from "@/hooks/useStaffAccess";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

// Componentes UI
import StatsCard from "./StatsCard";
import VehicleCard from "./VehicleCard";
import FleetConsumptionOverview from "@/components/vehicles/FleetConsumptionOverview";
import { DashboardFilters } from "./DashboardFilters";
import { TrendCharts } from "./TrendCharts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

// Ícones
import {
  Truck,
  DollarSign,
  TrendingUp,
  Fuel,
  Calendar,
  Plus,
  Filter,
  Route,
  FileText,
  Receipt,
  CreditCard,
  AlertTriangle,
  ArrowRight,
} from "lucide-react";
import * as LucideIcons from "lucide-react";

// --- Interfaces para Tipagem Estrita (Resolve problemas de inferência) ---

interface DashboardFiltersState {
  preset: "7d" | "15d" | "30d" | "60d" | "90d" | "custom";
  startDate: Date;
  endDate: Date;
  vehicleIds: string[];
  driverIds: string[];
  statusList: string[];
}

interface DashboardDataState {
  vehicles: any[];
  journeys: any[];
  revenue: any[];
  expenses: any[];
  fuelExpenses: any[];
  maintenances: any[];
  paidOrphanAccounts: any[];
  drivers: any[];
  revenueTimeSeries: Array<{ date: string; amount: number }>;
  expensesTimeSeries: Array<{ date: string; amount: number }>;
  fuelTimeSeries: Array<{ date: string; amount: number }>;
}

// --- Hook de Lógica ---

function useDashboardStats(companyId: string | undefined, user: any) {
  const [loading, setLoading] = useState(!!companyId); // Só inicia loading se há companyId
  const [filters, setFilters] = useState<DashboardFiltersState>({
    preset: "30d",
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    endDate: new Date(),
    vehicleIds: [],
    driverIds: [],
    statusList: [],
  });

  const [data, setData] = useState<DashboardDataState>({
    vehicles: [],
    journeys: [],
    revenue: [],
    expenses: [],
    fuelExpenses: [],
    maintenances: [],
    paidOrphanAccounts: [],
    drivers: [],
    revenueTimeSeries: [],
    expensesTimeSeries: [],
    fuelTimeSeries: [],
  });

  const fetchData = useCallback(async () => {
    if (!companyId || !user) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const startIso = filters.startDate.toISOString();
      const endIso = filters.endDate.toISOString();

      // Construção das Queries com filtro de soft delete
      let qVehicles = supabase.from("vehicles").select("*").eq("company_id", companyId);
      let qJourneys = supabase.from("journeys").select("*").eq("company_id", companyId).is("deleted_at", null);
      let qRevenue = supabase
        .from("revenue")
        .select("*")
        .eq("company_id", companyId)
        .is("deleted_at", null)
        .gte("date", startIso)
        .lte("date", endIso);

      // Select complexo que geralmente causa o erro TS2589
      let qExpenses = supabase
        .from("expenses")
        .select(`*, expense_categories!inner(name, icon, color)`)
        .eq("company_id", companyId)
        .is("deleted_at", null)
        .gte("date", startIso)
        .lte("date", endIso);

      let qFuel = supabase
        .from("fuel_expenses")
        .select("*")
        .eq("company_id", companyId)
        .is("deleted_at", null)
        .gte("date", startIso)
        .lte("date", endIso);

      // Query para manutenções concluídas no período
      let qMaintenance = supabase
        .from("vehicle_maintenances")
        .select("id, total_cost, service_category, vehicle_id, service_date")
        .eq("company_id", companyId)
        .eq("status", "completed")
        .is("deleted_at", null)
        .gte("service_date", startIso.split("T")[0])
        .lte("service_date", endIso.split("T")[0]);

      // Query para contas pagas órfãs (sem expense_id e maintenance_id)
      let qPaidOrphanAccounts = supabase
        .from("accounts_payable")
        .select("id, amount, category, is_direct, payment_date")
        .eq("company_id", companyId)
        .eq("status", "paid")
        .is("deleted_at", null)
        .is("expense_id", null)
        .is("maintenance_id", null)
        .gte("payment_date", startIso.split("T")[0])
        .lte("payment_date", endIso.split("T")[0]);

      // Filtros Dinâmicos
      if (filters.vehicleIds.length > 0) {
        qVehicles = qVehicles.in("id", filters.vehicleIds);
        qJourneys = qJourneys.in("vehicle_id", filters.vehicleIds);
        qExpenses = qExpenses.in("vehicle_id", filters.vehicleIds);
        qFuel = qFuel.in("vehicle_id", filters.vehicleIds);
        qMaintenance = qMaintenance.in("vehicle_id", filters.vehicleIds);
      }

      if (filters.driverIds.length > 0) {
        qJourneys = qJourneys.in("driver_id", filters.driverIds);
      }

      if (filters.statusList.length > 0) {
        qJourneys = qJourneys.in("status", filters.statusList);
      }

      // CORREÇÃO DO ERRO TS2589:
      // Usamos "as any" nas promises individuais dentro do array.
      // Isso impede que o TypeScript tente inferir uma tupla de tipos infinitamente profunda.
      const [vehiclesRes, journeysRes, revenueRes, expensesRes, fuelRes, maintenanceRes, paidOrphanRes, driversRes] = await Promise.all([
        qVehicles as any,
        qJourneys as any,
        qRevenue as any,
        qExpenses as any,
        qFuel as any,
        qMaintenance as any,
        qPaidOrphanAccounts as any,
        supabase.from("drivers").select("id, name").eq("company_id", companyId).eq("status", "active") as any,
      ]);

      // Processamento simples das séries temporais no frontend
      const revenueTimeSeries = revenueRes.data?.map((r: any) => ({ date: r.date, amount: r.amount })) || [];
      const expensesTimeSeries = expensesRes.data?.map((e: any) => ({ date: e.date, amount: e.amount })) || [];
      const fuelTimeSeries = fuelRes.data?.map((f: any) => ({ date: f.date, amount: f.total_amount })) || [];

      setData({
        vehicles: vehiclesRes.data || [],
        journeys: journeysRes.data || [],
        revenue: revenueRes.data || [],
        expenses: expensesRes.data || [],
        fuelExpenses: fuelRes.data || [],
        maintenances: maintenanceRes.data || [],
        paidOrphanAccounts: paidOrphanRes.data || [],
        drivers: driversRes.data || [],
        revenueTimeSeries,
        expensesTimeSeries,
        fuelTimeSeries,
      });
    } catch (error) {
      console.error("Erro ao carregar dashboard:", error);
    } finally {
      setLoading(false);
    }
  }, [companyId, user, filters]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const metrics = useMemo(() => {
    // Fonte única de receita: tabela revenue (evita duplicação)
    const totalRevenue = data.revenue.reduce((acc, curr) => acc + (curr.amount || 0), 0);
    const totalFuel = data.fuelExpenses.reduce((acc, curr) => acc + (curr.total_amount || 0), 0);
    const totalOtherExpenses = data.expenses.reduce((acc, curr) => acc + (curr.amount || 0), 0);
    // Incluir manutenções concluídas
    const totalMaintenance = data.maintenances.reduce((acc, curr) => acc + (curr.total_cost || 0), 0);
    // Incluir contas pagas órfãs (sem duplicidade com expenses/maintenances)
    const totalPaidOrphan = data.paidOrphanAccounts.reduce((acc, curr) => acc + (curr.amount || 0), 0);
    
    const totalExpenses = totalFuel + totalOtherExpenses + totalMaintenance + totalPaidOrphan;
    const profit = totalRevenue - totalExpenses;
    const margin = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0;

    const expensesByCategory = data.expenses.reduce((acc: any, exp: any) => {
      const name = exp.expense_categories?.name || "Outros";
      if (!acc[name]) {
        acc[name] = {
          amount: 0,
          icon: exp.expense_categories?.icon || "Package",
          color: exp.expense_categories?.color || "#888",
        };
      }
      acc[name].amount += exp.amount;
      return acc;
    }, {});

    if (totalFuel > 0) {
      expensesByCategory["Combustível"] = {
        amount: totalFuel,
        icon: "Fuel",
        color: "#EF4444",
      };
    }

    if (totalMaintenance > 0) {
      expensesByCategory["Manutenção"] = {
        amount: totalMaintenance,
        icon: "Wrench",
        color: "#f59e0b",
      };
    }

    if (totalPaidOrphan > 0) {
      // Agrupar contas órfãs em "Financeiro (Contas)"
      expensesByCategory["Financeiro (Contas)"] = {
        amount: totalPaidOrphan,
        icon: "CreditCard",
        color: "#8b5cf6",
      };
    }

    return {
      totalRevenue,
      totalExpenses,
      totalFuel,
      profit,
      margin,
      expensesByCategory,
      operatingVehicles: data.journeys.filter((j) => j.status === "in_progress").length,
    };
  }, [data]);

  return { loading, filters, setFilters, data, metrics, refresh: fetchData };
}

// --- Componentes Auxiliares ---

const DynamicIcon = ({ name, className, color }: { name: string; className?: string; color?: string }) => {
  // Cast para any para evitar erro de indexação complexa no Lucide
  const IconComponent = (LucideIcons as any)[name] || LucideIcons.Package;
  return <IconComponent className={className} style={{ color }} />;
};

const EmptyState = ({ onAction }: { onAction: () => void }) => (
  <Card className="border-dashed border-2 bg-muted/20">
    <CardContent className="flex flex-col items-center justify-center py-12 text-center">
      <div className="bg-background p-4 rounded-full shadow-sm mb-4">
        <Truck className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold mb-2">Sua frota está vazia</h3>
      <p className="text-muted-foreground max-w-sm mb-6">
        Cadastre seus veículos para começar a ter insights da operação.
      </p>
      <Button onClick={onAction} className="bg-primary">
        <Plus className="h-4 w-4 mr-2" /> Cadastrar Veículo
      </Button>
    </CardContent>
  </Card>
);

const LoadingSkeleton = () => (
  <div className="p-6 space-y-6">
    <div className="flex justify-between items-center mb-8">
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-32" />
      </div>
    </div>
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      {[...Array(4)].map((_, i) => (
        <Skeleton key={i} className="h-32 rounded-xl" />
      ))}
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
      <Skeleton className="col-span-2 h-80 rounded-xl" />
      <Skeleton className="col-span-1 h-80 rounded-xl" />
    </div>
  </div>
);

// --- Componente Principal ---

export default function Dashboard() {
  const { user } = useAuth();
  const { currentCompany } = useMultiTenant();
  const { staffContext, isBPO, isSupport } = useStaffAccess();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [showFilters, setShowFilters] = useState(false);

  // Usa staffContext como empresa efetiva para BPO/Suporte, senão currentCompany
  const effectiveCompanyId = staffContext?.company_id || currentCompany?.id;
  const effectiveCompanyName = staffContext?.company_name || currentCompany?.name;

  const { loading, metrics, data, filters, setFilters } = useDashboardStats(effectiveCompanyId, user);

  const handleNavigate = (path: string) => navigate(path);

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);

  const getPeriodLabel = () =>
    filters.preset === "custom"
      ? `${format(filters.startDate, "dd/MM")} - ${format(filters.endDate, "dd/MM")}`
      : `Últimos ${filters.preset.replace("d", " dias")}`;

  // Se não tem empresa selecionada, mostrar estado apropriado
  if (!effectiveCompanyId && !loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[50vh]">
        <div className="text-center space-y-4">
          <div className="bg-muted p-4 rounded-full inline-block">
            <Truck className="h-8 w-8 text-muted-foreground" />
          </div>
          <h2 className="text-xl font-semibold">Nenhuma empresa selecionada</h2>
          <p className="text-muted-foreground max-w-md">
            {(isBPO || isSupport) 
              ? "Selecione uma empresa para visualizar os dados."
              : "Entre em contato com o administrador."}
          </p>
          {isBPO && (
            <Button onClick={() => navigate("/select-company")}>
              Selecionar Empresa
            </Button>
          )}
          {isSupport && (
            <Button onClick={() => navigate("/search-company")}>
              Buscar Empresa
            </Button>
          )}
        </div>
      </div>
    );
  }

  if (loading && !data.vehicles.length) return <LoadingSkeleton />;

  return (
    <div className="p-6 space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Visão geral da {effectiveCompanyName || "empresa"}.</p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant={showFilters ? "secondary" : "outline"}
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="h-4 w-4 mr-2" />
            Filtros
            {filters.vehicleIds.length + filters.statusList.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {filters.vehicleIds.length + filters.statusList.length}
              </Badge>
            )}
          </Button>

          <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)}>
            <Calendar className="h-4 w-4 mr-2" />
            {getPeriodLabel()}
          </Button>
        </div>
      </div>

      {/* Filtros */}
      {showFilters && (
        <Card className="bg-muted/30 border-none shadow-inner">
          <CardContent className="pt-6">
            <DashboardFilters
              dateRange={{ preset: filters.preset, startDate: filters.startDate, endDate: filters.endDate }}
              onDateRangeChange={(preset, start, end) =>
                setFilters((prev) => ({ ...prev, preset: preset as any, startDate: start, endDate: end }))
              }
              vehicles={data.vehicles}
              selectedVehicles={filters.vehicleIds}
              onVehiclesChange={(ids) => setFilters((prev) => ({ ...prev, vehicleIds: ids }))}
              drivers={data.drivers}
              selectedDrivers={filters.driverIds}
              onDriversChange={(ids) => setFilters((prev) => ({ ...prev, driverIds: ids }))}
              selectedStatus={filters.statusList}
              onStatusChange={(ids) => setFilters((prev) => ({ ...prev, statusList: ids }))}
              onClearAll={() => setFilters((prev) => ({ ...prev, vehicleIds: [], driverIds: [], statusList: [] }))}
            />
          </CardContent>
        </Card>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Receita Total"
          value={formatCurrency(metrics.totalRevenue)}
          trend={metrics.totalRevenue > 0 ? "up" : "neutral"}
          trendValue={metrics.totalRevenue > 0 ? "Ativa" : "-"}
          icon={<DollarSign className="h-4 w-4" />}
          variant={metrics.totalRevenue > 0 ? "success" : "default"}
        />
        <StatsCard
          title="Lucro Líquido"
          value={formatCurrency(metrics.profit)}
          subtitle={`Margem: ${metrics.margin.toFixed(1)}%`}
          trend={metrics.profit > 0 ? "up" : "down"}
          icon={<TrendingUp className="h-4 w-4" />}
          variant={metrics.profit > 0 ? "success" : metrics.profit < 0 ? "danger" : "default"}
        />
        <StatsCard
          title="Despesas"
          value={formatCurrency(metrics.totalExpenses)}
          subtitle={`Combustível: ${formatCurrency(metrics.totalFuel)}`}
          trend="down"
          icon={<Receipt className="h-4 w-4" />}
          variant="warning"
        />
        <StatsCard
          title="Frota Ativa"
          value={`${metrics.operatingVehicles}/${data.vehicles.length}`}
          subtitle="Em operação"
          icon={<Truck className="h-4 w-4" />}
          variant="default"
        />
      </div>

      {/* Gráficos e Categorias */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-6">
          <TrendCharts
            startDate={filters.startDate}
            endDate={filters.endDate}
            revenueData={data.revenueTimeSeries}
            expensesData={data.expensesTimeSeries}
            fuelExpensesData={data.fuelTimeSeries}
          />

          {/* Ações Rápidas */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { icon: Route, label: "Jornadas", path: "/journeys" },
              { icon: Fuel, label: "Abastecer", path: "/fuel" },
              {
                icon: DollarSign,
                label: "Receitas",
                path: "/accounts",
                action: () => localStorage.setItem("openNewRevenue", "1"),
              },
              {
                icon: CreditCard,
                label: "Despesas",
                path: "/expenses",
                action: () => localStorage.setItem("openNewExpense", "1"),
              },
            ].map((item, idx) => (
              <Button
                key={idx}
                variant="outline"
                className="h-auto py-4 flex flex-col gap-2 hover:bg-muted/50 border-dashed hover:border-solid"
                onClick={() => {
                  if (item.action) item.action();
                  handleNavigate(item.path);
                }}
              >
                <item.icon className="h-5 w-5 text-primary" />
                <span className="text-xs font-medium">{item.label}</span>
              </Button>
            ))}
          </div>
        </div>

        {/* Custo por Categoria */}
        <div className="space-y-6">
          <FleetConsumptionOverview />

          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-medium flex items-center">
                <Receipt className="h-4 w-4 mr-2 text-muted-foreground" />
                Despesas por Categoria
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {Object.keys(metrics.expensesByCategory).length === 0 ? (
                <div className="text-center py-6 text-sm text-muted-foreground">Sem dados.</div>
              ) : (
                Object.entries(metrics.expensesByCategory)
                  .sort((a: any, b: any) => b[1].amount - a[1].amount)
                  .slice(0, 5)
                  .map(([name, cat]: [string, any]) => (
                    <div key={name} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center"
                          style={{ backgroundColor: `${cat.color}15`, color: cat.color }}
                        >
                          <DynamicIcon name={cat.icon} className="h-4 w-4" />
                        </div>
                        <span className="text-sm font-medium">{name}</span>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold">{formatCurrency(cat.amount)}</div>
                        <div className="text-xs text-muted-foreground">
                          {((cat.amount / metrics.totalExpenses) * 100).toFixed(1)}%
                        </div>
                      </div>
                    </div>
                  ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Grid de Veículos */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Truck className="h-5 w-5 text-primary" />
            Frota
          </h2>
          {data.vehicles.length > 0 && (
            <Button variant="ghost" size="sm" onClick={() => handleNavigate("/vehicles")}>
              Ver todos <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          )}
        </div>

        {data.vehicles.length === 0 ? (
          <EmptyState onAction={() => handleNavigate("/vehicles")} />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {data.vehicles.slice(0, 6).map((vehicle: any) => {
              const activeJourney = data.journeys.find(
                (j: any) => j.vehicle_id === vehicle.id && j.status === "in_progress",
              );

              // Calcular receitas do veículo no período
              const vehicleRevenue = data.revenue
                .filter((r: any) => r.vehicle_id === vehicle.id)
                .reduce((sum: number, r: any) => sum + (r.amount || 0), 0);

              // Calcular despesas do veículo no período
              const vehicleExpenses = data.expenses
                .filter((e: any) => e.vehicle_id === vehicle.id)
                .reduce((sum: number, e: any) => sum + (e.amount || 0), 0);

              // Calcular combustível do veículo no período
              const vehicleFuel = data.fuelExpenses
                .filter((f: any) => f.vehicle_id === vehicle.id)
                .reduce((sum: number, f: any) => sum + (f.total_amount || 0), 0);

              // Total de despesas incluindo combustível
              const totalVehicleExpenses = vehicleExpenses + vehicleFuel;

              // Lucro e margem
              const grossProfit = vehicleRevenue - totalVehicleExpenses;
              const marginPercent = vehicleRevenue > 0 ? (grossProfit / vehicleRevenue) * 100 : 0;

              // Calcular consumo médio (km/l) do veículo no período
              const vehicleFuelRecords = data.fuelExpenses.filter((f: any) => f.vehicle_id === vehicle.id);
              const totalDistance = vehicleFuelRecords.reduce((sum: number, f: any) => 
                sum + (f.distance_traveled || 0), 0);
              const totalLiters = vehicleFuelRecords.reduce((sum: number, f: any) => 
                sum + (f.liters || 0), 0);
              const fuelEfficiency = totalLiters > 0 ? totalDistance / totalLiters : (vehicle.avg_consumption || 0);

              // Calcular métricas da jornada ativa
              let journeyRevenue = 0;
              let journeyDirectExpenses = 0;
              let journeyMargin = 0;

              if (activeJourney) {
                journeyRevenue = data.revenue
                  .filter((r: any) => r.journey_id === activeJourney.id)
                  .reduce((sum: number, r: any) => sum + (r.amount || 0), 0) || activeJourney.freight_value || 0;
                
                const journeyExpenses = data.expenses
                  .filter((e: any) => e.journey_id === activeJourney.id)
                  .reduce((sum: number, e: any) => sum + (e.amount || 0), 0);
                
                const journeyFuel = data.fuelExpenses
                  .filter((f: any) => f.journey_id === activeJourney.id)
                  .reduce((sum: number, f: any) => sum + (f.total_amount || 0), 0);
                
                journeyDirectExpenses = journeyExpenses + journeyFuel;
                journeyMargin = journeyRevenue > 0 ? ((journeyRevenue - journeyDirectExpenses) / journeyRevenue) * 100 : 0;
              }

              const vehicleProps = {
                id: vehicle.id,
                plate: vehicle.plate,
                model: vehicle.model,
                brand: vehicle.brand,
                status: (activeJourney ? "operating" : "parked") as any,
                currentJourney: activeJourney
                  ? {
                      id: activeJourney.id,
                      origin: activeJourney.origin,
                      destination: activeJourney.destination,
                      revenue: journeyRevenue,
                      directExpenses: journeyDirectExpenses,
                      margin: journeyMargin,
                      driverBalance: 0,
                    }
                  : undefined,
                metrics: {
                  totalRevenue: vehicleRevenue,
                  totalExpenses: totalVehicleExpenses,
                  grossProfit: grossProfit,
                  marginPercent: marginPercent,
                  fuelEfficiency: fuelEfficiency,
                  targetEfficiency: vehicle.target_consumption || 3.5,
                },
              };

              return (
                <VehicleCard
                  key={vehicle.id}
                  vehicle={vehicleProps}
                  onOpenJourney={(id) => {
                    navigate("/journeys", { state: { vehicleId: id } });
                  }}
                  onViewDetails={(vehicleId, journeyId) => {
                    if (journeyId) {
                      navigate("/journeys", { state: { openJourneyId: journeyId } });
                    } else {
                      navigate("/vehicles");
                    }
                  }}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
