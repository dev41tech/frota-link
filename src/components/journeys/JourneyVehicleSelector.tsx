import { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  Truck,
  Container,
  Link2,
  CheckCircle2,
  Plus,
  Save,
  ChevronRight,
  ChevronLeft,
} from "lucide-react";
import type {
  Vehicle,
  Coupling,
  CreateCouplingInput,
} from "@/hooks/useVehicleCouplings";

type VehicleMode = "single" | "coupling" | "new";
type CouplingType = "simple" | "bitrem" | "rodotrem";

interface SavedCoupling {
  id: string;
  name: string;
  truck_id: string;
  coupling_type: CouplingType;
  trailer_ids: string[];
}

interface JourneyVehicleSelectorProps {
  vehicles: Vehicle[];
  activeCouplings: Coupling[];
  savedCouplings: SavedCoupling[];
  availableTrucks: Vehicle[];
  availableTrailers: Vehicle[];
  selectedVehicleId: string | null;
  selectedCouplingId: string | null;
  onVehicleSelect: (vehicleId: string | null) => void;
  onCouplingSelect: (couplingId: string | null) => void;
  onNewCouplingCreate: (input: CreateCouplingInput, save: boolean, name?: string) => Promise<boolean>;
}

const couplingTypeConfig: Record<CouplingType, { label: string; description: string; minTrailers: number; maxTrailers: number }> = {
  simple: { label: "Simples", description: "1 carreta", minTrailers: 1, maxTrailers: 1 },
  bitrem: { label: "Bitrem", description: "2 carretas", minTrailers: 2, maxTrailers: 2 },
  rodotrem: { label: "Rodotrem", description: "3+ carretas", minTrailers: 3, maxTrailers: 5 },
};

export function JourneyVehicleSelector({
  vehicles,
  activeCouplings,
  savedCouplings,
  availableTrucks,
  availableTrailers,
  selectedVehicleId,
  selectedCouplingId,
  onVehicleSelect,
  onCouplingSelect,
  onNewCouplingCreate,
}: JourneyVehicleSelectorProps) {
  const [mode, setMode] = useState<VehicleMode>("single");
  
  // New coupling wizard state
  const [wizardStep, setWizardStep] = useState(1);
  const [newTruckId, setNewTruckId] = useState<string | null>(null);
  const [newCouplingType, setNewCouplingType] = useState<CouplingType>("simple");
  const [newTrailerIds, setNewTrailerIds] = useState<string[]>([]);
  const [saveForFuture, setSaveForFuture] = useState(false);
  const [couplingName, setCouplingName] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  // Get single vehicles (rigid trucks or trucks without coupling)
  const singleVehicles = vehicles.filter(
    (v) => v.vehicle_type === "rigid" || 
    (v.vehicle_type === "truck" && !activeCouplings.some(c => c.truck_id === v.id))
  );

  // Reset wizard when mode changes
  useEffect(() => {
    if (mode !== "new") {
      setWizardStep(1);
      setNewTruckId(null);
      setNewCouplingType("simple");
      setNewTrailerIds([]);
      setSaveForFuture(false);
      setCouplingName("");
    }
  }, [mode]);

  const handleModeChange = (newMode: VehicleMode) => {
    setMode(newMode);
    onVehicleSelect(null);
    onCouplingSelect(null);
  };

  const handleSingleVehicleSelect = (vehicleId: string) => {
    onVehicleSelect(vehicleId);
    onCouplingSelect(null);
  };

  const handleCouplingSelect = (couplingId: string) => {
    const coupling = activeCouplings.find(c => c.id === couplingId);
    onCouplingSelect(couplingId);
    onVehicleSelect(coupling?.truck_id || null);
  };

  const handleSavedCouplingSelect = async (saved: SavedCoupling) => {
    // Check if this saved coupling is currently active
    const activeCoupling = activeCouplings.find(
      c => c.truck_id === saved.truck_id && 
      c.items.length === saved.trailer_ids.length &&
      c.items.every(item => saved.trailer_ids.includes(item.trailer_id))
    );

    if (activeCoupling) {
      handleCouplingSelect(activeCoupling.id);
    } else {
      // Need to create the coupling first
      setIsCreating(true);
      const success = await onNewCouplingCreate({
        truck_id: saved.truck_id,
        coupling_type: saved.coupling_type,
        trailer_ids: saved.trailer_ids,
      }, false);
      setIsCreating(false);
      
      if (success) {
        onVehicleSelect(saved.truck_id);
      }
    }
  };

  const handleTrailerToggle = (trailerId: string) => {
    setNewTrailerIds((prev) => {
      if (prev.includes(trailerId)) {
        return prev.filter((id) => id !== trailerId);
      }
      const maxTrailers = couplingTypeConfig[newCouplingType].maxTrailers;
      if (prev.length >= maxTrailers) {
        return prev;
      }
      return [...prev, trailerId];
    });
  };

  const handleCreateNewCoupling = async () => {
    if (!newTruckId || newTrailerIds.length === 0) return;

    setIsCreating(true);
    const success = await onNewCouplingCreate(
      {
        truck_id: newTruckId,
        coupling_type: newCouplingType,
        trailer_ids: newTrailerIds,
      },
      saveForFuture,
      couplingName || undefined
    );
    setIsCreating(false);

    if (success) {
      onVehicleSelect(newTruckId);
      setMode("coupling");
    }
  };

  const canProceedWizardStep1 = !!newTruckId;
  const canProceedWizardStep2 = !!newCouplingType;
  const canCreateCoupling = newTrailerIds.length >= couplingTypeConfig[newCouplingType].minTrailers;

  const selectedTruck = availableTrucks.find(t => t.id === newTruckId);

  // Generate default name for saved coupling
  useEffect(() => {
    if (saveForFuture && !couplingName && selectedTruck && newTrailerIds.length > 0) {
      const trailerPlates = newTrailerIds
        .map(id => availableTrailers.find(t => t.id === id)?.plate)
        .filter(Boolean)
        .join(" + ");
      setCouplingName(`${selectedTruck.plate} + ${trailerPlates}`);
    }
  }, [saveForFuture, selectedTruck, newTrailerIds, availableTrailers, couplingName]);

  return (
    <div className="space-y-4">
      <Label className="text-base font-medium flex items-center gap-2">
        <Truck className="h-4 w-4" />
        Veículo / Conjunto
      </Label>

      {/* Mode Selection */}
      <div className="grid grid-cols-3 gap-2">
        <Button
          type="button"
          variant={mode === "single" ? "default" : "outline"}
          className="flex flex-col items-center gap-1 h-auto py-3"
          onClick={() => handleModeChange("single")}
        >
          <Truck className="h-5 w-5" />
          <span className="text-xs">Avulso</span>
        </Button>
        <Button
          type="button"
          variant={mode === "coupling" ? "default" : "outline"}
          className="flex flex-col items-center gap-1 h-auto py-3"
          onClick={() => handleModeChange("coupling")}
        >
          <Link2 className="h-5 w-5" />
          <span className="text-xs">Conjunto</span>
        </Button>
        <Button
          type="button"
          variant={mode === "new" ? "default" : "outline"}
          className="flex flex-col items-center gap-1 h-auto py-3"
          onClick={() => handleModeChange("new")}
        >
          <Plus className="h-5 w-5" />
          <span className="text-xs">Montar Novo</span>
        </Button>
      </div>

      {/* Mode: Single Vehicle */}
      {mode === "single" && (
        <div className="space-y-2">
          <Label className="text-sm text-muted-foreground">
            Selecione um veículo avulso (rígido ou cavalo sem engate)
          </Label>
          <Select
            value={selectedVehicleId || ""}
            onValueChange={handleSingleVehicleSelect}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione o veículo" />
            </SelectTrigger>
            <SelectContent>
              {singleVehicles.map((vehicle) => (
                <SelectItem key={vehicle.id} value={vehicle.id}>
                  <div className="flex items-center gap-2">
                    <Truck className="h-4 w-4" />
                    <span className="font-medium">{vehicle.plate}</span>
                    <span className="text-muted-foreground">
                      - {vehicle.brand} {vehicle.model}
                    </span>
                    {vehicle.vehicle_type === "rigid" && (
                      <Badge variant="secondary" className="text-xs">Rígido</Badge>
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Mode: Existing Coupling */}
      {mode === "coupling" && (
        <div className="space-y-4">
          {activeCouplings.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">Conjuntos Ativos</Label>
              <ScrollArea className="h-[180px]">
                <RadioGroup
                  value={selectedCouplingId || ""}
                  onValueChange={handleCouplingSelect}
                >
                  <div className="space-y-2 pr-4">
                    {activeCouplings.map((coupling) => {
                      const truck = vehicles.find(v => v.id === coupling.truck_id);
                      const trailers = coupling.items
                        .sort((a, b) => a.position - b.position)
                        .map(item => vehicles.find(v => v.id === item.trailer_id))
                        .filter(Boolean);

                      return (
                        <Card
                          key={coupling.id}
                          className={cn(
                            "p-3 cursor-pointer transition-all hover:border-primary",
                            selectedCouplingId === coupling.id && "border-primary bg-primary/5"
                          )}
                          onClick={() => handleCouplingSelect(coupling.id)}
                        >
                          <div className="flex items-start gap-3">
                            <RadioGroupItem value={coupling.id} id={coupling.id} className="mt-1" />
                            <div className="flex-1 space-y-1">
                              <div className="flex items-center gap-2">
                                <Truck className="h-4 w-4 text-primary" />
                                <span className="font-bold">{truck?.plate}</span>
                                <span className="text-sm text-muted-foreground">
                                  {truck?.brand} {truck?.model}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 text-sm">
                                <Link2 className="h-3 w-3" />
                                <Badge variant="outline" className="text-xs">
                                  {couplingTypeConfig[coupling.coupling_type as CouplingType]?.label}
                                </Badge>
                                <span className="text-muted-foreground">
                                  {trailers.map(t => t?.plate).join(" + ")}
                                </span>
                              </div>
                            </div>
                            {selectedCouplingId === coupling.id && (
                              <CheckCircle2 className="h-5 w-5 text-primary" />
                            )}
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                </RadioGroup>
              </ScrollArea>
            </div>
          )}

          {savedCouplings.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground flex items-center gap-2">
                <Save className="h-3 w-3" />
                Conjuntos Salvos
              </Label>
              <ScrollArea className="h-[120px]">
                <div className="space-y-2 pr-4">
                  {savedCouplings.map((saved) => {
                    const truck = vehicles.find(v => v.id === saved.truck_id);
                    const isActive = activeCouplings.some(
                      c => c.truck_id === saved.truck_id
                    );

                    return (
                      <Card
                        key={saved.id}
                        className={cn(
                          "p-2 cursor-pointer transition-all hover:border-primary",
                          isActive && "opacity-50"
                        )}
                        onClick={() => !isActive && handleSavedCouplingSelect(saved)}
                      >
                        <div className="flex items-center gap-2">
                          <Container className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium">{saved.name}</span>
                          {isActive && (
                            <Badge variant="secondary" className="text-xs ml-auto">
                              Já engatado
                            </Badge>
                          )}
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>
          )}

          {activeCouplings.length === 0 && savedCouplings.length === 0 && (
            <div className="py-8 text-center text-muted-foreground">
              <Link2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>Nenhum conjunto disponível.</p>
              <Button
                type="button"
                variant="link"
                className="mt-2"
                onClick={() => handleModeChange("new")}
              >
                Montar novo conjunto
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Mode: Create New Coupling */}
      {mode === "new" && (
        <div className="space-y-4">
          {/* Step indicator */}
          <div className="flex items-center justify-center gap-2">
            {[1, 2, 3].map((s) => (
              <div key={s} className="flex items-center">
                <div
                  className={cn(
                    "w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium transition-colors",
                    wizardStep >= s
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {wizardStep > s ? <CheckCircle2 className="h-3 w-3" /> : s}
                </div>
                {s < 3 && (
                  <div
                    className={cn(
                      "w-8 h-0.5 mx-1",
                      wizardStep > s ? "bg-primary" : "bg-muted"
                    )}
                  />
                )}
              </div>
            ))}
          </div>

          {/* Step 1: Select Truck */}
          {wizardStep === 1 && (
            <div className="space-y-2">
              <Label className="text-sm">Selecione o Cavalo</Label>
              {availableTrucks.length === 0 ? (
                <div className="py-4 text-center text-muted-foreground text-sm">
                  Nenhum cavalo disponível para engate.
                </div>
              ) : (
                <ScrollArea className="h-[160px]">
                  <div className="space-y-2 pr-4">
                    {availableTrucks.map((truck) => (
                      <Card
                        key={truck.id}
                        className={cn(
                          "p-2 cursor-pointer transition-all hover:border-primary",
                          newTruckId === truck.id && "border-primary bg-primary/5"
                        )}
                        onClick={() => setNewTruckId(truck.id)}
                      >
                        <div className="flex items-center gap-2">
                          <Truck className="h-4 w-4 text-muted-foreground" />
                          <span className="font-bold text-sm">{truck.plate}</span>
                          <span className="text-xs text-muted-foreground">
                            {truck.brand} {truck.model}
                          </span>
                          {newTruckId === truck.id && (
                            <CheckCircle2 className="h-4 w-4 text-primary ml-auto" />
                          )}
                        </div>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </div>
          )}

          {/* Step 2: Select Coupling Type */}
          {wizardStep === 2 && (
            <div className="space-y-2">
              <Label className="text-sm">
                Tipo de Conjunto
                <span className="text-muted-foreground ml-2">
                  (Cavalo: {selectedTruck?.plate})
                </span>
              </Label>
              <RadioGroup
                value={newCouplingType}
                onValueChange={(v) => {
                  setNewCouplingType(v as CouplingType);
                  setNewTrailerIds([]);
                }}
              >
                <div className="grid grid-cols-3 gap-2">
                  {Object.entries(couplingTypeConfig).map(([key, config]) => (
                    <Card
                      key={key}
                      className={cn(
                        "p-3 cursor-pointer transition-all hover:border-primary text-center",
                        newCouplingType === key && "border-primary bg-primary/5"
                      )}
                      onClick={() => {
                        setNewCouplingType(key as CouplingType);
                        setNewTrailerIds([]);
                      }}
                    >
                      <RadioGroupItem value={key} id={key} className="sr-only" />
                      <Label htmlFor={key} className="cursor-pointer">
                        <div className="font-medium text-sm">{config.label}</div>
                        <div className="text-xs text-muted-foreground">{config.description}</div>
                      </Label>
                    </Card>
                  ))}
                </div>
              </RadioGroup>
            </div>
          )}

          {/* Step 3: Select Trailers */}
          {wizardStep === 3 && (
            <div className="space-y-3">
              <Label className="text-sm">
                Selecione as Carretas
                <span className="text-muted-foreground ml-2">
                  ({newTrailerIds.length}/{couplingTypeConfig[newCouplingType].minTrailers})
                </span>
              </Label>
              
              {availableTrailers.length === 0 ? (
                <div className="py-4 text-center text-muted-foreground text-sm">
                  Nenhuma carreta disponível para engate.
                </div>
              ) : (
                <ScrollArea className="h-[120px]">
                  <div className="space-y-2 pr-4">
                    {availableTrailers.map((trailer) => {
                      const isSelected = newTrailerIds.includes(trailer.id);
                      const position = newTrailerIds.indexOf(trailer.id) + 1;

                      return (
                        <div
                          key={trailer.id}
                          className={cn(
                            "flex items-center gap-2 p-2 border rounded-lg cursor-pointer transition-all hover:border-primary",
                            isSelected && "border-primary bg-primary/5"
                          )}
                          onClick={() => handleTrailerToggle(trailer.id)}
                        >
                          <Checkbox checked={isSelected} />
                          <Container className="h-4 w-4 text-muted-foreground" />
                          <span className="font-bold text-sm">{trailer.plate}</span>
                          <span className="text-xs text-muted-foreground">
                            {trailer.brand} {trailer.model}
                          </span>
                          {isSelected && (
                            <div className="w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold ml-auto">
                              {position}º
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              )}

              {/* Save for future option */}
              <div className="space-y-2 pt-2 border-t">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="save-coupling"
                    checked={saveForFuture}
                    onCheckedChange={(checked) => setSaveForFuture(!!checked)}
                  />
                  <Label htmlFor="save-coupling" className="text-sm cursor-pointer">
                    Salvar este conjunto para próximas viagens
                  </Label>
                </div>
                {saveForFuture && (
                  <Input
                    placeholder="Nome do conjunto (ex: Conjunto Principal)"
                    value={couplingName}
                    onChange={(e) => setCouplingName(e.target.value)}
                    className="text-sm"
                  />
                )}
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex justify-between pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => wizardStep === 1 ? handleModeChange("coupling") : setWizardStep(wizardStep - 1)}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              {wizardStep === 1 ? "Cancelar" : "Voltar"}
            </Button>

            {wizardStep < 3 ? (
              <Button
                type="button"
                size="sm"
                onClick={() => setWizardStep(wizardStep + 1)}
                disabled={
                  (wizardStep === 1 && !canProceedWizardStep1) ||
                  (wizardStep === 2 && !canProceedWizardStep2)
                }
              >
                Próximo
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                onClick={handleCreateNewCoupling}
                disabled={!canCreateCoupling || isCreating}
              >
                {isCreating ? (
                  "Criando..."
                ) : (
                  <>
                    <Link2 className="h-4 w-4 mr-1" />
                    Criar Conjunto
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
