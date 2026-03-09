import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { format, eachDayOfInterval, eachWeekOfInterval, eachMonthOfInterval, startOfWeek, startOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { TrendingUp } from "lucide-react";

interface TrendDataPoint {
  date: string;
  revenue: number;
  expenses: number;
  profit: number;
}

interface TrendChartsProps {
  startDate: Date;
  endDate: Date;
  revenueData: Array<{ date: string; amount: number }>;
  expensesData: Array<{ date: string; amount: number }>;
  fuelExpensesData: Array<{ date: string; amount: number }>;
}

export function TrendCharts({ 
  startDate, 
  endDate, 
  revenueData, 
  expensesData, 
  fuelExpensesData 
}: TrendChartsProps) {
  
  // Determinar granularidade baseada no período
  const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  const granularity = daysDiff <= 7 ? 'daily' : daysDiff <= 60 ? 'weekly' : 'monthly';

  // Gerar intervalos baseado na granularidade
  const intervals = granularity === 'daily' 
    ? eachDayOfInterval({ start: startDate, end: endDate })
    : granularity === 'weekly'
    ? eachWeekOfInterval({ start: startDate, end: endDate }, { locale: ptBR })
    : eachMonthOfInterval({ start: startDate, end: endDate });

  // Processar dados para o gráfico
  const trendData: TrendDataPoint[] = intervals.map(interval => {
    const intervalStart = granularity === 'weekly' 
      ? startOfWeek(interval, { locale: ptBR })
      : granularity === 'monthly'
      ? startOfMonth(interval)
      : interval;

    const intervalEnd = granularity === 'daily'
      ? interval
      : granularity === 'weekly'
      ? new Date(intervalStart.getTime() + 7 * 24 * 60 * 60 * 1000)
      : new Date(intervalStart.getFullYear(), intervalStart.getMonth() + 1, 0);

    // Filtrar dados do intervalo
    const intervalRevenue = revenueData
      .filter(r => {
        const date = new Date(r.date);
        return date >= intervalStart && date <= intervalEnd;
      })
      .reduce((sum, r) => sum + r.amount, 0);

    const intervalExpenses = expensesData
      .filter(e => {
        const date = new Date(e.date);
        return date >= intervalStart && date <= intervalEnd;
      })
      .reduce((sum, e) => sum + e.amount, 0);

    const intervalFuelExpenses = fuelExpensesData
      .filter(f => {
        const date = new Date(f.date);
        return date >= intervalStart && date <= intervalEnd;
      })
      .reduce((sum, f) => sum + f.amount, 0);

    const totalExpenses = intervalExpenses + intervalFuelExpenses;
    const profit = intervalRevenue - totalExpenses;

    return {
      date: granularity === 'daily'
        ? format(interval, 'dd/MM', { locale: ptBR })
        : granularity === 'weekly'
        ? format(intervalStart, 'dd/MM', { locale: ptBR })
        : format(interval, 'MMM/yy', { locale: ptBR }),
      revenue: intervalRevenue,
      expenses: totalExpenses,
      profit: profit
    };
  });

  // Formatador de moeda para tooltip
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
          <p className="font-semibold text-foreground mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{ color: entry.color }} className="text-sm">
              {entry.name}: {formatCurrency(entry.value)}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  const granularityLabel = granularity === 'daily' 
    ? 'Diária' 
    : granularity === 'weekly' 
    ? 'Semanal' 
    : 'Mensal';

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Tendência de Receitas e Despesas
          </CardTitle>
          <span className="text-sm text-muted-foreground">
            Visão {granularityLabel}
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={350}>
          <LineChart data={trendData}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis 
              dataKey="date" 
              className="text-xs text-muted-foreground"
              tick={{ fill: 'hsl(var(--muted-foreground))' }}
            />
            <YAxis 
              className="text-xs text-muted-foreground"
              tick={{ fill: 'hsl(var(--muted-foreground))' }}
              tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend 
              wrapperStyle={{ paddingTop: '20px' }}
              iconType="line"
            />
            <Line 
              type="monotone" 
              dataKey="revenue" 
              stroke="hsl(var(--success))" 
              strokeWidth={2.5}
              name="Receitas"
              dot={{ fill: 'hsl(var(--success))', r: 4 }}
              activeDot={{ r: 6 }}
            />
            <Line 
              type="monotone" 
              dataKey="expenses" 
              stroke="hsl(var(--warning))" 
              strokeWidth={2.5}
              name="Despesas"
              dot={{ fill: 'hsl(var(--warning))', r: 4 }}
              activeDot={{ r: 6 }}
            />
            <Line 
              type="monotone" 
              dataKey="profit" 
              stroke="hsl(var(--primary))" 
              strokeWidth={2.5}
              name="Lucro"
              dot={{ fill: 'hsl(var(--primary))', r: 4 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
