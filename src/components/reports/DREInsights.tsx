import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Lightbulb,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Fuel,
  Route,
  Wallet,
  CheckCircle2,
} from "lucide-react";
import { DREData, formatCurrency } from "@/lib/dreCalculations";

interface DREInsightsProps {
  dreData: DREData;
  previousDreData?: DREData | null;
}

interface Insight {
  id: string;
  type: "success" | "warning" | "info" | "danger";
  icon: React.ReactNode;
  title: string;
  description: string;
  value?: string;
}

export function DREInsights({ dreData, previousDreData }: DREInsightsProps) {
  const insights = useMemo(() => {
    const result: Insight[] = [];
    const { revenue, directExpenses, indirectExpenses, journeys, indicators, result: dreResult } = dreData;

    // 1. Análise da margem
    if (dreResult.margin > 20) {
      result.push({
        id: "margin-high",
        type: "success",
        icon: <TrendingUp className="h-4 w-4" />,
        title: "Excelente margem de lucro",
        description: `Margem de ${dreResult.margin.toFixed(1)}% está acima da média do setor (15-20%)`,
        value: `${dreResult.margin.toFixed(1)}%`,
      });
    } else if (dreResult.margin < 5 && dreResult.margin >= 0) {
      result.push({
        id: "margin-low",
        type: "warning",
        icon: <AlertTriangle className="h-4 w-4" />,
        title: "Margem de lucro baixa",
        description: "Considere revisar custos operacionais ou renegociar fretes",
        value: `${dreResult.margin.toFixed(1)}%`,
      });
    } else if (dreResult.margin < 0) {
      result.push({
        id: "margin-negative",
        type: "danger",
        icon: <TrendingDown className="h-4 w-4" />,
        title: "Operação com prejuízo",
        description: "Despesas ultrapassam receitas. Ação urgente necessária.",
        value: formatCurrency(dreResult.profit),
      });
    }

    // 2. Análise de combustível
    const fuelPercentage = revenue.total > 0 ? (directExpenses.fuel.total / revenue.total) * 100 : 0;
    if (fuelPercentage > 40) {
      result.push({
        id: "fuel-high",
        type: "warning",
        icon: <Fuel className="h-4 w-4" />,
        title: "Combustível representa alto custo",
        description: `${fuelPercentage.toFixed(0)}% da receita vai para combustível. Ideal: abaixo de 35%`,
        value: formatCurrency(directExpenses.fuel.total),
      });
    }

    // 3. Análise de consumo
    if (indicators.operational.avgConsumption > 0) {
      if (indicators.operational.avgConsumption < 2.5) {
        result.push({
          id: "consumption-bad",
          type: "danger",
          icon: <Fuel className="h-4 w-4" />,
          title: "Consumo médio crítico",
          description: `${indicators.operational.avgConsumption.toFixed(2)} km/L está abaixo do esperado. Verifique manutenção.`,
          value: `${indicators.operational.avgConsumption.toFixed(2)} km/L`,
        });
      } else if (indicators.operational.avgConsumption >= 3.5) {
        result.push({
          id: "consumption-good",
          type: "success",
          icon: <CheckCircle2 className="h-4 w-4" />,
          title: "Bom consumo de combustível",
          description: `Média de ${indicators.operational.avgConsumption.toFixed(2)} km/L é eficiente para o setor.`,
          value: `${indicators.operational.avgConsumption.toFixed(2)} km/L`,
        });
      }
    }

    // 4. Análise de receita por km
    if (indicators.financial.revenuePerKm > 0) {
      if (indicators.financial.revenuePerKm < 2) {
        result.push({
          id: "revenue-km-low",
          type: "warning",
          icon: <Route className="h-4 w-4" />,
          title: "Receita por km baixa",
          description: `${formatCurrency(indicators.financial.revenuePerKm)}/km. Considere rotas mais rentáveis.`,
          value: `${formatCurrency(indicators.financial.revenuePerKm)}/km`,
        });
      }
    }

    // 5. Maior categoria de despesa
    const allCategories = [
      ...directExpenses.categories,
      { name: "Combustível", amount: directExpenses.fuel.total, color: "#ef4444" },
    ];
    const topExpense = allCategories.reduce(
      (max, cat) => (cat.amount > max.amount ? cat : max),
      { name: "", amount: 0 }
    );

    if (topExpense.amount > 0) {
      const percentage = revenue.total > 0 ? (topExpense.amount / revenue.total) * 100 : 0;
      result.push({
        id: "top-expense",
        type: "info",
        icon: <Wallet className="h-4 w-4" />,
        title: `Maior despesa: ${topExpense.name}`,
        description: `Representa ${percentage.toFixed(0)}% da receita total`,
        value: formatCurrency(topExpense.amount),
      });
    }

    // 6. Comparação com período anterior
    if (previousDreData) {
      const revenueChange =
        previousDreData.revenue.total > 0
          ? ((revenue.total - previousDreData.revenue.total) / previousDreData.revenue.total) * 100
          : 0;

      if (revenueChange > 10) {
        result.push({
          id: "revenue-growth",
          type: "success",
          icon: <TrendingUp className="h-4 w-4" />,
          title: "Crescimento de receita",
          description: `Aumento de ${revenueChange.toFixed(0)}% em relação ao período anterior`,
          value: `+${revenueChange.toFixed(0)}%`,
        });
      } else if (revenueChange < -10) {
        result.push({
          id: "revenue-decline",
          type: "warning",
          icon: <TrendingDown className="h-4 w-4" />,
          title: "Queda na receita",
          description: `Redução de ${Math.abs(revenueChange).toFixed(0)}% em relação ao período anterior`,
          value: `${revenueChange.toFixed(0)}%`,
        });
      }
    }

    // 7. Alerta de jornadas sem distância
    if (journeys.count > 0 && journeys.totalDistance === 0) {
      result.push({
        id: "missing-distance",
        type: "warning",
        icon: <AlertTriangle className="h-4 w-4" />,
        title: "Dados incompletos",
        description: `${journeys.count} jornadas sem registro de distância. Indicadores podem estar incorretos.`,
      });
    }

    return result.slice(0, 4); // Limitar a 4 insights
  }, [dreData, previousDreData]);

  if (insights.length === 0) return null;

  const getTypeStyles = (type: Insight["type"]) => {
    switch (type) {
      case "success":
        return "border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20 dark:border-emerald-900";
      case "warning":
        return "border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900";
      case "danger":
        return "border-rose-200 bg-rose-50 dark:bg-rose-950/20 dark:border-rose-900";
      default:
        return "border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-900";
    }
  };

  const getIconColor = (type: Insight["type"]) => {
    switch (type) {
      case "success":
        return "text-emerald-600";
      case "warning":
        return "text-amber-600";
      case "danger":
        return "text-rose-600";
      default:
        return "text-blue-600";
    }
  };

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
      <CardContent className="pt-4">
        <div className="flex items-center gap-2 mb-4">
          <Lightbulb className="h-5 w-5 text-primary" />
          <h3 className="font-semibold text-sm">Insights Automáticos</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {insights.map((insight) => (
            <div
              key={insight.id}
              className={`p-3 rounded-lg border ${getTypeStyles(insight.type)} transition-all hover:scale-[1.02]`}
            >
              <div className="flex items-start gap-2">
                <span className={getIconColor(insight.type)}>{insight.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium text-sm truncate">{insight.title}</p>
                    {insight.value && (
                      <Badge variant="secondary" className="shrink-0 text-xs">
                        {insight.value}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                    {insight.description}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
