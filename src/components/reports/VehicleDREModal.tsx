import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { formatCurrency } from '@/lib/profitabilityCalculations';
import { formatDateBR } from '@/lib/utils';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell, LabelList, ReferenceLine,
} from 'recharts';
import {
  Truck, TrendingUp, TrendingDown, Route, Fuel, DollarSign, Download, Gauge,
} from 'lucide-react';
import { format } from 'date-fns';

interface VehicleAggregated {
  vehicleId: string;
  plate: string;
  model: string;
  totalRevenue: number;
  totalExpenses: number;
  totalProfit: number;
  margin: number;
  journeyCount: number;
  fuelCost: number;
  maintenanceCost: number;
  otherExpensesCost: number;
  fuelConsumption?: number | null;
  totalDistance?: number;
  totalLiters?: number;
}

interface JourneyRow {
  id: string;
  journey_number: string;
  origin: string;
  destination: string;
  start_date: string | null;
  distance: number | null;
  revenue: number;
  expenses: number;
  profit: number;
  margin: number;
}

interface VehicleDREModalProps {
  vehicle: VehicleAggregated | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  startDate?: Date;
  endDate?: Date;
}

function DRELine({ label, value, isTotal = false, isSubtraction = false }: {
  label: string; value: number; isTotal?: boolean; isSubtraction?: boolean;
}) {
  return (
    <div className={`flex justify-between items-center py-2 ${isTotal ? 'bg-muted/50 px-3 -mx-3 rounded font-semibold' : ''}`}>
      <span className={`${isTotal ? 'text-foreground' : 'text-muted-foreground'} ${isSubtraction ? 'pl-4' : ''}`}>
        {isSubtraction ? '(−) ' : isTotal ? '' : '(+) '}{label}
      </span>
      <span className={`font-mono text-right ${
        isTotal ? (value >= 0 ? 'text-emerald-600' : 'text-destructive')
          : isSubtraction ? 'text-destructive' : 'text-foreground'
      }`}>
        {isSubtraction ? `- ${formatCurrency(Math.abs(value))}` : formatCurrency(value)}
      </span>
    </div>
  );
}

export function VehicleDREModal({ vehicle, open, onOpenChange, startDate, endDate }: VehicleDREModalProps) {
  const { user } = useAuth();
  const [journeys, setJourneys] = useState<JourneyRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!vehicle || !open || !user) return;
    
    const fetchJourneys = async () => {
      setLoading(true);
      try {
        // Get journeys for this vehicle in the period
        let query = supabase
          .from('journeys')
          .select('id, journey_number, origin, destination, start_date, end_date, distance, start_km, end_km, freight_value, vehicle_id')
          .eq('vehicle_id', vehicle.vehicleId)
          .eq('status', 'completed')
          .is('deleted_at', null);

        if (startDate) query = query.gte('start_date', startDate.toISOString());
        if (endDate) query = query.lte('start_date', endDate.toISOString());

        const { data: journeysData } = await query.order('start_date', { ascending: false });

        if (!journeysData || journeysData.length === 0) {
          setJourneys([]);
          setLoading(false);
          return;
        }

        const journeyIds = journeysData.map(j => j.id);

        // Fetch revenues, expenses, fuel for all journeys in parallel
        const [revenueRes, expenseRes, fuelRes] = await Promise.all([
          supabase.from('revenue').select('journey_id, amount').in('journey_id', journeyIds).is('deleted_at', null),
          supabase.from('expenses').select('journey_id, amount').in('journey_id', journeyIds).is('deleted_at', null),
          supabase.from('fuel_expenses').select('journey_id, total_amount').in('journey_id', journeyIds).is('deleted_at', null),
        ]);

        // Aggregate by journey
        const revByJourney: Record<string, number> = {};
        const expByJourney: Record<string, number> = {};

        revenueRes.data?.forEach(r => {
          revByJourney[r.journey_id!] = (revByJourney[r.journey_id!] || 0) + Number(r.amount);
        });
        expenseRes.data?.forEach(e => {
          expByJourney[e.journey_id!] = (expByJourney[e.journey_id!] || 0) + Number(e.amount);
        });
        fuelRes.data?.forEach(f => {
          expByJourney[f.journey_id!] = (expByJourney[f.journey_id!] || 0) + Number(f.total_amount);
        });

        const rows: JourneyRow[] = journeysData.map(j => {
          const rev = revByJourney[j.id] || (j.freight_value ? Number(j.freight_value) : 0);
          const exp = expByJourney[j.id] || 0;
          const profit = rev - exp;
          const margin = rev > 0 ? (profit / rev) * 100 : 0;
          return {
            id: j.id,
            journey_number: j.journey_number,
            origin: j.origin,
            destination: j.destination,
            start_date: j.start_date,
            distance: j.distance ? Number(j.distance) : null,
            revenue: rev,
            expenses: exp,
            profit,
            margin,
          };
        });

        setJourneys(rows);
      } catch (err) {
        console.error('Error fetching vehicle journeys:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchJourneys();
  }, [vehicle?.vehicleId, open, user, startDate, endDate]);

  if (!vehicle) return null;

  const isProfitable = vehicle.totalProfit >= 0;
  const costPerKm = vehicle.totalDistance && vehicle.totalDistance > 0 
    ? vehicle.totalExpenses / vehicle.totalDistance : null;

  // Waterfall chart data
  const waterfallData = [
    { name: 'Receita', value: vehicle.totalRevenue, displayValue: vehicle.totalRevenue, fill: 'hsl(var(--chart-2))' },
    ...(vehicle.fuelCost > 0 ? [{
      name: 'Combustível', value: vehicle.totalRevenue - vehicle.fuelCost,
      displayValue: -vehicle.fuelCost, fill: 'hsl(var(--destructive))',
    }] : []),
    ...(vehicle.maintenanceCost > 0 ? [{
      name: 'Manutenção', value: vehicle.totalRevenue - vehicle.fuelCost - vehicle.maintenanceCost,
      displayValue: -vehicle.maintenanceCost, fill: 'hsl(var(--destructive))',
    }] : []),
    ...(vehicle.otherExpensesCost > 0 ? [{
      name: 'Outros', value: vehicle.totalRevenue - vehicle.fuelCost - vehicle.maintenanceCost - vehicle.otherExpensesCost,
      displayValue: -vehicle.otherExpensesCost, fill: 'hsl(var(--destructive))',
    }] : []),
    {
      name: 'Resultado', value: vehicle.totalProfit, displayValue: vehicle.totalProfit,
      fill: vehicle.totalProfit >= 0 ? 'hsl(var(--chart-2))' : 'hsl(var(--destructive))',
    },
  ];

  const handleDownloadPDF = () => {
    const doc = new jsPDF();
    const primaryColor = [41, 128, 185] as [number, number, number];

    // Title
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(`DRE - Veículo ${vehicle.plate}`, 14, 20);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    if (vehicle.model) doc.text(`Modelo: ${vehicle.model}`, 14, 27);
    const periodStr = `Período: ${startDate ? format(startDate, 'dd/MM/yyyy') : '—'} a ${endDate ? format(endDate, 'dd/MM/yyyy') : '—'}`;
    doc.text(periodStr, 14, vehicle.model ? 33 : 27);

    // Result
    let y = vehicle.model ? 43 : 37;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    const resultColor = isProfitable ? [22, 163, 74] : [220, 38, 38];
    doc.setTextColor(resultColor[0], resultColor[1], resultColor[2]);
    doc.text(`${isProfitable ? 'LUCRO' : 'PREJUÍZO'}: ${formatCurrency(Math.abs(vehicle.totalProfit))} (${vehicle.margin.toFixed(1)}%)`, 14, y);
    doc.setTextColor(0, 0, 0);

    // Operational metrics
    y += 12;
    const metricsData = [
      ['Jornadas', vehicle.journeyCount.toString()],
      ['Distância Total', vehicle.totalDistance ? `${vehicle.totalDistance.toLocaleString('pt-BR')} km` : 'N/A'],
      ['Média km/l', vehicle.fuelConsumption != null ? vehicle.fuelConsumption.toFixed(2) : 'N/A'],
      ['Custo/km', costPerKm ? formatCurrency(costPerKm) : 'N/A'],
    ];

    autoTable(doc, {
      startY: y,
      head: [['Métrica', 'Valor']],
      body: metricsData,
      theme: 'striped',
      headStyles: { fillColor: primaryColor },
      margin: { left: 14, right: 14 },
    });

    // DRE
    let dreY = (doc as any).lastAutoTable.finalY + 10;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text('Demonstrativo de Resultado', 14, dreY);

    const dreRows: string[][] = [
      ['(+) Receita Operacional', formatCurrency(vehicle.totalRevenue)],
      ...(vehicle.fuelCost > 0 ? [['(-) Combustível', `- ${formatCurrency(vehicle.fuelCost)}`]] : []),
      ...(vehicle.maintenanceCost > 0 ? [['(-) Manutenção', `- ${formatCurrency(vehicle.maintenanceCost)}`]] : []),
      ...(vehicle.otherExpensesCost > 0 ? [['(-) Outros Custos', `- ${formatCurrency(vehicle.otherExpensesCost)}`]] : []),
      ['(=) RESULTADO FINAL', formatCurrency(vehicle.totalProfit)],
    ];

    autoTable(doc, {
      startY: dreY + 4,
      head: [['Descrição', 'Valor']],
      body: dreRows,
      theme: 'striped',
      headStyles: { fillColor: primaryColor },
      margin: { left: 14, right: 14 },
      didParseCell: (data) => {
        if (data.row.index === dreRows.length - 1) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = isProfitable ? [220, 252, 231] : [254, 226, 226];
        }
      },
    });

    // Journeys table
    if (journeys.length > 0) {
      let jY = (doc as any).lastAutoTable.finalY + 10;
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('Jornadas no Período', 14, jY);

      autoTable(doc, {
        startY: jY + 4,
        head: [['#', 'Rota', 'Data', 'Receita', 'Despesas', 'Lucro', 'Margem']],
        body: journeys.map(j => [
          j.journey_number,
          `${j.origin} → ${j.destination}`,
          j.start_date ? formatDateBR(j.start_date) : '—',
          formatCurrency(j.revenue),
          formatCurrency(j.expenses),
          formatCurrency(j.profit),
          `${j.margin.toFixed(1)}%`,
        ]),
        theme: 'striped',
        headStyles: { fillColor: primaryColor },
        styles: { fontSize: 8 },
        margin: { left: 14, right: 14 },
      });
    }

    // Footer
    const footerY = (doc as any).lastAutoTable.finalY + 10;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(128, 128, 128);
    doc.text(`Gerado em ${new Date().toLocaleString('pt-BR')}`, 14, footerY);

    doc.save(`DRE_Veiculo_${vehicle.plate}.pdf`);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader className="space-y-1">
          <div className="flex items-center justify-between">
            <SheetTitle className="flex items-center gap-2 text-lg">
              <Truck className="h-5 w-5" />
              DRE - {vehicle.plate}
            </SheetTitle>
            <Button variant="outline" size="sm" onClick={handleDownloadPDF} className="gap-2">
              <Download className="h-4 w-4" />
              PDF
            </Button>
          </div>
          <SheetDescription>
            {vehicle.model && <span>{vehicle.model} · </span>}
            {startDate && endDate
              ? `${format(startDate, 'dd/MM/yyyy')} a ${format(endDate, 'dd/MM/yyyy')}`
              : 'Período selecionado'}
          </SheetDescription>
        </SheetHeader>

        {/* KPI Principal */}
        <div className="mt-6 p-4 rounded-lg border bg-muted/30">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">{isProfitable ? 'Lucro Líquido' : 'Prejuízo'}</p>
              <div className={`text-3xl font-bold ${isProfitable ? 'text-emerald-600' : 'text-destructive'}`}>
                {formatCurrency(Math.abs(vehicle.totalProfit))}
              </div>
            </div>
            <div className="text-right">
              <div className="flex items-center gap-1">
                {isProfitable
                  ? <TrendingUp className="h-5 w-5 text-emerald-600" />
                  : <TrendingDown className="h-5 w-5 text-destructive" />}
                <span className={`text-2xl font-bold ${isProfitable ? 'text-emerald-600' : 'text-destructive'}`}>
                  {vehicle.margin.toFixed(1)}%
                </span>
              </div>
              <p className="text-xs text-muted-foreground">Margem de Lucro</p>
            </div>
          </div>
        </div>

        {/* Métricas Operacionais */}
        <div className="mt-6">
          <h3 className="text-sm font-semibold mb-3">Métricas Operacionais</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-lg border bg-card">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Route className="h-4 w-4" />
                <span className="text-xs">Distância Total</span>
              </div>
              <p className="text-lg font-semibold">
                {vehicle.totalDistance ? `${vehicle.totalDistance.toLocaleString('pt-BR')} km` : 'N/A'}
              </p>
            </div>
            <div className="p-3 rounded-lg border bg-card">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Fuel className="h-4 w-4" />
                <span className="text-xs">Média km/l</span>
              </div>
              <p className="text-lg font-semibold">
                {vehicle.fuelConsumption != null ? `${vehicle.fuelConsumption.toFixed(2)} km/l` : 'N/A'}
              </p>
              {vehicle.totalLiters != null && vehicle.totalLiters > 0 && (
                <p className="text-xs text-muted-foreground">{vehicle.totalLiters.toFixed(0)}L total</p>
              )}
            </div>
            <div className="p-3 rounded-lg border bg-card">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <DollarSign className="h-4 w-4" />
                <span className="text-xs">Custo por km</span>
              </div>
              <p className="text-lg font-semibold">
                {costPerKm ? formatCurrency(costPerKm) : 'N/A'}
              </p>
            </div>
            <div className="p-3 rounded-lg border bg-card">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Gauge className="h-4 w-4" />
                <span className="text-xs">Jornadas</span>
              </div>
              <p className="text-lg font-semibold">{vehicle.journeyCount}</p>
            </div>
          </div>
        </div>

        {/* Waterfall Chart */}
        <div className="mt-6">
          <h3 className="text-sm font-semibold mb-3">Composição do Resultado</h3>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={waterfallData} margin={{ top: 20, right: 10, left: 10, bottom: 5 }}>
                <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={50} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <ReferenceLine y={0} stroke="hsl(var(--border))" />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {waterfallData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                  <LabelList dataKey="displayValue" position="top" formatter={(value: number) => {
                    const abs = Math.abs(value);
                    return abs >= 1000 ? `${value >= 0 ? '' : '-'}${(abs / 1000).toFixed(1)}k` : value.toFixed(0);
                  }} style={{ fontSize: 10, fill: 'hsl(var(--foreground))' }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <Separator className="my-6" />

        {/* DRE */}
        <div>
          <h3 className="text-sm font-semibold mb-3">Demonstrativo de Resultado</h3>
          <div className="space-y-1">
            <DRELine label="RECEITA OPERACIONAL" value={vehicle.totalRevenue} isTotal />
            {vehicle.fuelCost > 0 && <DRELine label="Combustível" value={vehicle.fuelCost} isSubtraction />}
            {vehicle.maintenanceCost > 0 && <DRELine label="Manutenção" value={vehicle.maintenanceCost} isSubtraction />}
            {vehicle.otherExpensesCost > 0 && <DRELine label="Outros Custos" value={vehicle.otherExpensesCost} isSubtraction />}
            <div className="h-2" />
            <DRELine label="RESULTADO FINAL" value={vehicle.totalProfit} isTotal />
          </div>
        </div>

        <Separator className="my-6" />

        {/* Journeys Table */}
        <div>
          <h3 className="text-sm font-semibold mb-3">Jornadas no Período ({journeys.length})</h3>
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : journeys.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Nenhuma jornada completada neste período.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-2 py-2 text-left">#</th>
                    <th className="px-2 py-2 text-left">Rota</th>
                    <th className="px-2 py-2 text-left">Data</th>
                    <th className="px-2 py-2 text-right">Receita</th>
                    <th className="px-2 py-2 text-right">Despesas</th>
                    <th className="px-2 py-2 text-right">Lucro</th>
                    <th className="px-2 py-2 text-center">Mg</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {journeys.map(j => (
                    <tr key={j.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-2 py-2 font-medium">{j.journey_number}</td>
                      <td className="px-2 py-2 max-w-[120px] truncate" title={`${j.origin} → ${j.destination}`}>
                        {j.origin} → {j.destination}
                      </td>
                      <td className="px-2 py-2 text-muted-foreground">
                        {j.start_date ? formatDateBR(j.start_date) : '—'}
                      </td>
                      <td className="px-2 py-2 text-right font-mono">{formatCurrency(j.revenue)}</td>
                      <td className="px-2 py-2 text-right font-mono text-destructive">{formatCurrency(j.expenses)}</td>
                      <td className={`px-2 py-2 text-right font-mono font-bold ${j.profit >= 0 ? 'text-emerald-600' : 'text-destructive'}`}>
                        {formatCurrency(j.profit)}
                      </td>
                      <td className="px-2 py-2 text-center">
                        <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-bold ${
                          j.margin >= 20 ? 'bg-emerald-100 text-emerald-800'
                            : j.margin >= 0 ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {j.margin.toFixed(0)}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Status badges */}
        <div className="mt-6 flex flex-wrap gap-2">
          <Badge variant={isProfitable ? 'default' : 'destructive'}>
            {isProfitable ? 'Veículo Lucrativo' : 'Veículo com Prejuízo'}
          </Badge>
          {vehicle.margin >= 40 && (
            <Badge variant="secondary" className="bg-emerald-100 text-emerald-700">Alta Performance</Badge>
          )}
          {vehicle.margin > 0 && vehicle.margin < 20 && (
            <Badge variant="secondary" className="bg-yellow-100 text-yellow-700">Margem Baixa</Badge>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
