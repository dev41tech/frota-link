import { useState, useEffect, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { useCompleteDRE, ExtendedDREData } from "@/hooks/useCompleteDRE";
import { useDREDetailedData, DetailedDREData } from "@/hooks/useDREDetailedData";
import { formatCurrency, calculateDREResult } from "@/lib/dreCalculations";
import { CategoryBadge } from "@/components/categories/CategoryBadge";
import { CategoryFilter } from "@/components/reports/CategoryFilter";
import { CategoryDrillDownDialog } from "@/components/reports/CategoryDrillDownDialog";
import { PeriodPresets } from "@/components/reports/PeriodPresets";
import { ReportViewModeSelector, type ReportViewMode } from "@/components/reports/ReportViewModeSelector";
import { DREInsights } from "@/components/reports/DREInsights";
import { DREStatCard } from "@/components/reports/DREStatCard";
import { DREDataQualityAlert } from "@/components/reports/DREDataQualityAlert";
import { DREHorizontalAnalysis } from "@/components/reports/DREHorizontalAnalysis";
import { DREYearlyAccumulated } from "@/components/reports/DREYearlyAccumulated";
import { useRevenueCategories } from "@/hooks/useRevenueCategories";
import { useExpenseCategories } from "@/hooks/useExpenseCategories";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Download,
  FileSpreadsheet,
  RefreshCw,
  PieChart as PieChartIcon,
  TrendingUp,
  Calendar,
  Filter,
  Wallet,
  Truck,
  DollarSign,
  Percent,
  Receipt,
  Fuel,
  HelpCircle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { format, startOfMonth, endOfMonth, eachMonthOfInterval, subMonths, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { supabase } from "@/integrations/supabase/client";
import { useMultiTenant } from "@/hooks/useMultiTenant";
import { useAuth } from "@/hooks/useAuth";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
  Area,
  AreaChart,
} from "recharts";

const LoadingSkeleton = () => (
  <div className="space-y-6">
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {[1, 2, 3, 4].map((i) => (
        <Skeleton key={i} className="h-28 w-full" />
      ))}
    </div>
    <Skeleton className="h-32 w-full" />
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <Skeleton className="h-[300px] w-full" />
      <Skeleton className="h-[300px] w-full" />
    </div>
  </div>
);

// Cores para gráficos
const CHART_COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6"];

export default function Reports() {
  const { toast } = useToast();
  const { user } = useAuth();
  const { currentCompany, isLoading: tenantLoading } = useMultiTenant();

  const [comparisonMode, setComparisonMode] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [activePreset, setActivePreset] = useState<string>("last-30");
  const [viewMode, setViewMode] = useState<ReportViewMode>('competency');

  const [startDate, setStartDate] = useState<Date>(() => subDays(new Date(), 30));
  const [endDate, setEndDate] = useState<Date>(new Date());

  const [startDate2, setStartDate2] = useState<Date>(() => subMonths(new Date(), 2));
  const [endDate2, setEndDate2] = useState<Date>(() => {
    const d = subMonths(new Date(), 1);
    d.setDate(d.getDate() - 1);
    return d;
  });

  const [vehicleId, setVehicleId] = useState<string>("all");
  const [driverId, setDriverId] = useState<string>("all");

  const [selectedRevenueCategories, setSelectedRevenueCategories] = useState<string[]>([]);
  const [selectedExpenseCategories, setSelectedExpenseCategories] = useState<string[]>([]);

  const [drillDownCategory, setDrillDownCategory] = useState<{
    type: "revenue" | "expense";
    category: any;
    data: any[];
  } | null>(null);

  const [vehicles, setVehicles] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [monthlyEvolution, setMonthlyEvolution] = useState<any[]>([]);

  const { data: revenueCategories = [] } = useRevenueCategories(true);
  const { data: expenseCategories = [] } = useExpenseCategories(undefined, true);

  const cleanId = (id: string) => (id && id !== "all" ? id : undefined);

  const { dreData, loading, refetch } = useCompleteDRE({
    startDate,
    endDate,
    vehicleId: cleanId(vehicleId),
    driverId: cleanId(driverId),
    viewMode,
  });

  const { dreData: dreData2, loading: loading2 } = useCompleteDRE({
    startDate: startDate2,
    endDate: endDate2,
    vehicleId: cleanId(vehicleId),
    driverId: cleanId(driverId),
    viewMode,
  });

  // Hook para buscar dados detalhados do DRE (para PDF analítico)
  const { fetchDetailedData } = useDREDetailedData();

  const handlePeriodPresetSelect = (start: Date, end: Date) => {
    setStartDate(start);
    setEndDate(end);
    // Detectar qual preset foi selecionado
    const today = new Date();
    if (start.getTime() === startOfMonth(today).getTime()) {
      setActivePreset("current-month");
    } else if (
      Math.abs(end.getTime() - today.getTime()) < 86400000 &&
      Math.abs(start.getTime() - subDays(today, 30).getTime()) < 86400000
    ) {
      setActivePreset("last-30");
    } else {
      setActivePreset("");
    }
  };

  useEffect(() => {
    if (user && currentCompany?.id) {
      const fetchData = async () => {
        const [vData, dData] = await Promise.all([
          supabase
            .from("vehicles")
            .select("id, plate, model")
            .eq("company_id", currentCompany.id)
            .eq("status", "active"),
          supabase.from("drivers").select("id, name").eq("company_id", currentCompany.id).eq("status", "active"),
        ]);
        if (vData.data) setVehicles(vData.data);
        if (dData.data) setDrivers(dData.data);
      };
      fetchData();
    }
  }, [currentCompany?.id, user]);

  useEffect(() => {
    if (user && currentCompany?.id) {
      fetchMonthlyEvolution();
    }
  }, [currentCompany?.id, user, startDate, endDate, vehicleId, driverId, viewMode]);

  const fetchMonthlyEvolution = async () => {
    if (!currentCompany?.id || !user) return;
    try {
      const months = eachMonthOfInterval({ start: startDate, end: endDate });
      const vId = cleanId(vehicleId);
      const dId = cleanId(driverId);

      const monthlyData = await Promise.all(
        months.map(async (month) => {
          const monthStart = startOfMonth(month);
          const monthEnd = endOfMonth(month);

          if (viewMode === 'journey') {
            // MODO POR JORNADA: Buscar jornadas do mês e suas receitas/despesas vinculadas
            let journeysQuery = supabase
              .from("journeys")
              .select("id")
              .eq("company_id", currentCompany.id)
              .eq("status", "completed")
              .is("deleted_at", null)
              .or(`and(start_date.gte.${monthStart.toISOString()},start_date.lte.${monthEnd.toISOString()}),and(start_date.is.null,end_date.gte.${monthStart.toISOString()},end_date.lte.${monthEnd.toISOString()})`);

            if (vId) journeysQuery = journeysQuery.eq("vehicle_id", vId);
            if (dId) journeysQuery = journeysQuery.eq("driver_id", dId);

            const { data: monthJourneys } = await journeysQuery;
            const monthJourneyIds = monthJourneys?.map(j => j.id) || [];

            if (monthJourneyIds.length === 0) {
              return {
                month: format(month, "MMM/yy", { locale: ptBR }),
                receitas: 0,
                despesas: 0,
                lucro: 0,
              };
            }

            // Buscar receitas das jornadas (sem filtro de data)
            const { data: revenues } = await supabase
              .from("revenue")
              .select("amount")
              .eq("company_id", currentCompany.id)
              .is("deleted_at", null)
              .in("journey_id", monthJourneyIds);

            // Buscar despesas das jornadas + despesas sem vínculo do mês
            const { data: expenses } = await supabase
              .from("expenses")
              .select("amount, vehicle_id")
              .eq("company_id", currentCompany.id)
              .is("deleted_at", null)
              .or(`journey_id.in.(${monthJourneyIds.join(',')}),and(journey_id.is.null,date.gte.${monthStart.toISOString()},date.lte.${monthEnd.toISOString()})`);

            // Buscar combustível das jornadas + combustível sem vínculo do mês
            const { data: fuel } = await supabase
              .from("fuel_expenses")
              .select("total_amount, vehicle_id")
              .eq("company_id", currentCompany.id)
              .is("deleted_at", null)
              .or(`journey_id.in.(${monthJourneyIds.join(',')}),and(journey_id.is.null,date.gte.${monthStart.toISOString()},date.lte.${monthEnd.toISOString()})`);

            // Aplicar filtro de veículo nas despesas/combustível
            let filteredExpenses = expenses || [];
            let filteredFuel = fuel || [];
            if (vId) {
              filteredExpenses = filteredExpenses.filter(e => e.vehicle_id === vId || !e.vehicle_id);
              filteredFuel = filteredFuel.filter(f => f.vehicle_id === vId);
            }

            const monthRevenue = revenues?.reduce((sum, r) => sum + r.amount, 0) || 0;
            const monthExpenses =
              filteredExpenses.reduce((s, e) => s + e.amount, 0) +
              filteredFuel.reduce((s, f) => s + f.total_amount, 0);

            return {
              month: format(month, "MMM/yy", { locale: ptBR }),
              receitas: monthRevenue,
              despesas: monthExpenses,
              lucro: monthRevenue - monthExpenses,
            };
          } else {
            // MODO COMPETÊNCIA (padrão): Filtrar por data do lançamento
            let revenueQuery = supabase
              .from("revenue")
              .select("amount, journey_id")
              .eq("company_id", currentCompany.id)
              .is("deleted_at", null)
              .gte("date", monthStart.toISOString())
              .lte("date", monthEnd.toISOString());

            let expenseQuery = supabase
              .from("expenses")
              .select("amount")
              .eq("company_id", currentCompany.id)
              .is("deleted_at", null)
              .gte("date", monthStart.toISOString())
              .lte("date", monthEnd.toISOString());

            let fuelQuery = supabase
              .from("fuel_expenses")
              .select("total_amount")
              .eq("company_id", currentCompany.id)
              .is("deleted_at", null)
              .gte("date", monthStart.toISOString())
              .lte("date", monthEnd.toISOString());

            // Apply vehicle/driver filter
            if (vId) {
              expenseQuery = expenseQuery.eq("vehicle_id", vId);
              fuelQuery = fuelQuery.eq("vehicle_id", vId);
            }

            // Se filtrar por veículo ou motorista, precisamos buscar jornadas para filtrar receitas
            if (vId || dId) {
              let journeysQuery = supabase
                .from("journeys")
                .select("id")
                .eq("company_id", currentCompany.id)
                .is("deleted_at", null);
              
              if (vId) journeysQuery = journeysQuery.eq("vehicle_id", vId);
              if (dId) journeysQuery = journeysQuery.eq("driver_id", dId);

              const { data: journeys } = await journeysQuery;
              const journeyIds = journeys?.map(j => j.id) || [];

              if (journeyIds.length > 0) {
                revenueQuery = revenueQuery.in("journey_id", journeyIds);
              } else {
                revenueQuery = revenueQuery.eq("journey_id", "00000000-0000-0000-0000-000000000000");
              }
            }

            const [revenueRes, expenseRes, fuelRes] = await Promise.all([
              revenueQuery,
              expenseQuery,
              fuelQuery,
            ]);

            const monthRevenue = revenueRes.data?.reduce((sum, r) => sum + r.amount, 0) || 0;
            const monthExpenses =
              (expenseRes.data?.reduce((s, e) => s + e.amount, 0) || 0) +
              (fuelRes.data?.reduce((s, f) => s + f.total_amount, 0) || 0);

            return {
              month: format(month, "MMM/yy", { locale: ptBR }),
              receitas: monthRevenue,
              despesas: monthExpenses,
              lucro: monthRevenue - monthExpenses,
            };
          }
        }),
      );
      setMonthlyEvolution(monthlyData);
    } catch (error) {
      console.error("Erro evolution:", error);
    }
  };

  const getFilteredDREData = useCallback(
    (data: ExtendedDREData | null) => {
      if (!data) return null;
      const filteredData = { ...data };

      if (selectedRevenueCategories.length > 0) {
        filteredData.revenue = {
          ...data.revenue,
          categories: data.revenue.categories.filter((cat: any) => selectedRevenueCategories.includes(cat.id)),
        };
        filteredData.revenue.total = filteredData.revenue.categories.reduce(
          (sum: number, cat: any) => sum + cat.amount,
          0,
        );
      }

      if (selectedExpenseCategories.length > 0) {
        filteredData.directExpenses = {
          ...data.directExpenses,
          categories: data.directExpenses.categories.filter((cat: any) => selectedExpenseCategories.includes(cat.id)),
        };
        filteredData.directExpenses.total =
          filteredData.directExpenses.categories.reduce((sum: number, cat: any) => sum + cat.amount, 0) +
          (filteredData.directExpenses.fuel?.total || 0) +
          (filteredData.directExpenses.maintenance?.total || 0);

        filteredData.indirectExpenses = {
          ...data.indirectExpenses,
          categories: data.indirectExpenses.categories.filter((cat: any) => selectedExpenseCategories.includes(cat.id)),
        };
        filteredData.indirectExpenses.total = filteredData.indirectExpenses.categories.reduce(
          (sum: number, cat: any) => sum + cat.amount,
          0,
        );
      }

      filteredData.result = calculateDREResult(
        filteredData.revenue.total,
        filteredData.directExpenses.total,
        filteredData.indirectExpenses.total,
      );

      return filteredData;
    },
    [selectedRevenueCategories, selectedExpenseCategories],
  );

  const filteredDREData = useMemo(() => (dreData ? getFilteredDREData(dreData) : null), [dreData, getFilteredDREData]);
  const filteredDREData2 = useMemo(
    () => (comparisonMode && dreData2 ? getFilteredDREData(dreData2) : null),
    [comparisonMode, dreData2, getFilteredDREData],
  );

  const handleCategoryDrillDown = async (categoryId: string, categoryType: "revenue" | "expense") => {
    if (!currentCompany?.id) return;
    try {
      // Tratamento especial para categoria sintética de manutenção
      if (categoryId === 'maintenance-system') {
        const category = { id: 'maintenance-system', name: 'Manutenção', icon: 'Wrench', color: '#EF4444', classification: 'direct' };

        const { data, error } = await supabase
          .from('vehicle_maintenances')
          .select('*, vehicles(plate, model), workshops(name)')
          .eq('company_id', currentCompany.id)
          .eq('status', 'completed')
          .gte('service_date', startDate.toISOString())
          .lte('service_date', endDate.toISOString())
          .order('service_date', { ascending: false });

        if (error) throw error;

        const mapped = (data || []).map((m: any) => ({
          id: m.id,
          amount: m.total_cost || 0,
          date: m.service_date,
          description: (m.service_type || 'Manutenção') + (m.description ? ' - ' + m.description : ''),
          supplier: m.workshops?.name || '-',
          vehicles: m.vehicles,
          status: m.status,
        }));

        setDrillDownCategory({ type: 'expense', category, data: mapped });
        return;
      }

      const category =
        categoryType === "revenue"
          ? revenueCategories.find((c) => c.id === categoryId)
          : expenseCategories.find((c) => c.id === categoryId);

      if (!category) return;

      const table = categoryType === "revenue" ? "revenue" : "expenses";
      const select =
        categoryType === "revenue"
          ? `*, journeys(journey_number, origin, destination)`
          : `*, journeys(journey_number, origin, destination), vehicles(plate, model)`;

      const { data, error } = await supabase
        .from(table)
        .select(select)
        .eq("company_id", currentCompany.id)
        .eq("category_id", categoryId)
        .gte("date", startDate.toISOString())
        .lte("date", endDate.toISOString())
        .is("deleted_at", null)
        .order("date", { ascending: false });

      if (error) throw error;

      let combined: any[] = (data || []) as any[];

      // Para despesas, também buscar contas pagas (accounts_payable) com mesmo category_id
      if (categoryType === "expense") {
        const { data: paidData, error: paidError } = await supabase
          .from("accounts_payable")
          .select("*, expense_categories(*), journeys(journey_number, origin, destination)")
          .eq("company_id", currentCompany.id)
          .eq("category_id", categoryId)
          .eq("status", "paid")
          .is("deleted_at", null)
          .gte("payment_date", startDate.toISOString().split('T')[0])
          .lte("payment_date", endDate.toISOString().split('T')[0]);

        if (!paidError && paidData) {
          // Filtrar contas que já estão vinculadas a uma expense (evitar duplicatas)
          const expenseIds = new Set((data || []).map((e: any) => e.accounts_payable_id).filter(Boolean));
          const linkedExpenseIds = new Set((data || []).map((e: any) => e.id));

          const uniquePaid = paidData.filter((ap: any) => {
            // Se a conta tem expense_id e essa expense já está nos resultados, pular
            if (ap.expense_id && linkedExpenseIds.has(ap.expense_id)) return false;
            // Se alguma expense já aponta para esta conta, pular
            if (expenseIds.has(ap.id)) return false;
            return true;
          });

          const mappedPaid = uniquePaid.map((a: any) => ({
            id: a.id,
            amount: Number(a.amount),
            date: a.payment_date,
            description: a.description || 'Conta a pagar',
            supplier: a.supplier,
            vehicles: a.vehicles,
            journeys: a.journeys,
            status: a.status,
            source: 'accounts_payable' as const,
          }));

          combined = [...(combined as any[]), ...mappedPaid]
            .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
        }
      }

      setDrillDownCategory({ type: categoryType, category, data: combined });
    } catch (error) {
      toast({ title: "Erro", description: "Falha ao carregar detalhes.", variant: "destructive" });
    }
  };

  // Dados para gráfico de pizza de composição de custos
  const expenseCompositionData = useMemo(() => {
    if (!filteredDREData) return [];
    const data = [
      { name: "Combustível", value: filteredDREData.directExpenses.fuel.total, color: "#ef4444" },
      ...filteredDREData.directExpenses.categories.map((cat: any, i: number) => ({
        name: cat.name,
        value: cat.amount,
        color: cat.color || CHART_COLORS[i % CHART_COLORS.length],
      })),
      ...filteredDREData.indirectExpenses.categories.map((cat: any, i: number) => ({
        name: cat.name,
        value: cat.amount,
        color: cat.color || CHART_COLORS[(i + 3) % CHART_COLORS.length],
      })),
    ].filter((d) => d.value > 0);
    return data;
  }, [filteredDREData]);

  const exportToPDF = useCallback(async () => {
    if (!filteredDREData) return;
    
    toast({ title: "Gerando PDF analítico...", description: "Buscando dados detalhados" });
    
    // Buscar dados detalhados com TODOS os filtros ativos (WYSIWYG)
    const detailedData: DetailedDREData | null = await fetchDetailedData({
      startDate,
      endDate,
      vehicleId: cleanId(vehicleId),
      driverId: cleanId(driverId),
      viewMode,
      selectedRevenueCategories: selectedRevenueCategories.length > 0 ? selectedRevenueCategories : undefined,
      selectedExpenseCategories: selectedExpenseCategories.length > 0 ? selectedExpenseCategories : undefined,
    });
    
    const doc = new jsPDF();
    let yPos = 20;

    const selectedVehicle = vehicleId !== "all" ? vehicles.find(v => v.id === vehicleId) : null;
    const selectedDriver = driverId !== "all" ? drivers.find(d => d.id === driverId) : null;

    // Cabeçalho
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("DRE ANALÍTICO - Relatório Gerencial Detalhado", 20, yPos);
    yPos += 10;
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text(
      `Período: ${format(filteredDREData.period.start, "dd/MM/yyyy")} - ${format(filteredDREData.period.end, "dd/MM/yyyy")}`,
      20,
      yPos,
    );
    yPos += 6;
    doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm")}`, 20, yPos);
    yPos += 6;
    doc.text(`Modo: ${viewMode === 'journey' ? 'Por Jornada' : 'Competência'}`, 20, yPos);
    yPos += 6;
    
    if (selectedVehicle) {
      doc.text(`Veículo: ${selectedVehicle.plate} ${selectedVehicle.model || ''}`, 20, yPos);
      yPos += 6;
    }
    if (selectedDriver) {
      doc.text(`Motorista: ${selectedDriver.name}`, 20, yPos);
      yPos += 6;
    }
    if (selectedRevenueCategories.length > 0) {
      const catNames = revenueCategories
        .filter(c => selectedRevenueCategories.includes(c.id))
        .map(c => c.name).join(', ');
      doc.text(`Categorias Receita: ${catNames}`, 20, yPos);
      yPos += 6;
    }
    if (selectedExpenseCategories.length > 0) {
      const catNames = expenseCategories
        .filter(c => selectedExpenseCategories.includes(c.id))
        .map(c => c.name).join(', ');
      doc.text(`Categorias Despesa: ${catNames}`, 20, yPos);
      yPos += 6;
    }
    yPos += 5;

    // Resumo Geral
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("RESUMO GERAL", 20, yPos);
    yPos += 5;
    
    autoTable(doc, {
      startY: yPos,
      head: [["Indicador", "Valor"]],
      body: [
        ["Total de Jornadas", `${filteredDREData.journeys.count}`],
        ["Distância Total", `${filteredDREData.journeys.totalDistance.toFixed(0)} km`],
        ["Receita Total", formatCurrency(filteredDREData.revenue.total)],
        ["Despesas Diretas", formatCurrency(filteredDREData.directExpenses.total)],
        ["Despesas Indiretas", formatCurrency(filteredDREData.indirectExpenses.total)],
        ["LUCRO/PREJUÍZO", formatCurrency(filteredDREData.result.profit)],
        ["Margem", `${filteredDREData.result.margin.toFixed(2)}%`],
      ],
      headStyles: { fillColor: [59, 130, 246] },
      alternateRowStyles: { fillColor: [245, 247, 250] },
    });

    yPos = (doc as any).lastAutoTable.finalY + 15;

    // ============= RECEITAS DETALHADAS =============
    if (detailedData && detailedData.revenues.length > 0) {
      // Verificar se precisa nova página
      if (yPos > 250) {
        doc.addPage();
        yPos = 20;
      }
      
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("RECEITAS - DETALHAMENTO ANALÍTICO", 20, yPos);
      yPos += 5;

      // Agrupar receitas por categoria
      const revenuesByCategory = detailedData.revenues.reduce((acc, r) => {
        const cat = r.categoryName || 'Outros';
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(r);
        return acc;
      }, {} as Record<string, typeof detailedData.revenues>);

      for (const [category, items] of Object.entries(revenuesByCategory)) {
        if (yPos > 260) {
          doc.addPage();
          yPos = 20;
        }
        
        const categoryTotal = items.reduce((sum, i) => sum + i.amount, 0);
        
        autoTable(doc, {
          startY: yPos,
          head: [[`${category}`, "Jornada", "Valor", `Subtotal: ${formatCurrency(categoryTotal)}`]],
          body: items.map(r => [
            format(new Date(r.date), "dd/MM/yy"),
            r.journeyNumber || '-',
            r.description.substring(0, 40),
            formatCurrency(r.amount),
          ]),
          headStyles: { fillColor: [16, 185, 129] },
          columnStyles: {
            0: { cellWidth: 25 },
            1: { cellWidth: 25 },
            2: { cellWidth: 90 },
            3: { cellWidth: 35, halign: 'right' },
          },
          margin: { left: 20, right: 20 },
        });
        yPos = (doc as any).lastAutoTable.finalY + 8;
      }
    }

    // ============= COMBUSTÍVEL DETALHADO =============
    if (detailedData && detailedData.fuelExpenses.length > 0) {
      if (yPos > 220) {
        doc.addPage();
        yPos = 20;
      }
      
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("COMBUSTÍVEL - DETALHAMENTO ANALÍTICO", 20, yPos);
      yPos += 5;

      const fuelTotal = detailedData.fuelExpenses.reduce((sum, f) => sum + f.amount, 0);
      
      autoTable(doc, {
        startY: yPos,
        head: [["Data", "Veículo", "Descrição", `Total: ${formatCurrency(fuelTotal)}`]],
        body: detailedData.fuelExpenses.map(f => [
          format(new Date(f.date), "dd/MM/yy"),
          f.vehicle || '-',
          f.description.substring(0, 55),
          formatCurrency(f.amount),
        ]),
        headStyles: { fillColor: [245, 158, 11] },
        columnStyles: {
          0: { cellWidth: 25 },
          1: { cellWidth: 25 },
          2: { cellWidth: 95 },
          3: { cellWidth: 30, halign: 'right' },
        },
        margin: { left: 20, right: 20 },
      });
      yPos = (doc as any).lastAutoTable.finalY + 10;
    }

    // ============= MANUTENÇÕES DETALHADAS =============
    if (detailedData && detailedData.maintenanceExpenses.length > 0) {
      if (yPos > 220) {
        doc.addPage();
        yPos = 20;
      }
      
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("MANUTENÇÃO - DETALHAMENTO ANALÍTICO", 20, yPos);
      yPos += 5;

      const maintenanceTotal = detailedData.maintenanceExpenses.reduce((sum, m) => sum + m.amount, 0);
      
      autoTable(doc, {
        startY: yPos,
        head: [["Data", "Veículo", "Descrição", `Total: ${formatCurrency(maintenanceTotal)}`]],
        body: detailedData.maintenanceExpenses.map(m => [
          format(new Date(m.date), "dd/MM/yy"),
          m.vehicle || '-',
          m.description.substring(0, 55),
          formatCurrency(m.amount),
        ]),
        headStyles: { fillColor: [239, 68, 68] },
        columnStyles: {
          0: { cellWidth: 25 },
          1: { cellWidth: 25 },
          2: { cellWidth: 95 },
          3: { cellWidth: 30, halign: 'right' },
        },
        margin: { left: 20, right: 20 },
      });
      yPos = (doc as any).lastAutoTable.finalY + 10;
    }

    // ============= DESPESAS DIRETAS DETALHADAS =============
    if (detailedData && detailedData.directExpenses.length > 0) {
      if (yPos > 200) {
        doc.addPage();
        yPos = 20;
      }
      
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("OUTRAS DESPESAS DIRETAS - DETALHAMENTO ANALÍTICO", 20, yPos);
      yPos += 5;

      // Agrupar por categoria
      const directByCategory = detailedData.directExpenses.reduce((acc, e) => {
        const cat = e.categoryName || 'Outros';
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(e);
        return acc;
      }, {} as Record<string, typeof detailedData.directExpenses>);

      for (const [category, items] of Object.entries(directByCategory)) {
        if (yPos > 260) {
          doc.addPage();
          yPos = 20;
        }
        
        const categoryTotal = items.reduce((sum, i) => sum + i.amount, 0);
        
        autoTable(doc, {
          startY: yPos,
          head: [[`${category}`, "Fornecedor", "Descrição", `Subtotal: ${formatCurrency(categoryTotal)}`]],
          body: items.map(e => [
            format(new Date(e.date), "dd/MM/yy"),
            (e.supplier || '-').substring(0, 20),
            e.description.substring(0, 45),
            formatCurrency(e.amount),
          ]),
          headStyles: { fillColor: [59, 130, 246] },
          columnStyles: {
            0: { cellWidth: 25 },
            1: { cellWidth: 35 },
            2: { cellWidth: 85 },
            3: { cellWidth: 30, halign: 'right' },
          },
          margin: { left: 20, right: 20 },
        });
        yPos = (doc as any).lastAutoTable.finalY + 8;
      }
    }

    // ============= DESPESAS INDIRETAS DETALHADAS =============
    if (detailedData && detailedData.indirectExpenses.length > 0) {
      if (yPos > 200) {
        doc.addPage();
        yPos = 20;
      }
      
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("DESPESAS INDIRETAS - DETALHAMENTO ANALÍTICO", 20, yPos);
      yPos += 5;

      // Agrupar por categoria
      const indirectByCategory = detailedData.indirectExpenses.reduce((acc, e) => {
        const cat = e.categoryName || 'Outros';
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(e);
        return acc;
      }, {} as Record<string, typeof detailedData.indirectExpenses>);

      for (const [category, items] of Object.entries(indirectByCategory)) {
        if (yPos > 260) {
          doc.addPage();
          yPos = 20;
        }
        
        const categoryTotal = items.reduce((sum, i) => sum + i.amount, 0);
        
        autoTable(doc, {
          startY: yPos,
          head: [[`${category}`, "Fornecedor", "Descrição", `Subtotal: ${formatCurrency(categoryTotal)}`]],
          body: items.map(e => [
            format(new Date(e.date), "dd/MM/yy"),
            (e.supplier || '-').substring(0, 20),
            e.description.substring(0, 45),
            formatCurrency(e.amount),
          ]),
          headStyles: { fillColor: [139, 92, 246] },
          columnStyles: {
            0: { cellWidth: 25 },
            1: { cellWidth: 35 },
            2: { cellWidth: 85 },
            3: { cellWidth: 30, halign: 'right' },
          },
          margin: { left: 20, right: 20 },
        });
        yPos = (doc as any).lastAutoTable.finalY + 8;
      }
    }

    // ============= INDICADORES OPERACIONAIS =============
    if (yPos > 220) {
      doc.addPage();
      yPos = 20;
    }
    
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("INDICADORES OPERACIONAIS", 20, yPos);
    yPos += 5;

    autoTable(doc, {
      startY: yPos,
      head: [["Indicador", "Valor"]],
      body: [
        ["Volume Abastecido", `${filteredDREData.indicators.operational.totalVolume.toFixed(0)} L`],
        ["Preço Médio/L", formatCurrency(filteredDREData.indicators.operational.avgPrice)],
        ["Consumo Médio", `${filteredDREData.indicators.operational.avgConsumption.toFixed(2)} km/L`],
        ["Receita/km", formatCurrency(filteredDREData.indicators.financial.revenuePerKm)],
        ["Lucro/km", formatCurrency(filteredDREData.indicators.financial.profitPerKm)],
      ],
      headStyles: { fillColor: [107, 114, 128] },
    });

    // ============= CONFERÊNCIA DE VALORES =============
    if (detailedData) {
      if (yPos > 200) {
        doc.addPage();
        yPos = 20;
      }

      const detailRevTotal = detailedData.summary.totalRevenue;
      const detailDirectTotal = detailedData.summary.totalDirectExpenses;
      const detailIndirectTotal = detailedData.summary.totalIndirectExpenses;

      const screenRevenue = filteredDREData.revenue.total;
      const screenDirect = filteredDREData.directExpenses.total;
      const screenIndirect = filteredDREData.indirectExpenses.total;

      const revenueMatch = Math.abs(detailRevTotal - screenRevenue) < 0.01;
      const directMatch = Math.abs(detailDirectTotal - screenDirect) < 0.01;
      const indirectMatch = Math.abs(detailIndirectTotal - screenIndirect) < 0.01;

      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("CONFERÊNCIA DE VALORES", 20, yPos);
      yPos += 5;

      autoTable(doc, {
        startY: yPos,
        head: [["Indicador", "Resumo (Tela)", "Detalhes (PDF)", "Status"]],
        body: [
          ["Receita Total", formatCurrency(screenRevenue), formatCurrency(detailRevTotal), revenueMatch ? "✓ OK" : "⚠ DIVERGENTE"],
          ["Despesas Diretas", formatCurrency(screenDirect), formatCurrency(detailDirectTotal), directMatch ? "✓ OK" : "⚠ DIVERGENTE"],
          ["Despesas Indiretas", formatCurrency(screenIndirect), formatCurrency(detailIndirectTotal), indirectMatch ? "✓ OK" : "⚠ DIVERGENTE"],
        ],
        headStyles: { fillColor: [75, 85, 99] },
        alternateRowStyles: { fillColor: [245, 247, 250] },
        columnStyles: {
          3: { fontStyle: 'bold' },
        },
      });
      yPos = (doc as any).lastAutoTable.finalY + 5;

      if (!revenueMatch || !directMatch || !indirectMatch) {
        doc.setFontSize(9);
        doc.setFont("helvetica", "italic");
        doc.text("⚠ Divergência detectada. Possíveis causas: filtros de categoria aplicados ou arredondamento.", 20, yPos);
      }
    }

    // Rodapé em todas as páginas
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.text(
        `Página ${i} de ${pageCount} | DRE Analítico - ${currentCompany?.name || 'Empresa'}`,
        20,
        doc.internal.pageSize.height - 10
      );
    }

    const filename = selectedVehicle 
      ? `dre-analitico-${selectedVehicle.plate}-${format(new Date(), "yyyy-MM-dd")}.pdf`
      : `dre-analitico-${format(new Date(), "yyyy-MM-dd")}.pdf`;
    doc.save(filename);
    toast({ title: "PDF analítico exportado com sucesso", description: `${pageCount} página(s) geradas` });
  }, [filteredDREData, toast, vehicleId, vehicles, driverId, drivers, startDate, endDate, viewMode, currentCompany, selectedRevenueCategories, selectedExpenseCategories, revenueCategories, expenseCategories]);

  const exportToExcel = async () => {
    if (!filteredDREData) return;
    try {
      const { createWorkbook, addArraySheet, downloadWorkbook } = await import("@/lib/excelExport");

      toast({ title: "Gerando Excel detalhado...", description: "Buscando dados analíticos" });

      const detailedData = await fetchDetailedData({
        startDate,
        endDate,
        vehicleId: cleanId(vehicleId),
        driverId: cleanId(driverId),
        viewMode,
        selectedRevenueCategories: selectedRevenueCategories.length > 0 ? selectedRevenueCategories : undefined,
        selectedExpenseCategories: selectedExpenseCategories.length > 0 ? selectedExpenseCategories : undefined,
      });

      if (!detailedData) {
        toast({ title: "Erro ao buscar dados detalhados", variant: "destructive" });
        return;
      }

      const wb = await createWorkbook();
      const fmtDate = (d: string) => {
        try { return format(new Date(d), "dd/MM/yyyy"); } catch { return d; }
      };
      const fmtVal = (v: number) => Number(v.toFixed(2));

      const selectedVehicle = vehicleId !== "all" ? vehicles.find(v => v.id === vehicleId) : null;
      const selectedDriver = driverId !== "all" ? drivers.find(d => d.id === driverId) : null;
      const modeLabel = viewMode === 'journey' ? 'Por Jornada' : 'Competência';

      const totalExpenses = filteredDREData.directExpenses.total + filteredDREData.indirectExpenses.total;
      const profit = filteredDREData.result.profit;
      const margin = filteredDREData.result.margin;

      // Aba 1: Resumo
      addArraySheet(wb, [
        ["DRE Gerencial - Relatório Detalhado"],
        ["Empresa", currentCompany?.name || ''],
        ["Período", `${format(startDate, "dd/MM/yyyy")} - ${format(endDate, "dd/MM/yyyy")}`],
        ["Modo", modeLabel],
        ...(selectedVehicle ? [["Veículo", selectedVehicle.plate]] : []),
        ...(selectedDriver ? [["Motorista", selectedDriver.name]] : []),
        [""],
        ["═══ RESULTADO ═══"],
        ["Receita Total", fmtVal(filteredDREData.revenue.total)],
        ["Despesas Diretas", fmtVal(filteredDREData.directExpenses.total)],
        ["Despesas Indiretas", fmtVal(filteredDREData.indirectExpenses.total)],
        ["Despesas Totais", fmtVal(totalExpenses)],
        ["Lucro Líquido", fmtVal(profit)],
        ["Margem %", fmtVal(margin)],
        [""],
        ["═══ OPERACIONAL ═══"],
        ["Jornadas", filteredDREData.journeys.count],
        ["Distância (km)", fmtVal(filteredDREData.journeys.totalDistance)],
        ["Combustível (L)", fmtVal(filteredDREData.indicators.operational.totalVolume)],
        ["Preço Médio/L", fmtVal(filteredDREData.indicators.operational.avgPrice)],
        ["Consumo (km/L)", fmtVal(filteredDREData.indicators.operational.avgConsumption)],
        [""],
        ["═══ INDICADORES FINANCEIROS ═══"],
        ["Receita/km", fmtVal(filteredDREData.indicators.financial.revenuePerKm)],
        ["Lucro/km", fmtVal(filteredDREData.indicators.financial.profitPerKm)],
        [""],
        ["═══ FLUXO DE CAIXA ═══"],
        ["Adiantamentos", fmtVal(filteredDREData.cashFlow.advances)],
        ["Comissões", fmtVal(filteredDREData.cashFlow.commissions)],
        ["Saldo", fmtVal(filteredDREData.cashFlow.balance)],
      ], "Resumo");

      // Aba 2: Receitas
      const revenueRows = detailedData.revenues.map(r => [
        fmtDate(r.date), r.description, r.categoryName, r.journeyNumber || '-', fmtVal(r.amount)
      ]);
      const totalRevenue = detailedData.revenues.reduce((s, r) => s + r.amount, 0);
      addArraySheet(wb, [
        ["Data", "Descrição", "Categoria", "Jornada", "Valor"],
        ...revenueRows,
        [""],
        ["TOTAL", "", "", "", fmtVal(totalRevenue)],
      ], "Receitas");

      // Aba 3: Despesas Diretas
      const directRows = detailedData.directExpenses.map(e => [
        fmtDate(e.date), e.description, e.categoryName, e.supplier || '-', e.vehicle || '-',
        e.source === 'paid_account' ? 'Conta Paga' : 'Despesa', fmtVal(e.amount)
      ]);
      const totalDirect = detailedData.directExpenses.reduce((s, e) => s + e.amount, 0);
      addArraySheet(wb, [
        ["Data", "Descrição", "Categoria", "Fornecedor", "Veículo", "Origem", "Valor"],
        ...directRows,
        [""],
        ["TOTAL", "", "", "", "", "", fmtVal(totalDirect)],
      ], "Despesas Diretas");

      // Aba 4: Combustível
      const fuelRows = detailedData.fuelExpenses.map(f => [
        fmtDate(f.date), f.description, f.vehicle || '-', fmtVal(f.amount)
      ]);
      const totalFuel = detailedData.fuelExpenses.reduce((s, f) => s + f.amount, 0);
      addArraySheet(wb, [
        ["Data", "Descrição", "Veículo", "Valor"],
        ...fuelRows,
        [""],
        ["TOTAL", "", "", fmtVal(totalFuel)],
      ], "Combustível");

      // Aba 5: Manutenção
      const maintRows = detailedData.maintenanceExpenses.map(m => [
        fmtDate(m.date), m.description, m.supplier || '-', m.vehicle || '-', fmtVal(m.amount)
      ]);
      const totalMaint = detailedData.maintenanceExpenses.reduce((s, m) => s + m.amount, 0);
      addArraySheet(wb, [
        ["Data", "Descrição", "Fornecedor", "Veículo", "Valor"],
        ...maintRows,
        [""],
        ["TOTAL", "", "", "", fmtVal(totalMaint)],
      ], "Manutenção");

      // Aba 6: Despesas Indiretas
      const indirectRows = detailedData.indirectExpenses.map(e => [
        fmtDate(e.date), e.description, e.categoryName, e.supplier || '-',
        e.source === 'paid_account' ? 'Conta Paga' : 'Despesa', fmtVal(e.amount)
      ]);
      const totalIndirect = detailedData.indirectExpenses.reduce((s, e) => s + e.amount, 0);
      addArraySheet(wb, [
        ["Data", "Descrição", "Categoria", "Fornecedor", "Origem", "Valor"],
        ...indirectRows,
        [""],
        ["TOTAL", "", "", "", "", fmtVal(totalIndirect)],
      ], "Despesas Indiretas");

      // Aba 7: Categorias (agrupado)
      const categoryMap = new Map<string, { name: string; type: string; total: number }>();
      detailedData.revenues.forEach(r => {
        const key = `rev-${r.categoryName}`;
        const existing = categoryMap.get(key);
        categoryMap.set(key, { name: r.categoryName, type: 'Receita', total: (existing?.total || 0) + r.amount });
      });
      [...detailedData.directExpenses, ...detailedData.fuelExpenses, ...detailedData.maintenanceExpenses].forEach(e => {
        const key = `dir-${e.categoryName}`;
        const existing = categoryMap.get(key);
        categoryMap.set(key, { name: e.categoryName, type: 'Direto', total: (existing?.total || 0) + e.amount });
      });
      detailedData.indirectExpenses.forEach(e => {
        const key = `ind-${e.categoryName}`;
        const existing = categoryMap.get(key);
        categoryMap.set(key, { name: e.categoryName, type: 'Indireto', total: (existing?.total || 0) + e.amount });
      });
      const grandTotal = Array.from(categoryMap.values()).reduce((s, c) => s + c.total, 0);
      const categoryRows = Array.from(categoryMap.values())
        .sort((a, b) => b.total - a.total)
        .map(c => [c.name, c.type, fmtVal(c.total), grandTotal > 0 ? fmtVal((c.total / grandTotal) * 100) : 0]);
      addArraySheet(wb, [
        ["Categoria", "Tipo", "Valor", "% do Total"],
        ...categoryRows,
      ], "Categorias");

      const filename = selectedVehicle
        ? `dre-detalhado-${selectedVehicle.plate}-${format(new Date(), "yyyy-MM-dd")}.xlsx`
        : `dre-detalhado-${format(new Date(), "yyyy-MM-dd")}.xlsx`;
      await downloadWorkbook(wb, filename);
      toast({ title: "Excel detalhado exportado com sucesso", description: "7 abas geradas com dados analíticos" });
    } catch (e) {
      console.error('Erro ao exportar Excel:', e);
      toast({ title: "Erro ao exportar Excel", variant: "destructive" });
    }
  };

  if (tenantLoading) return <LoadingSkeleton />;
  if (!user) return <div className="flex justify-center p-10">Acesso Restrito</div>;
  if (!currentCompany) return <div className="p-10">Selecione uma empresa</div>;

  return (
    <div className="w-full p-4 md:p-8 space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">DRE Gerencial</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {format(startDate, "dd/MM/yyyy")} - {format(endDate, "dd/MM/yyyy")}
              {vehicleId !== "all" && vehicles.find(v => v.id === vehicleId) && (
                <Badge variant="secondary" className="ml-2">
                  <Truck className="h-3 w-3 mr-1" />
                  {vehicles.find(v => v.id === vehicleId)?.plate}
                </Badge>
              )}
              {driverId !== "all" && drivers.find(d => d.id === driverId) && (
                <Badge variant="secondary" className="ml-2">
                  {drivers.find(d => d.id === driverId)?.name}
                </Badge>
              )}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)}>
              <Filter className="h-4 w-4 mr-2" />
              Filtros
              {showFilters ? <ChevronUp className="h-4 w-4 ml-1" /> : <ChevronDown className="h-4 w-4 ml-1" />}
            </Button>
            <Button variant="outline" size="sm" onClick={refetch} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Atualizar</span>
            </Button>
            <div className="flex gap-1 border-l pl-2 ml-1">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" onClick={exportToPDF} disabled={!filteredDREData || loading}>
                      <Download className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Exportar PDF</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" onClick={exportToExcel} disabled={!filteredDREData || loading}>
                      <FileSpreadsheet className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Exportar Excel</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
        </div>

        {/* Quick Vehicle Filter */}
        <div className="flex flex-wrap items-center gap-2">
          <PeriodPresets onSelect={handlePeriodPresetSelect} activePreset={activePreset} />
          <Separator orientation="vertical" className="h-6 hidden sm:block" />
          <ReportViewModeSelector mode={viewMode} onChange={setViewMode} />
          <Separator orientation="vertical" className="h-6 hidden sm:block" />
          <div className="flex items-center gap-2">
            <Truck className="h-4 w-4 text-muted-foreground" />
            <Select value={vehicleId} onValueChange={setVehicleId}>
              <SelectTrigger className="w-[140px] h-8 text-xs">
                <SelectValue placeholder="Veículo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos Veículos</SelectItem>
                {vehicles.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.plate} {v.model ? `- ${v.model}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <Card className="border-muted bg-muted/10">
          <CardContent className="pt-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
              <div className="space-y-2 sm:col-span-2">
                <Label className="flex items-center gap-2 text-xs">
                  <Calendar className="h-3.5 w-3.5" /> Período Personalizado
                </Label>
                <div className="flex gap-2">
                  <Input
                    type="date"
                    value={format(startDate, "yyyy-MM-dd")}
                    onChange={(e) => {
                      setStartDate(new Date(e.target.value));
                      setActivePreset("");
                    }}
                    className="bg-background text-sm"
                  />
                  <Input
                    type="date"
                    value={format(endDate, "yyyy-MM-dd")}
                    onChange={(e) => {
                      setEndDate(new Date(e.target.value));
                      setActivePreset("");
                    }}
                    className="bg-background text-sm"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Veículo</Label>
                <Select value={vehicleId} onValueChange={setVehicleId}>
                  <SelectTrigger className="bg-background text-sm">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {vehicles.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.plate}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Motorista</Label>
                <Select value={driverId} onValueChange={setDriverId}>
                  <SelectTrigger className="bg-background text-sm">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {drivers.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <Switch id="comparison-mode" checked={comparisonMode} onCheckedChange={setComparisonMode} />
              <Label htmlFor="comparison-mode" className="cursor-pointer text-sm">
                Comparar com período anterior
              </Label>
            </div>

            {comparisonMode && (
              <div className="p-3 border rounded-md bg-background/50 space-y-2">
                <Label className="text-xs text-muted-foreground">Período de Comparação</Label>
                <div className="flex gap-2 max-w-md">
                  <Input
                    type="date"
                    value={format(startDate2, "yyyy-MM-dd")}
                    onChange={(e) => setStartDate2(new Date(e.target.value))}
                    className="text-sm"
                  />
                  <Input
                    type="date"
                    value={format(endDate2, "yyyy-MM-dd")}
                    onChange={(e) => setEndDate2(new Date(e.target.value))}
                    className="text-sm"
                  />
                </div>
              </div>
            )}

            <div className="grid md:grid-cols-2 gap-4 pt-2">
              <CategoryFilter
                title="Filtrar Receitas"
                categories={revenueCategories}
                selectedCategories={selectedRevenueCategories}
                onSelectionChange={setSelectedRevenueCategories}
                type="revenue"
              />
              <CategoryFilter
                title="Filtrar Despesas"
                categories={expenseCategories}
                selectedCategories={selectedExpenseCategories}
                onSelectionChange={setSelectedExpenseCategories}
                type="expense"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {loading || (comparisonMode && loading2) ? (
        <LoadingSkeleton />
      ) : !filteredDREData ? (
        <Card className="border-dashed">
          <CardContent className="py-16 text-center text-muted-foreground">
            Sem dados para o período selecionado
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Data Quality Alert */}
          {filteredDREData.dataQuality && (
            <DREDataQualityAlert
              dreData={filteredDREData}
              journeysWithoutDistance={filteredDREData.dataQuality.journeysWithoutDistance}
              unlinkedFuelCount={filteredDREData.dataQuality.unlinkedFuelCount}
            />
          )}

          {/* Insights */}
          <DREInsights dreData={filteredDREData} previousDreData={filteredDREData2} />

          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
            <DREStatCard
              title="Receita Total"
              value={formatCurrency(filteredDREData.revenue.total)}
              subValue={`${formatCurrency(filteredDREData.indicators.financial.revenuePerKm)}/km`}
              icon={DollarSign}
              tooltip="Soma de todas as receitas registradas no período selecionado"
              variation={
                comparisonMode && filteredDREData2 && filteredDREData2.revenue.total > 0
                  ? ((filteredDREData.revenue.total - filteredDREData2.revenue.total) /
                      filteredDREData2.revenue.total) *
                    100
                  : undefined
              }
            />
            <DREStatCard
              title="Despesas Totais"
              value={formatCurrency(filteredDREData.directExpenses.total + filteredDREData.indirectExpenses.total)}
              icon={Receipt}
              tooltip="Soma de todas as despesas diretas (operacionais) e indiretas (administrativas)"
              variation={
                comparisonMode && filteredDREData2
                  ? ((filteredDREData.directExpenses.total +
                      filteredDREData.indirectExpenses.total -
                      (filteredDREData2.directExpenses.total + filteredDREData2.indirectExpenses.total)) /
                      (filteredDREData2.directExpenses.total + filteredDREData2.indirectExpenses.total || 1)) *
                    100
                  : undefined
              }
            />
            <DREStatCard
              title="Lucro Líquido"
              value={formatCurrency(filteredDREData.result.profit)}
              type={filteredDREData.result.profit >= 0 ? "success" : "danger"}
              icon={TrendingUp}
              tooltip="Receita Total - Despesas Totais = Lucro Líquido"
              variation={
                comparisonMode && filteredDREData2
                  ? ((filteredDREData.result.profit - filteredDREData2.result.profit) /
                      Math.abs(filteredDREData2.result.profit || 1)) *
                    100
                  : undefined
              }
            />
            <DREStatCard
              title="Margem"
              value={`${filteredDREData.result.margin.toFixed(1)}%`}
              subValue={`${formatCurrency(filteredDREData.indicators.financial.profitPerKm)}/km`}
              type={
                filteredDREData.result.margin > 10
                  ? "success"
                  : filteredDREData.result.margin > 0
                    ? "neutral"
                    : "danger"
              }
              icon={Percent}
              tooltip="Margem = (Lucro / Receita) × 100. Ideal: acima de 15%"
            />
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
            {/* Operação + Balanço */}
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Truck className="h-4 w-4" /> Operação
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-muted-foreground">Jornadas</span>
                    <span className="font-bold">{filteredDREData.journeys.count}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-muted-foreground">Distância</span>
                    <span className="font-bold">{filteredDREData.journeys.totalDistance.toFixed(0)} km</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-muted-foreground">Média/Jornada</span>
                    <span className="font-medium text-sm">
                      {filteredDREData.journeys.count > 0
                        ? (filteredDREData.journeys.totalDistance / filteredDREData.journeys.count).toFixed(0)
                        : 0}{" "}
                      km
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* Indicadores Operacionais */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Fuel className="h-4 w-4" /> Combustível
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-muted-foreground">Volume</span>
                    <span className="font-bold">{filteredDREData.indicators.operational.totalVolume.toFixed(0)} L</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-muted-foreground">Preço Médio</span>
                    <span className="font-bold">
                      {formatCurrency(filteredDREData.indicators.operational.avgPrice)}/L
                    </span>
                  </div>
                  <Separator />
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-muted-foreground">Consumo Médio</span>
                    <Badge
                      variant={
                        filteredDREData.indicators.operational.avgConsumption >= 3.5
                          ? "default"
                          : filteredDREData.indicators.operational.avgConsumption >= 2.5
                            ? "secondary"
                            : "destructive"
                      }
                      className="font-bold"
                    >
                      {filteredDREData.indicators.operational.avgConsumption.toFixed(2)} km/L
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Evolução Financeira */}
            <Card className="lg:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" /> Evolução Financeira
                </CardTitle>
              </CardHeader>
              <CardContent className="h-[280px] md:h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={monthlyEvolution}>
                    <defs>
                      <linearGradient id="colorReceitas" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorDespesas" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 11 }} />
                    <YAxis
                      tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 11 }}
                      width={45}
                    />
                    <RechartsTooltip
                      formatter={(value) => formatCurrency(value as number)}
                      contentStyle={{
                        borderRadius: "8px",
                        border: "none",
                        boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                      }}
                    />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: "12px" }} />
                    <Area
                      type="monotone"
                      dataKey="receitas"
                      name="Receitas"
                      stroke="#10b981"
                      fillOpacity={1}
                      fill="url(#colorReceitas)"
                      strokeWidth={2}
                    />
                    <Area
                      type="monotone"
                      dataKey="despesas"
                      name="Despesas"
                      stroke="#ef4444"
                      fillOpacity={1}
                      fill="url(#colorDespesas)"
                      strokeWidth={2}
                    />
                    <Line type="monotone" dataKey="lucro" name="Lucro" stroke="#3b82f6" strokeWidth={2} dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Detailed Financials */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
            {/* Despesas Diretas */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex justify-between items-center">
                  <CardTitle className="text-sm">Despesas Diretas</CardTitle>
                  <Badge variant="outline" className="text-xs">
                    Operacional
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between p-2.5 bg-rose-50 dark:bg-rose-950/20 rounded-lg border border-rose-100 dark:border-rose-900/30">
                  <div className="flex flex-col">
                    <span className="font-semibold text-sm">Combustível</span>
                    <span className="text-xs text-muted-foreground">
                      {filteredDREData.directExpenses.fuel.liters.toFixed(0)} L
                    </span>
                  </div>
                  <span className="font-bold text-rose-600">
                    {formatCurrency(filteredDREData.directExpenses.fuel.total)}
                  </span>
                </div>
                <div className="space-y-1">
                  {filteredDREData.directExpenses.categories.map((cat: any) => (
                    <div
                      key={cat.id}
                      onClick={() => handleCategoryDrillDown(cat.id, "expense")}
                      className="flex items-center justify-between p-2 hover:bg-muted/50 rounded cursor-pointer transition-all border-b border-border/30 last:border-0"
                    >
                      <CategoryBadge name={cat.name} color={cat.color} icon={cat.icon} />
                      <span className="font-medium text-sm">{formatCurrency(cat.amount)}</span>
                    </div>
                  ))}
                </div>
                <div className="pt-3 border-t flex justify-between font-bold">
                  <span>Total Direto</span>
                  <span className="text-rose-600">{formatCurrency(filteredDREData.directExpenses.total)}</span>
                </div>
              </CardContent>
            </Card>

            {/* Composição de Custos (Pie) + Fluxo */}
            <div className="space-y-4">
              {expenseCompositionData.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <PieChartIcon className="h-4 w-4" /> Composição de Custos
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="h-[180px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={expenseCompositionData}
                          cx="50%"
                          cy="50%"
                          innerRadius={40}
                          outerRadius={70}
                          paddingAngle={2}
                          dataKey="value"
                        >
                          {expenseCompositionData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <RechartsTooltip
                          formatter={(value) => formatCurrency(value as number)}
                          contentStyle={{ borderRadius: "8px", border: "none", fontSize: "12px" }}
                        />
                        <Legend
                          layout="vertical"
                          align="right"
                          verticalAlign="middle"
                          wrapperStyle={{ fontSize: "11px" }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Wallet className="h-4 w-4" /> Fluxo de Caixa
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Adiantamentos</span>
                    <span className="font-medium">{formatCurrency(filteredDREData.cashFlow.advances)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Comissões</span>
                    <span className="font-medium text-rose-500">
                      -{formatCurrency(filteredDREData.cashFlow.commissions)}
                    </span>
                  </div>
                  <Separator className="my-2" />
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Contas a Pagar</span>
                    <span className="font-medium text-amber-600">
                      {formatCurrency(filteredDREData.pendingAccounts.total)}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Despesas Indiretas */}
          {filteredDREData.indirectExpenses.categories.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <div className="flex justify-between items-center">
                  <CardTitle className="text-sm">Despesas Indiretas</CardTitle>
                  <Badge variant="secondary" className="text-xs">
                    Administrativo
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {filteredDREData.indirectExpenses.categories.map((cat: any) => (
                    <div
                      key={cat.id}
                      onClick={() => handleCategoryDrillDown(cat.id, "expense")}
                      className="flex items-center justify-between p-3 bg-muted/30 rounded-lg cursor-pointer hover:bg-muted/50 transition-all"
                    >
                      <CategoryBadge name={cat.name} color={cat.color} icon={cat.icon} />
                      <span className="font-medium">{formatCurrency(cat.amount)}</span>
                    </div>
                  ))}
                </div>
                <div className="pt-4 mt-4 border-t flex justify-between font-bold">
                  <span>Total Indireto</span>
                  <span className="text-amber-600">{formatCurrency(filteredDREData.indirectExpenses.total)}</span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Análise Horizontal - comparação com período anterior */}
          {comparisonMode && filteredDREData2 && (
            <DREHorizontalAnalysis 
              currentPeriod={filteredDREData} 
              previousPeriod={filteredDREData2} 
              loading={loading2}
            />
          )}

          {/* Acumulado Anual (YTD) */}
          <DREYearlyAccumulated 
            vehicleId={cleanId(vehicleId)} 
            driverId={cleanId(driverId)} 
          />
        </div>
      )}

      {/* Drill Down Dialog */}
      <CategoryDrillDownDialog drillDownData={drillDownCategory} onClose={() => setDrillDownCategory(null)} />
    </div>
  );
}
