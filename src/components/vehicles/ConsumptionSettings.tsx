import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Settings, Gauge } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useVehicleConsumption } from "@/hooks/useVehicleConsumption";

interface ConsumptionSettingsProps {
  vehicleId: string;
  currentTarget: number | null;
  plate: string;
}

export default function ConsumptionSettings({ vehicleId, currentTarget, plate }: ConsumptionSettingsProps) {
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState(currentTarget?.toString() || '');
  const { updateTargetConsumption } = useVehicleConsumption();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      await updateTargetConsumption(vehicleId, parseFloat(target));
      
      toast({
        title: "✅ Meta atualizada!",
        description: `Consumo ideal definido para ${target} km/L`
      });
      
      setOpen(false);
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Settings className="h-4 w-4 mr-2" />
          Meta
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Configurar Meta de Consumo - {plate}</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="target">Consumo Ideal (km/L)</Label>
            <div className="flex items-center space-x-2">
              <Gauge className="h-5 w-5 text-muted-foreground" />
              <Input
                id="target"
                type="number"
                step="0.1"
                min="0"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                placeholder="Ex: 3.5"
                required
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Meta personalizada para este veículo. Se não definida, será usada a meta padrão da frota (3.5 km/L).
            </p>
          </div>

          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit">
              Salvar Meta
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
