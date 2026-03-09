import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Truck, Container } from "lucide-react";
import { getTruckPositions, getTrailerPositions, TirePosition } from "@/lib/vehicleUtils";

interface OccupiedPosition {
  position: string;
  tireBrand?: string;
  tireModel?: string;
}

interface TrailerInfo {
  id: string;
  plate: string;
  model?: string;
  axleCount: number;
}

interface TirePositionSelectorProps {
  value: string;
  onChange: (position: string, vehicleId?: string) => void;
  occupiedPositions?: OccupiedPosition[];
  disabled?: boolean;
  vehicleType?: 'truck' | 'trailer' | 'rigid';
  axleCount?: number;
  trailers?: TrailerInfo[];
  trailerOccupiedPositions?: Record<string, OccupiedPosition[]>;
  selectedVehicleId?: string;
}

interface TireButtonProps {
  position: TirePosition;
  isSelected: boolean;
  isOccupied: boolean;
  occupiedInfo?: { tireBrand?: string; tireModel?: string };
  onClick: () => void;
  disabled?: boolean;
  size?: "normal" | "small";
}

function TireButton({ position, isSelected, isOccupied, occupiedInfo, onClick, disabled, size = "normal" }: TireButtonProps) {
  const sizeClasses = size === "small" ? "w-8 h-8 text-[10px]" : "w-10 h-10 text-xs";
  
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onClick}
          disabled={disabled || isOccupied}
          className={cn(
            sizeClasses,
            "rounded-full border-4 font-bold transition-all duration-200 flex items-center justify-center",
            "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
            isSelected && "bg-primary border-primary text-primary-foreground scale-110 shadow-lg",
            !isSelected && !isOccupied && "bg-slate-700 border-slate-500 text-slate-300 hover:border-primary hover:scale-105",
            isOccupied && "bg-slate-400 border-slate-300 text-slate-500 cursor-not-allowed opacity-60",
            disabled && "cursor-not-allowed opacity-50"
          )}
          aria-label={position.label}
        >
          {position.shortLabel}
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="bg-popover text-popover-foreground">
        <p className="font-medium">{position.label}</p>
        {isOccupied && occupiedInfo && (
          <p className="text-xs text-muted-foreground">
            Ocupado: {occupiedInfo.tireBrand} {occupiedInfo.tireModel}
          </p>
        )}
        {isOccupied && !occupiedInfo && (
          <p className="text-xs text-muted-foreground">Posição já ocupada</p>
        )}
      </TooltipContent>
    </Tooltip>
  );
}

function TruckDiagram({ 
  positions, 
  value, 
  onChange, 
  occupiedPositions = [], 
  disabled,
  axleCount = 2
}: { 
  positions: TirePosition[];
  value: string;
  onChange: (pos: string) => void;
  occupiedPositions?: OccupiedPosition[];
  disabled?: boolean;
  axleCount?: number;
}) {
  const isOccupied = (id: string) => occupiedPositions.some(p => p.position === id);
  const getOccupiedInfo = (id: string) => occupiedPositions.find(p => p.position === id);
  const getPosition = (id: string) => positions.find(p => p.id === id);
  
  const frontAxle = positions.filter(p => p.axle === 1);
  const rearAxles = positions.filter(p => p.axle > 1);
  const spare = positions.find(p => p.id === 'ESP');
  
  // Group rear axles
  const axleGroups: Record<number, TirePosition[]> = {};
  rearAxles.forEach(p => {
    if (!axleGroups[p.axle]) axleGroups[p.axle] = [];
    axleGroups[p.axle].push(p);
  });

  return (
    <div className="w-full max-w-[280px] mx-auto">
      {/* Diagrama do Caminhão */}
      <div className="relative bg-muted/50 rounded-xl border-2 border-border p-4">
        {/* Cabine */}
        <div className="relative bg-slate-200 dark:bg-slate-700 rounded-t-2xl border-2 border-slate-300 dark:border-slate-600 p-4 mb-2">
          <div className="absolute top-1 left-1/2 -translate-x-1/2 text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Cabine
          </div>
          
          {/* Eixo Dianteiro */}
          <div className="flex justify-between items-center pt-4">
            {frontAxle.filter(p => p.side === 'left').map(pos => (
              <TireButton
                key={pos.id}
                position={pos}
                isSelected={value === pos.id}
                isOccupied={isOccupied(pos.id)}
                occupiedInfo={getOccupiedInfo(pos.id)}
                onClick={() => onChange(pos.id)}
                disabled={disabled}
              />
            ))}
            
            {/* Eixo visual */}
            <div className="flex-1 h-1.5 bg-slate-400 dark:bg-slate-500 mx-2 rounded-full" />
            
            {frontAxle.filter(p => p.side === 'right').map(pos => (
              <TireButton
                key={pos.id}
                position={pos}
                isSelected={value === pos.id}
                isOccupied={isOccupied(pos.id)}
                occupiedInfo={getOccupiedInfo(pos.id)}
                onClick={() => onChange(pos.id)}
                disabled={disabled}
              />
            ))}
          </div>
        </div>

        {/* Chassi / Carroceria */}
        <div className="relative bg-slate-100 dark:bg-slate-800 rounded-b-lg border-2 border-t-0 border-slate-300 dark:border-slate-600 p-4 pt-6">
          <div className="absolute top-1 left-1/2 -translate-x-1/2 text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Chassi ({axleCount} eixos)
          </div>

          {/* Eixos Traseiros */}
          <div className="space-y-4 mb-6">
            {Object.entries(axleGroups).sort(([a], [b]) => Number(a) - Number(b)).map(([axle, axlePositions]) => (
              <div key={axle} className="flex justify-between items-center">
                {/* Lado Esquerdo - Rodas Duplas */}
                <div className="flex items-center gap-1">
                  {axlePositions
                    .filter(p => p.side === 'left')
                    .sort((a, b) => (a.isInner ? 0 : 1) - (b.isInner ? 0 : 1))
                    .map(pos => (
                      <TireButton
                        key={pos.id}
                        position={pos}
                        isSelected={value === pos.id}
                        isOccupied={isOccupied(pos.id)}
                        occupiedInfo={getOccupiedInfo(pos.id)}
                        onClick={() => onChange(pos.id)}
                        disabled={disabled}
                        size="small"
                      />
                    ))}
                </div>

                {/* Eixo visual */}
                <div className="flex-1 h-1.5 bg-slate-400 dark:bg-slate-500 mx-2 rounded-full" />

                {/* Lado Direito - Rodas Duplas */}
                <div className="flex items-center gap-1">
                  {axlePositions
                    .filter(p => p.side === 'right')
                    .sort((a, b) => (a.isInner ? 0 : 1) - (b.isInner ? 0 : 1))
                    .map(pos => (
                      <TireButton
                        key={pos.id}
                        position={pos}
                        isSelected={value === pos.id}
                        isOccupied={isOccupied(pos.id)}
                        occupiedInfo={getOccupiedInfo(pos.id)}
                        onClick={() => onChange(pos.id)}
                        disabled={disabled}
                        size="small"
                      />
                    ))}
                </div>
              </div>
            ))}
          </div>

          {/* Estepe */}
          {spare && (
            <div className="flex flex-col items-center">
              <div className="text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                Estepe
              </div>
              <TireButton
                position={spare}
                isSelected={value === spare.id}
                isOccupied={isOccupied(spare.id)}
                occupiedInfo={getOccupiedInfo(spare.id)}
                onClick={() => onChange(spare.id)}
                disabled={disabled}
              />
            </div>
          )}
        </div>

        {/* Indicador de frente */}
        <div className="absolute -top-2 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-[10px] font-bold px-2 py-0.5 rounded-full">
          FRENTE ▲
        </div>
      </div>
    </div>
  );
}

function TrailerDiagram({ 
  positions, 
  value, 
  onChange, 
  occupiedPositions = [], 
  disabled,
  plate
}: { 
  positions: TirePosition[];
  value: string;
  onChange: (pos: string) => void;
  occupiedPositions?: OccupiedPosition[];
  disabled?: boolean;
  plate?: string;
}) {
  const isOccupied = (id: string) => occupiedPositions.some(p => p.position === id);
  const getOccupiedInfo = (id: string) => occupiedPositions.find(p => p.position === id);
  
  const axlePositions = positions.filter(p => p.axle > 0);
  const spare = positions.find(p => p.id === 'ESP');
  
  // Group by axle
  const axleGroups: Record<number, TirePosition[]> = {};
  axlePositions.forEach(p => {
    if (!axleGroups[p.axle]) axleGroups[p.axle] = [];
    axleGroups[p.axle].push(p);
  });
  
  const axleCount = Object.keys(axleGroups).length;

  return (
    <div className="w-full max-w-[280px] mx-auto">
      {/* Diagrama da Carreta */}
      <div className="relative bg-muted/50 rounded-xl border-2 border-border p-4">
        {/* Corpo da Carreta */}
        <div className="relative bg-orange-100 dark:bg-orange-900/30 rounded-t-lg border-2 border-orange-300 dark:border-orange-700 p-4 mb-2">
          <div className="absolute top-1 left-1/2 -translate-x-1/2 text-[10px] font-medium text-orange-600 dark:text-orange-400 uppercase tracking-wider flex items-center gap-1">
            <Container className="w-3 h-3" />
            {plate || 'Carreta'}
          </div>
          <div className="h-8" />
        </div>

        {/* Chassi da Carreta */}
        <div className="relative bg-slate-100 dark:bg-slate-800 rounded-b-lg border-2 border-t-0 border-slate-300 dark:border-slate-600 p-4 pt-6">
          <div className="absolute top-1 left-1/2 -translate-x-1/2 text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            {axleCount} eixos
          </div>

          {/* Eixos */}
          <div className="space-y-4 mb-6">
            {Object.entries(axleGroups).sort(([a], [b]) => Number(a) - Number(b)).map(([axle, axlePos]) => (
              <div key={axle} className="flex justify-between items-center">
                {/* Lado Esquerdo */}
                <div className="flex items-center gap-1">
                  {axlePos
                    .filter(p => p.side === 'left')
                    .sort((a, b) => (a.isInner ? 0 : 1) - (b.isInner ? 0 : 1))
                    .map(pos => (
                      <TireButton
                        key={pos.id}
                        position={pos}
                        isSelected={value === pos.id}
                        isOccupied={isOccupied(pos.id)}
                        occupiedInfo={getOccupiedInfo(pos.id)}
                        onClick={() => onChange(pos.id)}
                        disabled={disabled}
                        size="small"
                      />
                    ))}
                </div>

                {/* Eixo visual */}
                <div className="flex-1 h-1.5 bg-slate-400 dark:bg-slate-500 mx-2 rounded-full" />

                {/* Lado Direito */}
                <div className="flex items-center gap-1">
                  {axlePos
                    .filter(p => p.side === 'right')
                    .sort((a, b) => (a.isInner ? 0 : 1) - (b.isInner ? 0 : 1))
                    .map(pos => (
                      <TireButton
                        key={pos.id}
                        position={pos}
                        isSelected={value === pos.id}
                        isOccupied={isOccupied(pos.id)}
                        occupiedInfo={getOccupiedInfo(pos.id)}
                        onClick={() => onChange(pos.id)}
                        disabled={disabled}
                        size="small"
                      />
                    ))}
                </div>
              </div>
            ))}
          </div>

          {/* Estepe */}
          {spare && (
            <div className="flex flex-col items-center">
              <div className="text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                Estepe
              </div>
              <TireButton
                position={spare}
                isSelected={value === spare.id}
                isOccupied={isOccupied(spare.id)}
                occupiedInfo={getOccupiedInfo(spare.id)}
                onClick={() => onChange(spare.id)}
                disabled={disabled}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function TirePositionSelector({ 
  value, 
  onChange, 
  occupiedPositions = [], 
  disabled,
  vehicleType = 'truck',
  axleCount,
  trailers = [],
  trailerOccupiedPositions = {},
  selectedVehicleId
}: TirePositionSelectorProps) {
  // Determine effective axle count
  const effectiveAxleCount = axleCount || (vehicleType === 'trailer' ? 3 : 2);
  
  // Get positions based on vehicle type
  const positions = vehicleType === 'trailer' 
    ? getTrailerPositions(effectiveAxleCount)
    : getTruckPositions(effectiveAxleCount);

  // If we have trailers attached, show tabs
  const hasTrailers = trailers.length > 0;

  const handlePositionChange = (position: string, vehicleId?: string) => {
    onChange(position, vehicleId);
  };
  
  const getPositionLabel = (posId: string) => {
    const allPositions = vehicleType === 'trailer' 
      ? getTrailerPositions(effectiveAxleCount)
      : getTruckPositions(effectiveAxleCount);
    return allPositions.find(p => p.id === posId)?.label || posId;
  };

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-4">
        {/* Legenda */}
        <div className="flex justify-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-primary border-2 border-primary" />
            <span className="text-muted-foreground">Selecionado</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-slate-700 border-2 border-slate-500" />
            <span className="text-muted-foreground">Disponível</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-slate-400 border-2 border-slate-300 opacity-60" />
            <span className="text-muted-foreground">Ocupado</span>
          </div>
        </div>

        {hasTrailers ? (
          <Tabs defaultValue="truck" className="w-full">
            <TabsList className="grid w-full" style={{ gridTemplateColumns: `repeat(${1 + trailers.length}, 1fr)` }}>
              <TabsTrigger value="truck" className="flex items-center gap-1">
                <Truck className="h-3 w-3" />
                <span className="truncate text-xs">Cavalo</span>
              </TabsTrigger>
              {trailers.map((trailer) => (
                <TabsTrigger key={trailer.id} value={trailer.id} className="flex items-center gap-1">
                  <Container className="h-3 w-3" />
                  <span className="truncate text-xs">{trailer.plate}</span>
                </TabsTrigger>
              ))}
            </TabsList>
            
            <TabsContent value="truck" className="mt-4">
              <TruckDiagram
                positions={positions}
                value={selectedVehicleId === undefined || selectedVehicleId === 'truck' ? value : ''}
                onChange={(pos) => handlePositionChange(pos, undefined)}
                occupiedPositions={occupiedPositions}
                disabled={disabled}
                axleCount={effectiveAxleCount}
              />
            </TabsContent>
            
            {trailers.map(trailer => {
              const trailerPositions = getTrailerPositions(trailer.axleCount || 3);
              const trailerOccupied = trailerOccupiedPositions[trailer.id] || [];
              
              return (
                <TabsContent key={trailer.id} value={trailer.id} className="mt-4">
                  <TrailerDiagram
                    positions={trailerPositions}
                    value={selectedVehicleId === trailer.id ? value : ''}
                    onChange={(pos) => handlePositionChange(pos, trailer.id)}
                    occupiedPositions={trailerOccupied}
                    disabled={disabled}
                    plate={trailer.plate}
                  />
                </TabsContent>
              );
            })}
          </Tabs>
        ) : vehicleType === 'trailer' ? (
          <TrailerDiagram
            positions={positions}
            value={value}
            onChange={(pos) => handlePositionChange(pos)}
            occupiedPositions={occupiedPositions}
            disabled={disabled}
          />
        ) : (
          <TruckDiagram
            positions={positions}
            value={value}
            onChange={(pos) => handlePositionChange(pos)}
            occupiedPositions={occupiedPositions}
            disabled={disabled}
            axleCount={effectiveAxleCount}
          />
        )}

        {/* Posição selecionada */}
        {value && (
          <div className="mt-3 text-center">
            <span className="text-sm text-muted-foreground">Posição selecionada: </span>
            <span className="text-sm font-medium text-foreground">
              {getPositionLabel(value)}
            </span>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
