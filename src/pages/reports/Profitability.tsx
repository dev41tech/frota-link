import { useState } from "react";
import { useDriverProfitability } from "@/hooks/useDriverProfitability";
import { useVehicleProfitability } from "@/hooks/useVehicleProfitability";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { JourneyProfitabilityDashboard } from "@/components/reports/JourneyProfitabilityDashboard";
import { ProfitabilityCharts } from "@/components/reports/ProfitabilityCharts";
import { VehicleProfitabilityDashboard } from "@/components/reports/VehicleProfitabilityDashboard";
import { CustomerProfitabilityDashboard } from "@/components/reports/CustomerProfitabilityDashboard";
import { UnlinkedExpensesDialog } from "@/components/reports/UnlinkedExpensesDialog";
import { ReportViewModeSelector, type ReportViewMode } from "@/components/reports/ReportViewModeSelector";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  TrendingUp,
  DollarSign,
  TrendingDown,
  Award,
  FileSpreadsheet,
  FileText,
  Calendar as CalendarIcon,
  AlertTriangle,
  Info,
  Eye,
  Users,
} from "lucide-react";
import { formatCurrency } from "@/lib/profitabilityCalculations";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { createWorkbook, addJsonSheet, downloadWorkbook } from "@/lib/excelExport";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export default function Profitability() {
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({
    from: new Date(new Date().getFullYear(), new Date().getMonth(), 1), // Início do mês atual
    to: new Date(),
  });
  const [showUnlinkedDialog, setShowUnlinkedDialog] = useState(false);
  const [viewMode, setViewMode] = useState<ReportViewMode>('competency');

  const { toast } = useToast();

  const { data: driverData, dataQuality: driverDataQuality, loading: driverLoading } = useDriverProfitability(dateRange.from, dateRange.to);

  const { data: vehicleData, dataQuality: vehicleDataQuality, unlinkedExpenses, loading: vehicleLoading, refetch: refetchVehicle } = useVehicleProfitability(dateRange.from, dateRange.to);

  // --- Cálculos de KPIs Gerais ---
  const totalRevenue = vehicleData?.reduce((sum, v) => sum + v.totalRevenue, 0) || 0;
  const totalExpenses = vehicleData?.reduce((sum, v) => sum + v.totalExpenses, 0) || 0;
  const totalProfit = totalRevenue - totalExpenses;
  const overallMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;
  const totalJourneys = vehicleData?.reduce((sum, v) => sum + v.journeyCount, 0) || 0;

  // Médias
  const avgTicket = totalJourneys > 0 ? totalRevenue / totalJourneys : 0;
  const avgProfitPerJourney = totalJourneys > 0 ? totalProfit / totalJourneys : 0;

  const bestVehicle =
    vehicleData && vehicleData.length > 0
      ? vehicleData.reduce((best, current) => (current.margin > best.margin ? current : best))
      : null;

  // Data quality checks
  const hasDataQualityIssues = 
    (vehicleDataQuality?.vehiclesWithFreightValueOnly || 0) > 0 ||
    (vehicleDataQuality?.totalUnlinkedExpenses || 0) > 0 ||
    vehicleDataQuality?.revenueSource !== 'revenue_table';

  // --- Função de Exportação PDF Refinada ---
  const exportToPDF = () => {
    // Inicialização com tipo 'any' para evitar erro de TS no getNumberOfPages em versões específicas
    const doc: any = new jsPDF();

    // Configurações de Estilo
    const primaryColor = [41, 128, 185] as [number, number, number]; // Azul Sóbrio
    const darkText = [50, 50, 50] as [number, number, number];
    const lightText = [100, 100, 100] as [number, number, number];

    // --- 1. Cabeçalho Minimalista ---
    doc.setFontSize(24);
    doc.setTextColor(...primaryColor);
    doc.text("DRE Gerencial", 14, 20); // Título Principal

    // Detalhes do Relatório (Topo Direito)
    doc.setFontSize(10);
    doc.setTextColor(...lightText);
    const dateStr = `${dateRange.from ? format(dateRange.from, "dd/MM/yyyy") : "Início"} até ${dateRange.to ? format(dateRange.to, "dd/MM/yyyy") : "Hoje"}`;
    doc.text(`Período: ${dateStr}`, 196, 15, { align: "right" });
    doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy HH:mm")}`, 196, 20, { align: "right" });

    // Linha divisória sutil
    doc.setDrawColor(230, 230, 230);
    doc.line(14, 25, 196, 25);

    let yPos = 35;

    // --- 2. Indicadores Operacionais (Cards Visuais) ---
    doc.setFontSize(12);
    doc.setTextColor(...primaryColor);
    doc.text("Resumo da Operação", 14, yPos);
    yPos += 8;

    const kpiData = [
      ["Total Viagens", totalJourneys.toString(), "Receita Média", formatCurrency(avgTicket)],
      ["Veículos Ativos", (vehicleData?.length || 0).toString(), "Lucro/Viagem", formatCurrency(avgProfitPerJourney)],
    ];

    autoTable(doc, {
      startY: yPos,
      body: kpiData,
      theme: "plain",
      styles: { fontSize: 10, cellPadding: 2, textColor: darkText },
      columnStyles: {
        0: { fontStyle: "bold", cellWidth: 35 },
        1: { cellWidth: 30 },
        2: { fontStyle: "bold", cellWidth: 35 },
        3: { cellWidth: 30 },
      },
    });

    yPos = (doc as any).lastAutoTable.finalY + 10;

    // --- 3. Demonstrativo Financeiro (Estilo DRE Contábil) ---
    doc.setFontSize(12);
    doc.setTextColor(...primaryColor);
    doc.text("Demonstrativo de Resultado", 14, yPos);
    yPos += 5;

    const dreData = [
      ["(+) RECEITA OPERACIONAL BRUTA", formatCurrency(totalRevenue)],
      ["(-) CUSTOS E DESPESAS TOTAIS", formatCurrency(totalExpenses)],
      ["(=) RESULTADO OPERACIONAL (LUCRO)", formatCurrency(totalProfit)],
      ["(%) MARGEM DE CONTRIBUIÇÃO", `${overallMargin.toFixed(2)}%`],
    ];

    autoTable(doc, {
      startY: yPos,
      head: [["Descrição", "Valor"]],
      body: dreData,
      theme: "grid",
      headStyles: {
        fillColor: [245, 245, 245],
        textColor: darkText,
        fontStyle: "bold",
        lineColor: [220, 220, 220],
        lineWidth: 0.1,
      },
      bodyStyles: { textColor: darkText, lineColor: [220, 220, 220] },
      columnStyles: {
        0: { cellWidth: 130 },
        1: { cellWidth: 50, halign: "right", fontStyle: "bold" },
      },
      didParseCell: function (data) {
        // Destacar linhas de Resultado e Receita
        if (data.row.index === 0 || data.row.index === 2) {
          data.cell.styles.fontStyle = "bold";
        }
        // Cor para lucro/prejuízo
        if (data.row.index === 2 && data.section === "body") {
          const val = totalProfit;
          data.cell.styles.textColor = val >= 0 ? [22, 160, 133] : [192, 57, 43];
        }
      },
    });

    yPos = (doc as any).lastAutoTable.finalY + 15;

    // --- 4. Detalhamento por Veículo (Tabela Limpa) ---
    if (vehicleData && vehicleData.length > 0) {
      doc.setFontSize(12);
      doc.setTextColor(...primaryColor);
      doc.text("Performance por Veículo", 14, yPos);
      yPos += 5;

      autoTable(doc, {
        startY: yPos,
        head: [["Veículo", "Viagens", "Receita", "Despesas", "Resultado", "Mg %", "km/l"]],
        body: vehicleData.map((v) => [
          `${v.plate} ${v.model ? "- " + v.model : ""}`,
          v.journeyCount,
          formatCurrency(v.totalRevenue),
          formatCurrency(v.totalExpenses),
          formatCurrency(v.totalRevenue - v.totalExpenses),
          `${v.margin.toFixed(1)}%`,
          v.fuelConsumption != null ? v.fuelConsumption.toFixed(2) : "-",
        ]),
        theme: "striped",
        headStyles: { fillColor: primaryColor, textColor: 255, fontStyle: "bold" },
        styles: { fontSize: 9, cellPadding: 3 },
        columnStyles: {
          0: { cellWidth: 60 },
          1: { halign: "center" },
          2: { halign: "right" },
          3: { halign: "right" },
          4: { halign: "right", fontStyle: "bold" },
          5: { halign: "center" },
        },
        alternateRowStyles: { fillColor: [245, 250, 255] },
      });
    }

    // --- 5. Rodapé Numeração ---
    const pageCount = doc.getNumberOfPages(); // Agora deve funcionar com o cast 'any' ou uso correto
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150);
      const pageWidth = doc.internal.pageSize.width || doc.internal.pageSize.getWidth();
      doc.text(`Página ${i} de ${pageCount}`, pageWidth / 2, 285, { align: "center" });
      doc.text(`Sistema de Gestão`, 196, 285, { align: "right" });
    }

    doc.save(`DRE_${format(new Date(), "yyyyMMdd")}.pdf`);
  };

  const exportToExcel = async () => {
    try {
      const wb = await createWorkbook();

      const summaryData = [
        { Item: "Receita Total", Valor: totalRevenue },
        { Item: "Despesas Totais", Valor: totalExpenses },
        { Item: "Lucro Líquido", Valor: totalProfit },
        { Item: "Margem %", Valor: overallMargin / 100 },
        { Item: "Total de Viagens", Valor: totalJourneys },
        { Item: "Ticket Médio", Valor: avgTicket },
      ];
      addJsonSheet(wb, summaryData, "DRE Resumido");

      if (vehicleData) {
        const vehicleRows = vehicleData.map((v) => ({
          Placa: v.plate,
          Modelo: v.model,
          Jornadas: v.journeyCount,
          Receita: v.totalRevenue,
          Despesas: v.totalExpenses,
          Lucro: v.totalRevenue - v.totalExpenses,
          "Margem %": v.margin / 100,
          "Distância (km)": v.totalDistance || 0,
          "Litros": v.totalLiters || 0,
          "Média km/l": v.fuelConsumption != null ? Number(v.fuelConsumption.toFixed(2)) : null,
        }));
        addJsonSheet(wb, vehicleRows, "Veículos");
      }

      if (driverData) {
        const driverRows = driverData.map((d) => ({
          Nome: d.name,
          Jornadas: d.journeyCount,
          Receita: d.totalRevenue,
          Despesas: d.totalExpenses,
          Lucro: d.totalRevenue - d.totalExpenses,
          "Margem %": d.margin / 100,
        }));
        addJsonSheet(wb, driverRows, "Motoristas");
      }

      await downloadWorkbook(wb, `Relatorio_Financeiro_${format(new Date(), "yyyy-MM-dd")}.xlsx`);

      toast({
        title: "Excel gerado com sucesso",
        description: "Download iniciado.",
      });
    } catch (error) {
      console.error(error);
      toast({
        title: "Erro na exportação",
        description: "Falha ao gerar arquivo Excel.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50/50 pb-10">
      {/* --- Header Profissional --- */}
      <div className="bg-white border-b sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto p-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-gray-900">Análise Operacional</h1>
              <p className="text-sm text-gray-500 mt-1">Lucratividade por veículo e motorista.</p>
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="h-9 w-full md:w-[260px] justify-start text-left font-normal border-gray-300 shadow-sm"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4 text-gray-500" />
                    {dateRange.from ? (
                      dateRange.to ? (
                        <>
                          {format(dateRange.from, "dd/MM/yyyy", { locale: ptBR })} -{" "}
                          {format(dateRange.to, "dd/MM/yyyy", { locale: ptBR })}
                        </>
                      ) : (
                        format(dateRange.from, "dd/MM/yyyy", { locale: ptBR })
                      )
                    ) : (
                      <span>Selecione o período</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                          <Calendar
                            initialFocus
                            mode="range"
                            defaultMonth={dateRange.from}
                            selected={{ from: dateRange.from, to: dateRange.to }}
                            onSelect={(range) => setDateRange({ from: range?.from, to: range?.to })}
                            numberOfMonths={2}
                            locale={ptBR}
                            className="pointer-events-auto"
                          />
                </PopoverContent>
              </Popover>

              <div className="h-8 w-px bg-gray-200 mx-1 hidden md:block" />

              <ReportViewModeSelector mode={viewMode} onChange={setViewMode} />

              <div className="h-8 w-px bg-gray-200 mx-1 hidden md:block" />

              <div className="flex gap-2 w-full md:w-auto">
                <Button
                  onClick={exportToPDF}
                  variant="outline"
                  size="sm"
                  className="flex-1 border-gray-200 hover:bg-red-50 hover:text-red-700 hover:border-red-200 transition-colors"
                >
                  <FileText className="h-4 w-4 mr-2 text-red-600" />
                  PDF
                </Button>
                <Button
                  onClick={exportToExcel}
                  variant="outline"
                  size="sm"
                  className="flex-1 border-gray-200 hover:bg-green-50 hover:text-green-700 hover:border-green-200 transition-colors"
                >
                  <FileSpreadsheet className="h-4 w-4 mr-2 text-green-600" />
                  Excel
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6 space-y-8">
        {/* --- Alertas de Qualidade de Dados --- */}
        {hasDataQualityIssues && (
          <Alert className="border-warning/50 bg-warning/5">
            <AlertTriangle className="h-4 w-4 text-warning" />
            <AlertTitle className="text-warning font-medium">Atenção à Qualidade dos Dados</AlertTitle>
            <AlertDescription className="text-sm text-muted-foreground mt-1 space-y-1">
              {vehicleDataQuality?.revenueSource === 'freight_value' && (
                <p>• Receitas calculadas a partir do valor de frete planejado (não há receitas cadastradas).</p>
              )}
              {vehicleDataQuality?.revenueSource === 'mixed' && (
                <p>• {vehicleDataQuality.vehiclesWithFreightValueOnly} veículo(s) usando valor de frete planejado como receita.</p>
              )}
              {(vehicleDataQuality?.totalUnlinkedExpenses || 0) > 0 && (
                <p className="flex items-center gap-2 flex-wrap">
                  <span>• {vehicleDataQuality.totalUnlinkedExpenses} despesa(s) não vinculada(s) a jornadas foram incluídas.</span>
                  <Button 
                    variant="link" 
                    size="sm" 
                    className="h-auto p-0 text-primary hover:text-primary/80"
                    onClick={() => setShowUnlinkedDialog(true)}
                  >
                    <Eye className="h-3 w-3 mr-1" />
                    Visualizar
                  </Button>
                </p>
              )}
              <p className="text-xs mt-2">
                <Info className="h-3 w-3 inline mr-1" />
                Para maior precisão, cadastre receitas reais na tabela de receitas e vincule despesas às jornadas.
              </p>
            </AlertDescription>
          </Alert>
        )}

        {/* Dialog de Despesas Não Vinculadas */}
        <UnlinkedExpensesDialog
          open={showUnlinkedDialog}
          onOpenChange={setShowUnlinkedDialog}
          expenses={unlinkedExpenses || []}
          onRefresh={refetchVehicle}
        />

        {/* --- Cards de KPIs --- */}
        {/* Ajustado grid para evitar aperto em resoluções intermediárias (Laptop) */}
        <div className="grid gap-6 grid-cols-1 md:grid-cols-2 xl:grid-cols-4">
          <Card className="overflow-hidden border-none shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">Receita Total</CardTitle>
              <DollarSign className="h-4 w-4 text-gray-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900 truncate">{formatCurrency(totalRevenue)}</div>
              <p className="text-xs text-muted-foreground mt-1">{totalJourneys} viagens realizadas</p>
            </CardContent>
          </Card>

          <Card className="overflow-hidden border-none shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">Despesas</CardTitle>
              <TrendingDown className="h-4 w-4 text-rose-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-rose-600 truncate">{formatCurrency(totalExpenses)}</div>
              <div className="flex items-center text-xs text-muted-foreground mt-1">
                <span className="font-medium text-rose-600 mr-1">
                  {totalRevenue > 0 ? ((totalExpenses / totalRevenue) * 100).toFixed(1) : 0}%
                </span>
                da receita
              </div>
            </CardContent>
          </Card>

          <Card className="overflow-hidden border-none shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">Lucro Líquido</CardTitle>
              <TrendingUp className={`h-4 w-4 ${totalProfit >= 0 ? "text-emerald-500" : "text-rose-500"}`} />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold truncate ${totalProfit >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                {formatCurrency(totalProfit)}
              </div>
              <div
                className={`text-xs inline-flex items-center mt-1 font-medium ${totalProfit >= 0 ? "text-emerald-700" : "text-rose-700"}`}
              >
                Margem Líquida: {overallMargin.toFixed(1)}%
              </div>
            </CardContent>
          </Card>

          <Card className="overflow-hidden border-none shadow-sm hover:shadow-md transition-shadow bg-blue-50/30">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-blue-600">Melhor Veículo</CardTitle>
              <Award className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-lg font-bold text-gray-900 truncate" title={bestVehicle?.plate || ""}>
                {bestVehicle?.plate || "-"}
              </div>
              <p className="text-xs text-blue-600/80 font-medium">
                {bestVehicle ? `Margem: ${bestVehicle.margin.toFixed(1)}%` : "Sem dados"}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* --- Tabs de Conteúdo --- */}
        <Tabs defaultValue="overview" className="space-y-6">
          <div className="flex justify-center md:justify-start">
            <TabsList className="grid w-full max-w-[750px] grid-cols-5 bg-gray-100 p-1 rounded-lg">
              <TabsTrigger value="overview" className="text-xs md:text-sm">
                Visão Geral
              </TabsTrigger>
              <TabsTrigger value="journeys" className="text-xs md:text-sm">
                Jornadas
              </TabsTrigger>
              <TabsTrigger value="vehicles" className="text-xs md:text-sm">
                Veículos
              </TabsTrigger>
              <TabsTrigger value="drivers" className="text-xs md:text-sm">
                Motoristas
              </TabsTrigger>
              <TabsTrigger value="customers" className="text-xs md:text-sm flex items-center gap-1">
                <Users className="h-3 w-3" />
                Clientes
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="overview" className="space-y-4">
            <ProfitabilityCharts vehicleData={vehicleData || []} driverData={driverData || []} />
          </TabsContent>

          <TabsContent value="journeys">
            <JourneyProfitabilityDashboard
              startDate={dateRange.from}
              endDate={dateRange.to}
              viewMode={viewMode}
            />
          </TabsContent>

          <TabsContent value="vehicles">
            <VehicleProfitabilityDashboard data={vehicleData || []} loading={vehicleLoading} startDate={dateRange.from} endDate={dateRange.to} />
          </TabsContent>

          <TabsContent value="drivers">
            <Card className="border shadow-sm">
              <CardHeader className="bg-gray-50/50 border-b pb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">Performance por Motorista</CardTitle>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-gray-50 text-gray-500 font-medium">
                      <tr>
                        <th className="px-6 py-3">Motorista</th>
                        <th className="px-6 py-3 text-right">Viagens</th>
                        <th className="px-6 py-3 text-right">Receita</th>
                        <th className="px-6 py-3 text-right">Lucro</th>
                        <th className="px-6 py-3 text-center">Margem</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {driverData?.map((driver) => (
                        <tr key={driver.driverId} className="hover:bg-gray-50/80 transition-colors">
                          <td className="px-6 py-3 font-medium text-gray-900">{driver.name}</td>
                          <td className="px-6 py-3 text-right text-gray-500">{driver.journeyCount}</td>
                          <td className="px-6 py-3 text-right text-gray-900">{formatCurrency(driver.totalRevenue)}</td>
                          <td
                            className={`px-6 py-3 text-right font-bold ${driver.totalProfit >= 0 ? "text-emerald-600" : "text-rose-600"}`}
                          >
                            {formatCurrency(driver.totalProfit)}
                          </td>
                          <td className="px-6 py-3 text-center">
                            <span
                              className={`inline-block px-2 py-1 rounded text-xs font-bold ${driver.margin >= 20 ? "bg-emerald-100 text-emerald-800" : "bg-yellow-100 text-yellow-800"}`}
                            >
                              {driver.margin.toFixed(1)}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="customers">
            <CustomerProfitabilityDashboard
              startDate={dateRange.from}
              endDate={dateRange.to}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
