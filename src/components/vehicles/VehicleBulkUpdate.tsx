import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Check, AlertCircle, Loader2, Car } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface Vehicle {
  id: string;
  plate: string;
  model: string;
  brand?: string;
  current_value?: number;
}

interface VehicleBulkUpdateProps {
  vehicles: Vehicle[];
  onSuccess: () => void;
}

interface UpdateStatus {
  id: string;
  plate: string;
  status: "pending" | "processing" | "success" | "error" | "skipped";
  message?: string;
  fipeValue?: string;
}

export function VehicleBulkUpdate({ vehicles, onSuccess }: VehicleBulkUpdateProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [updateStatuses, setUpdateStatuses] = useState<UpdateStatus[]>([]);
  const [options, setOptions] = useState({
    updateBrandModel: true,
    updateFipeValue: true,
    overwriteExisting: false,
  });
  const { toast } = useToast();

  const vehiclesWithoutFipe = vehicles.filter(v => !v.current_value);
  const vehiclesToUpdate = options.overwriteExisting ? vehicles : vehiclesWithoutFipe;

  const handleOpen = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen) {
      setUpdateStatuses(
        vehiclesToUpdate.map(v => ({
          id: v.id,
          plate: v.plate,
          status: "pending" as const,
        }))
      );
      setProgress(0);
    }
  };

  const startBulkUpdate = async () => {
    setLoading(true);
    const statuses = [...updateStatuses];
    let completed = 0;
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < statuses.length; i++) {
      const vehicle = vehicles.find(v => v.id === statuses[i].id);
      if (!vehicle) continue;

      // Update status to processing
      statuses[i].status = "processing";
      setUpdateStatuses([...statuses]);

      try {
        const { data, error } = await supabase.functions.invoke("smooth-processor", {
          body: { plate: vehicle.plate },
        });

        if (error || !data || !data.marca) {
          statuses[i].status = "error";
          statuses[i].message = "Dados não encontrados";
          errorCount++;
        } else {
          // Build update object
          const updateData: Record<string, any> = {};

          if (options.updateBrandModel) {
            if (!vehicle.brand || options.overwriteExisting) {
              updateData.brand = data.marca;
            }
            if (!vehicle.model || vehicle.model === "Modelo não identificado" || options.overwriteExisting) {
              updateData.model = data.modelo;
            }
          }

          if (options.updateFipeValue && data.fipe_valor) {
            const fipeValue = parseFloat(
              data.fipe_valor.replace("R$ ", "").replace(/\./g, "").replace(",", ".")
            );
            if (!isNaN(fipeValue)) {
              updateData.current_value = fipeValue;
              statuses[i].fipeValue = data.fipe_valor;
            }
          }

          if (Object.keys(updateData).length > 0) {
            const { error: updateError } = await supabase
              .from("vehicles")
              .update(updateData)
              .eq("id", vehicle.id);

            if (updateError) {
              statuses[i].status = "error";
              statuses[i].message = updateError.message;
              errorCount++;
            } else {
              statuses[i].status = "success";
              statuses[i].message = `${data.marca} ${data.modelo}`;
              successCount++;
            }
          } else {
            statuses[i].status = "skipped";
            statuses[i].message = "Nenhum campo a atualizar";
          }
        }
      } catch (err: any) {
        statuses[i].status = "error";
        statuses[i].message = err.message || "Erro desconhecido";
        errorCount++;
      }

      completed++;
      setProgress((completed / statuses.length) * 100);
      setUpdateStatuses([...statuses]);

      // Rate limiting - wait 600ms between requests
      if (i < statuses.length - 1) {
        await new Promise(r => setTimeout(r, 600));
      }
    }

    setLoading(false);
    toast({
      title: "Atualização concluída",
      description: `${successCount} atualizados, ${errorCount} erros`,
    });

    if (successCount > 0) {
      onSuccess();
    }
  };

  const getStatusIcon = (status: UpdateStatus["status"]) => {
    switch (status) {
      case "success":
        return <Check className="h-4 w-4 text-green-500" />;
      case "error":
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case "processing":
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
      case "skipped":
        return <span className="text-muted-foreground text-xs">—</span>;
      default:
        return <span className="text-muted-foreground text-xs">•</span>;
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Atualizar FIPE
          {vehiclesWithoutFipe.length > 0 && (
            <Badge variant="secondary" className="ml-1 bg-amber-100 text-amber-700">
              {vehiclesWithoutFipe.length}
            </Badge>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            Atualização em Massa - FIPE
          </DialogTitle>
          <DialogDescription>
            Atualizar dados de {vehiclesToUpdate.length} veículos via consulta FIPE
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Options */}
          <div className="space-y-3 p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="updateBrandModel"
                checked={options.updateBrandModel}
                onCheckedChange={(checked) =>
                  setOptions(prev => ({ ...prev, updateBrandModel: !!checked }))
                }
                disabled={loading}
              />
              <label htmlFor="updateBrandModel" className="text-sm cursor-pointer">
                Atualizar marca/modelo (se vazio)
              </label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="updateFipeValue"
                checked={options.updateFipeValue}
                onCheckedChange={(checked) =>
                  setOptions(prev => ({ ...prev, updateFipeValue: !!checked }))
                }
                disabled={loading}
              />
              <label htmlFor="updateFipeValue" className="text-sm cursor-pointer">
                Atualizar valor FIPE
              </label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="overwriteExisting"
                checked={options.overwriteExisting}
                onCheckedChange={(checked) =>
                  setOptions(prev => ({ ...prev, overwriteExisting: !!checked }))
                }
                disabled={loading}
              />
              <label htmlFor="overwriteExisting" className="text-sm cursor-pointer">
                Sobrescrever dados existentes
              </label>
            </div>
          </div>

          {/* Progress */}
          {loading && (
            <div className="space-y-2">
              <Progress value={progress} className="h-2" />
              <p className="text-xs text-muted-foreground text-center">
                {Math.round(progress)}% concluído
              </p>
            </div>
          )}

          {/* Vehicle list */}
          <ScrollArea className="h-[280px] border rounded-lg">
            <div className="p-2 space-y-1">
              {updateStatuses.map((item) => (
                <div
                  key={item.id}
                  className={`flex items-center justify-between p-2 rounded-md text-sm ${
                    item.status === "processing" ? "bg-blue-50" :
                    item.status === "success" ? "bg-green-50" :
                    item.status === "error" ? "bg-red-50" :
                    "bg-muted/30"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Car className="h-4 w-4 text-muted-foreground" />
                    <span className="font-mono font-medium">{item.plate}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {item.fipeValue && (
                      <span className="text-xs text-green-600 font-medium">
                        {item.fipeValue}
                      </span>
                    )}
                    {item.message && item.status !== "success" && (
                      <span className="text-xs text-muted-foreground max-w-[120px] truncate">
                        {item.message}
                      </span>
                    )}
                    {getStatusIcon(item.status)}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              {loading ? "Processando..." : "Fechar"}
            </Button>
            <Button
              onClick={startBulkUpdate}
              disabled={loading || updateStatuses.length === 0}
              className="bg-gradient-primary"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Atualizando...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Iniciar Atualização
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
