import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useMultiTenant } from "@/hooks/useMultiTenant";
import { 
  Download, RefreshCw, TrendingUp, TrendingDown, Fuel, DollarSign, Gauge, 
  AlertTriangle, Target, Activity, FileSpreadsheet 
} from "lucide-react";
import { 
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, 
  Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, ComposedChart, Area 
} from 'recharts';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format, subMonths, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { createWorkbook, addJsonSheet, addArraySheet, downloadWorkbook } from "@/lib/excelExport";
import {
  FuelExpenseRecord,
  MonthlyFuelData,
  VehicleFuelData,
  calculateDistance,
  calculateDistancesFromConsecutiveOdometers,
  calculateConsumption,
  calculateCostPerKm,
  getConsumptionStatus,
  getStatusColor,
  getStatusBgColor,
  formatCurrency,
  formatNumber,
} from "@/lib/fuelCalculations";

interface GasStationData {
  name: string;
  totalLiters: number;
  avgPrice: number;
  fillCount: number;
}

export default function FuelReports() {
  const [monthlyData, setMonthlyData] = useState<MonthlyFuelData[]>([]);
  const [vehicleData, setVehicleData] = useState<VehicleFuelData[]>([]);
  const [gasStationData, setGasStationData] = useState<GasStationData[]>([]);
  const [rawExpenses, setRawExpenses] = useState<FuelExpenseRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("6");
  const [vehicleFilter, setVehicleFilter] = useState<string>("all");
  const { toast } = useToast();
  const { currentCompany } = useMultiTenant();

  useEffect(() => {
    if (currentCompany?.id) {
      fetchFuelReports();
    }
  }, [currentCompany?.id, period]);

  const fetchFuelReports = async () => {
    if (!currentCompany?.id) return;
    
    try {
      setLoading(true);
      const months = parseInt(period);
      const startDate = subMonths(new Date(), months);
      
      // Single optimized query - fetch all fuel expenses with vehicle data
      const { data: fuelExpenses, error } = await supabase
        .from('fuel_expenses')
        .select(`
          id,
          vehicle_id,
          total_amount,
          liters,
          price_per_liter,
          distance_traveled,
          odometer,
          odometer_final,
          date,
          location_address,
          vehicles!inner (
            plate,
            target_consumption
          )
        `)
        .eq('company_id', currentCompany.id)
        .gte('date', startDate.toISOString())
        .order('date', { ascending: true });

      if (error) throw error;

      const rawData = (fuelExpenses || []) as unknown as FuelExpenseRecord[];
      
      // Pre-process: calculate distances from consecutive odometers
      const expenses = calculateDistancesFromConsecutiveOdometers(rawData);
      setRawExpenses(expenses);

      // Process monthly data
      const monthlyMap = new Map<string, {
        liters: number;
        cost: number;
        distance: number;
        prices: number[];
      }>();

      expenses.forEach(expense => {
        const date = new Date(expense.date);
        const monthKey = format(date, 'yyyy-MM');
        const distance = calculateDistance(expense);
        
        const current = monthlyMap.get(monthKey) || { liters: 0, cost: 0, distance: 0, prices: [] };
        monthlyMap.set(monthKey, {
          liters: current.liters + Number(expense.liters),
          cost: current.cost + Number(expense.total_amount),
          distance: current.distance + distance,
          prices: [...current.prices, Number(expense.price_per_liter)]
        });
      });

      // Convert to array and calculate derived values
      const monthlyArray: MonthlyFuelData[] = [];
      const sortedKeys = Array.from(monthlyMap.keys()).sort();
      
      sortedKeys.forEach((monthKey, index) => {
        const data = monthlyMap.get(monthKey)!;
        const avgPrice = data.prices.length > 0 
          ? data.prices.reduce((a, b) => a + b, 0) / data.prices.length 
          : 0;
        
        const previousMonth = sortedKeys[index - 1];
        const previousPrice = previousMonth 
          ? (monthlyMap.get(previousMonth)?.prices.reduce((a, b) => a + b, 0) || 0) / 
            (monthlyMap.get(previousMonth)?.prices.length || 1)
          : avgPrice;
        
        const priceVariation = previousPrice > 0 
          ? ((avgPrice - previousPrice) / previousPrice) * 100 
          : 0;

        monthlyArray.push({
          month: format(parseISO(monthKey + '-01'), 'MMM/yy', { locale: ptBR }),
          monthKey,
          totalLiters: data.liters,
          totalCost: data.cost,
          avgPricePerLiter: avgPrice,
          totalDistance: data.distance,
          avgConsumption: calculateConsumption(data.distance, data.liters),
          costPerKm: calculateCostPerKm(data.cost, data.distance),
          priceVariation
        });
      });

      setMonthlyData(monthlyArray);

      // Process vehicle data
      const vehicleMap = new Map<string, VehicleFuelData>();
      
      expenses.forEach(expense => {
        const vehicleId = expense.vehicle_id;
        const plate = expense.vehicles?.plate || 'Desconhecido';
        const target = expense.vehicles?.target_consumption || null;
        const distance = calculateDistance(expense);
        
        const current = vehicleMap.get(vehicleId);
        
        if (current) {
          current.totalCost += Number(expense.total_amount);
          current.totalLiters += Number(expense.liters);
          current.totalDistance += distance;
        } else {
          vehicleMap.set(vehicleId, {
            vehicleId,
            vehiclePlate: plate,
            totalCost: Number(expense.total_amount),
            totalLiters: Number(expense.liters),
            totalDistance: distance,
            avgConsumption: 0,
            targetConsumption: target,
            efficiencyVsTarget: null,
            costPerKm: 0,
            status: 'good'
          });
        }
      });

      // Calculate derived values for vehicles
      vehicleMap.forEach((data) => {
        data.avgConsumption = calculateConsumption(data.totalDistance, data.totalLiters);
        data.costPerKm = calculateCostPerKm(data.totalCost, data.totalDistance);
        data.efficiencyVsTarget = data.targetConsumption && data.targetConsumption > 0 
          ? (data.avgConsumption / data.targetConsumption) * 100 
          : null;
        data.status = getConsumptionStatus(data.avgConsumption, data.targetConsumption);
      });

      const vehicleArray = Array.from(vehicleMap.values())
        .sort((a, b) => b.totalCost - a.totalCost);
      
      setVehicleData(vehicleArray);

      // Process gas station data
      const stationMap = new Map<string, GasStationData>();
      
      expenses.forEach(expense => {
        const stationName = expense.location_address || 'Não informado';
        const current = stationMap.get(stationName);
        
        if (current) {
          current.totalLiters += Number(expense.liters);
          current.avgPrice = (current.avgPrice * current.fillCount + Number(expense.price_per_liter)) / (current.fillCount + 1);
          current.fillCount += 1;
        } else {
          stationMap.set(stationName, {
            name: stationName.length > 30 ? stationName.substring(0, 30) + '...' : stationName,
            totalLiters: Number(expense.liters),
            avgPrice: Number(expense.price_per_liter),
            fillCount: 1
          });
        }
      });

      const stationArray = Array.from(stationMap.values())
        .sort((a, b) => b.totalLiters - a.totalLiters)
        .slice(0, 5);
      
      setGasStationData(stationArray);
      
    } catch (error) {
      console.error('Error fetching fuel reports:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar relatórios de combustível",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Calculate summary KPIs
  const summary = useMemo(() => {
    const totalCost = monthlyData.reduce((sum, m) => sum + m.totalCost, 0);
    const totalLiters = monthlyData.reduce((sum, m) => sum + m.totalLiters, 0);
    const totalDistance = monthlyData.reduce((sum, m) => sum + m.totalDistance, 0);
    const avgConsumption = calculateConsumption(totalDistance, totalLiters);
    const avgPricePerLiter = totalLiters > 0 ? totalCost / totalLiters : 0;
    const costPerKm = calculateCostPerKm(totalCost, totalDistance);
    
    const currentMonth = monthlyData[monthlyData.length - 1];
    const previousMonth = monthlyData[monthlyData.length - 2];
    const priceVariation = currentMonth && previousMonth && previousMonth.avgPricePerLiter > 0
      ? ((currentMonth.avgPricePerLiter - previousMonth.avgPricePerLiter) / previousMonth.avgPricePerLiter) * 100
      : 0;

    const avgTargetConsumption = vehicleData
      .filter(v => v.targetConsumption && v.targetConsumption > 0)
      .reduce((sum, v) => sum + (v.targetConsumption || 0), 0) / 
      vehicleData.filter(v => v.targetConsumption && v.targetConsumption > 0).length || 0;
    
    const efficiencyVsTarget = avgTargetConsumption > 0 
      ? (avgConsumption / avgTargetConsumption) * 100 
      : null;

    return {
      totalCost,
      totalLiters,
      totalDistance,
      avgConsumption,
      avgPricePerLiter,
      costPerKm,
      priceVariation,
      avgTargetConsumption,
      efficiencyVsTarget
    };
  }, [monthlyData, vehicleData]);

  // Alerts for vehicles with poor efficiency
  const alerts = useMemo(() => {
    return vehicleData.filter(v => v.status === 'critical' || v.status === 'warning');
  }, [vehicleData]);

  // Filtered vehicle data for charts
  const filteredVehicleData = useMemo(() => {
    if (vehicleFilter === 'all') return vehicleData;
    return vehicleData.filter(v => v.vehicleId === vehicleFilter);
  }, [vehicleData, vehicleFilter]);

  // Chart data for target vs actual
  const targetVsActualData = useMemo(() => {
    return vehicleData
      .filter(v => v.avgConsumption > 0)
      .map(v => ({
        plate: v.vehiclePlate,
        consumo: v.avgConsumption,
        meta: v.targetConsumption || 0,
        status: v.status
      }))
      .slice(0, 10);
  }, [vehicleData]);

  // Efficiency ranking
  const efficiencyRanking = useMemo(() => {
    return [...vehicleData]
      .filter(v => v.avgConsumption > 0)
      .sort((a, b) => b.avgConsumption - a.avgConsumption)
      .slice(0, 10);
  }, [vehicleData]);

  const exportToPDF = async () => {
    if (!currentCompany) return;
    
    const loadingToast = toast({
      title: 'Gerando PDF...',
      description: 'Aguarde enquanto o relatório é gerado',
    });
    
    try {
      const { jsPDF } = await import('jspdf');
      const { applyPlugin } = await import('jspdf-autotable');
      applyPlugin(jsPDF);
      
      const doc = new jsPDF() as any;
      
      doc.setFontSize(18);
      doc.setTextColor('#0ea5e9');
      doc.text('Relatório de Combustível', 20, 20);
      
      doc.setFontSize(12);
      doc.setTextColor('#1f2937');
      doc.text(currentCompany.name, 20, 30);
      
      doc.setFontSize(10);
      doc.setTextColor('#6b7280');
      doc.text(`Período: Últimos ${period} meses`, 20, 37);
      doc.text(`Gerado em: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 20, 44);
      
      let yPos = 58;
      doc.setFontSize(11);
      doc.setTextColor('#1f2937');
      doc.text('Resumo Executivo', 20, yPos);
      yPos += 10;
      
      doc.setFontSize(9);
      doc.setTextColor('#6b7280');
      doc.text(`Custo Total: ${formatCurrency(summary.totalCost)}`, 20, yPos);
      doc.text(`Litros Consumidos: ${formatNumber(summary.totalLiters, 1)} L`, 110, yPos);
      yPos += 7;
      doc.text(`Consumo Médio: ${formatNumber(summary.avgConsumption)} km/L`, 20, yPos);
      doc.text(`Custo por km: ${formatCurrency(summary.costPerKm)}`, 110, yPos);
      yPos += 7;
      doc.text(`Preço Médio: ${formatCurrency(summary.avgPricePerLiter)}/L`, 20, yPos);
      doc.text(`Distância Total: ${formatNumber(summary.totalDistance, 0)} km`, 110, yPos);
      yPos += 15;
      
      doc.autoTable({
        head: [['Mês', 'Litros', 'Custo', 'Preço/L', 'Distância', 'Consumo', 'R$/km']],
        body: monthlyData.map(d => [
          d.month,
          `${formatNumber(d.totalLiters, 1)} L`,
          formatCurrency(d.totalCost),
          formatCurrency(d.avgPricePerLiter),
          `${formatNumber(d.totalDistance, 0)} km`,
          `${formatNumber(d.avgConsumption)} km/L`,
          formatCurrency(d.costPerKm)
        ]),
        startY: yPos,
        headStyles: { fillColor: '#0ea5e9', textColor: '#ffffff', fontStyle: 'bold', fontSize: 8 },
        bodyStyles: { fontSize: 7 },
      });
      
      if (vehicleData.length > 0) {
        doc.addPage();
        doc.setFontSize(14);
        doc.setTextColor('#1f2937');
        doc.text('Eficiência por Veículo', 20, 20);
        
        doc.autoTable({
          head: [['Placa', 'Custo', 'Litros', 'km/L', 'Meta', 'Eficiência', 'Status']],
          body: vehicleData.map(v => [
            v.vehiclePlate,
            formatCurrency(v.totalCost),
            `${formatNumber(v.totalLiters, 1)} L`,
            `${formatNumber(v.avgConsumption)} km/L`,
            v.targetConsumption ? `${formatNumber(v.targetConsumption)} km/L` : '-',
            v.efficiencyVsTarget ? `${formatNumber(v.efficiencyVsTarget)}%` : '-',
            v.status === 'excellent' ? 'Excelente' : 
              v.status === 'good' ? 'Bom' : 
              v.status === 'warning' ? 'Atenção' : 'Crítico'
          ]),
          startY: 30,
          headStyles: { fillColor: '#0ea5e9', textColor: '#ffffff', fontStyle: 'bold', fontSize: 8 },
          bodyStyles: { fontSize: 7 },
        });
      }
      
      const pageCount = doc.internal.pages.length - 1;
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(9);
        doc.setTextColor('#6b7280');
        doc.text('Gerado por Frota Link', 20, doc.internal.pageSize.height - 10);
        doc.text(`Página ${i} de ${pageCount}`, doc.internal.pageSize.width - 40, doc.internal.pageSize.height - 10);
      }
      
      doc.save(`relatorio-combustivel-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
      
      toast({ title: "PDF gerado com sucesso", description: "O download foi iniciado" });
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast({ title: "Erro ao gerar PDF", description: "Tente novamente", variant: "destructive" });
    } finally {
      loadingToast.dismiss();
    }
  };

  const exportToExcel = async () => {
    if (!currentCompany) return;
    
    try {
      const wb = await createWorkbook();
      
      // Resumo sheet
      addArraySheet(wb, [
        ['RELATÓRIO DE COMBUSTÍVEL'],
        ['Empresa:', currentCompany.name],
        ['Período:', `Últimos ${period} meses`],
        ['Gerado em:', format(new Date(), 'dd/MM/yyyy HH:mm')],
        [],
        ['RESUMO EXECUTIVO'],
        ['Custo Total', summary.totalCost],
        ['Litros Consumidos', summary.totalLiters],
        ['Distância Total (km)', summary.totalDistance],
        ['Consumo Médio (km/L)', summary.avgConsumption],
        ['Preço Médio (R$/L)', summary.avgPricePerLiter],
        ['Custo por km (R$)', summary.costPerKm],
      ], 'Resumo');
      
      // Monthly sheet
      addJsonSheet(wb, monthlyData.map(d => ({
        'Mês': d.month,
        'Litros': d.totalLiters,
        'Custo (R$)': d.totalCost,
        'Preço/L (R$)': d.avgPricePerLiter,
        'Distância (km)': d.totalDistance,
        'Consumo (km/L)': d.avgConsumption,
        'Custo/km (R$)': d.costPerKm,
        'Variação Preço (%)': d.priceVariation
      })), 'Mensal');
      
      // Vehicles sheet
      addJsonSheet(wb, vehicleData.map(v => ({
        'Placa': v.vehiclePlate,
        'Custo Total (R$)': v.totalCost,
        'Litros': v.totalLiters,
        'Distância (km)': v.totalDistance,
        'Consumo (km/L)': v.avgConsumption,
        'Meta (km/L)': v.targetConsumption || '-',
        'Eficiência (%)': v.efficiencyVsTarget || '-',
        'Custo/km (R$)': v.costPerKm,
        'Status': v.status === 'excellent' ? 'Excelente' : 
          v.status === 'good' ? 'Bom' : 
          v.status === 'warning' ? 'Atenção' : 'Crítico'
      })), 'Veículos');
      
      // Raw data sheet
      addJsonSheet(wb, rawExpenses.map(e => ({
        'Data': format(new Date(e.date), 'dd/MM/yyyy'),
        'Placa': e.vehicles?.plate || '-',
        'Litros': e.liters,
        'Preço/L (R$)': e.price_per_liter,
        'Total (R$)': e.total_amount,
        'Distância (km)': calculateDistance(e),
        'Odômetro Inicial': e.odometer || '-',
        'Odômetro Final': e.odometer_final || '-'
      })), 'Abastecimentos');
      
      await downloadWorkbook(wb, `relatorio-combustivel-${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
      
      toast({ title: "Excel gerado com sucesso", description: "O download foi iniciado" });
    } catch (error) {
      console.error('Error generating Excel:', error);
      toast({ title: "Erro ao gerar Excel", description: "Tente novamente", variant: "destructive" });
    }
  };

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">Relatórios de Combustível</h1>
          <p className="text-muted-foreground">Análise completa de consumo, custos e eficiência</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="3">3 meses</SelectItem>
              <SelectItem value="6">6 meses</SelectItem>
              <SelectItem value="12">12 meses</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={fetchFuelReports} variant="outline" size="icon">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button onClick={exportToPDF} variant="outline">
            <Download className="h-4 w-4 mr-2" />
            PDF
          </Button>
          <Button onClick={exportToExcel} variant="outline">
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Excel
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <RefreshCw className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <>
          {/* Alerts */}
          {alerts.length > 0 && (
            <Alert variant="destructive" className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Veículos com eficiência abaixo da meta</AlertTitle>
              <AlertDescription>
                {alerts.length} veículo(s) precisam de atenção: {alerts.map(a => a.vehiclePlate).join(', ')}
              </AlertDescription>
            </Alert>
          )}

          {/* KPI Cards - Row 1 */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Custo Total</CardTitle>
                <DollarSign className="h-4 w-4 text-red-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">
                  {formatCurrency(summary.totalCost)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Últimos {period} meses</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Litros Consumidos</CardTitle>
                <Fuel className="h-4 w-4 text-blue-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">
                  {formatNumber(summary.totalLiters, 1)} L
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {formatNumber(summary.totalDistance, 0)} km percorridos
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Consumo Médio</CardTitle>
                <Gauge className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {formatNumber(summary.avgConsumption)} km/L
                </div>
                {summary.efficiencyVsTarget && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatNumber(summary.efficiencyVsTarget)}% da meta
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Custo por km</CardTitle>
                <Activity className="h-4 w-4 text-purple-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-purple-600">
                  {formatCurrency(summary.costPerKm)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">R$ por quilômetro</p>
              </CardContent>
            </Card>
          </div>

          {/* KPI Cards - Row 2 */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Preço Médio</CardTitle>
                <TrendingUp className="h-4 w-4 text-orange-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">
                  {formatCurrency(summary.avgPricePerLiter)}/L
                </div>
                <div className="flex items-center gap-1 mt-1">
                  {summary.priceVariation !== 0 && (
                    <>
                      {summary.priceVariation > 0 ? (
                        <TrendingUp className="h-3 w-3 text-red-500" />
                      ) : (
                        <TrendingDown className="h-3 w-3 text-green-500" />
                      )}
                      <span className={`text-xs ${summary.priceVariation > 0 ? 'text-red-500' : 'text-green-500'}`}>
                        {formatNumber(Math.abs(summary.priceVariation))}% vs mês anterior
                      </span>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Meta Média</CardTitle>
                <Target className="h-4 w-4 text-cyan-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-cyan-600">
                  {summary.avgTargetConsumption > 0 ? `${formatNumber(summary.avgTargetConsumption)} km/L` : '-'}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Meta de consumo da frota</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Abastecimentos</CardTitle>
                <Fuel className="h-4 w-4 text-indigo-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-indigo-600">
                  {rawExpenses.length}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Total de abastecimentos</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Veículos Ativos</CardTitle>
                <Activity className="h-4 w-4 text-teal-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-teal-600">
                  {vehicleData.length}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {alerts.length} precisam de atenção
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Charts Row 1 */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Evolução de Custos e Consumo</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <ComposedChart data={monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis yAxisId="left" />
                    <YAxis yAxisId="right" orientation="right" />
                    <Tooltip 
                      formatter={(value, name) => {
                        if (name === 'Custo Total') return formatCurrency(Number(value));
                        return `${formatNumber(Number(value))} km/L`;
                      }}
                    />
                    <Legend />
                    <Area 
                      yAxisId="left"
                      type="monotone" 
                      dataKey="totalCost" 
                      name="Custo Total" 
                      fill="#ef444433"
                      stroke="#ef4444" 
                    />
                    <Line 
                      yAxisId="right"
                      type="monotone" 
                      dataKey="avgConsumption" 
                      name="Consumo (km/L)" 
                      stroke="#10b981" 
                      strokeWidth={2}
                      dot={{ r: 4 }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Tendência de Preços</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="avgPricePerLiter" 
                      name="Preço/L" 
                      stroke="#f59e0b" 
                      strokeWidth={2}
                      dot={{ r: 4 }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="costPerKm" 
                      name="Custo/km" 
                      stroke="#8b5cf6" 
                      strokeWidth={2}
                      dot={{ r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Charts Row 2 - Target vs Actual */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Meta vs Consumo Real
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={targetVsActualData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis dataKey="plate" type="category" width={80} />
                    <Tooltip formatter={(value) => `${formatNumber(Number(value))} km/L`} />
                    <Legend />
                    <Bar dataKey="consumo" name="Consumo Real" fill="#3b82f6" />
                    <Bar dataKey="meta" name="Meta" fill="#10b98166" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Top 5 Locais de Abastecimento</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={gasStationData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-15} textAnchor="end" height={60} />
                    <YAxis />
                    <Tooltip 
                      formatter={(value, name) => {
                        if (name === 'Preço Médio') return formatCurrency(Number(value));
                        return `${formatNumber(Number(value), 1)} L`;
                      }}
                    />
                    <Legend />
                    <Bar dataKey="totalLiters" name="Litros" fill="#3b82f6" />
                    <Bar dataKey="avgPrice" name="Preço Médio" fill="#f59e0b" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Efficiency Ranking */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Ranking de Eficiência por Veículo</span>
                <Select value={vehicleFilter} onValueChange={setVehicleFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Filtrar veículo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {vehicleData.map(v => (
                      <SelectItem key={v.vehicleId} value={v.vehicleId}>{v.vehiclePlate}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Rank</TableHead>
                    <TableHead>Placa</TableHead>
                    <TableHead className="text-right">Consumo</TableHead>
                    <TableHead className="text-right">Meta</TableHead>
                    <TableHead className="text-right">Eficiência</TableHead>
                    <TableHead className="text-right">Custo/km</TableHead>
                    <TableHead className="text-right">Custo Total</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(vehicleFilter === 'all' ? efficiencyRanking : filteredVehicleData).map((vehicle, index) => (
                    <TableRow key={vehicle.vehicleId}>
                      <TableCell className="font-medium">#{index + 1}</TableCell>
                      <TableCell className="font-medium">{vehicle.vehiclePlate}</TableCell>
                      <TableCell className={`text-right font-medium ${getStatusColor(vehicle.status)}`}>
                        {formatNumber(vehicle.avgConsumption)} km/L
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {vehicle.targetConsumption ? `${formatNumber(vehicle.targetConsumption)} km/L` : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        {vehicle.efficiencyVsTarget ? (
                          <span className={vehicle.efficiencyVsTarget >= 100 ? 'text-green-600' : 'text-red-600'}>
                            {formatNumber(vehicle.efficiencyVsTarget)}%
                          </span>
                        ) : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(vehicle.costPerKm)}
                      </TableCell>
                      <TableCell className="text-right text-red-600 font-medium">
                        {formatCurrency(vehicle.totalCost)}
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatusBgColor(vehicle.status)}>
                          {vehicle.status === 'excellent' ? 'Excelente' : 
                            vehicle.status === 'good' ? 'Bom' : 
                            vehicle.status === 'warning' ? 'Atenção' : 'Crítico'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Monthly Detail Table */}
          <Card>
            <CardHeader>
              <CardTitle>Detalhamento Mensal</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mês</TableHead>
                    <TableHead className="text-right">Litros</TableHead>
                    <TableHead className="text-right">Custo Total</TableHead>
                    <TableHead className="text-right">Preço/L</TableHead>
                    <TableHead className="text-right">Variação</TableHead>
                    <TableHead className="text-right">Distância</TableHead>
                    <TableHead className="text-right">Consumo</TableHead>
                    <TableHead className="text-right">R$/km</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {monthlyData.map((data) => (
                    <TableRow key={data.monthKey}>
                      <TableCell className="font-medium">{data.month}</TableCell>
                      <TableCell className="text-right">{formatNumber(data.totalLiters, 1)} L</TableCell>
                      <TableCell className="text-right text-red-600 font-medium">
                        {formatCurrency(data.totalCost)}
                      </TableCell>
                      <TableCell className="text-right">{formatCurrency(data.avgPricePerLiter)}</TableCell>
                      <TableCell className="text-right">
                        {data.priceVariation !== 0 && (
                          <span className={data.priceVariation > 0 ? 'text-red-500' : 'text-green-500'}>
                            {data.priceVariation > 0 ? '+' : ''}{formatNumber(data.priceVariation)}%
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">{formatNumber(data.totalDistance, 0)} km</TableCell>
                      <TableCell className="text-right text-green-600 font-medium">
                        {formatNumber(data.avgConsumption)} km/L
                      </TableCell>
                      <TableCell className="text-right text-purple-600">
                        {formatCurrency(data.costPerKm)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
