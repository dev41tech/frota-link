import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useMultiTenant } from "@/hooks/useMultiTenant";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Loader2, Truck, Container } from "lucide-react";
import { TirePositionSelector } from "./TirePositionSelector";
import { inferAxleConfig, inferTrailerAxles } from "@/lib/vehicleUtils";

interface TireVehicleAssignmentProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tire: any;
  onSuccess: () => void;
}

interface OccupiedPosition {
  position: string;
  tireBrand?: string;
  tireModel?: string;
}

interface VehicleData {
  id: string;
  plate: string;
  model: string;
  vehicle_type?: string;
  axle_count?: number;
  trailer_type?: string;
}

interface TrailerInfo {
  id: string;
  plate: string;
  model?: string;
  axleCount: number;
}

export function TireVehicleAssignment({
  open,
  onOpenChange,
  tire,
  onSuccess,
}: TireVehicleAssignmentProps) {
  const { user } = useAuth();
  const { currentCompany } = useMultiTenant();
  const [loading, setLoading] = useState(false);
  const [vehicles, setVehicles] = useState<VehicleData[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState("");
  const [selectedPosition, setSelectedPosition] = useState("");
  const [targetVehicleId, setTargetVehicleId] = useState<string | undefined>(undefined);
  const [installationKm, setInstallationKm] = useState("");
  const [alertRotationKm, setAlertRotationKm] = useState("20000");
  const [occupiedPositions, setOccupiedPositions] = useState<OccupiedPosition[]>([]);
  const [alertReplacementKm, setAlertReplacementKm] = useState("80000");
  
  // Vehicle-specific info
  const [vehicleType, setVehicleType] = useState<'truck' | 'trailer' | 'rigid'>('truck');
  const [axleCount, setAxleCount] = useState<number>(2);
  const [trailers, setTrailers] = useState<TrailerInfo[]>([]);
  const [trailerOccupiedPositions, setTrailerOccupiedPositions] = useState<Record<string, OccupiedPosition[]>>({});

  useEffect(() => {
    const fetchVehicles = async () => {
      if (!currentCompany?.id) return;
      const { data } = await supabase
        .from("vehicles")
        .select("id, plate, model, vehicle_type, axle_count, trailer_type")
        .eq("company_id", currentCompany.id)
        .eq("status", "active")
        .order("plate");
      if (data) setVehicles(data);
    };
    fetchVehicles();
  }, [currentCompany]);

  // Fetch current vehicle data, couplings, and occupied positions when vehicle is selected
  useEffect(() => {
    const fetchVehicleData = async () => {
      if (!selectedVehicle || !currentCompany?.id) return;

      const selectedVehicleData = vehicles.find(v => v.id === selectedVehicle);
      if (!selectedVehicleData) return;

      // Set vehicle type and infer axle count
      const vType = (selectedVehicleData.vehicle_type || 'truck') as 'truck' | 'trailer' | 'rigid';
      setVehicleType(vType);

      if (selectedVehicleData.axle_count) {
        setAxleCount(selectedVehicleData.axle_count);
      } else {
        // Infer from model
        if (vType === 'trailer') {
          const inferred = inferTrailerAxles(selectedVehicleData.trailer_type, selectedVehicleData.model);
          setAxleCount(inferred);
        } else {
          const config = inferAxleConfig(selectedVehicleData.model);
          setAxleCount(config.totalAxles);
        }
      }

      // Fetch odometer
      const { data: fuelData } = await supabase
        .from("fuel_expenses")
        .select("odometer")
        .eq("vehicle_id", selectedVehicle)
        .eq("company_id", currentCompany.id)
        .order("date", { ascending: false })
        .limit(1)
        .single();

      if (fuelData?.odometer) {
        setInstallationKm(fuelData.odometer.toString());
      }

      // Fetch occupied positions for this vehicle
      const { data: tiresData } = await supabase
        .from("tire_assets")
        .select("current_position, brand, model")
        .eq("current_vehicle_id", selectedVehicle)
        .eq("company_id", currentCompany.id)
        .eq("status", "installed");

      if (tiresData) {
        setOccupiedPositions(
          tiresData
            .filter(t => t.current_position)
            .map(t => ({
              position: t.current_position!,
              tireBrand: t.brand || undefined,
              tireModel: t.model || undefined,
            }))
        );
      } else {
        setOccupiedPositions([]);
      }

      // If this is a truck, check for coupled trailers
      if (vType === 'truck') {
        const { data: couplingData } = await supabase
          .from("vehicle_couplings")
          .select(`
            id,
            coupling_type,
            vehicle_coupling_items(
              trailer_id,
              position
            )
          `)
          .eq("truck_id", selectedVehicle)
          .is("decoupled_at", null)
          .single();

        if (couplingData && couplingData.vehicle_coupling_items) {
          const trailerIds = couplingData.vehicle_coupling_items.map((item: any) => item.trailer_id);
          
          if (trailerIds.length > 0) {
            // Fetch trailer details
            const { data: trailerData } = await supabase
              .from("vehicles")
              .select("id, plate, model, axle_count, trailer_type")
              .in("id", trailerIds);

            if (trailerData) {
              const trailerInfos: TrailerInfo[] = trailerData.map((t: any) => ({
                id: t.id,
                plate: t.plate,
                model: t.model,
                axleCount: t.axle_count || inferTrailerAxles(t.trailer_type, t.model),
              }));
              setTrailers(trailerInfos);

              // Fetch occupied positions for each trailer
              const trailerOccupied: Record<string, OccupiedPosition[]> = {};
              for (const trailer of trailerInfos) {
                const { data: trailerTires } = await supabase
                  .from("tire_assets")
                  .select("current_position, brand, model")
                  .eq("current_vehicle_id", trailer.id)
                  .eq("company_id", currentCompany.id)
                  .eq("status", "installed");

                if (trailerTires) {
                  trailerOccupied[trailer.id] = trailerTires
                    .filter(t => t.current_position)
                    .map(t => ({
                      position: t.current_position!,
                      tireBrand: t.brand || undefined,
                      tireModel: t.model || undefined,
                    }));
                } else {
                  trailerOccupied[trailer.id] = [];
                }
              }
              setTrailerOccupiedPositions(trailerOccupied);
            }
          } else {
            setTrailers([]);
            setTrailerOccupiedPositions({});
          }
        } else {
          setTrailers([]);
          setTrailerOccupiedPositions({});
        }
      } else {
        setTrailers([]);
        setTrailerOccupiedPositions({});
      }
    };
    fetchVehicleData();
  }, [selectedVehicle, currentCompany, vehicles]);

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setSelectedVehicle("");
      setSelectedPosition("");
      setTargetVehicleId(undefined);
      setInstallationKm("");
      setOccupiedPositions([]);
      setTrailers([]);
      setTrailerOccupiedPositions({});
      setAlertRotationKm(tire?.alert_rotation_km?.toString() || "20000");
      setAlertReplacementKm(tire?.alert_replacement_km?.toString() || "80000");
    }
  }, [open, tire]);

  const handlePositionChange = (position: string, vehicleId?: string) => {
    setSelectedPosition(position);
    setTargetVehicleId(vehicleId);
  };

  const handleSubmit = async () => {
    if (!user || !currentCompany || !tire) return;
    if (!selectedVehicle || !selectedPosition) {
      toast.error("Selecione o veículo e a posição");
      return;
    }

    setLoading(true);
    try {
      const kmValue = parseInt(installationKm) || 0;
      
      // Determine actual vehicle to assign tire to
      const actualVehicleId = targetVehicleId || selectedVehicle;
      
      // Get vehicle plate for history
      let vehiclePlate = "";
      if (targetVehicleId) {
        const trailer = trailers.find(t => t.id === targetVehicleId);
        vehiclePlate = trailer?.plate || "";
      } else {
        const selectedVehicleData = vehicles.find(v => v.id === selectedVehicle);
        vehiclePlate = selectedVehicleData?.plate || "";
      }

      // Update tire with new vehicle assignment
      const { error } = await supabase
        .from("tire_assets")
        .update({
          current_vehicle_id: actualVehicleId,
          current_position: selectedPosition,
          installation_km: kmValue,
          alert_rotation_km: parseInt(alertRotationKm) || 20000,
          alert_replacement_km: parseInt(alertReplacementKm) || 80000,
          status: "installed",
          user_id: user.id,
        })
        .eq("id", tire.id);

      if (error) throw error;

      // Log installation in tire_history
      await supabase.from("tire_history").insert({
        company_id: currentCompany.id,
        tire_id: tire.id,
        vehicle_id: actualVehicleId,
        vehicle_plate: vehiclePlate,
        action: "install",
        position: selectedPosition,
        km_at_action: kmValue,
        km_driven: 0,
        notes: null,
        user_id: user.id,
      });

      toast.success("Pneu vinculado ao veículo com sucesso!");
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error assigning tire:", error);
      toast.error("Erro ao vincular pneu: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const selectedVehicleData = vehicles.find(v => v.id === selectedVehicle);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Vincular Pneu ao Veículo</DialogTitle>
          <DialogDescription>
            {tire && (
              <span>
                {tire.brand} {tire.model} - {tire.size} (SN: {tire.serial_number})
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="vehicle">Veículo</Label>
            <Select value={selectedVehicle} onValueChange={setSelectedVehicle}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o veículo" />
              </SelectTrigger>
              <SelectContent>
                {vehicles.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    <div className="flex items-center gap-2">
                      {v.vehicle_type === 'trailer' ? (
                        <Container className="h-4 w-4 text-orange-500" />
                      ) : (
                        <Truck className="h-4 w-4" />
                      )}
                      <span>{v.plate} - {v.model}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedVehicle && selectedVehicleData && (
            <>
              {/* Vehicle info badge */}
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="px-2 py-0.5 bg-muted rounded text-xs font-medium">
                  {vehicleType === 'trailer' ? 'Carreta' : 'Cavalo'} • {axleCount} eixos
                </span>
                {trailers.length > 0 && (
                  <span className="px-2 py-0.5 bg-primary/10 text-primary rounded text-xs font-medium">
                    + {trailers.length} carreta{trailers.length > 1 ? 's' : ''} engatada{trailers.length > 1 ? 's' : ''}
                  </span>
                )}
              </div>

              <div className="grid gap-2">
                <Label>Posição do Pneu</Label>
                <TirePositionSelector
                  value={selectedPosition}
                  onChange={handlePositionChange}
                  occupiedPositions={occupiedPositions}
                  vehicleType={vehicleType}
                  axleCount={axleCount}
                  trailers={trailers}
                  trailerOccupiedPositions={trailerOccupiedPositions}
                  selectedVehicleId={targetVehicleId}
                />
              </div>
            </>
          )}

          <div className="grid gap-2">
            <Label htmlFor="installation_km">KM de Instalação</Label>
            <Input
              id="installation_km"
              type="number"
              value={installationKm}
              onChange={(e) => setInstallationKm(e.target.value)}
              placeholder="KM atual do veículo"
            />
            <p className="text-xs text-muted-foreground">
              Preenchido automaticamente com o último odômetro registrado
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="alert_rotation">Alerta Rodízio (KM)</Label>
              <Input
                id="alert_rotation"
                type="number"
                value={alertRotationKm}
                onChange={(e) => setAlertRotationKm(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="alert_replacement">Alerta Troca (KM)</Label>
              <Input
                id="alert_replacement"
                type="number"
                value={alertReplacementKm}
                onChange={(e) => setAlertReplacementKm(e.target.value)}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Vincular Pneu
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
