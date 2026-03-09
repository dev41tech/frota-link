import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingDown, TrendingUp, DollarSign, Info, Car } from "lucide-react";
import { useMultiTenant } from "@/hooks/useMultiTenant";
import { useStaffAccess } from "@/hooks/useStaffAccess";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell } from "recharts";

interface VehicleValuation {
  id: string;
  plate: string;
  model: string;
  brand: string;
  vehicle_type: string;
  purchase_value: number | null;
  current_value: number | null;
}

export default function FleetValuationOverview() {
  const { currentCompany } = useMultiTenant();
  const { staffContext } = useStaffAccess();
  const effectiveCompanyId = staffContext?.company_id || currentCompany?.id;
  
  const [loading, setLoading] = useState(true);
  const [vehicles, setVehicles] = useState<VehicleValuation[]>([]);

  useEffect(() => {
    if (effectiveCompanyId) {
      fetchVehicles();
    }
  }, [effectiveCompanyId]);

  const fetchVehicles = async () => {
    try {
      const { data, error } = await supabase
        .from("vehicles")
        .select("id, plate, model, brand, vehicle_type, purchase_value, current_value")
        .eq("company_id", effectiveCompanyId)
        .eq("status", "active");

      if (error) throw error;
      setVehicles(data || []);
    } catch (error) {
      console.error("Erro ao buscar veículos:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <DollarSign className="h-5 w-5" />
            <span>Valor da Frota</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  const vehiclesWithFipe = vehicles.filter(v => v.current_value && v.current_value > 0);
  const vehiclesWithoutFipe = vehicles.filter(v => !v.current_value || v.current_value === 0);
  
  const totalFipeValue = vehiclesWithFipe.reduce((sum, v) => sum + (v.current_value || 0), 0);
  
  // Calculate depreciation for vehicles with both purchase and current values
  const vehiclesWithDepreciation = vehicles.filter(
    v => v.purchase_value && v.purchase_value > 0 && v.current_value && v.current_value > 0
  );
  
  const totalPurchaseValue = vehiclesWithDepreciation.reduce((sum, v) => sum + (v.purchase_value || 0), 0);
  const totalCurrentValue = vehiclesWithDepreciation.reduce((sum, v) => sum + (v.current_value || 0), 0);
  const depreciationValue = totalCurrentValue - totalPurchaseValue;
  const depreciationPercent = totalPurchaseValue > 0 
    ? ((depreciationValue / totalPurchaseValue) * 100)
    : 0;

  // Prepare chart data - top 6 most valuable vehicles
  const chartData = vehiclesWithFipe
    .sort((a, b) => (b.current_value || 0) - (a.current_value || 0))
    .slice(0, 6)
    .map(v => ({
      plate: v.plate,
      value: v.current_value || 0,
      model: v.model,
      type: v.vehicle_type === "trailer" ? "Carreta" : "Cavalo"
    }));

  const chartConfig = {
    value: {
      label: "Valor FIPE",
      color: "hsl(var(--primary))",
    },
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatCurrencyCompact = (value: number) => {
    if (value >= 1000000) {
      return `R$ ${(value / 1000000).toFixed(1)}M`;
    }
    if (value >= 1000) {
      return `R$ ${(value / 1000).toFixed(0)}k`;
    }
    return formatCurrency(value);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <DollarSign className="h-5 w-5" />
          <span>Valor da Frota</span>
          {vehiclesWithoutFipe.length > 0 && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="h-4 w-4 text-amber-500" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p>{vehiclesWithoutFipe.length} veículo(s) sem valor FIPE cadastrado. Atualize via botão "FIPE em Massa".</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 overflow-hidden">
        {/* Summary Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center p-3 bg-primary/10 rounded-lg">
            <div className="text-lg sm:text-2xl font-bold text-primary truncate">
              {vehiclesWithFipe.length > 0 ? formatCurrencyCompact(totalFipeValue) : '--'}
            </div>
            <div className="text-xs text-muted-foreground">Valor FIPE Total</div>
          </div>
          <div className="text-center p-3 bg-muted rounded-lg">
            <div className="text-lg sm:text-2xl font-bold">
              {vehiclesWithFipe.length}/{vehicles.length}
            </div>
            <div className="text-xs text-muted-foreground">Com Valor FIPE</div>
          </div>
        </div>

        {/* Bar Chart */}
        {chartData.length > 0 && (
          <div className="h-40 overflow-hidden">
            <ChartContainer config={chartConfig} className="h-full w-full">
              <BarChart
                data={chartData}
                layout="vertical"
                margin={{ left: 0, right: 10, top: 5, bottom: 5 }}
              >
                <XAxis type="number" hide />
                <YAxis 
                  dataKey="plate" 
                  type="category" 
                  width={70}
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                />
                <ChartTooltip
                  cursor={{ fill: 'hsl(var(--muted))' }}
                  content={
                    <ChartTooltipContent
                      formatter={(value) => formatCurrency(Number(value))}
                    />
                  }
                />
                <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={16}>
                  {chartData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`}
                      fill={entry.type === "Carreta" 
                        ? "hsl(var(--muted-foreground))" 
                        : "hsl(var(--primary))"
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ChartContainer>
          </div>
        )}

        {/* Legend */}
        {chartData.length > 0 && (
          <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-primary"></div>
              <span>Cavalo</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-muted-foreground"></div>
              <span>Carreta</span>
            </div>
          </div>
        )}

        {/* Depreciation Section */}
        {vehiclesWithDepreciation.length > 0 && (
          <div className={`p-3 rounded-lg border ${
            depreciationValue >= 0 
              ? 'bg-green-50 border-green-200' 
              : 'bg-red-50 border-red-200'
          }`}>
            <div className="flex items-center gap-2 mb-2">
              {depreciationValue >= 0 ? (
                <TrendingUp className="h-4 w-4 text-green-600" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-600" />
              )}
              <span className={`text-sm font-medium ${
                depreciationValue >= 0 ? 'text-green-800' : 'text-red-800'
              }`}>
                {depreciationValue >= 0 ? 'Valorização' : 'Desvalorização'}
              </span>
              <Badge variant="secondary" className="ml-auto text-xs">
                {vehiclesWithDepreciation.length} veículo(s)
              </Badge>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-muted-foreground">Compra:</span>
                <span className="ml-1 font-medium">{formatCurrencyCompact(totalPurchaseValue)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Atual:</span>
                <span className="ml-1 font-medium">{formatCurrencyCompact(totalCurrentValue)}</span>
              </div>
            </div>
            <div className={`text-sm font-bold mt-1 ${
              depreciationValue >= 0 ? 'text-green-700' : 'text-red-700'
            }`}>
              {depreciationValue >= 0 ? '+' : ''}{depreciationPercent.toFixed(1)}% ({formatCurrency(depreciationValue)})
            </div>
          </div>
        )}

        {/* No FIPE Data Warning */}
        {vehiclesWithFipe.length === 0 && vehicles.length > 0 && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex items-center gap-2">
              <Car className="h-4 w-4 text-amber-600" />
              <p className="text-sm text-amber-800">
                Nenhum veículo com valor FIPE. Use "FIPE em Massa" para atualizar.
              </p>
            </div>
          </div>
        )}

        {/* Empty State */}
        {vehicles.length === 0 && (
          <div className="text-center py-4 text-muted-foreground text-sm">
            Nenhum veículo ativo cadastrado.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
