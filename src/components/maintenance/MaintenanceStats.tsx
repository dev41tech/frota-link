import { Card, CardContent } from "@/components/ui/card";
import { DollarSign, Calendar, AlertTriangle, Wrench, TrendingUp, TrendingDown, Clock, Activity } from "lucide-react";
import { cn } from "@/lib/utils";

// Expandindo os tipos de filtro para incluir os novos estados
type FilterType = "all" | "scheduled" | "overdue" | "active" | "upcoming";

interface MaintenanceStatsProps {
  totalCost: number;
  monthCost: number;
  scheduledCount: number;
  overdueCount: number;
  // Novos dados operacionais
  activeCount?: number; // Veículos atualmente na oficina
  upcomingCount?: number; // Manutenções vencendo em breve (ex: 7 dias)

  previousMonthCost?: number;
  previousOverdueCount?: number;
  activeFilter?: FilterType;
  onFilterChange?: (filter: FilterType) => void;
}

export function MaintenanceStats({
  totalCost,
  monthCost,
  scheduledCount,
  overdueCount,
  activeCount = 0,
  upcomingCount = 0,
  previousMonthCost = 0,
  previousOverdueCount = 0,
  activeFilter = "all",
  onFilterChange,
}: MaintenanceStatsProps) {
  const monthChange = previousMonthCost > 0 ? ((monthCost - previousMonthCost) / previousMonthCost) * 100 : 0;

  const overdueChange = overdueCount - previousOverdueCount;

  // Lógica de cor para tendência financeira: Custo subiu (ruim) = Vermelho
  const isCostTrendBad = monthChange > 0;

  const stats = [
    {
      id: "all" as FilterType,
      label: "Custo Mês Atual", // Movi para primeiro pois é o KPI financeiro principal
      value: monthCost.toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
      }),
      icon: DollarSign,
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
      borderColor: "border-blue-500",
      trend: monthChange,
      trendIsBad: isCostTrendBad, // Nova prop para controlar cor da trend
      clickable: false,
    },
    {
      id: "active" as FilterType,
      label: "Em Manutenção", // Crítico: Veículos parados
      value: activeCount.toString(),
      icon: Activity,
      color: "text-purple-500",
      bgColor: "bg-purple-500/10",
      borderColor: "border-purple-500",
      clickable: true,
    },
    {
      id: "overdue" as FilterType,
      label: "Atrasadas",
      value: overdueCount.toString(),
      icon: AlertTriangle,
      color: overdueCount > 0 ? "text-red-500" : "text-muted-foreground",
      bgColor: overdueCount > 0 ? "bg-red-500/10" : "bg-muted/50",
      borderColor: "border-red-500",
      trend: overdueChange !== 0 ? overdueChange : undefined,
      trendIsCount: true,
      trendIsBad: overdueChange > 0, // Mais atrasos = Ruim
      clickable: true,
    },
    {
      id: "upcoming" as FilterType,
      label: "Vence em 7 dias", // Planejamento
      value: upcomingCount.toString(),
      icon: Clock,
      color: "text-orange-500",
      bgColor: "bg-orange-500/10",
      borderColor: "border-orange-500",
      clickable: true,
    },
    {
      id: "scheduled" as FilterType,
      label: "Agendadas (Total)",
      value: scheduledCount.toString(),
      icon: Wrench, // Ícone de chave inglesa
      color: "text-slate-500",
      bgColor: "bg-slate-500/10",
      borderColor: "border-slate-500",
      clickable: true,
    },
  ];

  return (
    // Ajustei o grid para acomodar melhor 5 itens em telas grandes
    <div className="grid gap-4 grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      {stats.map((stat, index) => {
        // Lógica de cor da tendência baseada se é "Bom" ou "Ruim"
        const trendColor = stat.trendIsBad ? "text-red-500" : "text-green-500";
        const TrendIcon = stat.trend && stat.trend > 0 ? TrendingUp : TrendingDown;

        return (
          <Card
            key={`${stat.label}-${index}`}
            className={cn(
              "transition-all duration-200 border",
              stat.clickable && "cursor-pointer hover:shadow-md hover:scale-[1.02]",
              stat.clickable && activeFilter === stat.id ? `border-2 ${stat.borderColor} bg-accent/5` : "border-border",
            )}
            onClick={() => {
              if (stat.clickable && onFilterChange) {
                onFilterChange(activeFilter === stat.id ? "all" : stat.id);
              }
            }}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                  <stat.icon className={`h-4 w-4 sm:h-5 sm:w-5 ${stat.color}`} />
                </div>
                {stat.trend !== undefined && (
                  <div className={cn("flex items-center gap-1 text-xs font-medium", trendColor)}>
                    <TrendIcon className="h-3 w-3" />
                    <span>
                      {stat.trendIsCount
                        ? `${stat.trend > 0 ? "+" : ""}${stat.trend}`
                        : `${Math.abs(stat.trend).toFixed(0)}%`}
                    </span>
                  </div>
                )}
              </div>

              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{stat.label}</p>
                <h3 className="text-2xl font-bold mt-1">{stat.value}</h3>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
