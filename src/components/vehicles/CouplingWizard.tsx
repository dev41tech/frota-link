import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Truck, Container, Link2, CheckCircle2, Loader2 } from "lucide-react";
import type { Vehicle, CreateCouplingInput } from "@/hooks/useVehicleCouplings";

interface CouplingWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (input: CreateCouplingInput) => Promise<boolean>;
  availableTrucks: Vehicle[];
  availableTrailers: Vehicle[];
}

type CouplingType = "simple" | "bitrem" | "rodotrem";

const couplingTypeConfig: Record<CouplingType, { label: string; description: string; minTrailers: number }> = {
  simple: { label: "Simples", description: "1 carreta", minTrailers: 1 },
  bitrem: { label: "Bitrem", description: "2 carretas", minTrailers: 2 },
  rodotrem: { label: "Rodotrem", description: "3+ carretas", minTrailers: 3 },
};

export function CouplingWizard({
  isOpen,
  onClose,
  onSubmit,
  availableTrucks,
  availableTrailers,
}: CouplingWizardProps) {
  const [step, setStep] = useState(1);
  const [selectedTruckId, setSelectedTruckId] = useState<string | null>(null);
  const [couplingType, setCouplingType] = useState<CouplingType>("simple");
  const [selectedTrailerIds, setSelectedTrailerIds] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const selectedTruck = availableTrucks.find((t) => t.id === selectedTruckId);

  const reset = () => {
    setStep(1);
    setSelectedTruckId(null);
    setCouplingType("simple");
    setSelectedTrailerIds([]);
    setNotes("");
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleTrailerToggle = (trailerId: string) => {
    setSelectedTrailerIds((prev) => {
      if (prev.includes(trailerId)) {
        return prev.filter((id) => id !== trailerId);
      }
      // Limit based on coupling type
      const maxTrailers = couplingType === "simple" ? 1 : couplingType === "bitrem" ? 2 : 5;
      if (prev.length >= maxTrailers) {
        return prev;
      }
      return [...prev, trailerId];
    });
  };

  const handleSubmit = async () => {
    if (!selectedTruckId || selectedTrailerIds.length === 0) return;

    setSubmitting(true);
    const success = await onSubmit({
      truck_id: selectedTruckId,
      coupling_type: couplingType,
      trailer_ids: selectedTrailerIds,
      notes: notes || undefined,
    });

    setSubmitting(false);
    if (success) {
      handleClose();
    }
  };

  const canProceedStep1 = !!selectedTruckId;
  const canProceedStep2 = !!couplingType;
  const canProceedStep3 = selectedTrailerIds.length >= couplingTypeConfig[couplingType].minTrailers;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            Montar Conjunto
          </DialogTitle>
          <DialogDescription>
            Selecione o cavalo e as carretas para criar um novo engate
          </DialogDescription>
        </DialogHeader>

        {/* Stepper */}
        <div className="flex items-center justify-center gap-2 py-2">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center">
              <div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors",
                  step >= s
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {step > s ? <CheckCircle2 className="h-4 w-4" /> : s}
              </div>
              {s < 3 && (
                <div
                  className={cn(
                    "w-12 h-1 mx-1",
                    step > s ? "bg-primary" : "bg-muted"
                  )}
                />
              )}
            </div>
          ))}
        </div>

        {/* Step 1: Select Truck */}
        {step === 1 && (
          <div className="space-y-4">
            <Label className="text-base">Selecione o Cavalo</Label>
            {availableTrucks.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                Nenhum cavalo disponível para engate.
              </div>
            ) : (
              <ScrollArea className="h-[250px]">
                <div className="space-y-2 pr-4">
                  {availableTrucks.map((truck) => (
                    <Card
                      key={truck.id}
                      className={cn(
                        "p-3 cursor-pointer transition-all hover:border-primary",
                        selectedTruckId === truck.id && "border-primary bg-primary/5"
                      )}
                      onClick={() => setSelectedTruckId(truck.id)}
                    >
                      <div className="flex items-center gap-3">
                        <Truck className="h-5 w-5 text-muted-foreground" />
                        <div className="flex-1">
                          <div className="font-bold">{truck.plate}</div>
                          <div className="text-sm text-muted-foreground">
                            {truck.brand} {truck.model}
                          </div>
                        </div>
                        {selectedTruckId === truck.id && (
                          <CheckCircle2 className="h-5 w-5 text-primary" />
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
        {step === 2 && (
          <div className="space-y-4">
            <div>
              <Label className="text-base">Tipo de Conjunto</Label>
              <p className="text-sm text-muted-foreground mt-1">
                Cavalo selecionado: <strong>{selectedTruck?.plate}</strong> - {selectedTruck?.model}
              </p>
            </div>

            <RadioGroup value={couplingType} onValueChange={(v) => setCouplingType(v as CouplingType)}>
              {Object.entries(couplingTypeConfig).map(([key, config]) => (
                <div
                  key={key}
                  className={cn(
                    "flex items-center space-x-3 p-4 border rounded-lg cursor-pointer transition-all hover:border-primary",
                    couplingType === key && "border-primary bg-primary/5"
                  )}
                  onClick={() => setCouplingType(key as CouplingType)}
                >
                  <RadioGroupItem value={key} id={key} />
                  <div className="flex-1">
                    <Label htmlFor={key} className="font-medium cursor-pointer">
                      {config.label}
                    </Label>
                    <p className="text-sm text-muted-foreground">{config.description}</p>
                  </div>
                </div>
              ))}
            </RadioGroup>
          </div>
        )}

        {/* Step 3: Select Trailers */}
        {step === 3 && (
          <div className="space-y-4">
            <div>
              <Label className="text-base">Selecione as Carretas</Label>
              <p className="text-sm text-muted-foreground mt-1">
                {couplingTypeConfig[couplingType].label}: selecione {couplingTypeConfig[couplingType].minTrailers}
                {couplingType === "rodotrem" && "+"} carreta(s)
              </p>
            </div>

            {availableTrailers.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                Nenhuma carreta disponível para engate.
              </div>
            ) : (
              <ScrollArea className="h-[200px]">
                <div className="space-y-2 pr-4">
                  {availableTrailers.map((trailer) => {
                    const isSelected = selectedTrailerIds.includes(trailer.id);
                    const position = selectedTrailerIds.indexOf(trailer.id) + 1;

                    return (
                      <div
                        key={trailer.id}
                        className={cn(
                          "flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-all hover:border-primary",
                          isSelected && "border-primary bg-primary/5"
                        )}
                        onClick={() => handleTrailerToggle(trailer.id)}
                      >
                        <Checkbox checked={isSelected} />
                        <Container className="h-5 w-5 text-muted-foreground" />
                        <div className="flex-1">
                          <div className="font-bold">{trailer.plate}</div>
                          <div className="text-sm text-muted-foreground">
                            {trailer.brand} {trailer.model}
                          </div>
                        </div>
                        {isSelected && (
                          <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">
                            {position}º
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            )}

            <div className="space-y-2">
              <Label>Observações (opcional)</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Adicione observações sobre este engate..."
                rows={2}
              />
            </div>
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="flex justify-between pt-4 border-t">
          <Button
            variant="outline"
            onClick={() => (step === 1 ? handleClose() : setStep(step - 1))}
          >
            {step === 1 ? "Cancelar" : "Voltar"}
          </Button>

          {step < 3 ? (
            <Button
              onClick={() => setStep(step + 1)}
              disabled={(step === 1 && !canProceedStep1) || (step === 2 && !canProceedStep2)}
            >
              Próximo
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={!canProceedStep3 || submitting}
              className="bg-gradient-primary"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Vinculando...
                </>
              ) : (
                <>
                  <Link2 className="h-4 w-4 mr-2" />
                  Vincular Veículos
                </>
              )}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
