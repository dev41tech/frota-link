import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Truck, Navigation, DollarSign, TrendingUp, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface VehicleData {
  id: string;
  plate: string;
  model: string;
  status: "operating" | "parked" | "maintenance";
  currentJourney?: {
    id: string;
    origin: string;
    destination: string;
    revenue: number;
    directExpenses: number;
    margin: number;
    driverBalance: number;
  };
  metrics: {
    totalRevenue: number;
    totalExpenses: number;
    grossProfit: number;
    marginPercent: number;
    fuelEfficiency: number;
    targetEfficiency: number;
  };
}

interface VehicleCardProps {
  vehicle: VehicleData;
  onOpenJourney: (vehicleId: string) => void;
  onViewDetails: (vehicleId: string, journeyId?: string) => void;
}

export default function VehicleCard({ vehicle, onOpenJourney, onViewDetails }: VehicleCardProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case "operating":
        return "bg-success text-success-foreground";
      case "parked":
        return "bg-warning text-warning-foreground";
      case "maintenance":
        return "bg-danger text-danger-foreground";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "operating":
        return "Operando";
      case "parked":
        return "Estacionado";
      case "maintenance":
        return "Manutenção";
      default:
        return "Indefinido";
    }
  };

  const getMarginColor = (margin: number) => {
    if (margin >= 45) return "text-success";
    if (margin >= 35) return "text-warning";
    return "text-danger";
  };

  const getMarginIndicator = (margin: number) => {
    if (margin >= 45) return "🟢";
    if (margin >= 35) return "🟡";
    return "🔴";
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const efficiencyPercent = (vehicle.metrics.fuelEfficiency / vehicle.metrics.targetEfficiency) * 100;

  return (
    <Card className="shadow-card hover:shadow-elevated transition-all duration-200">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-primary/10 p-2 rounded-lg">
              <Truck className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg font-bold">{vehicle.plate}</CardTitle>
              <p className="text-sm text-muted-foreground">{vehicle.model}</p>
            </div>
          </div>
          <Badge className={cn("text-xs", getStatusColor(vehicle.status))}>
            {getStatusLabel(vehicle.status)}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Current Journey */}
        {vehicle.currentJourney && (
          <div className="p-3 bg-muted/50 rounded-lg space-y-2">
            <div className="flex items-center space-x-2">
              <Navigation className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Jornada Atual</span>
            </div>
            <p className="text-xs text-muted-foreground">
              {vehicle.currentJourney.origin} → {vehicle.currentJourney.destination}
            </p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-muted-foreground">Receita:</span>
                <span className="ml-1 font-medium text-success">
                  {formatCurrency(vehicle.currentJourney.revenue)}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Despesas:</span>
                <span className="ml-1 font-medium text-danger">
                  {formatCurrency(vehicle.currentJourney.directExpenses)}
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Margem:</span>
              <span className={cn("text-sm font-bold", getMarginColor(vehicle.currentJourney.margin))}>
                {getMarginIndicator(vehicle.currentJourney.margin)} {vehicle.currentJourney.margin.toFixed(1)}%
              </span>
            </div>
          </div>
        )}

        {/* Metrics */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-2">
            <TrendingUp className="h-4 w-4" />
            <span>Informações Gerais</span>
          </div>
          
          {(() => {
            // Use journey data when active, otherwise use period metrics
            const displayGrossProfit = vehicle.currentJourney 
              ? vehicle.currentJourney.revenue - vehicle.currentJourney.directExpenses
              : vehicle.metrics.grossProfit;
            const displayMargin = vehicle.currentJourney 
              ? vehicle.currentJourney.margin 
              : vehicle.metrics.marginPercent;
            
            return (
              <div className="grid grid-cols-2 gap-3">
                <div className="text-center p-2 bg-success-light rounded-lg">
                  <div className={cn("text-sm font-bold", displayGrossProfit >= 0 ? "text-success" : "text-danger")}>
                    {formatCurrency(displayGrossProfit)}
                  </div>
                  <div className="text-xs text-muted-foreground">Lucro Bruto</div>
                </div>
                <div className="text-center p-2 bg-primary/5 rounded-lg">
                  <div className={cn("text-sm font-bold", getMarginColor(displayMargin))}>
                    {displayMargin.toFixed(1)}%
                  </div>
                  <div className="text-xs text-muted-foreground">Margem</div>
                </div>
              </div>
            );
          })()}

          {/* Fuel Efficiency */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Consumo (km/l)</span>
              <span className="font-medium">
                {vehicle.metrics.fuelEfficiency.toFixed(1)} / {vehicle.metrics.targetEfficiency.toFixed(1)}
              </span>
            </div>
            <Progress 
              value={Math.min(efficiencyPercent, 100)} 
              className="h-2"
            />
            {efficiencyPercent < 90 && (
              <div className="flex items-center space-x-1 text-xs text-warning">
                <AlertTriangle className="h-3 w-3" />
                <span>Abaixo da meta</span>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex space-x-2 pt-2">
          {vehicle.status === "parked" ? (
            <Button
              size="sm"
              className="flex-1 bg-gradient-primary shadow-primary"
              onClick={() => onOpenJourney(vehicle.id)}
            >
              Abrir Jornada
            </Button>
          ) : (
          <Button
            size="sm"
            variant="outline"
            className="flex-1"
            onClick={() => onViewDetails(vehicle.id, vehicle.currentJourney?.id)}
          >
            Ver Detalhes
          </Button>
        )}
        </div>
      </CardContent>
    </Card>
  );
}