import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DateRangeSelector } from "./DateRangeSelector";
import { Badge } from "@/components/ui/badge";
import { RotateCcw } from "lucide-react";
import { Separator } from "@/components/ui/separator";

interface DashboardFiltersProps {
  // Período
  dateRange: {
    preset: '7d' | '15d' | '30d' | '60d' | '90d' | 'custom';
    startDate: Date;
    endDate: Date;
  };
  onDateRangeChange: (preset: string, start: Date, end: Date) => void;

  // Veículos
  vehicles: Array<{ id: string; plate: string; model: string }>;
  selectedVehicles: string[];
  onVehiclesChange: (selected: string[]) => void;

  // Motoristas
  drivers: Array<{ id: string; name: string }>;
  selectedDrivers: string[];
  onDriversChange: (selected: string[]) => void;

  // Status
  selectedStatus: string[];
  onStatusChange: (selected: string[]) => void;

  // Ações
  onClearAll: () => void;
}

export function DashboardFilters({
  dateRange,
  onDateRangeChange,
  vehicles,
  selectedVehicles,
  onVehiclesChange,
  drivers,
  selectedDrivers,
  onDriversChange,
  selectedStatus,
  onStatusChange,
  onClearAll
}: DashboardFiltersProps) {
  
  const toggleVehicle = (vehicleId: string) => {
    if (selectedVehicles.includes(vehicleId)) {
      onVehiclesChange(selectedVehicles.filter(id => id !== vehicleId));
    } else {
      onVehiclesChange([...selectedVehicles, vehicleId]);
    }
  };

  const toggleDriver = (driverId: string) => {
    if (selectedDrivers.includes(driverId)) {
      onDriversChange(selectedDrivers.filter(id => id !== driverId));
    } else {
      onDriversChange([...selectedDrivers, driverId]);
    }
  };

  const toggleStatus = (status: string) => {
    if (selectedStatus.includes(status)) {
      onStatusChange(selectedStatus.filter(s => s !== status));
    } else {
      onStatusChange([...selectedStatus, status]);
    }
  };

  const statusOptions = [
    { value: 'planned', label: 'Planejado' },
    { value: 'in_progress', label: 'Em Andamento' },
    { value: 'completed', label: 'Concluído' },
    { value: 'cancelled', label: 'Cancelado' }
  ];

  const hasActiveFilters = 
    selectedVehicles.length > 0 || 
    selectedDrivers.length > 0 || 
    selectedStatus.length > 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Filtros</CardTitle>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={onClearAll}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Limpar Filtros
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        
        {/* Período */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold">Período</h3>
          <DateRangeSelector
            preset={dateRange.preset}
            startDate={dateRange.startDate}
            endDate={dateRange.endDate}
            onChange={onDateRangeChange}
          />
        </div>

        <Separator />

        {/* Veículos */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Veículos</h3>
            {selectedVehicles.length > 0 && (
              <Badge variant="secondary">{selectedVehicles.length} selecionados</Badge>
            )}
          </div>
          <ScrollArea className="h-[150px] pr-4">
            <div className="space-y-2">
              {vehicles.map((vehicle) => (
                <div
                  key={vehicle.id}
                  className="flex items-center space-x-2 p-2 hover:bg-accent rounded-lg cursor-pointer transition-colors"
                  onClick={() => toggleVehicle(vehicle.id)}
                >
                  <Checkbox
                    checked={selectedVehicles.includes(vehicle.id)}
                    onCheckedChange={() => toggleVehicle(vehicle.id)}
                  />
                  <span className="text-sm">
                    {vehicle.plate} - {vehicle.model}
                  </span>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>

        <Separator />

        {/* Motoristas */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Motoristas</h3>
            {selectedDrivers.length > 0 && (
              <Badge variant="secondary">{selectedDrivers.length} selecionados</Badge>
            )}
          </div>
          <ScrollArea className="h-[150px] pr-4">
            <div className="space-y-2">
              {drivers.map((driver) => (
                <div
                  key={driver.id}
                  className="flex items-center space-x-2 p-2 hover:bg-accent rounded-lg cursor-pointer transition-colors"
                  onClick={() => toggleDriver(driver.id)}
                >
                  <Checkbox
                    checked={selectedDrivers.includes(driver.id)}
                    onCheckedChange={() => toggleDriver(driver.id)}
                  />
                  <span className="text-sm">{driver.name}</span>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>

        <Separator />

        {/* Status das Viagens */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Status das Viagens</h3>
            {selectedStatus.length > 0 && (
              <Badge variant="secondary">{selectedStatus.length} selecionados</Badge>
            )}
          </div>
          <div className="space-y-2">
            {statusOptions.map((option) => (
              <div
                key={option.value}
                className="flex items-center space-x-2 p-2 hover:bg-accent rounded-lg cursor-pointer transition-colors"
                onClick={() => toggleStatus(option.value)}
              >
                <Checkbox
                  checked={selectedStatus.includes(option.value)}
                  onCheckedChange={() => toggleStatus(option.value)}
                />
                <span className="text-sm">{option.label}</span>
              </div>
            ))}
          </div>
        </div>

      </CardContent>
    </Card>
  );
}
