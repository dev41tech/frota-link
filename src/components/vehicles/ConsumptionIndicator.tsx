import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Gauge, TrendingUp, TrendingDown, AlertTriangle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ConsumptionIndicatorProps {
  actual: number | null;
  target: number | null;
  status: 'excellent' | 'good' | 'warning' | 'critical' | 'unknown' | 'insufficient_data';
  variancePercent: number;
  size?: 'sm' | 'md' | 'lg';
  showDetails?: boolean;
}

export default function ConsumptionIndicator({
  actual,
  target,
  status,
  variancePercent,
  size = 'md',
  showDetails = true
}: ConsumptionIndicatorProps) {
  const getStatusConfig = () => {
    switch (status) {
      case 'excellent':
        return {
          color: 'bg-green-500',
          textColor: 'text-green-700',
          bgColor: 'bg-green-50',
          icon: <CheckCircle2 className="h-4 w-4" />,
          label: 'Excelente',
          badgeColor: 'bg-green-100 text-green-800'
        };
      case 'good':
        return {
          color: 'bg-blue-500',
          textColor: 'text-blue-700',
          bgColor: 'bg-blue-50',
          icon: <TrendingUp className="h-4 w-4" />,
          label: 'Na Meta',
          badgeColor: 'bg-blue-100 text-blue-800'
        };
      case 'warning':
        return {
          color: 'bg-yellow-500',
          textColor: 'text-yellow-700',
          bgColor: 'bg-yellow-50',
          icon: <AlertTriangle className="h-4 w-4" />,
          label: 'Atenção',
          badgeColor: 'bg-yellow-100 text-yellow-800'
        };
      case 'critical':
        return {
          color: 'bg-red-500',
          textColor: 'text-red-700',
          bgColor: 'bg-red-50',
          icon: <TrendingDown className="h-4 w-4" />,
          label: 'Crítico',
          badgeColor: 'bg-red-100 text-red-800'
        };
      case 'insufficient_data':
        return {
          color: 'bg-amber-500',
          textColor: 'text-amber-700',
          bgColor: 'bg-amber-50',
          icon: <AlertTriangle className="h-4 w-4" />,
          label: 'Dados Insuficientes',
          badgeColor: 'bg-amber-100 text-amber-800'
        };
      default:
        return {
          color: 'bg-muted',
          textColor: 'text-muted-foreground',
          bgColor: 'bg-muted/50',
          icon: <Gauge className="h-4 w-4" />,
          label: 'Sem Dados',
          badgeColor: 'bg-muted text-muted-foreground'
        };
    }
  };

  const config = getStatusConfig();

  if (!actual || !target) {
    return (
      <div className="flex items-center space-x-2">
        <Gauge className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Sem dados</span>
      </div>
    );
  }

  const progressPercent = Math.min((actual / target) * 100, 150);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          {config.icon}
          <span className="text-sm font-medium">Consumo</span>
        </div>
        <Badge className={cn("text-xs", config.badgeColor)}>
          {config.label}
        </Badge>
      </div>

      {showDetails && (
        <>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Real / Meta</span>
            <span className="font-medium">
              {actual.toFixed(1)} / {target.toFixed(1)} km/L
            </span>
          </div>

          <Progress 
            value={progressPercent} 
            className="h-2"
          />

          <div className="flex items-center justify-between text-xs">
            <span className={config.textColor}>
              {variancePercent > 0 ? '+' : ''}{variancePercent.toFixed(1)}% da meta
            </span>
            {variancePercent < -15 && (
              <span className="text-red-600 font-medium">
                Revisar consumo
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
}
