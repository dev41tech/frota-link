import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Clock, AlertCircle, Check, ExternalLink } from "lucide-react";
import { useMaintenanceAlerts } from "@/hooks/useMaintenanceAlerts";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useState } from "react";

interface MaintenanceAlertsProps {
  onRefresh?: () => void;
}

export function MaintenanceAlerts({ onRefresh }: MaintenanceAlertsProps) {
  const { alerts, loading, refetch } = useMaintenanceAlerts();
  const [completing, setCompleting] = useState<string | null>(null);

  const handleMarkAsCompleted = async (maintenanceId: string) => {
    setCompleting(maintenanceId);
    try {
      // Buscar a manutenção atual para obter os dados
      const { data: currentMaintenance, error: fetchError } = await supabase
        .from("vehicle_maintenances")
        .select("*")
        .eq("id", maintenanceId)
        .single();

      if (fetchError || !currentMaintenance) {
        throw new Error("Manutenção não encontrada");
      }

      // Buscar os intervalos configurados em maintenance_schedules
      const { data: scheduleConfig } = await supabase
        .from("maintenance_schedules")
        .select("interval_months, interval_km")
        .eq("company_id", currentMaintenance.company_id)
        .eq("service_category", currentMaintenance.service_category)
        .eq("is_active", true)
        .or(`vehicle_id.is.null,vehicle_id.eq.${currentMaintenance.vehicle_id}`)
        .order("vehicle_id", { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle();

      // Limpar next_due_date e next_due_km da manutenção atual
      // para que ela não gere mais alertas
      const { error: updateError } = await supabase
        .from("vehicle_maintenances")
        .update({ 
          next_due_date: null, 
          next_due_km: null 
        })
        .eq("id", maintenanceId);

      if (updateError) throw updateError;

      // Calcular próximas datas se houver intervalos configurados
      const today = new Date().toISOString().split('T')[0];
      let newNextDueDate: string | null = null;
      let newNextDueKm: number | null = null;
      
      const intervalMonths = scheduleConfig?.interval_months;
      const intervalKm = scheduleConfig?.interval_km;
      
      if (intervalMonths) {
        const nextDate = new Date();
        nextDate.setMonth(nextDate.getMonth() + intervalMonths);
        newNextDueDate = nextDate.toISOString().split('T')[0];
      }
      
      if (intervalKm) {
        // Buscar odômetro atual do veículo
        const { data: latestFuel } = await supabase
          .from("fuel_expenses")
          .select("odometer")
          .eq("vehicle_id", currentMaintenance.vehicle_id)
          .not("odometer", "is", null)
          .order("date", { ascending: false })
          .limit(1)
          .maybeSingle();
        
        if (latestFuel?.odometer) {
          newNextDueKm = latestFuel.odometer + intervalKm;
        }
      }

      // Se há intervalos configurados, criar nova manutenção com próximos vencimentos
      if (newNextDueDate || newNextDueKm) {
        const { error: insertError } = await supabase
          .from("vehicle_maintenances")
          .insert([{
            company_id: currentMaintenance.company_id,
            user_id: currentMaintenance.user_id,
            vehicle_id: currentMaintenance.vehicle_id,
            description: currentMaintenance.description,
            service_category: currentMaintenance.service_category,
            maintenance_type: "preventive",
            status: "completed",
            service_date: today,
            total_cost: 0,
            next_due_date: newNextDueDate,
            next_due_km: newNextDueKm,
          }]);

        if (insertError) throw insertError;
        toast.success("Manutenção concluída! Próximo alerta agendado.");
      } else {
        toast.success("Manutenção marcada como concluída");
      }

      refetch();
      onRefresh?.();
    } catch (error) {
      console.error("Error completing maintenance:", error);
      toast.error("Erro ao atualizar manutenção");
    } finally {
      setCompleting(null);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Alertas de Manutenção
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
            <AlertTriangle className="h-5 w-5" />
            Alertas de Manutenção
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6">
            <div className="p-3 rounded-full bg-green-500/10 w-fit mx-auto mb-3">
              <Check className="h-6 w-6 text-green-500" />
            </div>
            <p className="text-muted-foreground">
              Tudo em dia! Nenhum alerta no momento.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const getAlertIcon = (type: string) => {
    switch (type) {
      case "overdue":
        return <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />;
      case "critical":
        return <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0" />;
      default:
        return <Clock className="h-4 w-4 text-blue-500 flex-shrink-0" />;
    }
  };

  const getAlertBadge = (type: string) => {
    switch (type) {
      case "overdue":
        return <Badge variant="destructive">Atrasada</Badge>;
      case "critical":
        return <Badge className="bg-amber-500 hover:bg-amber-600">Urgente</Badge>;
      default:
        return <Badge variant="secondary">Próxima</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" />
          Alertas de Manutenção
          {alerts.length > 0 && (
            <Badge variant="destructive" className="ml-auto">
              {alerts.length}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3 max-h-[400px] overflow-y-auto">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
            >
              {getAlertIcon(alert.alert_type)}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="font-medium">
                    {alert.vehicle_plate}
                  </span>
                  {getAlertBadge(alert.alert_type)}
                </div>
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {alert.description}
                </p>
                <div className="flex gap-4 mt-1 text-xs text-muted-foreground">
                  {alert.days_until_due !== null && (
                    <span>
                      {alert.days_until_due < 0
                        ? `${Math.abs(alert.days_until_due)} dias atrasado`
                        : alert.days_until_due === 0
                        ? "Vence hoje"
                        : `Em ${alert.days_until_due} dias`}
                    </span>
                  )}
                  {alert.km_until_due !== null && (
                    <span>
                      {alert.km_until_due < 0
                        ? `${Math.abs(alert.km_until_due).toLocaleString()} km atrasado`
                        : `Faltam ${alert.km_until_due.toLocaleString()} km`}
                    </span>
                  )}
                </div>
                
                {/* Quick Actions */}
                <div className="flex gap-2 mt-3">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    disabled={completing === alert.id}
                    onClick={() => handleMarkAsCompleted(alert.id)}
                  >
                    {completing === alert.id ? (
                      <span className="animate-pulse">Salvando...</span>
                    ) : (
                      <>
                        <Check className="h-3 w-3 mr-1" />
                        Concluir
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
