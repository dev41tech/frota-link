import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Truck, Eye, History, Ban, Power } from "lucide-react";
import { VehicleStatusBadge, CouplingTypeBadge } from "./VehicleStatusBadge";
import { CouplingHistoryDialog } from "./CouplingHistoryDialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import type { Vehicle, Coupling } from "@/hooks/useVehicleCouplings";

interface TrucksListProps {
  trucks: Vehicle[];
  activeCouplings: Coupling[];
  coupledTruckIds: string[];
  onEdit: (vehicle: any) => void;
  onViewCoupling: (coupling: Coupling) => void;
  onInactivate?: (vehicle: any) => void;
  onReactivate?: (vehicle: any) => void;
}

export function TrucksList({ 
  trucks, 
  activeCouplings, 
  coupledTruckIds, 
  onEdit,
  onViewCoupling,
  onInactivate,
  onReactivate
}: TrucksListProps) {
  const [historyVehicleId, setHistoryVehicleId] = useState<string | null>(null);

  const getCouplingForTruck = (truckId: string): Coupling | undefined => {
    return activeCouplings.find(c => c.truck_id === truckId);
  };

  const getTrailerPlates = (coupling: Coupling | undefined): string => {
    if (!coupling?.items) return "-";
    return coupling.items
      .sort((a, b) => a.position - b.position)
      .map(item => item.trailer?.plate || "?")
      .join(", ");
  };

  if (trucks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Truck className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium">Nenhum cavalo cadastrado</h3>
        <p className="text-muted-foreground text-sm mt-1">
          Cadastre um novo veículo do tipo "Cavalo" para começar
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
            <TableHead className="hidden md:table-cell">Marca/Ano</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Engate</TableHead>
            <TableHead>Carretas</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {trucks.map((truck) => {
            const isCoupled = coupledTruckIds.includes(truck.id);
            const coupling = getCouplingForTruck(truck.id);
            
            return (
              <TableRow key={truck.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Truck className="h-4 w-4 text-muted-foreground" />
                    <span className="font-bold">{truck.plate}</span>
                  </div>
                </TableCell>
                <TableCell>{truck.model}</TableCell>
                <TableCell className="hidden md:table-cell">
                  {truck.brand}{" "}
                  {truck.year && <span className="text-muted-foreground text-xs">({truck.year})</span>}
                </TableCell>
                <TableCell>
                  <VehicleStatusBadge status={truck.status} isCoupled={isCoupled} />
                </TableCell>
                <TableCell>
                  {isCoupled && coupling ? (
                    <CouplingTypeBadge type={coupling.coupling_type} />
                  ) : (
                    <span className="text-muted-foreground text-sm">Livre</span>
                  )}
                </TableCell>
                <TableCell>
                  {isCoupled ? (
                    <span className="text-sm font-medium">{getTrailerPlates(coupling)}</span>
                  ) : (
                    <span className="text-muted-foreground text-sm">-</span>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-1">
                    {isCoupled && coupling && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onViewCoupling(coupling)}
                        title="Ver engate"
                      >
                        <Eye className="h-3 w-3" />
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setHistoryVehicleId(truck.id)}
                      title="Histórico de engates"
                    >
                      <History className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onEdit(truck as any)}
                      title="Editar"
                    >
                      Editar
                    </Button>
                    {truck.status === "inactive" ? (
                      onReactivate && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onReactivate(truck)}
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
                              <AlertDialogTitle>Inativar Veículo</AlertDialogTitle>
                              <AlertDialogDescription>
                                O veículo <strong>{truck.plate}</strong> será inativado. 
                                Todo o histórico será mantido, mas ele não poderá ser usado em novas viagens, abastecimentos ou manutenções.
                                <br /><br />
                                Você poderá reativar o veículo a qualquer momento.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => onInactivate(truck)}
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
