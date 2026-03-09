import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertCircle, CheckCircle2, Clock, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

const INCIDENT_TYPES: Record<string, string> = {
  pneu_furado: "Pneu Furado",
  acidente: "Acidente",
  cartao_recusado: "Cartão Recusado",
  avaria: "Avaria",
  mecanica: "Problema Mecânico",
  outro: "Outro",
};

interface Props {
  incident: {
    id: string;
    incident_type: string;
    description: string;
    photo_url: string | null;
    status: string;
    resolution_notes: string | null;
    created_at: string;
    resolved_at: string | null;
    drivers: { name: string } | null;
    vehicles: { plate: string; model: string } | null;
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: () => void;
}

export function IncidentDetailDialog({ incident, open, onOpenChange, onUpdated }: Props) {
  const { user } = useAuth();
  const [status, setStatus] = useState(incident.status);
  const [resolutionNotes, setResolutionNotes] = useState(incident.resolution_notes || "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const updates: any = {
        status,
        resolution_notes: resolutionNotes || null,
      };

      if (status === "resolved") {
        updates.resolved_at = new Date().toISOString();
        updates.resolved_by = user?.id;
      } else {
        updates.resolved_at = null;
        updates.resolved_by = null;
      }

      const { error } = await supabase
        .from("incidents")
        .update(updates)
        .eq("id", incident.id);

      if (error) throw error;
      toast.success("Ocorrência atualizada!");
      onUpdated();
    } catch (err: any) {
      toast.error("Erro: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-destructive" />
            {INCIDENT_TYPES[incident.incident_type] || incident.incident_type}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-muted-foreground">Motorista:</span>
              <p className="font-medium">{(incident.drivers as any)?.name || "—"}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Veículo:</span>
              <p className="font-medium">
                {incident.vehicles
                  ? `${(incident.vehicles as any)?.plate} • ${(incident.vehicles as any)?.model}`
                  : "—"}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">Data:</span>
              <p className="font-medium">
                {format(new Date(incident.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
              </p>
            </div>
          </div>

          <div>
            <Label className="text-muted-foreground">Descrição</Label>
            <p className="text-sm bg-muted/30 rounded-md p-3 mt-1">{incident.description}</p>
          </div>

          {incident.photo_url && (
            <div>
              <Label className="text-muted-foreground">Foto</Label>
              <img
                src={incident.photo_url}
                alt="Foto da ocorrência"
                className="mt-1 rounded-md max-h-48 object-cover w-full"
              />
            </div>
          )}

          <div>
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="open">
                  <span className="flex items-center gap-1.5">
                    <AlertCircle className="h-3.5 w-3.5" /> Aberto
                  </span>
                </SelectItem>
                <SelectItem value="in_progress">
                  <span className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" /> Em Andamento
                  </span>
                </SelectItem>
                <SelectItem value="resolved">
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Resolvido
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Nota de resolução</Label>
            <Textarea
              value={resolutionNotes}
              onChange={(e) => setResolutionNotes(e.target.value)}
              placeholder="Descreva a resolução ou andamento..."
              rows={3}
              className="resize-none mt-1"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
