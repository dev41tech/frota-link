import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Container, History, Truck, Ban, Power } from "lucide-react";
import { VehicleStatusBadge } from "./VehicleStatusBadge";
import { CouplingHistoryDialog } from "./CouplingHistoryDialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import type { Vehicle, Coupling } from "@/hooks/useVehicleCouplings";

interface TrailersListProps {
  trailers: Vehicle[];
  activeCouplings: Coupling[];
  coupledTrailerIds: string[];
  onEdit: (vehicle: any) => void;
  onInactivate?: (vehicle: any) => void;
  onReactivate?: (vehicle: any) => void;
}

const trailerTypeLabels: Record<string, string> = {
  bau: "Baú",
  graneleira: "Graneleira",
  sider: "Sider",
  tanque: "Tanque",
  cegonha: "Cegonha",
  prancha: "Prancha",
  container: "Porta-Container",
  dolly: "Carreta Dolly",
  basculante: "Basculante",
  refrigerada: "Refrigerada / Frigorífica",
  silo: "Silo",
  boiadeira: "Boiadeira",
  canavieira: "Canavieira",
  florestal: "Florestal / Porta-Toras",
  gaiola: "Gaiola",
  extensiva: "Extensiva",
};

export function TrailersList({ 
  trailers, 
  activeCouplings, 
  coupledTrailerIds, 
  onEdit,
  onInactivate,
  onReactivate
}: TrailersListProps) {
  const [historyVehicleId, setHistoryVehicleId] = useState<string | null>(null);

  const getCouplingForTrailer = (trailerId: string): Coupling | undefined => {
    return activeCouplings.find(c => 
      c.items?.some(item => item.trailer_id === trailerId)
    );
  };

  if (trailers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Container className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium">Nenhuma carreta cadastrada</h3>
        <p className="text-muted-foreground text-sm mt-1">
          Cadastre um novo veículo do tipo "Carreta" para começar
        </p>
      </div>
    );
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead>Placa</TableHead>
            <TableHead>Modelo</TableHead>
            <TableHead className="hidden md:table-cell">Tipo</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Vinculada a</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {trailers.map((trailer) => {
            const isCoupled = coupledTrailerIds.includes(trailer.id);
            const coupling = getCouplingForTrailer(trailer.id);
            
            return (
              <TableRow key={trailer.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Container className="h-4 w-4 text-muted-foreground" />
                    <span className="font-bold">{trailer.plate}</span>
                  </div>
                </TableCell>
                <TableCell>{trailer.model}</TableCell>
                <TableCell className="hidden md:table-cell">
                  {trailer.trailer_type ? (
                    <Badge variant="outline">
                      {trailerTypeLabels[trailer.trailer_type] || trailer.trailer_type}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground text-sm">-</span>
                  )}
                </TableCell>
                <TableCell>
                  <VehicleStatusBadge status={trailer.status} isCoupled={isCoupled} />
                </TableCell>
                <TableCell>
                  {isCoupled && coupling?.truck ? (
                    <div className="flex items-center gap-1 text-sm">
                      <Truck className="h-3 w-3 text-muted-foreground" />
                      <span className="font-medium">{coupling.truck.plate}</span>
                    </div>
                  ) : (
                    <span className="text-muted-foreground text-sm">-</span>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setHistoryVehicleId(trailer.id)}
                      title="Histórico de engates"
                    >
                      <History className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onEdit(trailer as any)}
                      title="Editar"
                    >
                      Editar
                    </Button>
                    {trailer.status === "inactive" ? (
                      onReactivate && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onReactivate(trailer)}
                          title="Reativar veículo"
                          className="text-green-600 hover:text-green-700 hover:bg-green-50"
                        >
                          <Power className="h-3 w-3" />
                        </Button>
                      )
                    ) : (
                      onInactivate && !isCoupled && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              title="Inativar veículo"
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            >
                              <Ban className="h-3 w-3" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Inativar Carreta</AlertDialogTitle>
                              <AlertDialogDescription>
                                A carreta <strong>{trailer.plate}</strong> será inativada. 
                                Todo o histórico será mantido, mas ela não poderá ser usada em novas viagens ou engates.
                                <br /><br />
                                Você poderá reativar a carreta a qualquer momento.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => onInactivate(trailer)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Inativar
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )
                    )}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <CouplingHistoryDialog
        vehicleId={historyVehicleId}
        isOpen={!!historyVehicleId}
        onClose={() => setHistoryVehicleId(null)}
      />
    </>
  );
}
