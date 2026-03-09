import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useDriverAuth } from "@/hooks/useDriverAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle2, Clock, Plus, Loader2, Image as ImageIcon } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CreateIncidentDialog } from "./CreateIncidentDialog";

const INCIDENT_TYPES: Record<string, string> = {
  pneu_furado: "Pneu Furado",
  acidente: "Acidente",
  cartao_recusado: "Cartão Recusado",
  avaria: "Avaria",
  mecanica: "Problema Mecânico",
  outro: "Outro",
};

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  open: { label: "Aberto", color: "text-orange-600", icon: AlertCircle },
  in_progress: { label: "Em Andamento", color: "text-blue-600", icon: Clock },
  resolved: { label: "Resolvido", color: "text-green-600", icon: CheckCircle2 },
};

interface Incident {
  id: string;
  incident_type: string;
  description: string;
  photo_url: string | null;
  status: string;
  resolution_notes: string | null;
  created_at: string;
  vehicles: { plate: string; model: string } | null;
}

export function DriverIncidents() {
  const { driver } = useDriverAuth();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const fetchIncidents = async () => {
    if (!driver) return;
    try {
      const { data, error } = await supabase
        .from("incidents")
        .select("*, vehicles:vehicle_id(plate, model)")
        .eq("driver_id", driver.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setIncidents((data as any) || []);
    } catch (err) {
      console.error("Erro ao buscar ocorrências:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIncidents();
  }, [driver?.id]);

  const handleCreated = () => {
    setShowCreate(false);
    fetchIncidents();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setShowCreate(true)} size="sm">
          <Plus className="h-4 w-4 mr-1" />
          Nova Ocorrência
        </Button>
      </div>

      {incidents.length === 0 ? (
        <div className="text-center py-12 px-4">
          <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
          <h3 className="font-semibold">Nenhuma ocorrência</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Registre eventos operacionais como pneu furado, avarias, etc.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {incidents.map((inc) => {
            const cfg = STATUS_CONFIG[inc.status] || STATUS_CONFIG.open;
            const Icon = cfg.icon;

            return (
              <Card key={inc.id}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-1.5">
                    <Icon className={`h-4 w-4 ${cfg.color}`} />
                    <span className={`text-xs font-semibold ${cfg.color}`}>{cfg.label}</span>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                      {INCIDENT_TYPES[inc.incident_type] || inc.incident_type}
                    </Badge>
                    {inc.photo_url && <ImageIcon className="h-3.5 w-3.5 text-muted-foreground" />}
                  </div>
                  <p className="text-sm line-clamp-2 mb-1.5">{inc.description}</p>

                  {inc.resolution_notes && inc.status !== "open" && (
                    <div className="bg-muted/30 rounded p-2 mb-1.5">
                      <p className="text-xs text-muted-foreground">
                        <span className="font-semibold">Resposta:</span> {inc.resolution_notes}
                      </p>
                    </div>
                  )}

                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    {inc.vehicles && (
                      <span>{(inc.vehicles as any)?.plate}</span>
                    )}
                    <span>
                      {format(new Date(inc.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <CreateIncidentDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        onCreated={handleCreated}
      />
    </div>
  );
}
