import { useState, useEffect } from "react";
import { parseExcelFile } from "@/lib/excelExport";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Upload, FileSpreadsheet, Check, AlertCircle, Loader2, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Progress } from "@/components/ui/progress";

interface ImportedVehicle {
  plate: string;
  brand: string;
  model: string;
  year: string | number;
  chassis: string;
  renavam: string;
  fipeValue: string;
  fuelType: string;
  targetConsumption: number | null;
  status: "pending" | "enriching" | "success" | "error";
  message?: string;
}

interface VehicleImportProps {
  onSuccess: () => void;
  userId: string | undefined;
  companyId: string | undefined;
}

export function VehicleImport({ onSuccess, userId, companyId }: VehicleImportProps) {
  const [open, setOpen] = useState(false);
  const [vehicles, setVehicles] = useState<ImportedVehicle[]>([]);
  const [loading, setLoading] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [progress, setProgress] = useState(0);
  const { toast } = useToast();

  // Auto-enrich when vehicles are loaded
  useEffect(() => {
    if (vehicles.length > 0 && vehicles.every(v => v.status === "pending")) {
      enrichData();
    }
  }, [vehicles]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const data = await parseExcelFile(file);

      const formattedData: ImportedVehicle[] = data
        .map((row: any) => {
          const rawPlate = row["Placa"] || row["placa"] || row["PLACA"] || Object.values(row)[0] || "";

          return {
            plate: rawPlate
              .toString()
              .toUpperCase()
              .replace(/[^A-Z0-9]/g, ""),
            brand: row["Marca"] || "",
            model: row["Modelo"] || "",
            year: row["Ano"] || "",
            chassis: row["Chassi"] || "",
            renavam: row["Renavam"] || "",
            fipeValue: "",
            fuelType: "diesel",
            targetConsumption: null,
            status: "pending" as const,
          };
        })
        .filter((v) => v.plate.length === 7);

      if (formattedData.length === 0) {
        toast({ title: "Erro", description: "Nenhuma placa válida encontrada na planilha.", variant: "destructive" });
        return;
      }
      setVehicles(formattedData);
    } catch (error) {
      toast({ title: "Erro", description: "Falha ao ler o arquivo.", variant: "destructive" });
    }
  };

  const enrichData = async () => {
    setEnriching(true);
    setLoading(true);
    let completed = 0;
    const newVehicles = [...vehicles];

    for (let i = 0; i < newVehicles.length; i++) {
      // Skip if already has model data
      if (newVehicles[i].model && newVehicles[i].status === "success") {
        completed++;
        continue;
      }

      // Update status to enriching
      newVehicles[i].status = "enriching";
      setVehicles([...newVehicles]);

      try {
        const { data, error } = await supabase.functions.invoke("smooth-processor", {
          body: { plate: newVehicles[i].plate },
        });

        if (!error && data && data.marca) {
          // Parse fuel type
          let fuelType = "diesel";
          const apiFuel = (data.combustivel || "").toLowerCase();
          if (apiFuel.includes("flex") || apiFuel.includes("gasolina")) fuelType = "gasoline";
          else if (apiFuel.includes("etanol")) fuelType = "ethanol";
          else if (apiFuel.includes("eletrico")) fuelType = "electric";

          // Get expected consumption based on brand/model
          let targetConsumption: number | null = null;
          try {
            const { data: consumptionData } = await supabase.rpc('get_expected_consumption', {
              p_brand: data.marca,
              p_model: data.modelo
            });
            if (consumptionData) {
              targetConsumption = consumptionData;
            }
          } catch (err) {
            console.log('Could not fetch consumption reference:', err);
          }

          newVehicles[i] = {
            ...newVehicles[i],
            brand: data.marca,
            model: data.modelo,
            year: data.ano,
            chassis: data.chassis || "",
            renavam: data.renavam || "",
            fipeValue: data.fipe_valor || "",
            fuelType,
            targetConsumption,
            status: "success" as const,
          };
        } else {
          newVehicles[i].status = "error";
          newVehicles[i].message = "Não encontrado";
        }
      } catch (err) {
        newVehicles[i].status = "error";
        newVehicles[i].message = "Erro na busca";
      }
      completed++;
      setProgress((completed / newVehicles.length) * 100);
      setVehicles([...newVehicles]);
      await new Promise((r) => setTimeout(r, 600));
    }
    setEnriching(false);
    setLoading(false);
    toast({ title: "Busca FIPE concluída", description: `${newVehicles.filter(v => v.status === "success").length} veículos encontrados.` });
  };

  const handleSave = async () => {
    if (!userId || !companyId) return;
    setLoading(true);
    try {
      const payload = vehicles.map((v) => {
        // Parse FIPE value
        let currentValue = null;
        if (v.fipeValue) {
          const parsed = parseFloat(
            v.fipeValue.replace("R$ ", "").replace(/\./g, "").replace(",", ".")
          );
          if (!isNaN(parsed)) currentValue = parsed;
        }

        return {
          user_id: userId,
          company_id: companyId,
          plate: v.plate,
          brand: v.brand,
          model: v.model || "Modelo não identificado",
          year: parseInt(v.year?.toString()) || null,
          chassis: v.chassis,
          renavam: v.renavam,
          fuel_type: v.fuelType,
          current_value: currentValue,
          target_consumption: v.targetConsumption,
          status: "active",
        };
      });

      const { error } = await supabase.from("vehicles").insert(payload);
      if (error) throw error;

      toast({ title: "Sucesso!", description: `${vehicles.length} veículos cadastrados com dados FIPE.` });
      setOpen(false);
      setVehicles([]);
      setProgress(0);
      onSuccess();
    } catch (error: any) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: string) => {
    if (!value) return "—";
    return value;
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="gap-2"
        >
          <FileSpreadsheet className="h-4 w-4" /> Importar
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importação em Massa com FIPE</DialogTitle>
          <DialogDescription>
            Selecione uma planilha (.xlsx) com a coluna "Placa". Os dados FIPE serão buscados automaticamente.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {!vehicles.length && (
            <div className="border-2 border-dashed rounded-lg p-10 text-center hover:bg-muted/50 transition-colors">
              <Upload className="mx-auto h-10 w-10 text-muted-foreground mb-4" />
              <label htmlFor="file-upload" className="cursor-pointer">
                <span className="bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90">
                  Selecionar Arquivo
                </span>
                <input
                  id="file-upload"
                  type="file"
                  accept=".xlsx, .csv"
                  className="hidden"
                  onChange={handleFileUpload}
                />
              </label>
              <p className="text-xs text-muted-foreground mt-4">
                A busca FIPE iniciará automaticamente após o upload
              </p>
            </div>
          )}
          {vehicles.length > 0 && (
            <>
              <div className="flex justify-between items-center bg-muted/20 p-3 rounded-md">
                <div className="text-sm">
                  <span className="font-medium">{vehicles.length} veículos</span>
                  {enriching && (
                    <span className="text-muted-foreground ml-2">
                      • Buscando dados FIPE...
                    </span>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setVehicles([]);
                    setProgress(0);
                  }}
                  disabled={loading}
                >
                  Limpar
                </Button>
              </div>

              {(loading || enriching) && (
                <div className="space-y-1">
                  <Progress value={progress} className="h-2 w-full" />
                  <p className="text-xs text-muted-foreground text-center">
                    {Math.round(progress)}% concluído
                  </p>
                </div>
              )}

              <div className="border rounded-md max-h-[350px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Placa</TableHead>
                      <TableHead>Marca/Modelo</TableHead>
                      <TableHead>Ano</TableHead>
                      <TableHead className="text-right">Meta km/l</TableHead>
                      <TableHead className="text-right">Valor FIPE</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {vehicles.map((v, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-mono font-bold">{v.plate}</TableCell>
                        <TableCell>
                          {v.model ? `${v.brand} ${v.model}` : "—"}
                        </TableCell>
                        <TableCell>{v.year || "—"}</TableCell>
                        <TableCell className="text-right font-medium text-blue-600">
                          {v.targetConsumption ? `${v.targetConsumption} km/l` : "—"}
                        </TableCell>
                        <TableCell className="text-right font-medium text-green-600">
                          {formatCurrency(v.fipeValue)}
                        </TableCell>
                        <TableCell className="text-center">
                          {v.status === "success" ? (
                            <Check className="h-4 w-4 text-green-500 mx-auto" />
                          ) : v.status === "error" ? (
                            <AlertCircle className="h-4 w-4 text-red-500 mx-auto" />
                          ) : v.status === "enriching" ? (
                            <Loader2 className="h-4 w-4 animate-spin text-blue-500 mx-auto" />
                          ) : (
                            <span className="text-muted-foreground">•</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="flex justify-end pt-4 border-t">
                <Button 
                  onClick={handleSave} 
                  disabled={loading || enriching} 
                  className="bg-gradient-primary"
                >
                  <Save className="h-4 w-4 mr-2" /> Confirmar Importação
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
