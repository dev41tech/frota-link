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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { supabase } from "@/integrations/supabase/client";
import { useMultiTenant } from "@/hooks/useMultiTenant";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Loader2, AlertTriangle, Package, CircleDot } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface TireReplacementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  oldTireId: string | null;
  vehicleId: string | null;
  position: string | null;
  vehiclePlate?: string;
  onSuccess: () => void;
}

interface StockTire {
  id: string;
  brand: string | null;
  model: string | null;
  size: string | null;
  serial_number: string;
  status: string | null;
}

export function TireReplacementDialog({
  open,
  onOpenChange,
  oldTireId,
  vehicleId,
  position,
  vehiclePlate,
  onSuccess,
}: TireReplacementDialogProps) {
  const { user } = useAuth();
  const { currentCompany } = useMultiTenant();
  const [loading, setLoading] = useState(false);
  const [stockTires, setStockTires] = useState<StockTire[]>([]);
  const [selectedTireId, setSelectedTireId] = useState<string>("");
  const [oldTireDestination, setOldTireDestination] = useState<"stock" | "recapping" | "discard">("stock");
  const [currentKm, setCurrentKm] = useState<number>(0);

  useEffect(() => {
    const fetchData = async () => {
      if (!currentCompany?.id || !vehicleId) return;

      // Fetch stock tires
      const { data: tires } = await supabase
        .from("tire_assets")
        .select("id, brand, model, size, serial_number, status")
        .eq("company_id", currentCompany.id)
        .is("current_vehicle_id", null)
        .eq("status", "in_stock");

      if (tires) setStockTires(tires);

      // Fetch current vehicle KM
      const { data: fuelData } = await supabase
        .from("fuel_expenses")
        .select("odometer")
        .eq("vehicle_id", vehicleId)
        .order("date", { ascending: false })
        .limit(1)
        .single();

      if (fuelData?.odometer) {
        setCurrentKm(fuelData.odometer);
      }
    };

    if (open) {
      fetchData();
      setSelectedTireId("");
      setOldTireDestination("stock");
    }
  }, [open, currentCompany?.id, vehicleId]);

  const handleSubmit = async () => {
    if (!user || !currentCompany || !oldTireId || !vehicleId || !position) return;
    if (!selectedTireId) {
      toast.error("Selecione um pneu do estoque");
      return;
    }

    setLoading(true);
    try {
      // 1. Get old tire data for history
      const { data: oldTireData } = await supabase
        .from("tire_assets")
        .select("installation_km, total_km")
        .eq("id", oldTireId)
        .single();

      const installationKm = oldTireData?.installation_km || 0;
      const previousTotalKm = oldTireData?.total_km || 0;
      const kmDriven = currentKm - installationKm;
      const newTotalKm = previousTotalKm + (kmDriven > 0 ? kmDriven : 0);

      // 2. Remove old tire from vehicle
      const newStatus = oldTireDestination === "discard" ? "discarded" : oldTireDestination === "recapping" ? "recapping" : "in_stock";
      await supabase
        .from("tire_assets")
        .update({
          current_vehicle_id: null,
          current_position: null,
          installation_km: null,
          status: newStatus,
          total_km: newTotalKm,
        })
        .eq("id", oldTireId);

      // 3. Log old tire removal in history
      await supabase.from("tire_history").insert({
        company_id: currentCompany.id,
        tire_id: oldTireId,
        vehicle_id: vehicleId,
        vehicle_plate: vehiclePlate || null,
        action: oldTireDestination === "discard" ? "discard" : oldTireDestination === "recapping" ? "recapping" : "replace",
        position: position,
        km_at_action: currentKm,
        km_driven: kmDriven > 0 ? kmDriven : 0,
        notes: `Substituído por outro pneu`,
        user_id: user.id,
      });

      // 4. Install new tire on vehicle
      await supabase
        .from("tire_assets")
        .update({
          current_vehicle_id: vehicleId,
          current_position: position,
          installation_km: currentKm,
          status: "installed",
        })
        .eq("id", selectedTireId);

      // 5. Log new tire installation in history
      await supabase.from("tire_history").insert({
        company_id: currentCompany.id,
        tire_id: selectedTireId,
        vehicle_id: vehicleId,
        vehicle_plate: vehiclePlate || null,
        action: "install",
        position: position,
        km_at_action: currentKm,
        km_driven: 0,
        notes: "Instalado em substituição a outro pneu",
        user_id: user.id,
      });

      toast.success("Troca de pneu realizada com sucesso!");
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error replacing tire:", error);
      toast.error("Erro ao realizar troca: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CircleDot className="h-5 w-5" />
            Substituição de Pneu
          </DialogTitle>
          <DialogDescription>
            Veículo: {vehiclePlate} • Posição: {position}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Old tire destination */}
          <div className="grid gap-2">
            <Label>O que fazer com o pneu antigo?</Label>
            <RadioGroup
              value={oldTireDestination}
              onValueChange={(val) => setOldTireDestination(val as "stock" | "recapping" | "discard")}
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="stock" id="stock" />
                <Label htmlFor="stock" className="font-normal cursor-pointer">
                  Retornar ao estoque (reutilização)
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="recapping" id="recapping" />
                <Label htmlFor="recapping" className="font-normal cursor-pointer">
                  Enviar para recape
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="discard" id="discard" />
                <Label htmlFor="discard" className="font-normal cursor-pointer">
                  Descartar (sucata)
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Stock tire selection */}
          <div className="grid gap-2">
            <Label>Selecione o novo pneu do estoque</Label>
            {stockTires.length === 0 ? (
              <Alert>
                <Package className="h-4 w-4" />
                <AlertDescription>
                  Nenhum pneu disponível em estoque. Adicione pneus no Almoxarifado primeiro.
                </AlertDescription>
              </Alert>
            ) : (
              <Select value={selectedTireId} onValueChange={setSelectedTireId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o pneu" />
                </SelectTrigger>
                <SelectContent>
                  {stockTires.map((tire) => (
                    <SelectItem key={tire.id} value={tire.id}>
                      {tire.brand} {tire.model} - {tire.size} (SN: {tire.serial_number})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Warning */}
          <Alert variant="default" className="bg-amber-500/10 border-amber-500/30">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <AlertDescription className="text-sm">
              O novo pneu será instalado automaticamente na posição {position} com o
              KM atual do veículo ({currentKm.toLocaleString()} km).
            </AlertDescription>
          </Alert>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={loading || stockTires.length === 0}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirmar Troca
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
