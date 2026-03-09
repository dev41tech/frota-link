import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RotateCcw, Replace, Check, CircleDot } from "lucide-react";
import { useTireAlerts, TireAlert } from "@/hooks/useTireAlerts";
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";

interface TireAlertsPanelProps {
  onRegisterRotation?: (tireId: string, vehicleId: string) => void;
  onRegisterReplacement?: (tireId: string, vehicleId: string) => void;
}

export function TireAlertsPanel({ onRegisterRotation, onRegisterReplacement }: TireAlertsPanelProps) {
  const { alerts, loading, refetch } = useTireAlerts();
  const [processing, setProcessing] = useState<string | null>(null);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CircleDot className="h-5 w-5" />
            Alertas de Pneus
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (alerts.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CircleDot className="h-5 w-5" />
            Alertas de Pneus
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6">
            <div className="p-3 rounded-full bg-green-500/10 w-fit mx-auto mb-3">
              <Check className="h-6 w-6 text-green-500" />
            </div>
            <p className="text-muted-foreground">
              Todos os pneus em dia! Nenhum alerta no momento.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const getAlertIcon = (type: TireAlert["alert_type"]) => {
    switch (type) {
      case "critical_replacement":
        return <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0" />;
      case "replacement":
        return <Replace className="h-4 w-4 text-amber-500 flex-shrink-0" />;
      case "rotation":
        return <RotateCcw className="h-4 w-4 text-blue-500 flex-shrink-0" />;
    }
  };

  const getAlertBadge = (type: TireAlert["alert_type"]) => {
    switch (type) {
      case "critical_replacement":
        return <Badge variant="destructive">Troca Urgente</Badge>;
      case "replacement":
        return <Badge className="bg-amber-500 hover:bg-amber-600">Troca Próxima</Badge>;
      case "rotation":
        return <Badge variant="secondary">Rodízio</Badge>;
    }
  };

  const getAlertMessage = (alert: TireAlert) => {
    if (alert.alert_type === "critical_replacement") {
      return `${Math.abs(alert.km_until_replacement).toLocaleString()} km além do limite de troca`;
    }
    if (alert.alert_type === "replacement") {
      return `Faltam ${alert.km_until_replacement.toLocaleString()} km para troca`;
    }
    if (alert.km_until_rotation <= 0) {
      return `${Math.abs(alert.km_until_rotation).toLocaleString()} km além do limite de rodízio`;
    }
    return `Faltam ${alert.km_until_rotation.toLocaleString()} km para rodízio`;
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <CircleDot className="h-5 w-5" />
          Alertas de Pneus
          {alerts.length > 0 && (
            <Badge variant="destructive" className="ml-auto">
              {alerts.length}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3 max-h-[300px] overflow-y-auto">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
            >
              {getAlertIcon(alert.alert_type)}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="font-medium">{alert.vehicle_plate}</span>
                  <span className="text-xs text-muted-foreground">Pos. {alert.current_position}</span>
                  {getAlertBadge(alert.alert_type)}
                </div>
                <p className="text-sm text-muted-foreground">
                  {alert.tire_brand} {alert.tire_model} - {alert.tire_size}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {alert.km_driven.toLocaleString()} km rodados • {getAlertMessage(alert)}
                </p>

                {/* Quick Actions */}
                <div className="flex gap-2 mt-3">
                  {alert.alert_type === "rotation" && onRegisterRotation && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      disabled={processing === alert.id}
                      onClick={() => onRegisterRotation(alert.tire_id, alert.vehicle_id)}
                    >
                      <RotateCcw className="h-3 w-3 mr-1" />
                      Registrar Rodízio
                    </Button>
                  )}
                  {(alert.alert_type === "replacement" || alert.alert_type === "critical_replacement") &&
                    onRegisterReplacement && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        disabled={processing === alert.id}
                        onClick={() => onRegisterReplacement(alert.tire_id, alert.vehicle_id)}
                      >
                        <Replace className="h-3 w-3 mr-1" />
                        Registrar Troca
                      </Button>
                    )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
