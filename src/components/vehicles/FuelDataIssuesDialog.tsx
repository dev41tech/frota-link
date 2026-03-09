import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, Fuel, Route, ExternalLink, Info } from "lucide-react";

interface VehicleDataIssue {
  vehicleId: string;
  plate: string;
  model: string;
  totalDistance: number;
  totalLiters: number;
  dataQualityIssue?: 'unrealistic_consumption' | 'missing_fuel_data' | 'mixed_sources';
}

interface FuelDataIssuesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vehiclesWithIssues: VehicleDataIssue[];
}

const issueDescriptions: Record<string, { title: string; description: string; severity: 'warning' | 'error' }> = {
  'missing_fuel_data': {
    title: 'Sem dados de abastecimento',
    description: 'Veículo tem jornadas registradas mas nenhum abastecimento nos últimos 90 dias.',
    severity: 'error'
  },
  'mixed_sources': {
    title: 'Dados inconsistentes',
    description: 'O cálculo está usando distância das jornadas mas os abastecimentos registrados são insuficientes para essa distância.',
    severity: 'warning'
  },
  'unrealistic_consumption': {
    title: 'Consumo irreal',
    description: 'O consumo calculado excede 15 km/L, que é impossível para caminhões. Verifique os dados de hodômetro.',
    severity: 'warning'
  }
};

export function FuelDataIssuesDialog({ open, onOpenChange, vehiclesWithIssues }: FuelDataIssuesDialogProps) {
  const navigate = useNavigate();

  const handleGoToFuel = (vehicleId: string) => {
    onOpenChange(false);
    navigate(`/fuel?vehicle=${vehicleId}`);
  };

  const handleGoToVehicle = (vehicleId: string) => {
    onOpenChange(false);
    navigate(`/vehicles?id=${vehicleId}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Veículos com Dados Insuficientes
          </DialogTitle>
          <DialogDescription>
            Os veículos abaixo precisam de mais dados de abastecimento para calcular o consumo corretamente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* Summary Alert */}
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex items-start gap-3">
              <Info className="h-5 w-5 text-amber-600 mt-0.5" />
              <div className="text-sm text-amber-800">
                <p className="font-medium mb-1">Por que isso acontece?</p>
                <ul className="list-disc list-inside space-y-1 text-xs">
                  <li>Abastecimentos sem hodômetro inicial e final registrados</li>
                  <li>Jornadas longas com poucos abastecimentos registrados</li>
                  <li>Abastecimentos feitos fora do sistema</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Vehicles List */}
          <div className="space-y-3">
            {vehiclesWithIssues.map((vehicle) => {
              const issue = vehicle.dataQualityIssue 
                ? issueDescriptions[vehicle.dataQualityIssue] 
                : { title: 'Dados insuficientes', description: 'Sem dados suficientes para cálculo.', severity: 'warning' as const };

              return (
                <div 
                  key={vehicle.vehicleId} 
                  className="p-4 border rounded-lg bg-card hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold">{vehicle.plate}</span>
                        <span className="text-muted-foreground text-sm">- {vehicle.model}</span>
                      </div>
                      
                      <Badge 
                        variant="outline" 
                        className={issue.severity === 'error' 
                          ? 'border-red-300 text-red-700 bg-red-50' 
                          : 'border-amber-300 text-amber-700 bg-amber-50'
                        }
                      >
                        {issue.title}
                      </Badge>
                      
                      <p className="text-xs text-muted-foreground mt-2">
                        {issue.description}
                      </p>

                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Route className="h-3 w-3" />
                          {vehicle.totalDistance.toLocaleString('pt-BR')} km (jornadas)
                        </span>
                        <span className="flex items-center gap-1">
                          <Fuel className="h-3 w-3" />
                          {vehicle.totalLiters.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} L (abastecimentos)
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      <Button 
                        size="sm" 
                        variant="default"
                        onClick={() => handleGoToFuel(vehicle.vehicleId)}
                        className="gap-1"
                      >
                        <Fuel className="h-3 w-3" />
                        Registrar Abastecimento
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => handleGoToVehicle(vehicle.vehicleId)}
                        className="gap-1"
                      >
                        <ExternalLink className="h-3 w-3" />
                        Ver Veículo
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {vehiclesWithIssues.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum veículo com problemas de dados.
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
