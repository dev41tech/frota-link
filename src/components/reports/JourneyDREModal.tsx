import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { JourneyProfitDetail, ExpenseBreakdown } from '@/hooks/useJourneyProfitDetails';
import { useJourneyLegProfitability, LegProfitData } from '@/hooks/useJourneyLegProfitability';
import { useCouplingDetails } from '@/hooks/useCouplingDetails';
import { formatCurrency } from '@/lib/profitabilityCalculations';
import { calculateJourneyDistance } from '@/lib/fleetConsumptionCalculations';
import { formatDateBR } from '@/lib/utils';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Cell,
  LabelList,
  ReferenceLine,
} from 'recharts';
import {
  Truck,
  TrendingUp,
  TrendingDown,
  Lightbulb,
  ArrowRight,
  Gauge,
  Fuel,
  Route,
  DollarSign,
  Download,
  Container,
  Link2,
  ChevronDown,
  Trophy,
  MapPin,
} from 'lucide-react';

interface JourneyDREModalProps {
  journey: JourneyProfitDetail | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Waterfall chart data builder
function buildWaterfallData(detail: JourneyProfitDetail) {
  const data: Array<{
    name: string;
    value: number;
    displayValue: number;
    fill: string;
    isTotal?: boolean;
  }> = [];

  // Starting point - Revenue
  data.push({
    name: 'Receita',
    value: detail.revenue,
    displayValue: detail.revenue,
    fill: 'hsl(var(--chart-2))', // Green
    isTotal: true,
  });

  let runningTotal = detail.revenue;

  // Fuel cost
  if (detail.expenseBreakdown.fuel > 0) {
    runningTotal -= detail.expenseBreakdown.fuel;
    data.push({
      name: 'Combustível',
      value: runningTotal,
      displayValue: -detail.expenseBreakdown.fuel,
      fill: 'hsl(var(--destructive))',
    });
  }

  // Toll cost
  if (detail.expenseBreakdown.toll > 0) {
    runningTotal -= detail.expenseBreakdown.toll;
    data.push({
      name: 'Pedágio',
      value: runningTotal,
      displayValue: -detail.expenseBreakdown.toll,
      fill: 'hsl(var(--destructive))',
    });
  }

  // Maintenance cost
  if (detail.expenseBreakdown.maintenance > 0) {
    runningTotal -= detail.expenseBreakdown.maintenance;
    data.push({
      name: 'Manutenção',
      value: runningTotal,
      displayValue: -detail.expenseBreakdown.maintenance,
      fill: 'hsl(var(--destructive))',
    });
  }

  // Lodging cost
  if (detail.expenseBreakdown.lodging > 0) {
    runningTotal -= detail.expenseBreakdown.lodging;
    data.push({
      name: 'Hospedagem',
      value: runningTotal,
      displayValue: -detail.expenseBreakdown.lodging,
      fill: 'hsl(var(--destructive))',
    });
  }

  // Other costs
  if (detail.expenseBreakdown.other > 0) {
    runningTotal -= detail.expenseBreakdown.other;
    data.push({
      name: 'Outros',
      value: runningTotal,
      displayValue: -detail.expenseBreakdown.other,
      fill: 'hsl(var(--destructive))',
    });
  }

  // Final result
  data.push({
    name: 'Resultado',
    value: detail.profit,
    displayValue: detail.profit,
    fill: detail.profit >= 0 ? 'hsl(var(--chart-2))' : 'hsl(var(--destructive))',
    isTotal: true,
  });

  return data;
}

// DRE Line component
function DRELine({
  label,
  value,
  isTotal = false,
  isSubtraction = false,
  sublabel,
}: {
  label: string;
  value: number;
  isTotal?: boolean;
  isSubtraction?: boolean;
  sublabel?: string;
}) {
  return (
    <div className={`flex justify-between items-center py-2 ${isTotal ? 'bg-muted/50 px-3 -mx-3 rounded font-semibold' : ''}`}>
      <div className="flex flex-col">
        <span className={`${isTotal ? 'text-foreground' : 'text-muted-foreground'} ${isSubtraction ? 'pl-4' : ''}`}>
          {isSubtraction ? '(−) ' : isTotal ? '' : '(+) '}{label}
        </span>
        {sublabel && <span className="text-xs text-muted-foreground pl-4">{sublabel}</span>}
      </div>
      <span className={`font-mono text-right ${
        isTotal 
          ? value >= 0 ? 'text-emerald-600' : 'text-destructive'
          : isSubtraction ? 'text-destructive' : 'text-foreground'
      }`}>
        {isSubtraction ? `- ${formatCurrency(Math.abs(value))}` : formatCurrency(value)}
      </span>
    </div>
  );
}

// Generate DRE insights
function generateDREInsights(detail: JourneyProfitDetail): string[] {
  const insights: string[] = [];
  
  // Fuel as percentage of revenue
  if (detail.revenue > 0) {
    const fuelPct = (detail.expenseBreakdown.fuel / detail.revenue) * 100;
    if (fuelPct > 0) {
      const targetPct = 35; // Meta de 35% para combustível
      const diff = fuelPct - targetPct;
      if (diff > 0) {
        insights.push(`O custo de Combustível representou ${fuelPct.toFixed(1)}% da receita (Meta: ${targetPct}%). Isso está ${diff.toFixed(1)}% acima do ideal.`);
      } else {
        insights.push(`O custo de Combustível representou ${fuelPct.toFixed(1)}% da receita, dentro da meta de ${targetPct}%.`);
      }
    }
  }

  // Margin analysis
  const avgMargin = 25; // Margem média padrão
  if (detail.margin > avgMargin) {
    const diff = detail.margin - avgMargin;
    insights.push(`Esta jornada teve uma rentabilidade ${diff.toFixed(1)}% acima da média da frota.`);
  } else if (detail.margin < avgMargin && detail.margin >= 0) {
    const diff = avgMargin - detail.margin;
    insights.push(`Esta jornada teve uma rentabilidade ${diff.toFixed(1)}% abaixo da média da frota.`);
  }

  // Toll analysis
  if (detail.revenue > 0 && detail.expenseBreakdown.toll > 0) {
    const tollPct = (detail.expenseBreakdown.toll / detail.revenue) * 100;
    if (tollPct > 10) {
      insights.push(`Pedágios consumiram ${tollPct.toFixed(1)}% do frete. Considere rotas alternativas.`);
    }
  }

  // Main offender
  if (detail.profit < 0 && detail.mainOffender) {
    insights.push(`Principal ofensor: ${detail.mainOffender}. Analise formas de reduzir este custo.`);
  }

  return insights;
}

export function JourneyDREModal({ journey, open, onOpenChange }: JourneyDREModalProps) {
  // Hooks must be called unconditionally
  const { coupling, expensesByVehicle, loading: couplingLoading } = useCouplingDetails(
    journey?.journey.coupling_id || null,
    journey?.journey.id || null
  );
  const { legs: legProfitData, loading: legsLoading } = useJourneyLegProfitability(
    journey?.journey.id || null
  );
  const [legsOpen, setLegsOpen] = useState(false);

  if (!journey) return null;

  const actualDistance = calculateJourneyDistance({
    distance: journey.journey.distance || null,
    start_km: journey.journey.start_km ?? null,
    end_km: journey.journey.end_km ?? null,
    vehicle_id: '',
  });

  const waterfallData = buildWaterfallData(journey);
  const dreInsights = generateDREInsights(journey);
  const isProfitable = journey.profit >= 0;
  const hasCoupling = !!coupling && coupling.trailers.length > 0;

  // Calculate contribution margin (before fixed costs)
  const contributionMargin = journey.revenue - journey.totalExpenses;

  const handleDownloadPDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // Title
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(`DRE - Jornada #${journey.journey.journey_number}`, 14, 20);
    
    // Date and route
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Data: ${journey.journey.start_date ? formatDateBR(journey.journey.start_date) : 'N/A'}`, 14, 28);
    doc.text(`Rota: ${journey.journey.origin} → ${journey.journey.destination}`, 14, 34);
    doc.text(`Veículo: ${journey.vehicle.plate}${journey.vehicle.model ? ` (${journey.vehicle.model})` : ''}`, 14, 40);
    
    // Result highlight
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    const resultLabel = isProfitable ? 'LUCRO LÍQUIDO' : 'PREJUÍZO';
    const resultColor = isProfitable ? [22, 163, 74] : [220, 38, 38];
    doc.setTextColor(resultColor[0], resultColor[1], resultColor[2]);
    doc.text(`${resultLabel}: ${formatCurrency(Math.abs(journey.profit))} (${journey.margin.toFixed(1)}%)`, 14, 52);
    doc.setTextColor(0, 0, 0);

    // Operational metrics
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Métricas Operacionais', 14, 64);
    
    const metricsData = [
      ['Distância Percorrida', actualDistance > 0 ? `${actualDistance.toLocaleString('pt-BR')} km` : 'N/A'],
      ['Média de Consumo', actualDistance > 0 && journey.fuelLiters > 0 ? `${(actualDistance / journey.fuelLiters).toFixed(2)} km/L` : 'N/A'],
      ['Custo por Km', actualDistance > 0 ? formatCurrency(journey.totalExpenses / actualDistance) : 'N/A'],
      ['Hodômetro Inicial', journey.journey.start_km != null ? `${journey.journey.start_km.toLocaleString('pt-BR')} km` : 'N/A'],
      ['Hodômetro Final', journey.journey.end_km != null ? `${journey.journey.end_km.toLocaleString('pt-BR')} km` : 'N/A'],
    ];

    autoTable(doc, {
      startY: 68,
      head: [['Métrica', 'Valor']],
      body: metricsData,
      theme: 'striped',
      headStyles: { fillColor: [59, 130, 246] },
      margin: { left: 14, right: 14 },
    });

    // DRE Table
    const dreStartY = (doc as any).lastAutoTable.finalY + 10;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Demonstrativo de Resultado Econômico', 14, dreStartY);

    const dreData: (string | number)[][] = [
      ['(+) Receita Operacional Bruta', formatCurrency(journey.revenue)],
      ['(=) Receita Líquida', formatCurrency(journey.revenue)],
    ];

    if (journey.expenseBreakdown.fuel > 0) {
      dreData.push(['(-) Combustível', `- ${formatCurrency(journey.expenseBreakdown.fuel)}`]);
    }
    if (journey.expenseBreakdown.toll > 0) {
      dreData.push(['(-) Pedágios', `- ${formatCurrency(journey.expenseBreakdown.toll)}`]);
    }
    if (journey.expenseBreakdown.maintenance > 0) {
      dreData.push(['(-) Manutenção', `- ${formatCurrency(journey.expenseBreakdown.maintenance)}`]);
    }
    if (journey.expenseBreakdown.lodging > 0) {
      dreData.push(['(-) Hospedagem/Diárias', `- ${formatCurrency(journey.expenseBreakdown.lodging)}`]);
    }
    if (journey.expenseBreakdown.other > 0) {
      dreData.push(['(-) Outros Custos', `- ${formatCurrency(journey.expenseBreakdown.other)}`]);
    }

    dreData.push(['(=) Margem de Contribuição', formatCurrency(contributionMargin)]);
    dreData.push(['(=) RESULTADO FINAL', formatCurrency(journey.profit)]);

    autoTable(doc, {
      startY: dreStartY + 4,
      head: [['Descrição', 'Valor']],
      body: dreData,
      theme: 'striped',
      headStyles: { fillColor: [59, 130, 246] },
      margin: { left: 14, right: 14 },
      didParseCell: (data) => {
        // Highlight final result row
        if (data.row.index === dreData.length - 1) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = isProfitable ? [220, 252, 231] : [254, 226, 226];
        }
      },
    });

    // Footer
    const footerY = (doc as any).lastAutoTable.finalY + 10;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(128, 128, 128);
    doc.text(`Gerado em ${new Date().toLocaleString('pt-BR')}`, 14, footerY);

    // Save
    doc.save(`DRE_Jornada_${journey.journey.journey_number}.pdf`);
  };
  
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader className="space-y-1">
          <div className="flex items-center justify-between">
            <SheetTitle className="flex items-center gap-2 text-lg">
              DRE da Jornada #{journey.journey.journey_number}
              {journey.journey.start_date && (
                <span className="text-sm font-normal text-muted-foreground">
                  - {formatDateBR(journey.journey.start_date)}
                </span>
              )}
            </SheetTitle>
            <Button variant="outline" size="sm" onClick={handleDownloadPDF} className="gap-2">
              <Download className="h-4 w-4" />
              PDF
            </Button>
          </div>
          <SheetDescription className="flex items-center gap-1">
            <ArrowRight className="h-3 w-3" />
            {journey.journey.origin} → {journey.journey.destination}
          </SheetDescription>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Truck className="h-4 w-4" />
            <span>{journey.vehicle.plate}</span>
            {journey.vehicle.model && <span className="text-xs">({journey.vehicle.model})</span>}
          </div>
        </SheetHeader>

        {/* KPI Principal */}
        <div className="mt-6 p-4 rounded-lg border bg-muted/30">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">
                {isProfitable ? 'Lucro Líquido' : 'Prejuízo'}
              </p>
              <div className={`text-3xl font-bold ${isProfitable ? 'text-emerald-600' : 'text-destructive'}`}>
                {formatCurrency(Math.abs(journey.profit))}
              </div>
            </div>
            <div className="text-right">
              <div className="flex items-center gap-1">
                {isProfitable ? (
                  <TrendingUp className="h-5 w-5 text-emerald-600" />
                ) : (
                  <TrendingDown className="h-5 w-5 text-destructive" />
                )}
                <span className={`text-2xl font-bold ${isProfitable ? 'text-emerald-600' : 'text-destructive'}`}>
                  {journey.margin.toFixed(1)}%
                </span>
              </div>
              <p className="text-xs text-muted-foreground">Margem de Lucro</p>
            </div>
          </div>
        </div>

        {/* Seção Conjunto Utilizado */}
        {hasCoupling && (
          <div className="mt-6 p-4 rounded-lg border border-primary/20 bg-primary/5">
            <div className="flex items-center gap-2 mb-3">
              <Link2 className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold">Conjunto Utilizado</h3>
              <Badge variant="secondary" className="text-xs">
                {coupling.type === 'simple' ? 'Simples' : coupling.type === 'bitrem' ? 'Bitrem' : 'Rodotrem'}
              </Badge>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <Truck className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{journey.vehicle.plate}</span>
                {journey.vehicle.model && <span className="text-muted-foreground">({journey.vehicle.model})</span>}
                <Badge variant="outline" className="text-xs">Cavalo</Badge>
              </div>
              {coupling.trailers.map((trailer, idx) => (
                <div key={trailer.id} className="flex items-center gap-2 text-sm pl-4">
                  <Container className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{trailer.plate}</span>
                  {trailer.model && <span className="text-muted-foreground">({trailer.model})</span>}
                  <Badge variant="outline" className="text-xs">{idx + 1}ª Carreta</Badge>
                </div>
              ))}
            </div>

            {/* Breakdown de custos por veículo */}
            {expensesByVehicle.length > 0 && (
              <div className="mt-4">
                <h4 className="text-xs font-medium text-muted-foreground mb-2">Custos por Componente</h4>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Veículo</TableHead>
                        <TableHead className="text-xs text-right">Combustível</TableHead>
                        <TableHead className="text-xs text-right">Pedágio</TableHead>
                        <TableHead className="text-xs text-right">Manutenção</TableHead>
                        <TableHead className="text-xs text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {expensesByVehicle.map((ve) => (
                        <TableRow key={ve.vehicleId}>
                          <TableCell className="text-xs py-2">
                            <div className="flex items-center gap-1">
                              {ve.vehicleType === 'truck' ? (
                                <Truck className="h-3 w-3 text-muted-foreground" />
                              ) : (
                                <Container className="h-3 w-3 text-muted-foreground" />
                              )}
                              <span className="font-medium">{ve.vehiclePlate}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-xs text-right py-2 font-mono">
                            {ve.fuel > 0 ? formatCurrency(ve.fuel) : '-'}
                          </TableCell>
                          <TableCell className="text-xs text-right py-2 font-mono">
                            {ve.toll > 0 ? formatCurrency(ve.toll) : '-'}
                          </TableCell>
                          <TableCell className="text-xs text-right py-2 font-mono">
                            {ve.maintenance > 0 ? formatCurrency(ve.maintenance) : '-'}
                          </TableCell>
                          <TableCell className="text-xs text-right py-2 font-mono font-semibold">
                            {formatCurrency(ve.total)}
                          </TableCell>
                        </TableRow>
                      ))}
                      {/* Linha de total */}
                      <TableRow className="bg-muted/50">
                        <TableCell className="text-xs py-2 font-semibold">TOTAL</TableCell>
                        <TableCell className="text-xs text-right py-2 font-mono font-semibold">
                          {formatCurrency(expensesByVehicle.reduce((s, v) => s + v.fuel, 0))}
                        </TableCell>
                        <TableCell className="text-xs text-right py-2 font-mono font-semibold">
                          {formatCurrency(expensesByVehicle.reduce((s, v) => s + v.toll, 0))}
                        </TableCell>
                        <TableCell className="text-xs text-right py-2 font-mono font-semibold">
                          {formatCurrency(expensesByVehicle.reduce((s, v) => s + v.maintenance, 0))}
                        </TableCell>
                        <TableCell className="text-xs text-right py-2 font-mono font-semibold">
                          {formatCurrency(expensesByVehicle.reduce((s, v) => s + v.total, 0))}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  * Combustível e pedágio são 100% alocados ao cavalo. Manutenção é alocada ao veículo específico.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Métricas Operacionais */}
        <div className="mt-6">
          <h3 className="text-sm font-semibold mb-3">Métricas Operacionais</h3>
          <div className="grid grid-cols-2 gap-3">
            {/* Distância Percorrida */}
            <div className="p-3 rounded-lg border bg-card">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Route className="h-4 w-4" />
                <span className="text-xs">Distância Percorrida</span>
              </div>
              <p className="text-lg font-semibold">
                {actualDistance > 0
                  ? `${actualDistance.toLocaleString('pt-BR')} km`
                  : 'N/A'}
              </p>
            </div>

            {/* Média de Consumo */}
            <div className="p-3 rounded-lg border bg-card">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Fuel className="h-4 w-4" />
                <span className="text-xs">Média de Consumo</span>
              </div>
              <p className="text-lg font-semibold">
                {actualDistance > 0 && journey.fuelLiters > 0
                  ? `${(actualDistance / journey.fuelLiters).toFixed(2)} km/L`
                  : 'N/A'}
              </p>
              {journey.fuelLiters > 0 && (
                <p className="text-xs text-muted-foreground">
                  {journey.fuelLiters.toFixed(1)}L a R$ {journey.fuelAvgPrice.toFixed(2)}/L
                </p>
              )}
            </div>

            {/* Custo por Km */}
            <div className="p-3 rounded-lg border bg-card">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <DollarSign className="h-4 w-4" />
                <span className="text-xs">Custo por Km</span>
              </div>
              <p className="text-lg font-semibold">
                {actualDistance > 0
                  ? formatCurrency(journey.totalExpenses / actualDistance)
                  : 'N/A'}
              </p>
            </div>

            {/* KM Inicial e Final */}
            <div className="p-3 rounded-lg border bg-card">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Gauge className="h-4 w-4" />
                <span className="text-xs">Hodômetro</span>
              </div>
              <p className="text-lg font-semibold">
                {journey.journey.start_km != null && journey.journey.end_km != null
                  ? `${journey.journey.start_km.toLocaleString('pt-BR')} → ${journey.journey.end_km.toLocaleString('pt-BR')}`
                  : journey.journey.start_km != null
                  ? `Inicial: ${journey.journey.start_km.toLocaleString('pt-BR')}`
                  : 'N/A'}
              </p>
              {journey.journey.start_km != null && journey.journey.end_km != null && (
                <p className="text-xs text-muted-foreground">
                  Δ {(journey.journey.end_km - journey.journey.start_km).toLocaleString('pt-BR')} km
                </p>
              )}
            </div>
          </div>
        </div>
        <div className="mt-6">
          <h3 className="text-sm font-semibold mb-3">Composição do Resultado</h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={waterfallData}
                margin={{ top: 20, right: 10, left: 10, bottom: 5 }}
              >
                <XAxis 
                  dataKey="name" 
                  tick={{ fontSize: 10 }}
                  interval={0}
                  angle={-20}
                  textAnchor="end"
                  height={50}
                />
                <YAxis 
                  tick={{ fontSize: 10 }}
                  tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                />
                <ReferenceLine y={0} stroke="hsl(var(--border))" />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {waterfallData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                  <LabelList 
                    dataKey="displayValue" 
                    position="top" 
                    formatter={(value: number) => {
                      const absValue = Math.abs(value);
                      if (absValue >= 1000) {
                        return `${value >= 0 ? '' : '-'}${(absValue / 1000).toFixed(1)}k`;
                      }
                      return value.toFixed(0);
                    }}
                    style={{ fontSize: 10, fill: 'hsl(var(--foreground))' }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <Separator className="my-6" />

        {/* DRE Table */}
        <div>
          <h3 className="text-sm font-semibold mb-3">Demonstrativo de Resultado</h3>
          <div className="space-y-1">
            <DRELine 
              label="RECEITA OPERACIONAL BRUTA" 
              value={journey.revenue} 
              isTotal 
            />
            
            <DRELine 
              label="Valor do Frete" 
              value={journey.revenue} 
            />

            <div className="h-2" />

            <DRELine 
              label="RECEITA LÍQUIDA" 
              value={journey.revenue} 
              isTotal 
            />

            <div className="h-2" />
            <p className="text-xs text-muted-foreground font-medium">CUSTOS DA VIAGEM:</p>

            {journey.expenseBreakdown.fuel > 0 && (
              <DRELine 
                label="Combustível" 
                value={journey.expenseBreakdown.fuel}
                isSubtraction
              />
            )}

            {journey.expenseBreakdown.toll > 0 && (
              <DRELine 
                label="Pedágios" 
                value={journey.expenseBreakdown.toll}
                isSubtraction
              />
            )}

            {journey.expenseBreakdown.maintenance > 0 && (
              <DRELine 
                label="Manutenção em Viagem" 
                value={journey.expenseBreakdown.maintenance}
                isSubtraction
              />
            )}

            {journey.expenseBreakdown.lodging > 0 && (
              <DRELine 
                label="Hospedagem / Diárias" 
                value={journey.expenseBreakdown.lodging}
                isSubtraction
              />
            )}

            {journey.expenseBreakdown.other > 0 && (
              <DRELine 
                label="Outros Custos" 
                value={journey.expenseBreakdown.other}
                isSubtraction
              />
            )}

            <div className="h-2" />

            <DRELine 
              label="MARGEM DE CONTRIBUIÇÃO" 
              value={contributionMargin}
              isTotal
            />

            <div className="h-2" />

            <DRELine 
              label="RESULTADO FINAL" 
              value={journey.profit}
              isTotal
            />
          </div>
        </div>

        {/* Insights */}
        {dreInsights.length > 0 && (
          <>
            <Separator className="my-6" />
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Lightbulb className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-semibold">Análise Rápida</h3>
                </div>
                <ul className="space-y-2">
                  {dreInsights.map((insight, idx) => (
                    <li key={idx} className="text-sm text-muted-foreground flex gap-2">
                      <span className="text-primary">•</span>
                      <span>{insight}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </>
        )}

        {/* Análise de Trechos */}
        {legProfitData.length > 0 && (
          <>
            <Separator className="my-6" />
            <Collapsible open={legsOpen} onOpenChange={setLegsOpen}>
              <CollapsibleTrigger asChild>
                <Button variant="outline" className="w-full justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    <span>Verificar Trechos mais lucrativos dessa jornada</span>
                  </div>
                  <ChevronDown className={`h-4 w-4 transition-transform ${legsOpen ? 'rotate-180' : ''}`} />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-4 space-y-3">
                {legsLoading ? (
                  <p className="text-sm text-muted-foreground text-center py-4">Carregando trechos...</p>
                ) : (
                  [...legProfitData].sort((a, b) => a.rank - b.rank).map((leg) => {
                    const isBest = leg.rank === 1;
                    const isWorst = leg.rank === legProfitData.length && legProfitData.length > 1;
                    const marginColor = leg.margin >= 30 ? 'text-emerald-600' : leg.margin >= 10 ? 'text-yellow-600' : 'text-destructive';
                    const borderColor = isBest ? 'border-emerald-300 bg-emerald-50/50 dark:bg-emerald-950/20' : isWorst ? 'border-destructive/30 bg-destructive/5' : '';

                    return (
                      <div key={leg.legId} className={`p-4 rounded-lg border ${borderColor}`}>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs font-mono">
                              {isBest && <Trophy className="h-3 w-3 mr-1 text-emerald-600" />}
                              #{leg.rank}
                            </Badge>
                            <span className="text-sm font-semibold">
                              Trecho {leg.legNumber}: {leg.origin} → {leg.destination}
                            </span>
                          </div>
                          {leg.distance && (
                            <span className="text-xs text-muted-foreground">{leg.distance.toLocaleString('pt-BR')} km</span>
                          )}
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                          <div>
                            <p className="text-xs text-muted-foreground">Receita</p>
                            <p className="font-mono font-semibold">{formatCurrency(leg.revenue)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Despesas</p>
                            <p className="font-mono font-semibold text-destructive">{formatCurrency(leg.totalExpenses)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Lucro</p>
                            <p className={`font-mono font-semibold ${leg.profit >= 0 ? 'text-emerald-600' : 'text-destructive'}`}>
                              {formatCurrency(leg.profit)}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Margem</p>
                            <p className={`font-mono font-semibold ${marginColor}`}>
                              {leg.margin.toFixed(1)}%
                            </p>
                          </div>
                        </div>

                        {/* Cost composition bar */}
                        {leg.totalExpenses > 0 && (
                          <div className="mt-3">
                            <div className="flex h-2 rounded-full overflow-hidden bg-muted">
                              {leg.fuelExpenses > 0 && (
                                <div
                                  className="bg-orange-400 h-full"
                                  style={{ width: `${(leg.fuelExpenses / leg.totalExpenses) * 100}%` }}
                                  title={`Combustível: ${formatCurrency(leg.fuelExpenses)}`}
                                />
                              )}
                              {leg.directExpenses > 0 && (
                                <div
                                  className="bg-blue-400 h-full"
                                  style={{ width: `${(leg.directExpenses / leg.totalExpenses) * 100}%` }}
                                  title={`Outras despesas: ${formatCurrency(leg.directExpenses)}`}
                                />
                              )}
                            </div>
                            <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
                              {leg.fuelExpenses > 0 && (
                                <span className="flex items-center gap-1">
                                  <span className="w-2 h-2 rounded-full bg-orange-400" />
                                  Combustível
                                </span>
                              )}
                              {leg.directExpenses > 0 && (
                                <span className="flex items-center gap-1">
                                  <span className="w-2 h-2 rounded-full bg-blue-400" />
                                  Outras
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </CollapsibleContent>
            </Collapsible>
          </>
        )}

        {/* Status badges */}
        <div className="mt-6 flex flex-wrap gap-2">
          <Badge variant={isProfitable ? 'default' : 'destructive'}>
            {isProfitable ? 'Jornada Lucrativa' : 'Jornada com Prejuízo'}
          </Badge>
          {journey.margin >= 40 && (
            <Badge variant="secondary" className="bg-emerald-100 text-emerald-700">
              Alta Performance
            </Badge>
          )}
          {journey.margin > 0 && journey.margin < 20 && (
            <Badge variant="secondary" className="bg-yellow-100 text-yellow-700">
              Margem Baixa
            </Badge>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
