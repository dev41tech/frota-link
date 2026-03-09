import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useMultiTenant } from "@/hooks/useMultiTenant";
import { Loader2, CircleDot, Link2, Unlink, RotateCcw, RefreshCw, Trash2, Wrench } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface TireHistoryEntry {
  id: string;
  action: string;
  vehicle_plate: string | null;
  position: string | null;
  km_at_action: number | null;
  km_driven: number | null;
  notes: string | null;
  created_at: string;
}

interface TireHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tireId: string | null;
  tireName?: string;
}

const ACTION_LABELS: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  install: { label: "Instalação", icon: Link2, color: "bg-green-500" },
  rotation: { label: "Rodízio", icon: RotateCcw, color: "bg-blue-500" },
  unlink: { label: "Desvinculação", icon: Unlink, color: "bg-amber-500" },
  replace: { label: "Substituição", icon: RefreshCw, color: "bg-purple-500" },
  recap_send: { label: "Enviado p/ Recape", icon: Wrench, color: "bg-orange-500" },
  recap_return: { label: "Retorno do Recape", icon: Wrench, color: "bg-teal-500" },
  discard: { label: "Descarte", icon: Trash2, color: "bg-red-500" },
};

export function TireHistoryDialog({
  open,
  onOpenChange,
  tireId,
  tireName,
}: TireHistoryDialogProps) {
  const { currentCompany } = useMultiTenant();
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<TireHistoryEntry[]>([]);
  const [totalKm, setTotalKm] = useState(0);

  useEffect(() => {
    const fetchHistory = async () => {
      if (!tireId || !currentCompany?.id) return;
      setLoading(true);

      try {
        const { data, error } = await supabase
          .from("tire_history")
          .select("*")
          .eq("tire_id", tireId)
          .eq("company_id", currentCompany.id)
          .order("created_at", { ascending: false });

        if (error) throw error;

        setHistory(data || []);

        // Calculate total KM driven
        const total = (data || []).reduce((acc, entry) => acc + (entry.km_driven || 0), 0);
        setTotalKm(total);
      } catch (error) {
        console.error("Error fetching tire history:", error);
      } finally {
        setLoading(false);
      }
    };

    if (open && tireId) {
      fetchHistory();
    }
  }, [open, tireId, currentCompany?.id]);

  const getActionDetails = (action: string) => {
    return ACTION_LABELS[action] || { label: action, icon: CircleDot, color: "bg-muted" };
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CircleDot className="h-5 w-5" />
            Histórico do Pneu
          </DialogTitle>
          {tireName && (
            <DialogDescription>{tireName}</DialogDescription>
          )}
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : history.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <CircleDot className="h-10 w-10 mx-auto mb-3 opacity-50" />
            <p>Nenhum histórico registrado</p>
            <p className="text-sm">As movimentações do pneu aparecerão aqui</p>
          </div>
        ) : (
          <>
            {/* Summary */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <span className="text-sm text-muted-foreground">Total rodado</span>
              <span className="font-semibold">{totalKm.toLocaleString()} km</span>
            </div>

            <Separator />

            {/* Timeline */}
            <ScrollArea className="h-[350px] pr-4">
              <div className="relative">
                {/* Timeline line */}
                <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />

                <div className="space-y-4">
                  {history.map((entry, index) => {
                    const { label, icon: Icon, color } = getActionDetails(entry.action);
                    return (
                      <div key={entry.id} className="relative pl-10">
                        {/* Timeline dot */}
                        <div
                          className={`absolute left-2 top-1 w-5 h-5 rounded-full flex items-center justify-center ${color}`}
                        >
                          <Icon className="h-3 w-3 text-white" />
                        </div>

                        <div className="p-3 rounded-lg border bg-card">
                          <div className="flex items-center justify-between mb-1">
                            <Badge variant="outline" className="text-xs">
                              {label}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(entry.created_at), "dd/MM/yyyy HH:mm", {
                                locale: ptBR,
                              })}
                            </span>
                          </div>

                          <div className="text-sm space-y-1 mt-2">
                            {entry.vehicle_plate && (
                              <p>
                                <span className="text-muted-foreground">Veículo:</span>{" "}
                                <span className="font-medium">{entry.vehicle_plate}</span>
                                {entry.position && (
                                  <span className="text-muted-foreground"> ({entry.position})</span>
                                )}
                              </p>
                            )}
                            {entry.km_at_action !== null && (
                              <p>
                                <span className="text-muted-foreground">KM:</span>{" "}
                                {entry.km_at_action.toLocaleString()}
                              </p>
                            )}
                            {entry.km_driven !== null && entry.km_driven > 0 && (
                              <p>
                                <span className="text-muted-foreground">Rodados no período:</span>{" "}
                                <span className="text-green-600 font-medium">
                                  +{entry.km_driven.toLocaleString()} km
                                </span>
                              </p>
                            )}
                            {entry.notes && (
                              <p className="text-muted-foreground italic text-xs mt-1">
                                {entry.notes}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </ScrollArea>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
