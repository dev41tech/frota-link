import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Gauge, AlertTriangle, CheckCircle2, Info, Eye } from "lucide-react";
import { useFleetConsumption } from "@/hooks/useFleetConsumption";
import { useMultiTenant } from "@/hooks/useMultiTenant";
import { useStaffAccess } from "@/hooks/useStaffAccess";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { FuelDataIssuesDialog } from "./FuelDataIssuesDialog";

export default function FleetConsumptionOverview() {
  const [issuesDialogOpen, setIssuesDialogOpen] = useState(false);
  const { currentCompany } = useMultiTenant();
  const { staffContext } = useStaffAccess();
  const effectiveCompanyId = staffContext?.company_id || currentCompany?.id;
  
  // Usar hook centralizado de consumo
  const { result, loading } = useFleetConsumption({ companyId: effectiveCompanyId });

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Gauge className="h-5 w-5" />
            <span>Consumo da Frota</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  const data = result?.consumptionByVehicle || [];
  const vehiclesWithValidData = data.filter(v => 
    v.consumption !== null && v.status !== 'insufficient_data'
  );
  const vehiclesWithDataIssues = data.filter(v => v.dataQualityIssue);
  
  const avgConsumption = result?.avgConsumption || 0;

  const criticalVehicles = data.filter(v => v.status === 'critical').length;
  const warningVehicles = data.filter(v => v.status === 'warning').length;
  const goodVehicles = data.filter(v => v.status === 'good' || v.status === 'excellent').length;
  const insufficientDataVehicles = data.filter(v => v.status === 'insufficient_data').length;

  const hasDataQualityIssues = vehiclesWithDataIssues.length > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Gauge className="h-5 w-5" />
          <span>Consumo da Frota</span>
          {hasDataQualityIssues && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="h-4 w-4 text-amber-500" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p>{vehiclesWithDataIssues.length} veículo(s) com dados insuficientes para cálculo preciso. Registre os abastecimentos com hodômetro para melhorar a precisão.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center p-3 bg-primary/10 rounded-lg">
            <div className="text-2xl font-bold text-primary">
              {vehiclesWithValidData.length > 0 ? avgConsumption.toFixed(1) : '--'}
            </div>
            <div className="text-xs text-muted-foreground">km/L Média</div>
          </div>
          <div className="text-center p-3 bg-muted rounded-lg">
            <div className="text-2xl font-bold">
              {vehiclesWithValidData.length}/{data.length}
            </div>
            <div className="text-xs text-muted-foreground">Com Dados Válidos</div>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <span>Bom desempenho</span>
            </div>
            <Badge className="bg-green-100 text-green-800">{goodVehicles}</Badge>
          </div>
          
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              <span>Atenção</span>
            </div>
            <Badge className="bg-yellow-100 text-yellow-800">{warningVehicles}</Badge>
          </div>
          
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <span>Crítico</span>
            </div>
            <Badge className="bg-red-100 text-red-800">{criticalVehicles}</Badge>
          </div>

          {insufficientDataVehicles > 0 && (
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center space-x-2">
                <Info className="h-4 w-4 text-amber-500" />
                <span>Dados insuficientes</span>
              </div>
              <Badge className="bg-amber-100 text-amber-800">{insufficientDataVehicles}</Badge>
            </div>
          )}
        </div>

        {criticalVehicles > 0 && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-800">
              ⚠️ {criticalVehicles} veículo{criticalVehicles > 1 ? 's' : ''} com consumo crítico. Verifique manutenção.
            </p>
          </div>
        )}

        {hasDataQualityIssues && insufficientDataVehicles > 0 && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm text-amber-800 flex-1">
                ℹ️ {insufficientDataVehicles} veículo{insufficientDataVehicles > 1 ? 's' : ''} sem dados de abastecimento suficientes. Registre os abastecimentos com hodômetro inicial e final.
              </p>
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => setIssuesDialogOpen(true)}
                className="shrink-0 gap-1 bg-white hover:bg-amber-100 border-amber-300 text-amber-800"
              >
                <Eye className="h-3 w-3" />
                Visualizar
              </Button>
            </div>
          </div>
        )}

        <FuelDataIssuesDialog 
          open={issuesDialogOpen}
          onOpenChange={setIssuesDialogOpen}
          vehiclesWithIssues={vehiclesWithDataIssues.map(v => ({
            vehicleId: v.vehicleId,
            plate: v.plate,
            model: v.model,
            totalDistance: v.distance,
            totalLiters: v.liters,
            dataQualityIssue: v.dataQualityIssue
          }))}
        />
      </CardContent>
    </Card>
  );
}
