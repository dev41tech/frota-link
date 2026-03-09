import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { useMultiTenant } from "@/hooks/useMultiTenant";
import { Truck, Container, Circle, AlertTriangle, CheckCircle } from "lucide-react";
import { getTruckPositions, getTrailerPositions, inferAxleConfig, inferTrailerAxles, TirePosition } from "@/lib/vehicleUtils";
import { cn } from "@/lib/utils";

interface TireData {
  id: string;
  current_position: string;
  brand: string | null;
  model: string | null;
  size: string | null;
  serial_number: string;
  installation_km: number | null;
  total_km: number | null;
  alert_rotation_km: number | null;
  alert_replacement_km: number | null;
  tread_depth_mm: number | null;
}

interface VehicleInfo {
  id: string;
  plate: string;
  model: string;
  vehicle_type: string;
  axle_count: number | null;
  trailer_type: string | null;
}

interface TrailerInfo {
  id: string;
  plate: string;
  model: string;
  axleCount: number;
  tires: TireData[];
}

interface TireInstallationDiagramProps {
  vehicleId: string;
}

interface TireSlotProps {
  position: TirePosition;
  tire: TireData | null;
  currentKm: number;
  size?: "normal" | "small";
}

function TireSlot({ position, tire, currentKm, size = "normal" }: TireSlotProps) {
  const sizeClasses = size === "small" ? "w-10 h-10" : "w-12 h-12";
  const textSize = size === "small" ? "text-[8px]" : "text-[10px]";
  
  const kmDriven = tire && tire.installation_km ? currentKm - tire.installation_km : 0;
  const needsRotation = tire && tire.alert_rotation_km && kmDriven >= tire.alert_rotation_km;
  const needsReplacement = tire && tire.alert_replacement_km && kmDriven >= tire.alert_replacement_km;
  
  const getStatusColor = () => {
    if (!tire) return "bg-muted border-dashed border-muted-foreground/30";
    if (needsReplacement) return "bg-destructive/20 border-destructive";
    if (needsRotation) return "bg-yellow-500/20 border-yellow-500";
    return "bg-primary/20 border-primary";
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={cn(
            sizeClasses,
            "rounded-full border-4 flex flex-col items-center justify-center cursor-pointer transition-all hover:scale-105",
            getStatusColor()
          )}
        >
          {tire ? (
            <>
              <span className={cn(textSize, "font-bold truncate max-w-[90%]")}>
                {position.shortLabel}
              </span>
              {needsReplacement && <AlertTriangle className="w-3 h-3 text-destructive" />}
              {needsRotation && !needsReplacement && <AlertTriangle className="w-3 h-3 text-yellow-500" />}
            </>
          ) : (
            <>
              <Circle className="w-4 h-4 text-muted-foreground/50" />
              <span className={cn(textSize, "text-muted-foreground/50")}>{position.shortLabel}</span>
            </>
          )}
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs">
        <div className="space-y-1">
          <p className="font-semibold">{position.label}</p>
          {tire ? (
            <>
              <p className="text-sm">
                <span className="font-medium">{tire.brand || 'N/A'}</span> {tire.model || ''}
              </p>
              <p className="text-xs text-muted-foreground">
                Tamanho: {tire.size || 'N/A'} • SN: {tire.serial_number}
              </p>
              <p className="text-xs text-muted-foreground">
                Instalado em: {tire.installation_km?.toLocaleString('pt-BR') || 0} km
              </p>
              <p className="text-xs font-medium">
                KM Rodados: {kmDriven.toLocaleString('pt-BR')} km
              </p>
              {tire.tread_depth_mm && (
                <p className="text-xs text-muted-foreground">
                  Sulco: {tire.tread_depth_mm} mm
                </p>
              )}
              {needsReplacement && (
                <Badge variant="destructive" className="text-xs mt-1">Troca necessária</Badge>
              )}
              {needsRotation && !needsReplacement && (
                <Badge variant="outline" className="text-xs mt-1 border-yellow-500 text-yellow-600">Rodízio</Badge>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Posição vazia</p>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

function VehicleDiagram({ 
  positions, 
  tires, 
  currentKm,
  vehicleType,
  plate,
  axleCount
}: { 
  positions: TirePosition[];
  tires: TireData[];
  currentKm: number;
  vehicleType: 'truck' | 'trailer' | 'rigid';
  plate?: string;
  axleCount: number;
}) {
  const getTire = (positionId: string) => tires.find(t => t.current_position === positionId) || null;
  
  const frontAxle = positions.filter(p => p.axle === 1);
  const rearAxles = positions.filter(p => p.axle > 0 && p.axle !== 1);
  const spare = positions.find(p => p.id === 'ESP');
  
  // Group rear axles
  const axleGroups: Record<number, TirePosition[]> = {};
  rearAxles.forEach(p => {
    if (!axleGroups[p.axle]) axleGroups[p.axle] = [];
    axleGroups[p.axle].push(p);
  });

  const isTruck = vehicleType === 'truck' || vehicleType === 'rigid';

  return (
    <div className="w-full max-w-[320px] mx-auto">
      <div className="relative bg-muted/50 rounded-xl border-2 border-border p-4">
        {isTruck ? (
          <>
            {/* Cabine do Caminhão */}
            <div className="relative bg-slate-200 dark:bg-slate-700 rounded-t-2xl border-2 border-slate-300 dark:border-slate-600 p-4 mb-2">
              <div className="absolute top-1 left-1/2 -translate-x-1/2 text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <Truck className="w-3 h-3" />
                {plate || 'Cabine'}
              </div>
              
              {/* Eixo Dianteiro */}
              <div className="flex justify-between items-center pt-4">
                <div className="flex items-center gap-1">
                  {frontAxle.filter(p => p.side === 'left').map(pos => (
                    <TireSlot key={pos.id} position={pos} tire={getTire(pos.id)} currentKm={currentKm} />
                  ))}
                </div>
                <div className="flex-1 h-1.5 bg-slate-400 dark:bg-slate-500 mx-2 rounded-full" />
                <div className="flex items-center gap-1">
                  {frontAxle.filter(p => p.side === 'right').map(pos => (
                    <TireSlot key={pos.id} position={pos} tire={getTire(pos.id)} currentKm={currentKm} />
                  ))}
                </div>
              </div>
            </div>

            {/* Chassi */}
            <div className="relative bg-slate-100 dark:bg-slate-800 rounded-b-lg border-2 border-t-0 border-slate-300 dark:border-slate-600 p-4 pt-6">
              <div className="absolute top-1 left-1/2 -translate-x-1/2 text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Chassi ({axleCount} eixos)
              </div>

              <div className="space-y-3 mb-4">
                {Object.entries(axleGroups).sort(([a], [b]) => Number(a) - Number(b)).map(([axle, axlePositions]) => (
                  <div key={axle} className="flex justify-between items-center">
                    <div className="flex items-center gap-1">
                      {axlePositions
                        .filter(p => p.side === 'left')
                        .sort((a, b) => (a.isInner ? 0 : 1) - (b.isInner ? 0 : 1))
                        .map(pos => (
                          <TireSlot key={pos.id} position={pos} tire={getTire(pos.id)} currentKm={currentKm} size="small" />
                        ))}
                    </div>
                    <div className="flex-1 h-1.5 bg-slate-400 dark:bg-slate-500 mx-2 rounded-full" />
                    <div className="flex items-center gap-1">
                      {axlePositions
                        .filter(p => p.side === 'right')
                        .sort((a, b) => (a.isInner ? 0 : 1) - (b.isInner ? 0 : 1))
                        .map(pos => (
                          <TireSlot key={pos.id} position={pos} tire={getTire(pos.id)} currentKm={currentKm} size="small" />
                        ))}
                    </div>
                  </div>
                ))}
              </div>

              {spare && (
                <div className="flex flex-col items-center">
                  <div className="text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                    Estepe
                  </div>
                  <TireSlot position={spare} tire={getTire(spare.id)} currentKm={currentKm} size="small" />
                </div>
              )}
            </div>
          </>
        ) : (
          <>
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

              <div className="space-y-3 mb-4">
                {Object.entries(axleGroups).sort(([a], [b]) => Number(a) - Number(b)).map(([axle, axlePositions]) => (
                  <div key={axle} className="flex justify-between items-center">
                    <div className="flex items-center gap-1">
                      {axlePositions
                        .filter(p => p.side === 'left')
                        .sort((a, b) => (a.isInner ? 0 : 1) - (b.isInner ? 0 : 1))
                        .map(pos => (
                          <TireSlot key={pos.id} position={pos} tire={getTire(pos.id)} currentKm={currentKm} size="small" />
                        ))}
                    </div>
                    <div className="flex-1 h-1.5 bg-slate-400 dark:bg-slate-500 mx-2 rounded-full" />
                    <div className="flex items-center gap-1">
                      {axlePositions
                        .filter(p => p.side === 'right')
                        .sort((a, b) => (a.isInner ? 0 : 1) - (b.isInner ? 0 : 1))
                        .map(pos => (
                          <TireSlot key={pos.id} position={pos} tire={getTire(pos.id)} currentKm={currentKm} size="small" />
                        ))}
                    </div>
                  </div>
                ))}
              </div>

              {spare && (
                <div className="flex flex-col items-center">
                  <div className="text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                    Estepe
                  </div>
                  <TireSlot position={spare} tire={getTire(spare.id)} currentKm={currentKm} size="small" />
                </div>
              )}
            </div>
          </>
        )}

        {/* Front indicator */}
        <div className="absolute -top-2 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-[10px] font-bold px-2 py-0.5 rounded-full">
          FRENTE ▲
        </div>
      </div>
    </div>
  );
}

export function TireInstallationDiagram({ vehicleId }: TireInstallationDiagramProps) {
  const { currentCompany } = useMultiTenant();
  const [loading, setLoading] = useState(true);
  const [vehicle, setVehicle] = useState<VehicleInfo | null>(null);
  const [tires, setTires] = useState<TireData[]>([]);
  const [trailers, setTrailers] = useState<TrailerInfo[]>([]);
  const [currentKm, setCurrentKm] = useState(0);

  useEffect(() => {
    const fetchData = async () => {
      if (!currentCompany?.id || !vehicleId) return;
      setLoading(true);

      try {
        // Fetch vehicle info
        const { data: vehicleData } = await supabase
          .from("vehicles")
          .select("id, plate, model, vehicle_type, axle_count, trailer_type")
          .eq("id", vehicleId)
          .single();

        if (!vehicleData) return;
        setVehicle(vehicleData as VehicleInfo);

        // Fetch tires for this vehicle
        const { data: tiresData } = await supabase
          .from("tire_assets")
          .select("id, current_position, brand, model, size, serial_number, installation_km, total_km, alert_rotation_km, alert_replacement_km, tread_depth_mm")
          .eq("current_vehicle_id", vehicleId)
          .eq("company_id", currentCompany.id)
          .eq("status", "installed");

        if (tiresData) setTires(tiresData as TireData[]);

        // Fetch current KM from fuel expenses
        const { data: fuelData } = await supabase
          .from("fuel_expenses")
          .select("odometer")
          .eq("vehicle_id", vehicleId)
          .eq("company_id", currentCompany.id)
          .order("date", { ascending: false })
          .limit(1)
          .single();

        if (fuelData?.odometer) {
          setCurrentKm(fuelData.odometer);
        }

        // If truck, check for coupled trailers
        if (vehicleData.vehicle_type === 'truck') {
          const { data: couplingData } = await supabase
            .from("vehicle_couplings")
            .select(`
              id,
              vehicle_coupling_items(trailer_id)
            `)
            .eq("truck_id", vehicleId)
            .is("decoupled_at", null)
            .single();

          if (couplingData?.vehicle_coupling_items) {
            const trailerIds = couplingData.vehicle_coupling_items.map((item: any) => item.trailer_id);

            if (trailerIds.length > 0) {
              const { data: trailerData } = await supabase
                .from("vehicles")
                .select("id, plate, model, axle_count, trailer_type")
                .in("id", trailerIds);

              if (trailerData) {
                const trailerInfos: TrailerInfo[] = [];
                
                for (const t of trailerData) {
                  const { data: trailerTires } = await supabase
                    .from("tire_assets")
                    .select("id, current_position, brand, model, size, serial_number, installation_km, total_km, alert_rotation_km, alert_replacement_km, tread_depth_mm")
                    .eq("current_vehicle_id", t.id)
                    .eq("company_id", currentCompany.id)
                    .eq("status", "installed");

                  trailerInfos.push({
                    id: t.id,
                    plate: t.plate,
                    model: t.model,
                    axleCount: t.axle_count || inferTrailerAxles(t.trailer_type, t.model),
                    tires: (trailerTires as TireData[]) || [],
                  });
                }
                setTrailers(trailerInfos);
              }
            }
          }
        }
      } catch (error) {
        console.error("Error fetching tire data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [vehicleId, currentCompany?.id]);

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">
          Carregando...
        </CardContent>
      </Card>
    );
  }

  if (!vehicle) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">
          Veículo não encontrado
        </CardContent>
      </Card>
    );
  }

  const vehicleType = (vehicle.vehicle_type || 'truck') as 'truck' | 'trailer' | 'rigid';
  const axleCount = vehicle.axle_count || (vehicleType === 'trailer' 
    ? inferTrailerAxles(vehicle.trailer_type, vehicle.model) 
    : inferAxleConfig(vehicle.model).totalAxles);

  const positions = vehicleType === 'trailer' 
    ? getTrailerPositions(axleCount)
    : getTruckPositions(axleCount);

  const totalPositions = positions.length;
  const installedCount = tires.length;
  const emptyCount = totalPositions - installedCount;

  const hasTrailers = trailers.length > 0;

  return (
    <TooltipProvider delayDuration={200}>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              {vehicleType === 'trailer' ? (
                <Container className="h-5 w-5 text-orange-500" />
              ) : (
                <Truck className="h-5 w-5" />
              )}
              Pneus Instalados - {vehicle.plate}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                {installedCount}/{totalPositions} posições
              </Badge>
              {currentKm > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {currentKm.toLocaleString('pt-BR')} km
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Legend */}
          <div className="flex flex-wrap justify-center gap-4 text-xs mb-4">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-primary/20 border-2 border-primary" />
              <span className="text-muted-foreground">Instalado (OK)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-yellow-500/20 border-2 border-yellow-500" />
              <span className="text-muted-foreground">Rodízio</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-destructive/20 border-2 border-destructive" />
              <span className="text-muted-foreground">Troca</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-muted border-2 border-dashed border-muted-foreground/30" />
              <span className="text-muted-foreground">Vazio</span>
            </div>
          </div>

          {hasTrailers ? (
            <Tabs defaultValue="truck" className="w-full">
              <TabsList className="grid w-full mb-4" style={{ gridTemplateColumns: `repeat(${1 + trailers.length}, 1fr)` }}>
                <TabsTrigger value="truck" className="flex items-center gap-1">
                  <Truck className="h-3 w-3" />
                  <span className="truncate text-xs">{vehicle.plate}</span>
                </TabsTrigger>
                {trailers.map((trailer) => (
                  <TabsTrigger key={trailer.id} value={trailer.id} className="flex items-center gap-1">
                    <Container className="h-3 w-3" />
                    <span className="truncate text-xs">{trailer.plate}</span>
                  </TabsTrigger>
                ))}
              </TabsList>

              <TabsContent value="truck">
                <VehicleDiagram
                  positions={positions}
                  tires={tires}
                  currentKm={currentKm}
                  vehicleType={vehicleType}
                  plate={vehicle.plate}
                  axleCount={axleCount}
                />
              </TabsContent>

              {trailers.map(trailer => {
                const trailerPositions = getTrailerPositions(trailer.axleCount);
                return (
                  <TabsContent key={trailer.id} value={trailer.id}>
                    <VehicleDiagram
                      positions={trailerPositions}
                      tires={trailer.tires}
                      currentKm={currentKm}
                      vehicleType="trailer"
                      plate={trailer.plate}
                      axleCount={trailer.axleCount}
                    />
                  </TabsContent>
                );
              })}
            </Tabs>
          ) : (
            <VehicleDiagram
              positions={positions}
              tires={tires}
              currentKm={currentKm}
              vehicleType={vehicleType}
              plate={vehicle.plate}
              axleCount={axleCount}
            />
          )}

          {/* Summary table */}
          {tires.length > 0 && (
            <div className="mt-6 border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-2 font-medium">Posição</th>
                    <th className="text-left p-2 font-medium">Marca/Modelo</th>
                    <th className="text-left p-2 font-medium">Série</th>
                    <th className="text-right p-2 font-medium">KM Inst.</th>
                    <th className="text-right p-2 font-medium">KM Rodados</th>
                  </tr>
                </thead>
                <tbody>
                  {tires.map((tire) => {
                    const kmDriven = tire.installation_km ? currentKm - tire.installation_km : 0;
                    const needsRotation = tire.alert_rotation_km && kmDriven >= tire.alert_rotation_km;
                    const needsReplacement = tire.alert_replacement_km && kmDriven >= tire.alert_replacement_km;
                    
                    return (
                      <tr key={tire.id} className="border-t">
                        <td className="p-2 font-medium">{tire.current_position}</td>
                        <td className="p-2">{tire.brand || 'N/A'} {tire.model || ''}</td>
                        <td className="p-2 text-muted-foreground">{tire.serial_number}</td>
                        <td className="p-2 text-right">{tire.installation_km?.toLocaleString('pt-BR') || '-'}</td>
                        <td className="p-2 text-right">
                          <span className={cn(
                            needsReplacement && "text-destructive font-medium",
                            needsRotation && !needsReplacement && "text-yellow-600 font-medium"
                          )}>
                            {kmDriven.toLocaleString('pt-BR')}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}
