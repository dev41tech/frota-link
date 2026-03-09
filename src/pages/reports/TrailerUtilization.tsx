import { useState } from 'react';
import { useTrailerUtilization } from '@/hooks/useTrailerUtilization';
import { usePlanFeaturesContext } from '@/contexts/PlanFeaturesContext';
import { UpgradePrompt } from '@/components/subscription/UpgradePrompt';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { formatCurrency } from '@/lib/profitabilityCalculations';
import { formatDateBR, cn } from '@/lib/utils';
import { startOfMonth, endOfMonth, subMonths, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { DateRange } from 'react-day-picker';
import {
  Container,
  Truck,
  Route,
  Wrench,
  AlertTriangle,
  RefreshCw,
  BarChart3,
  CalendarIcon,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  Cell,
  PieChart,
  Pie,
  Legend,
} from 'recharts';

const CHART_COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
];

function OccupancyBadge({ rate }: { rate: number }) {
  if (rate >= 70) {
    return <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600">Alta ({rate.toFixed(0)}%)</Badge>;
  }
  if (rate >= 40) {
    return <Badge variant="secondary" className="bg-yellow-500/10 text-yellow-600">Média ({rate.toFixed(0)}%)</Badge>;
  }
  return <Badge variant="destructive">Baixa ({rate.toFixed(0)}%)</Badge>;
}

function TrailerTypeLabel({ type }: { type: string | null }) {
  const labels: Record<string, string> = {
    'sider': 'Sider',
    'graneleira': 'Graneleira',
    'bau': 'Baú',
    'tanque': 'Tanque',
    'cegonha': 'Cegonha',
    'prancha': 'Prancha',
    'container': 'Porta-Container',
    'dolly': 'Carreta Dolly',
    'basculante': 'Basculante',
    'refrigerada': 'Refrigerada / Frigorífica',
    'silo': 'Silo',
    'boiadeira': 'Boiadeira',
    'canavieira': 'Canavieira',
    'florestal': 'Florestal / Porta-Toras',
    'gaiola': 'Gaiola',
    'extensiva': 'Extensiva',
    'outros': 'Outros',
  };
  return <span>{labels[type || ''] || type || 'Não especificado'}</span>;
}

export default function TrailerUtilization() {
  const [startDate, setStartDate] = useState<Date>(startOfMonth(subMonths(new Date(), 1)));
  const [endDate, setEndDate] = useState<Date>(endOfMonth(new Date()));
  const planFeatures = usePlanFeaturesContext();

  const { data, loading, summary, topPerformers, idleTrailers, refetch } = useTrailerUtilization(startDate, endDate);

  // Bloquear acesso sem módulo de engates
  if (!planFeatures.hasCouplingModule) {
    return (
      <div className="container mx-auto p-6">
        <UpgradePrompt
          featureName="Gestão de Engates"
          requiredPlan="Add-on"
          currentPlan={planFeatures.planName}
        />
      </div>
    );
  }

  const occupancyChartData = data.map(t => ({
    plate: t.plate,
    occupancy: t.occupancyRate,
    fill: t.occupancyRate >= 70 ? CHART_COLORS[1] : t.occupancyRate >= 40 ? CHART_COLORS[2] : CHART_COLORS[0],
  }));

  // Dados para gráfico de tipos
  const typeChartData = Object.entries(summary.trailersByType).map(([type, count], index) => ({
    name: type,
    value: count,
    fill: CHART_COLORS[index % CHART_COLORS.length],
  }));

  if (loading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Container className="h-6 w-6 text-primary" />
            Utilização de Carretas
          </h1>
          <p className="text-muted-foreground">
            Análise de ocupação, custos e rentabilidade por carreta
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="justify-start text-left font-normal">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {format(startDate, 'dd/MM/yyyy')} - {format(endDate, 'dd/MM/yyyy')}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="range"
                defaultMonth={startDate}
                selected={{ from: startDate, to: endDate }}
                onSelect={(range: DateRange | undefined) => {
                  if (range?.from) setStartDate(range.from);
                  if (range?.to) setEndDate(range.to);
                }}
                initialFocus
                locale={ptBR}
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
          <Button variant="outline" size="icon" onClick={refetch}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <Container className="h-4 w-4" />
              <span className="text-sm">Total de Carretas</span>
            </div>
            <p className="text-3xl font-bold">{summary.totalTrailers}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <BarChart3 className="h-4 w-4" />
              <span className="text-sm">Ocupação Média</span>
            </div>
            <p className="text-3xl font-bold">{summary.averageOccupancy.toFixed(1)}%</p>
            <Progress value={summary.averageOccupancy} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <Route className="h-4 w-4" />
              <span className="text-sm">Km Total Rodados</span>
            </div>
            <p className="text-3xl font-bold">{summary.totalKm.toLocaleString('pt-BR')}</p>
            <p className="text-sm text-muted-foreground">km no período</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <Wrench className="h-4 w-4" />
              <span className="text-sm">Custo de Manutenção</span>
            </div>
            <p className="text-3xl font-bold">{formatCurrency(summary.totalMaintenanceCost)}</p>
            <p className="text-sm text-muted-foreground">total em carretas</p>
          </CardContent>
        </Card>
      </div>

      {/* Alertas de carretas ociosas */}
      {idleTrailers.length > 0 && (
        <Card className="border-yellow-200 bg-yellow-50/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-yellow-700">
              <AlertTriangle className="h-4 w-4" />
              Carretas com Baixa Utilização
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-yellow-700 mb-2">
              {idleTrailers.length} carreta(s) com menos de 20% de ocupação no período:
            </p>
            <div className="flex flex-wrap gap-2">
              {idleTrailers.map(t => (
                <Badge key={t.trailerId} variant="outline" className="border-yellow-300 text-yellow-700">
                  {t.plate} ({t.occupancyRate.toFixed(0)}%)
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gráfico de Ocupação por Carreta */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Taxa de Ocupação por Carreta</CardTitle>
            <CardDescription>Percentual de dias em uso no período</CardDescription>
          </CardHeader>
          <CardContent>
            {occupancyChartData.length > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={occupancyChartData} layout="vertical" margin={{ left: 60 }}>
                    <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                    <YAxis type="category" dataKey="plate" tick={{ fontSize: 11 }} width={55} />
                    <Tooltip 
                      formatter={(value: number) => [`${value.toFixed(1)}%`, 'Ocupação']}
                      labelFormatter={(label) => `Placa: ${label}`}
                    />
                    <Bar dataKey="occupancy" radius={[0, 4, 4, 0]}>
                      {occupancyChartData.map((entry, index) => (
                        <Cell key={index} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-muted-foreground">
                Nenhum dado disponível
              </div>
            )}
          </CardContent>
        </Card>

        {/* Gráfico de Distribuição por Tipo */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Distribuição por Tipo</CardTitle>
            <CardDescription>Composição da frota de carretas</CardDescription>
          </CardHeader>
          <CardContent>
            {typeChartData.length > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={typeChartData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label={({ name, value }) => `${name}: ${value}`}
                    >
                      {typeChartData.map((entry, index) => (
                        <Cell key={index} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-muted-foreground">
                Nenhum dado disponível
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tabela Detalhada */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Detalhamento por Carreta</CardTitle>
          <CardDescription>
            Métricas completas de utilização, custo e rentabilidade
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Container className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhuma carreta cadastrada</p>
              <p className="text-sm">Adicione carretas na seção de Veículos</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Placa</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="text-center">Eixos</TableHead>
                    <TableHead className="text-center">Ocupação</TableHead>
                    <TableHead className="text-right">Km</TableHead>
                    <TableHead className="text-center">Jornadas</TableHead>
                    <TableHead className="text-right">Manutenção</TableHead>
                    <TableHead className="text-right">Custo/Km</TableHead>
                    <TableHead className="text-right">Receita Prop.</TableHead>
                    <TableHead className="text-right">Lucro</TableHead>
                    <TableHead>Último Uso</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((trailer) => (
                    <TableRow key={trailer.trailerId}>
                      <TableCell className="font-medium">{trailer.plate}</TableCell>
                      <TableCell>
                        <TrailerTypeLabel type={trailer.trailerType} />
                      </TableCell>
                      <TableCell className="text-center">{trailer.axleCount || '-'}</TableCell>
                      <TableCell className="text-center">
                        <OccupancyBadge rate={trailer.occupancyRate} />
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {trailer.totalKm.toLocaleString('pt-BR')}
                      </TableCell>
                      <TableCell className="text-center">{trailer.journeyCount}</TableCell>
                      <TableCell className="text-right font-mono text-destructive">
                        {formatCurrency(trailer.maintenanceCost)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {trailer.costPerKm > 0 ? formatCurrency(trailer.costPerKm) : '-'}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(trailer.proportionalRevenue)}
                      </TableCell>
                      <TableCell className={`text-right font-mono ${trailer.profit >= 0 ? 'text-emerald-600' : 'text-destructive'}`}>
                        {formatCurrency(trailer.profit)}
                      </TableCell>
                      <TableCell className="text-sm">
                        {trailer.lastCoupledAt ? (
                          <div>
                            <div>{formatDateBR(trailer.lastCoupledAt)}</div>
                            <div className="text-xs text-muted-foreground flex items-center gap-1">
                              <Truck className="h-3 w-3" />
                              {trailer.lastTruckPlate}
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
