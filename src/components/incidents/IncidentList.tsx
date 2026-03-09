import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useMultiTenant } from "@/hooks/useMultiTenant";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertCircle, CheckCircle2, Clock, Loader2, Image as ImageIcon } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { IncidentDetailDialog } from "./IncidentDetailDialog";

const INCIDENT_TYPES: Record<string, string> = {
  pneu_furado: "Pneu Furado",
  acidente: "Acidente",
  cartao_recusado: "Cartão Recusado",
  avaria: "Avaria",
  mecanica: "Problema Mecânico",
  outro: "Outro",
};

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "outline"; icon: any }> = {
  open: { label: "Aberto", variant: "default", icon: AlertCircle },
  in_progress: { label: "Em Andamento", variant: "secondary", icon: Clock },
  resolved: { label: "Resolvido", variant: "outline", icon: CheckCircle2 },
};

interface Incident {
  id: string;
  incident_type: string;
  description: string;
  photo_url: string | null;
  status: string;
  resolution_notes: string | null;
  created_at: string;
  resolved_at: string | null;
  driver_id: string;
  vehicle_id: string | null;
  drivers: { name: string } | null;
  vehicles: { plate: string; model: string } | null;
}

export function IncidentList() {
  const { currentCompany } = useMultiTenant();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);

  const fetchIncidents = async () => {
    if (!currentCompany?.id) return;
    try {
      let query = supabase
        .from("incidents")
        .select("*, drivers:driver_id(name), vehicles:vehicle_id(plate, model)")
        .eq("company_id", currentCompany.id)
        .order("created_at", { ascending: false });

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      setIncidents((data as any) || []);
    } catch (err) {
      console.error("Erro ao buscar ocorrências:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchIncidents();
  }, [currentCompany?.id, statusFilter]);

  const handleUpdated = () => {
    setSelectedIncident(null);
    fetchIncidents();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {incidents.length} ocorrência(s)
        </p>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="open">Abertos</SelectItem>
            <SelectItem value="in_progress">Em Andamento</SelectItem>
            <SelectItem value="resolved">Resolvidos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {incidents.length === 0 ? (
        <div className="text-center py-12">
          <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
          <h3 className="font-semibold text-foreground">Nenhuma ocorrência</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Ocorrências registradas pelos motoristas aparecerão aqui.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {incidents.map((inc) => {
            const statusCfg = STATUS_CONFIG[inc.status] || STATUS_CONFIG.open;
            const StatusIcon = statusCfg.icon;

            return (
              <Card
                key={inc.id}
                className="hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => setSelectedIncident(inc)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant={statusCfg.variant} className="text-[10px] px-1.5 py-0">
                          <StatusIcon className="h-3 w-3 mr-0.5" />
                          {statusCfg.label}
                        </Badge>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                          {INCIDENT_TYPES[inc.incident_type] || inc.incident_type}
                        </Badge>
                        {inc.photo_url && (
                          <ImageIcon className="h-3.5 w-3.5 text-muted-foreground" />
                        )}
                      </div>
                      <p className="text-sm line-clamp-2 mb-1.5">{inc.description}</p>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>{(inc.drivers as any)?.name || "—"}</span>
                        {inc.vehicles && (
                          <span>{(inc.vehicles as any)?.plate} • {(inc.vehicles as any)?.model}</span>
                        )}
                        <span>
                          {format(new Date(inc.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {selectedIncident && (
        <IncidentDetailDialog
          incident={selectedIncident}
          open={!!selectedIncident}
          onOpenChange={(open) => !open && setSelectedIncident(null)}
          onUpdated={handleUpdated}
        />
      )}
    </div>
  );
}
