import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Calendar, Truck, Container } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useVehicleCouplings, CouplingHistory } from "@/hooks/useVehicleCouplings";
import { CouplingTypeBadge } from "./VehicleStatusBadge";

interface CouplingHistoryDialogProps {
  vehicleId: string | null;
  isOpen: boolean;
  onClose: () => void;
}

export function CouplingHistoryDialog({ vehicleId, isOpen, onClose }: CouplingHistoryDialogProps) {
  const { getCouplingHistory, trucks, trailers } = useVehicleCouplings();
  const [history, setHistory] = useState<CouplingHistory[]>([]);
  const [loading, setLoading] = useState(false);

  const vehicle = vehicleId 
    ? [...trucks, ...trailers].find(v => v.id === vehicleId)
    : null;

  useEffect(() => {
    if (vehicleId && isOpen) {
      setLoading(true);
      getCouplingHistory(vehicleId)
        .then(setHistory)
        .finally(() => setLoading(false));
    }
  }, [vehicleId, isOpen]);

  const formatDate = (dateStr: string) => {
    return format(new Date(dateStr), "dd/MM/yyyy", { locale: ptBR });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {vehicle?.vehicle_type === 'trailer' ? (
              <Container className="h-5 w-5" />
            ) : (
              <Truck className="h-5 w-5" />
            )}
            Histórico de Engates - {vehicle?.plate}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[400px]">
          {loading ? (
            <div className="py-8 text-center text-muted-foreground">
              Carregando...
            </div>
          ) : history.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              Nenhum histórico de engate encontrado.
            </div>
          ) : (
            <div className="space-y-3">
              {history.map((item) => (
                <div
                  key={item.id}
                  className="p-3 border rounded-lg bg-muted/30"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">
                        {formatDate(item.coupled_at)}
                        {item.decoupled_at && (
                          <span className="text-muted-foreground">
                            {" → "}
                            {formatDate(item.decoupled_at)}
                          </span>
                        )}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CouplingTypeBadge type={item.coupling_type} />
                      {!item.decoupled_at && (
                        <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                          Ativo
                        </Badge>
                      )}
                    </div>
                  </div>

                  {vehicle?.vehicle_type === 'trailer' && item.truck && (
                    <div className="flex items-center gap-2 text-sm">
                      <Truck className="h-3 w-3 text-muted-foreground" />
                      <span className="font-medium">{item.truck.plate}</span>
                      <span className="text-muted-foreground">- {item.truck.model}</span>
                    </div>
                  )}

                  {vehicle?.vehicle_type !== 'trailer' && item.trailers.length > 0 && (
                    <div className="space-y-1">
                      {item.trailers.map((trailer, idx) => (
                        <div key={trailer.id} className="flex items-center gap-2 text-sm">
                          <Container className="h-3 w-3 text-muted-foreground" />
                          <span className="text-muted-foreground text-xs">{idx + 1}º</span>
                          <span className="font-medium">{trailer.plate}</span>
                          <span className="text-muted-foreground">- {trailer.model}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
