import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, AlertTriangle, Info, CheckCircle, X } from "lucide-react";
import { useMultiTenant } from "@/hooks/useMultiTenant";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Alert {
  id: string;
  alert_type: string;
  severity: 'low' | 'medium' | 'high';
  title: string;
  description: string;
  status: string;
  created_at: string;
  metadata?: any;
}

export default function FuelAlertsPanel() {
  const { currentCompany } = useMultiTenant();
  const { toast } = useToast();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (currentCompany?.id) {
      fetchAlerts();
      
      // Realtime subscription
      const channel = supabase
        .channel('fuel-alerts-changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'system_alerts',
            filter: `company_id=eq.${currentCompany.id}`
          },
          () => {
            fetchAlerts();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [currentCompany?.id]);

  const fetchAlerts = async () => {
    if (!currentCompany?.id) return;

    try {
      const { data, error } = await supabase
        .from('system_alerts')
        .select('*')
        .eq('company_id', currentCompany.id)
        .in('alert_type', ['critical_consumption', 'low_fuel', 'stale_odometer'])
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) throw error;
      setAlerts((data || []) as Alert[]);
    } catch (error: any) {
      console.error('Error fetching alerts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleResolve = async (alertId: string) => {
    try {
      const { error } = await supabase
        .from('system_alerts')
        .update({
          status: 'resolved',
          resolved_at: new Date().toISOString(),
          resolved_by: (await supabase.auth.getUser()).data.user?.id,
        })
        .eq('id', alertId);

      if (error) throw error;

      toast({
        title: "Alerta resolvido",
        description: "O alerta foi marcado como resolvido",
      });

      fetchAlerts();
    } catch (error: any) {
      toast({
        title: "Erro ao resolver alerta",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const getIcon = (severity: string) => {
    switch (severity) {
      case 'high':
        return <AlertCircle className="h-4 w-4 text-destructive" />;
      case 'medium':
        return <AlertTriangle className="h-4 w-4 text-warning" />;
      default:
        return <Info className="h-4 w-4 text-blue-600" />;
    }
  };

  const getSeverityBadge = (severity: string) => {
    const variants: { [key: string]: "destructive" | "secondary" | "outline" | "default" } = {
      high: 'destructive',
      medium: 'destructive',
      low: 'secondary'
    };

    const labels = {
      high: 'Crítico',
      medium: 'Médio',
      low: 'Baixo'
    };

    return (
      <Badge variant={variants[severity] || 'secondary'}>
        {labels[severity as keyof typeof labels] || severity}
      </Badge>
    );
  };

  const getAlertTypeLabel = (type: string) => {
    const labels: { [key: string]: string } = {
      critical_consumption: 'Consumo Crítico',
      low_fuel: 'Combustível Baixo',
      stale_odometer: 'Hodômetro Parado'
    };
    return labels[type] || type;
  };

  if (loading) {
    return (
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center">
            <AlertCircle className="h-5 w-5 mr-2" />
            Alertas de Combustível
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="h-16 bg-muted animate-pulse rounded-lg" />
            <div className="h-16 bg-muted animate-pulse rounded-lg" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (alerts.length === 0) {
    return (
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center">
            <AlertCircle className="h-5 w-5 mr-2" />
            Alertas de Combustível
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6">
            <CheckCircle className="h-12 w-12 text-success mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              Nenhum alerta ativo no momento
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center">
            <AlertCircle className="h-5 w-5 mr-2" />
            Alertas de Combustível
          </div>
          <Badge variant="secondary">{alerts.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className="p-4 rounded-lg border bg-card hover:bg-accent/5 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {getIcon(alert.severity)}
                    <h4 className="font-medium text-sm truncate">{alert.title}</h4>
                  </div>
                  <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
                    {alert.description}
                  </p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="text-xs">
                      {getAlertTypeLabel(alert.alert_type)}
                    </Badge>
                    {getSeverityBadge(alert.severity)}
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(alert.created_at), {
                        addSuffix: true,
                        locale: ptBR
                      })}
                    </span>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleResolve(alert.id)}
                  className="shrink-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
