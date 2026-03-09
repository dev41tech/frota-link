import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, DollarSign, Users, Building2, Car } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

interface CompanyMRR {
  id: string;
  name: string;
  planName: string;
  vehicles: number;
  pricePerVehicle: number;
  mrr: number;
}

interface PlanBreakdown {
  name: string;
  companies: number;
  mrr: number;
  vehicles: number;
}

interface MonthlyMRR {
  month: string;
  mrr: number;
  companies: number;
}

const CHART_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

export default function MRRAnalytics() {
  const [loading, setLoading] = useState(true);
  const [currentMRR, setCurrentMRR] = useState(0);
  const [lastMonthMRR, setLastMonthMRR] = useState(0);
  const [growth, setGrowth] = useState(0);
  const [activeCompanies, setActiveCompanies] = useState(0);
  const [totalVehicles, setTotalVehicles] = useState(0);
  const [arpu, setArpu] = useState(0);
  const [ticketPerVehicle, setTicketPerVehicle] = useState(0);
  const [companiesBreakdown, setCompaniesBreakdown] = useState<CompanyMRR[]>([]);
  const [plansBreakdown, setPlansBreakdown] = useState<PlanBreakdown[]>([]);
  const [monthlyTrend, setMonthlyTrend] = useState<MonthlyMRR[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    fetchMRRData();
  }, []);

  const fetchMRRData = async () => {
    try {
      // Fetch active companies with subscription plans
      const { data: companies, error: companiesError } = await supabase
        .from("companies")
        .select(`
          id,
          name,
          status,
          subscription_status,
          vehicle_limit,
          contracted_price_per_vehicle,
          created_at,
          subscription_plan:subscription_plans(
            id,
            name,
            price_per_vehicle,
            monthly_price
          )
        `)
        .eq("status", "active")
        .eq("subscription_status", "active");

      if (companiesError) throw companiesError;

      // Calculate current MRR and breakdown
      let totalMRR = 0;
      let totalVehicleCount = 0;
      const companyBreakdownList: CompanyMRR[] = [];
      const planMap = new Map<string, PlanBreakdown>();

      companies?.forEach((company) => {
        const plan = company.subscription_plan as any;
        const pricePerVehicle =
          company.contracted_price_per_vehicle ||
          plan?.price_per_vehicle ||
          plan?.monthly_price ||
          0;
        const vehicleLimit = company.vehicle_limit || 1;
        const companyMRR = Number(pricePerVehicle) * vehicleLimit;

        totalMRR += companyMRR;
        totalVehicleCount += vehicleLimit;

        const planName = plan?.name || "Sem Plano";

        companyBreakdownList.push({
          id: company.id,
          name: company.name,
          planName,
          vehicles: vehicleLimit,
          pricePerVehicle: Number(pricePerVehicle),
          mrr: companyMRR,
        });

        // Group by plan
        if (planMap.has(planName)) {
          const existing = planMap.get(planName)!;
          existing.companies += 1;
          existing.mrr += companyMRR;
          existing.vehicles += vehicleLimit;
        } else {
          planMap.set(planName, {
            name: planName,
            companies: 1,
            mrr: companyMRR,
            vehicles: vehicleLimit,
          });
        }
      });

      // Sort companies by MRR descending
      companyBreakdownList.sort((a, b) => b.mrr - a.mrr);

      // Calculate historical MRR from subscription invoices
      const today = new Date();
      const monthlyData: MonthlyMRR[] = [];

      for (let i = 5; i >= 0; i--) {
        const monthStart = startOfMonth(subMonths(today, i));
        const monthEnd = endOfMonth(subMonths(today, i));

        const { data: monthInvoices, error: invoicesError } = await supabase
          .from("invoices")
          .select("amount, company_id")
          .eq("billing_kind", "subscription")
          .eq("status", "paid")
          .gte("billing_period_start", monthStart.toISOString())
          .lte("billing_period_start", monthEnd.toISOString())
          .is("deleted_at", null);

        if (invoicesError) {
          console.error("Error fetching invoices for month:", invoicesError);
          continue;
        }

        const monthMRR = monthInvoices?.reduce((sum, inv) => sum + Number(inv.amount), 0) || 0;
        const uniqueCompanies = new Set(monthInvoices?.map((inv) => inv.company_id)).size;

        monthlyData.push({
          month: format(monthStart, "MMM/yy", { locale: ptBR }),
          mrr: monthMRR,
          companies: uniqueCompanies,
        });
      }

      // Calculate last month's MRR
      const lastMonthData = monthlyData[monthlyData.length - 2];
      const previousMRR = lastMonthData?.mrr || 0;
      const growthPercentage = previousMRR > 0 ? ((totalMRR - previousMRR) / previousMRR) * 100 : 0;

      // Set state
      setCurrentMRR(totalMRR);
      setLastMonthMRR(previousMRR);
      setGrowth(growthPercentage);
      setActiveCompanies(companies?.length || 0);
      setTotalVehicles(totalVehicleCount);
      setArpu(companies?.length ? totalMRR / companies.length : 0);
      setTicketPerVehicle(totalVehicleCount > 0 ? totalMRR / totalVehicleCount : 0);
      setCompaniesBreakdown(companyBreakdownList);
      setPlansBreakdown(Array.from(planMap.values()).sort((a, b) => b.mrr - a.mrr));
      setMonthlyTrend(monthlyData);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar dados",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-popover border border-border rounded-lg p-3 shadow-lg">
          <p className="font-medium text-foreground">{label}</p>
          <p className="text-primary">{formatCurrency(payload[0].value)}</p>
          {payload[0].payload.companies && (
            <p className="text-muted-foreground text-sm">{payload[0].payload.companies} empresas</p>
          )}
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
        <div className="h-64 bg-muted animate-pulse rounded-lg" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Análise de MRR</h1>
        <p className="text-muted-foreground">Receita recorrente mensal e métricas de crescimento</p>
      </div>

      {/* Main Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">MRR Atual</CardTitle>
            <DollarSign className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(currentMRR)}</div>
            <p className="text-xs text-muted-foreground">Receita recorrente mensal</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Crescimento</CardTitle>
            {growth >= 0 ? (
              <TrendingUp className="h-4 w-4 text-green-600" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-600" />
            )}
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${growth >= 0 ? "text-green-600" : "text-red-600"}`}>
              {growth >= 0 ? "+" : ""}
              {growth.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">vs. mês anterior</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">ARPU</CardTitle>
            <Building2 className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(arpu)}</div>
            <p className="text-xs text-muted-foreground">Receita média por empresa</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ticket/Veículo</CardTitle>
            <Car className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(ticketPerVehicle)}</div>
            <p className="text-xs text-muted-foreground">{totalVehicles} veículos ativos</p>
          </CardContent>
        </Card>
      </div>

      {/* Secondary Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">MRR Mês Anterior</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(lastMonthMRR)}</div>
            <p className="text-xs text-muted-foreground">Base de comparação</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Empresas Ativas</CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeCompanies}</div>
            <p className="text-xs text-muted-foreground">Clientes pagantes</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Expansão MRR</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(Math.max(0, currentMRR - lastMonthMRR))}
            </div>
            <p className="text-xs text-muted-foreground">Crescimento absoluto</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Trend Chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Evolução do MRR</CardTitle>
          </CardHeader>
          <CardContent>
            {monthlyTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={monthlyTrend}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="month" className="text-muted-foreground" fontSize={12} />
                  <YAxis
                    tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`}
                    className="text-muted-foreground"
                    fontSize={12}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Line
                    type="monotone"
                    dataKey="mrr"
                    stroke="hsl(var(--primary))"
                    strokeWidth={3}
                    dot={{ fill: "hsl(var(--primary))", strokeWidth: 2, r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                Sem dados históricos de faturas pagas
              </div>
            )}
          </CardContent>
        </Card>

        {/* Plan Breakdown Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle>MRR por Plano</CardTitle>
          </CardHeader>
          <CardContent>
            {plansBreakdown.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={plansBreakdown}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={2}
                    dataKey="mrr"
                    nameKey="name"
                  >
                    {plansBreakdown.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => formatCurrency(value)}
                    contentStyle={{
                      backgroundColor: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                  />
                  <Legend
                    formatter={(value, entry: any) => (
                      <span className="text-foreground text-sm">
                        {value} ({entry.payload.companies})
                      </span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                Nenhum plano ativo
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Plan Breakdown Table */}
      <Card>
        <CardHeader>
          <CardTitle>Breakdown por Plano</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Plano</TableHead>
                <TableHead className="text-center">Empresas</TableHead>
                <TableHead className="text-center">Veículos</TableHead>
                <TableHead className="text-right">MRR</TableHead>
                <TableHead className="text-right">% do Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {plansBreakdown.map((plan) => (
                <TableRow key={plan.name}>
                  <TableCell className="font-medium">{plan.name}</TableCell>
                  <TableCell className="text-center">{plan.companies}</TableCell>
                  <TableCell className="text-center">{plan.vehicles}</TableCell>
                  <TableCell className="text-right">{formatCurrency(plan.mrr)}</TableCell>
                  <TableCell className="text-right">
                    <Badge variant="secondary">
                      {currentMRR > 0 ? ((plan.mrr / currentMRR) * 100).toFixed(1) : 0}%
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Companies Breakdown Table */}
      <Card>
        <CardHeader>
          <CardTitle>Detalhamento por Empresa</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Empresa</TableHead>
                <TableHead>Plano</TableHead>
                <TableHead className="text-center">Veículos</TableHead>
                <TableHead className="text-right">Preço/Veículo</TableHead>
                <TableHead className="text-right">MRR</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {companiesBreakdown.slice(0, 20).map((company) => (
                <TableRow key={company.id}>
                  <TableCell className="font-medium">{company.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{company.planName}</Badge>
                  </TableCell>
                  <TableCell className="text-center">{company.vehicles}</TableCell>
                  <TableCell className="text-right">{formatCurrency(company.pricePerVehicle)}</TableCell>
                  <TableCell className="text-right font-medium">{formatCurrency(company.mrr)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {companiesBreakdown.length > 20 && (
            <p className="text-sm text-muted-foreground text-center mt-4">
              Exibindo top 20 de {companiesBreakdown.length} empresas
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
