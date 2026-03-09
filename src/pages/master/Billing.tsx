import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DollarSign, CreditCard, TrendingUp, AlertTriangle, Download, ExternalLink, Copy, RefreshCw, Trash2, Filter, BarChart3 } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { format, subMonths, startOfMonth, endOfMonth, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Invoice {
  id: string;
  company: { name: string } | null;
  plan: { name: string } | null;
  amount: number;
  due_date: string;
  paid_date: string | null;
  status: string;
  billing_period_start: string;
  billing_period_end: string;
  asaas_invoice_url: string | null;
  asaas_payment_id: string | null;
  billing_kind: string | null;
  deleted_at: string | null;
}

interface Company {
  id: string;
  name: string;
  status: string;
  subscription_status: string | null;
  vehicle_limit: number | null;
  contracted_price_per_vehicle: number | null;
  subscription_plan: {
    id: string;
    name: string;
    price_per_vehicle: number | null;
    monthly_price: number | null;
  } | null;
}

interface CompanyMRR {
  name: string;
  plan: string;
  vehicles: number;
  pricePerVehicle: number;
  mrr: number;
}

interface PlanBreakdown {
  name: string;
  mrr: number;
  companies: number;
  vehicles: number;
}

interface MonthlyMRR {
  month: string;
  mrr: number;
}

type BillingKindFilter = 'all' | 'subscription' | 'one_time' | 'unknown';
type StatusFilter = 'all' | 'pending' | 'paid' | 'overdue' | 'cancelled';

const COLORS = ['hsl(var(--primary))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

export default function Billing() {
  const [activeTab, setActiveTab] = useState("overview");
  const [stats, setStats] = useState({
    mrr: 0,
    lastMonthMrr: 0,
    growthPercentage: 0,
    growthAbsolute: 0,
    pendingInvoices: 0,
    overdueInvoices: 0,
    pendingAmount: 0,
    overdueAmount: 0,
    subscriptionTotal: 0,
    oneTimeTotal: 0,
    arpu: 0,
    avgTicketPerVehicle: 0,
    totalVehicles: 0,
    activeCompanies: 0,
  });
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [companies, setCompanies] = useState<CompanyMRR[]>([]);
  const [planBreakdown, setPlanBreakdown] = useState<PlanBreakdown[]>([]);
  const [mrrTrend, setMrrTrend] = useState<MonthlyMRR[]>([]);
  const [loading, setLoading] = useState(true);
  const [kindFilter, setKindFilter] = useState<BillingKindFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [invoiceToCancel, setInvoiceToCancel] = useState<Invoice | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchBillingData();
  }, []);

  const fetchBillingData = async () => {
    setLoading(true);
    try {
      // Fetch companies for MRR calculation
      const { data: companiesData, error: companiesError } = await supabase
        .from("companies")
        .select(`
          id,
          name,
          status,
          subscription_status,
          vehicle_limit,
          contracted_price_per_vehicle,
          subscription_plan:subscription_plans(id, name, price_per_vehicle, monthly_price)
        `)
        .eq("status", "active")
        .eq("subscription_status", "active");

      if (companiesError) throw companiesError;

      // Calculate MRR and company breakdown
      const companiesMRR: CompanyMRR[] = [];
      const planMap: Record<string, PlanBreakdown> = {};
      let totalMRR = 0;
      let totalVehicles = 0;

      (companiesData as Company[] || []).forEach(company => {
        const pricePerVehicle = company.contracted_price_per_vehicle 
          || company.subscription_plan?.price_per_vehicle 
          || company.subscription_plan?.monthly_price 
          || 0;
        const vehicleLimit = company.vehicle_limit || 1;
        const companyMRR = pricePerVehicle * vehicleLimit;
        const planName = company.subscription_plan?.name || 'Sem Plano';

        totalMRR += companyMRR;
        totalVehicles += vehicleLimit;

        companiesMRR.push({
          name: company.name,
          plan: planName,
          vehicles: vehicleLimit,
          pricePerVehicle,
          mrr: companyMRR,
        });

        if (!planMap[planName]) {
          planMap[planName] = { name: planName, mrr: 0, companies: 0, vehicles: 0 };
        }
        planMap[planName].mrr += companyMRR;
        planMap[planName].companies += 1;
        planMap[planName].vehicles += vehicleLimit;
      });

      // Sort companies by MRR descending
      companiesMRR.sort((a, b) => b.mrr - a.mrr);
      setCompanies(companiesMRR.slice(0, 20));

      // Convert plan breakdown to array and sort
      const planBreakdownArray = Object.values(planMap).sort((a, b) => b.mrr - a.mrr);
      setPlanBreakdown(planBreakdownArray);

      // Fetch historical MRR from paid invoices
      const sixMonthsAgo = subMonths(new Date(), 6);
      const { data: historicalInvoices, error: histError } = await supabase
        .from("invoices")
        .select("amount, billing_period_start, billing_kind, status")
        .eq("status", "paid")
        .eq("billing_kind", "subscription")
        .gte("billing_period_start", sixMonthsAgo.toISOString())
        .is("deleted_at", null);

      if (histError) throw histError;

      // Group by month
      const monthlyData: Record<string, number> = {};
      const now = new Date();
      
      // Initialize last 6 months with 0
      for (let i = 5; i >= 0; i--) {
        const month = subMonths(now, i);
        const key = format(month, 'yyyy-MM');
        monthlyData[key] = 0;
      }

      // Sum paid invoices per month
      historicalInvoices?.forEach(inv => {
        if (inv.billing_period_start) {
          const key = format(parseISO(inv.billing_period_start), 'yyyy-MM');
          if (monthlyData[key] !== undefined) {
            monthlyData[key] += Number(inv.amount);
          }
        }
      });

      // Use current MRR for current month if no invoices yet
      const currentMonthKey = format(now, 'yyyy-MM');
      if (monthlyData[currentMonthKey] === 0) {
        monthlyData[currentMonthKey] = totalMRR;
      }

      const mrrTrendData: MonthlyMRR[] = Object.entries(monthlyData).map(([key, value]) => ({
        month: format(parseISO(`${key}-01`), 'MMM/yy', { locale: ptBR }),
        mrr: value,
      }));
      setMrrTrend(mrrTrendData);

      // Calculate last month MRR
      const lastMonthKey = format(subMonths(now, 1), 'yyyy-MM');
      const lastMonthMrr = monthlyData[lastMonthKey] || 0;
      const growthAbsolute = totalMRR - lastMonthMrr;
      const growthPercentage = lastMonthMrr > 0 ? ((totalMRR - lastMonthMrr) / lastMonthMrr) * 100 : 0;

      // Fetch invoices
      const { data: invoicesData, error: invoicesError } = await supabase
        .from("invoices")
        .select(`
          *,
          company:companies(name),
          plan:subscription_plans(name)
        `)
        .is("deleted_at", null)
        .order("due_date", { ascending: false })
        .limit(100);

      if (invoicesError) throw invoicesError;

      // Calculate invoice stats
      const pending = invoicesData?.filter(i => i.status === 'pending') || [];
      const overdue = invoicesData?.filter(i => i.status === 'overdue') || [];
      const subscriptions = invoicesData?.filter(i => i.billing_kind === 'subscription' && ['pending', 'overdue'].includes(i.status)) || [];
      const oneTime = invoicesData?.filter(i => i.billing_kind === 'one_time' && ['pending', 'overdue'].includes(i.status)) || [];

      const activeCompanies = companiesData?.length || 0;
      const arpu = activeCompanies > 0 ? totalMRR / activeCompanies : 0;
      const avgTicketPerVehicle = totalVehicles > 0 ? totalMRR / totalVehicles : 0;

      setStats({
        mrr: totalMRR,
        lastMonthMrr,
        growthPercentage,
        growthAbsolute,
        pendingInvoices: pending.length,
        overdueInvoices: overdue.length,
        pendingAmount: pending.reduce((sum, i) => sum + Number(i.amount), 0),
        overdueAmount: overdue.reduce((sum, i) => sum + Number(i.amount), 0),
        subscriptionTotal: subscriptions.reduce((sum, i) => sum + Number(i.amount), 0),
        oneTimeTotal: oneTime.reduce((sum, i) => sum + Number(i.amount), 0),
        arpu,
        avgTicketPerVehicle,
        totalVehicles,
        activeCompanies,
      });

      setInvoices(invoicesData || []);
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

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("pt-BR");
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      pending: { label: "Pendente", variant: "secondary" },
      paid: { label: "Pago", variant: "default" },
      overdue: { label: "Vencido", variant: "destructive" },
      cancelled: { label: "Cancelado", variant: "outline" },
    };
    const config = variants[status] || variants.pending;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getBillingKindBadge = (kind: string | null) => {
    switch (kind) {
      case 'subscription':
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Assinatura</Badge>;
      case 'one_time':
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Unitária</Badge>;
      default:
        return <Badge variant="outline" className="bg-gray-50 text-gray-500 border-gray-200">Indefinido</Badge>;
    }
  };

  const copyToClipboard = (url: string) => {
    navigator.clipboard.writeText(url);
    toast({ title: "Link copiado!", description: "Link do boleto copiado para a área de transferência" });
  };

  const openPaymentLink = (url: string) => {
    window.open(url, "_blank");
  };

  const handleCancelClick = (invoice: Invoice) => {
    if (invoice.status === 'paid') {
      toast({ title: "Não permitido", description: "Não é possível cancelar uma fatura já paga", variant: "destructive" });
      return;
    }
    setInvoiceToCancel(invoice);
    setCancelDialogOpen(true);
  };

  const confirmCancel = async () => {
    if (!invoiceToCancel) return;
    
    setCancelling(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Não autenticado");

      const { data, error } = await supabase.functions.invoke('asaas-cancel-payment', {
        body: { 
          invoice_id: invoiceToCancel.id, 
          cancel_in_asaas: true,
          soft_delete: false 
        },
        headers: { Authorization: `Bearer ${session.access_token}` }
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Erro ao cancelar");

      toast({ title: "Cobrança cancelada", description: "A cobrança foi cancelada com sucesso" });
      fetchBillingData();
    } catch (error: any) {
      toast({ title: "Erro ao cancelar", description: error.message, variant: "destructive" });
    } finally {
      setCancelling(false);
      setCancelDialogOpen(false);
      setInvoiceToCancel(null);
    }
  };

  const filteredInvoices = invoices.filter(invoice => {
    if (kindFilter !== 'all' && invoice.billing_kind !== kindFilter) return false;
    if (statusFilter !== 'all' && invoice.status !== statusFilter) return false;
    return true;
  });

  const exportReport = () => {
    const content = generateReportContent();
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `relatorio-faturamento-${new Date().toISOString().split("T")[0]}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast({ title: "Relatório exportado", description: "O arquivo foi baixado" });
  };

  const generateReportContent = () => {
    return `
RELATÓRIO DE FATURAMENTO - FROTA LINK
Gerado em: ${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR")}

================================================================================
RESUMO:
• MRR (Contratado): ${formatCurrency(stats.mrr)}
• Faturas Pendentes: ${stats.pendingInvoices} (${formatCurrency(stats.pendingAmount)})
• Faturas Vencidas: ${stats.overdueInvoices} (${formatCurrency(stats.overdueAmount)})
• Total em Aberto: ${formatCurrency(stats.pendingAmount + stats.overdueAmount)}

POR TIPO:
• Assinaturas em aberto: ${formatCurrency(stats.subscriptionTotal)}
• Cobranças unitárias em aberto: ${formatCurrency(stats.oneTimeTotal)}

================================================================================
DETALHES DAS FATURAS:
${filteredInvoices.map(invoice => `
Empresa: ${invoice.company?.name || "N/A"}
Tipo: ${invoice.billing_kind === 'subscription' ? 'Assinatura' : invoice.billing_kind === 'one_time' ? 'Unitária' : 'Indefinido'}
Valor: ${formatCurrency(Number(invoice.amount))}
Vencimento: ${formatDate(invoice.due_date)}
Status: ${invoice.status.toUpperCase()}
--------------------------------------------------------------------------------
`).join("")}

Total de ${filteredInvoices.length} faturas listadas
    `;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Faturamento</h1>
        <p className="text-muted-foreground">Visão geral do faturamento, cobranças e MRR</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="invoices">Cobranças</TabsTrigger>
          <TabsTrigger value="mrr">MRR Analytics</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">MRR (Contratado)</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="h-8 bg-muted animate-pulse rounded" />
                ) : (
                  <>
                    <div className="text-2xl font-bold">{formatCurrency(stats.mrr)}</div>
                    <p className="text-xs text-muted-foreground">
                      {stats.growthPercentage >= 0 ? '+' : ''}{stats.growthPercentage.toFixed(1)}% vs mês anterior
                    </p>
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pendentes</CardTitle>
                <CreditCard className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="h-8 bg-muted animate-pulse rounded" />
                ) : (
                  <>
                    <div className="text-2xl font-bold">{stats.pendingInvoices}</div>
                    <p className="text-xs text-muted-foreground">{formatCurrency(stats.pendingAmount)} aguardando</p>
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Vencidas</CardTitle>
                <AlertTriangle className="h-4 w-4 text-destructive" />
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="h-8 bg-muted animate-pulse rounded" />
                ) : (
                  <>
                    <div className="text-2xl font-bold text-destructive">{stats.overdueInvoices}</div>
                    <p className="text-xs text-muted-foreground">{formatCurrency(stats.overdueAmount)} em atraso</p>
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Por Tipo</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="h-8 bg-muted animate-pulse rounded" />
                ) : (
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Assinaturas:</span>
                      <span className="font-medium">{formatCurrency(stats.subscriptionTotal)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Unitárias:</span>
                      <span className="font-medium">{formatCurrency(stats.oneTimeTotal)}</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Quick Actions */}
          <div className="flex gap-2">
            <Button onClick={fetchBillingData} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Atualizar
            </Button>
            <Button onClick={exportReport} variant="outline" size="sm" disabled={invoices.length === 0}>
              <Download className="h-4 w-4 mr-2" />
              Exportar
            </Button>
          </div>
        </TabsContent>

        {/* Invoices Tab */}
        <TabsContent value="invoices" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <CardTitle>Cobranças</CardTitle>
                <div className="flex flex-wrap gap-2">
                  <Select value={kindFilter} onValueChange={(v) => setKindFilter(v as BillingKindFilter)}>
                    <SelectTrigger className="w-[140px]">
                      <Filter className="h-4 w-4 mr-2" />
                      <SelectValue placeholder="Tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos tipos</SelectItem>
                      <SelectItem value="subscription">Assinatura</SelectItem>
                      <SelectItem value="one_time">Unitária</SelectItem>
                      <SelectItem value="unknown">Indefinido</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos status</SelectItem>
                      <SelectItem value="pending">Pendente</SelectItem>
                      <SelectItem value="overdue">Vencido</SelectItem>
                      <SelectItem value="paid">Pago</SelectItem>
                      <SelectItem value="cancelled">Cancelado</SelectItem>
                    </SelectContent>
                  </Select>

                  <Button onClick={fetchBillingData} variant="outline" size="sm">
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Atualizar
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-2">
                  <div className="h-10 bg-muted animate-pulse rounded" />
                  <div className="h-10 bg-muted animate-pulse rounded" />
                  <div className="h-10 bg-muted animate-pulse rounded" />
                </div>
              ) : filteredInvoices.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">Nenhuma cobrança encontrada</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Empresa</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Valor</TableHead>
                        <TableHead>Vencimento</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredInvoices.map((invoice) => (
                        <TableRow key={invoice.id}>
                          <TableCell className="font-medium">{invoice.company?.name || "N/A"}</TableCell>
                          <TableCell>{getBillingKindBadge(invoice.billing_kind)}</TableCell>
                          <TableCell>{formatCurrency(Number(invoice.amount))}</TableCell>
                          <TableCell>{formatDate(invoice.due_date)}</TableCell>
                          <TableCell>{getStatusBadge(invoice.status)}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              {invoice.asaas_invoice_url && invoice.status !== "paid" && invoice.status !== "cancelled" && (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => openPaymentLink(invoice.asaas_invoice_url!)}
                                    title="Abrir boleto/PIX"
                                  >
                                    <ExternalLink className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => copyToClipboard(invoice.asaas_invoice_url!)}
                                    title="Copiar link"
                                  >
                                    <Copy className="h-4 w-4" />
                                  </Button>
                                </>
                              )}
                              {invoice.status !== "paid" && invoice.status !== "cancelled" && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleCancelClick(invoice)}
                                  title="Cancelar cobrança"
                                  className="text-destructive hover:text-destructive"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* MRR Analytics Tab */}
        <TabsContent value="mrr" className="space-y-6">
          {/* MRR Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">MRR Atual</CardTitle>
                <DollarSign className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-primary">{formatCurrency(stats.mrr)}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {stats.activeCompanies} empresas ativas
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Crescimento</CardTitle>
                <TrendingUp className={`h-4 w-4 ${stats.growthPercentage >= 0 ? 'text-green-600' : 'text-destructive'}`} />
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${stats.growthPercentage >= 0 ? 'text-green-600' : 'text-destructive'}`}>
                  {stats.growthPercentage >= 0 ? '+' : ''}{stats.growthPercentage.toFixed(1)}%
                </div>
                <p className="text-xs text-muted-foreground">
                  {formatCurrency(Math.abs(stats.growthAbsolute))} {stats.growthAbsolute >= 0 ? 'a mais' : 'a menos'}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">ARPU</CardTitle>
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(stats.arpu)}</div>
                <p className="text-xs text-muted-foreground">Receita média por empresa</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Ticket por Veículo</CardTitle>
                <CreditCard className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(stats.avgTicketPerVehicle)}</div>
                <p className="text-xs text-muted-foreground">{stats.totalVehicles} veículos total</p>
              </CardContent>
            </Card>
          </div>

          {/* MRR Trend Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Evolução do MRR</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="h-[300px] bg-muted animate-pulse rounded" />
              ) : (
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={mrrTrend}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="month" className="text-xs" />
                      <YAxis 
                        tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`}
                        className="text-xs"
                      />
                      <Tooltip 
                        formatter={(value: number) => [formatCurrency(value), 'MRR']}
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px'
                        }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="mrr" 
                        stroke="hsl(var(--primary))" 
                        strokeWidth={3}
                        dot={{ fill: 'hsl(var(--primary))', strokeWidth: 2 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Plan Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle>MRR por Plano</CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="h-[250px] bg-muted animate-pulse rounded" />
                ) : planBreakdown.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">Nenhum dado disponível</p>
                ) : (
                  <div className="space-y-4">
                    <div className="h-[200px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={planBreakdown}
                            cx="50%"
                            cy="50%"
                            innerRadius={50}
                            outerRadius={80}
                            paddingAngle={2}
                            dataKey="mrr"
                            nameKey="name"
                          >
                            {planBreakdown.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip 
                            formatter={(value: number) => formatCurrency(value)}
                            contentStyle={{ 
                              backgroundColor: 'hsl(var(--card))',
                              border: '1px solid hsl(var(--border))',
                              borderRadius: '8px'
                            }}
                          />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="space-y-2">
                      {planBreakdown.map((plan, index) => (
                        <div key={plan.name} className="flex justify-between items-center text-sm">
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-3 h-3 rounded-full" 
                              style={{ backgroundColor: COLORS[index % COLORS.length] }}
                            />
                            <span>{plan.name}</span>
                          </div>
                          <div className="text-right">
                            <span className="font-medium">{formatCurrency(plan.mrr)}</span>
                            <span className="text-muted-foreground ml-2">({plan.companies} empresas)</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Top Companies */}
            <Card>
              <CardHeader>
                <CardTitle>Top Empresas por MRR</CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="h-[300px] bg-muted animate-pulse rounded" />
                ) : companies.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">Nenhum dado disponível</p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Empresa</TableHead>
                          <TableHead>Plano</TableHead>
                          <TableHead className="text-right">Veículos</TableHead>
                          <TableHead className="text-right">MRR</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {companies.slice(0, 10).map((company) => (
                          <TableRow key={company.name}>
                            <TableCell className="font-medium">{company.name}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{company.plan}</Badge>
                            </TableCell>
                            <TableCell className="text-right">{company.vehicles}</TableCell>
                            <TableCell className="text-right font-medium">{formatCurrency(company.mrr)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Cancel Dialog */}
      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar Cobrança</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja cancelar esta cobrança? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelling}>Não, manter</AlertDialogCancel>
            <AlertDialogAction onClick={confirmCancel} disabled={cancelling} className="bg-destructive text-destructive-foreground">
              {cancelling ? "Cancelando..." : "Sim, cancelar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
