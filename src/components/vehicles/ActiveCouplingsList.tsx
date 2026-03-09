import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Truck, Container, Unlink, ArrowRight, Link2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CouplingTypeBadge } from "./VehicleStatusBadge";
import type { Coupling } from "@/hooks/useVehicleCouplings";

interface ActiveCouplingsListProps {
  couplings: Coupling[];
  onDecouple: (couplingId: string) => Promise<boolean>;
}

export function ActiveCouplingsList({ couplings, onDecouple }: ActiveCouplingsListProps) {
  const [decouplingId, setDecouplingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleDecouple = async () => {
    if (!decouplingId) return;
    
    setLoading(true);
    await onDecouple(decouplingId);
    setLoading(false);
    setDecouplingId(null);
  };

  if (couplings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Link2 className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium">Nenhum engate ativo</h3>
        <p className="text-muted-foreground text-sm mt-1">
          Clique em "Novo Engate" para montar um conjunto
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {couplings.map((coupling) => (
          <Card key={coupling.id} className="overflow-hidden">
            <CardContent className="p-4">
              {/* Header */}
              <div className="flex items-center justify-between mb-3">
                <CouplingTypeBadge type={coupling.coupling_type} />
                <span className="text-xs text-muted-foreground">
                  {format(new Date(coupling.coupled_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                </span>
              </div>

              {/* Truck */}
              <div className="flex items-center gap-2 mb-3 pb-3 border-b">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                  <Truck className="h-5 w-5 text-blue-700" />
                </div>
                <div className="flex-1">
                  <div className="font-bold">{coupling.truck?.plate}</div>
                  <div className="text-xs text-muted-foreground">
                    {coupling.truck?.brand} {coupling.truck?.model}
                  </div>
                </div>
              </div>

              {/* Arrow */}
              <div className="flex justify-center mb-3">
                <ArrowRight className="h-4 w-4 text-muted-foreground rotate-90" />
              </div>

              {/* Trailers */}
              <div className="space-y-2">
                {coupling.items
                  ?.sort((a, b) => a.position - b.position)
                  .map((item) => (
                    <div key={item.id} className="flex items-center gap-2">
                      <Badge variant="outline" className="w-6 h-6 p-0 justify-center">
                        {item.position}
                      </Badge>
                      <Container className="h-4 w-4 text-muted-foreground" />
                      <div className="flex-1">
                        <span className="font-medium text-sm">{item.trailer?.plate}</span>
                        <span className="text-xs text-muted-foreground ml-1">
                          {item.trailer?.model}
                        </span>
                      </div>
                    </div>
                  ))}
              </div>

              {/* Notes */}
              {coupling.notes && (
                <p className="text-xs text-muted-foreground mt-3 pt-3 border-t italic">
                  {coupling.notes}
                </p>
              )}

              {/* Actions */}
              <div className="mt-4 pt-3 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-red-600 hover:text-red-700 hover:bg-red-50"
                  onClick={() => setDecouplingId(coupling.id)}
                >
                  <Unlink className="h-4 w-4 mr-2" />
                  Desengatar
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <AlertDialog open={!!decouplingId} onOpenChange={(open) => !open && setDecouplingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar desengate?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação irá separar o cavalo das carretas. Os veículos ficarão disponíveis para novos engates.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDecouple}
              disabled={loading}
              className="bg-red-600 hover:bg-red-700"
            >
              {loading ? "Desengatando..." : "Desengatar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
