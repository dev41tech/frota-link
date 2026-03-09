import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useMultiTenant } from "@/hooks/useMultiTenant";
import { formatCurrency } from "@/lib/dreCalculations";
import { Calendar, TrendingUp, Target, BarChart3 } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  ComposedChart,
  Area,
} from "recharts";
import { format, eachMonthOfInterval, startOfYear, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";

interface MonthlyData {
  month: string;
  monthLabel: string;
  receitas: number;
  despesas: number;
  combustivel: number;
  lucro: number;
  acumuladoReceitas: number;
  acumuladoDespesas: number;
  acumuladoLucro: number;
  margemAcumulada: number;
}

interface DREYearlyAccumulatedProps {
  vehicleId?: string;
  driverId?: string;
}

export function DREYearlyAccumulated({ vehicleId, driverId }: DREYearlyAccumulatedProps) {
  const { currentCompany } = useMultiTenant();
  const [loading, setLoading] = useState(true);
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
  const [viewMode, setViewMode] = useState<"monthly" | "accumulated">("monthly");

  useEffect(() => {
    if (currentCompany?.id) {
      fetchYearlyData();
    }
  }, [currentCompany?.id, vehicleId, driverId]);

  const fetchYearlyData = async () => {
    if (!currentCompany?.id) return;
    
    setLoading(true);
    try {
      const yearStart = startOfYear(new Date());
      const months = eachMonthOfInterval({ start: yearStart, end: new Date() });

      // Se tiver filtro de veículo ou motorista, buscar jornadas primeiro
      let journeyIds: string[] = [];
      if (vehicleId || driverId) {
        let journeysQuery = supabase
          .from("journeys")
          .select("id")
          .eq("company_id", currentCompany.id)
          .is("deleted_at", null)
          .gte("created_at", yearStart.toISOString())
          .lte("created_at", new Date().toISOString());

        if (vehicleId) journeysQuery = journeysQuery.eq("vehicle_id", vehicleId);
        if (driverId) journeysQuery = journeysQuery.eq("driver_id", driverId);

        const { data: journeys } = await journeysQuery;
        journeyIds = journeys?.map(j => j.id) || [];
      }

      const data = await Promise.all(
        months.map(async (month) => {
          const monthStart = startOfMonth(month);
          const monthEnd = endOfMonth(month);

          // Build queries with proper filters
          let revenueQuery = supabase
            .from("revenue")
            .select("amount")
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
          if (vehicleId || driverId) {
            // Filtrar receitas pelas jornadas do veículo/motorista
            if (journeyIds.length > 0) {
              revenueQuery = revenueQuery.in("journey_id", journeyIds);
            } else {
              // Sem jornadas = sem receitas vinculadas
              revenueQuery = revenueQuery.eq("journey_id", "00000000-0000-0000-0000-000000000000");
            }
            
            if (vehicleId) {
              expenseQuery = expenseQuery.eq("vehicle_id", vehicleId);
              fuelQuery = fuelQuery.eq("vehicle_id", vehicleId);
            }
          }

          const [revenueRes, expenseRes, fuelRes] = await Promise.all([
            revenueQuery,
            expenseQuery,
            fuelQuery,
          ]);

          const receitas = revenueRes.data?.reduce((sum, r) => sum + r.amount, 0) || 0;
          const outrasDesp = expenseRes.data?.reduce((sum, e) => sum + e.amount, 0) || 0;
          const combustivel = fuelRes.data?.reduce((sum, f) => sum + f.total_amount, 0) || 0;
          const despesas = outrasDesp + combustivel;
          const lucro = receitas - despesas;

          return {
            month: format(month, "yyyy-MM"),
            monthLabel: format(month, "MMM", { locale: ptBR }),
            receitas,
            despesas,
            combustivel,
            lucro,
            acumuladoReceitas: 0,
            acumuladoDespesas: 0,
            acumuladoLucro: 0,
            margemAcumulada: 0,
          };
        })
      );

      // Calcular acumulados
      let accReceitas = 0;
      let accDespesas = 0;
      let accLucro = 0;

      const dataWithAccumulated = data.map((item) => {
        accReceitas += item.receitas;
        accDespesas += item.despesas;
        accLucro += item.lucro;
        
        return {
          ...item,
          acumuladoReceitas: accReceitas,
          acumuladoDespesas: accDespesas,
          acumuladoLucro: accLucro,
          margemAcumulada: accReceitas > 0 ? (accLucro / accReceitas) * 100 : 0,
        };
      });

      setMonthlyData(dataWithAccumulated);
    } catch (error) {
      console.error("Erro ao buscar dados anuais:", error);
    } finally {
      setLoading(false);
    }
  };

  const ytdTotals = useMemo(() => {
    if (monthlyData.length === 0) return { receitas: 0, despesas: 0, lucro: 0, margem: 0 };
    const last = monthlyData[monthlyData.length - 1];
    return {
      receitas: last.acumuladoReceitas,
      despesas: last.acumuladoDespesas,
      lucro: last.acumuladoLucro,
      margem: last.margemAcumulada,
    };
  }, [monthlyData]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Acumulado Anual (YTD)
            </CardTitle>
            <CardDescription>
              Evolução mensal e acumulado desde {format(startOfYear(new Date()), "MMMM 'de' yyyy", { locale: ptBR })}
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Badge 
              variant={viewMode === "monthly" ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => setViewMode("monthly")}
            >
              Mensal
            </Badge>
            <Badge 
              variant={viewMode === "accumulated" ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => setViewMode("accumulated")}
            >
              Acumulado
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* KPIs YTD */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-lg bg-green-50 border border-green-100">
            <p className="text-xs text-green-600 font-medium">Receita YTD</p>
            <p className="text-lg font-bold text-green-700">{formatCurrency(ytdTotals.receitas)}</p>
          </div>
          <div className="p-4 rounded-lg bg-red-50 border border-red-100">
            <p className="text-xs text-red-600 font-medium">Despesas YTD</p>
            <p className="text-lg font-bold text-red-700">{formatCurrency(ytdTotals.despesas)}</p>
          </div>
          <div className={`p-4 rounded-lg ${ytdTotals.lucro >= 0 ? "bg-blue-50 border-blue-100" : "bg-orange-50 border-orange-100"} border`}>
            <p className={`text-xs font-medium ${ytdTotals.lucro >= 0 ? "text-blue-600" : "text-orange-600"}`}>
              Lucro YTD
            </p>
            <p className={`text-lg font-bold ${ytdTotals.lucro >= 0 ? "text-blue-700" : "text-orange-700"}`}>
              {formatCurrency(ytdTotals.lucro)}
            </p>
          </div>
          <div className="p-4 rounded-lg bg-purple-50 border border-purple-100">
            <p className="text-xs text-purple-600 font-medium">Margem YTD</p>
            <p className="text-lg font-bold text-purple-700">{ytdTotals.margem.toFixed(1)}%</p>
          </div>
        </div>

        {/* Gráfico */}
        <div className="h-[350px]">
          <ResponsiveContainer width="100%" height="100%">
            {viewMode === "monthly" ? (
              <BarChart data={monthlyData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="monthLabel" tick={{ fontSize: 12 }} />
                <YAxis 
                  tick={{ fontSize: 12 }} 
                  tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  formatter={(value: number) => formatCurrency(value)}
                  labelFormatter={(label) => `Mês: ${label}`}
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                />
                <Legend />
                <Bar dataKey="receitas" name="Receitas" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="despesas" name="Despesas" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="lucro" name="Lucro" fill="hsl(var(--chart-3))" radius={[4, 4, 0, 0]} />
              </BarChart>
            ) : (
              <ComposedChart data={monthlyData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="monthLabel" tick={{ fontSize: 12 }} />
                <YAxis 
                  yAxisId="left"
                  tick={{ fontSize: 12 }} 
                  tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                />
                <YAxis 
                  yAxisId="right" 
                  orientation="right"
                  tick={{ fontSize: 12 }}
                  tickFormatter={(value) => `${value.toFixed(0)}%`}
                />
                <Tooltip
                  formatter={(value: number, name: string) => 
                    name.includes("Margem") ? `${value.toFixed(1)}%` : formatCurrency(value)
                  }
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                />
                <Legend />
                <Area 
                  yAxisId="left"
                  type="monotone" 
                  dataKey="acumuladoReceitas" 
                  name="Receitas Acum." 
                  fill="hsl(var(--chart-1))" 
                  fillOpacity={0.3}
                  stroke="hsl(var(--chart-1))"
                />
                <Area 
                  yAxisId="left"
                  type="monotone" 
                  dataKey="acumuladoDespesas" 
                  name="Despesas Acum." 
                  fill="hsl(var(--chart-2))" 
                  fillOpacity={0.3}
                  stroke="hsl(var(--chart-2))"
                />
                <Line 
                  yAxisId="left"
                  type="monotone" 
                  dataKey="acumuladoLucro" 
                  name="Lucro Acum." 
                  stroke="hsl(var(--chart-3))" 
                  strokeWidth={3}
                  dot={{ r: 4 }}
                />
                <Line 
                  yAxisId="right"
                  type="monotone" 
                  dataKey="margemAcumulada" 
                  name="Margem Acum." 
                  stroke="hsl(var(--chart-4))" 
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={{ r: 3 }}
                />
              </ComposedChart>
            )}
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
