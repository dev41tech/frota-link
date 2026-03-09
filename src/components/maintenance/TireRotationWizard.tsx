import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { useMultiTenant } from "@/hooks/useMultiTenant";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Loader2, Truck, Container, Circle, ArrowLeftRight, Undo2, GripVertical } from "lucide-react";
import { getTruckPositions, getTrailerPositions, inferAxleConfig, inferTrailerAxles, TirePosition } from "@/lib/vehicleUtils";
import { cn } from "@/lib/utils";

interface TireData {
  id: string;
  current_position: string;
  brand: string | null;
  model: string | null;
  serial_number: string;
  size: string | null;
  installation_km: number | null;
}

interface PendingMove {
  tireId: string;
  fromPosition: string;
  toPosition: string;
}

interface TireRotationWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vehicleId: string;
  vehiclePlate: string;
  onSuccess: () => void;
}

export function TireRotationWizard({ open, onOpenChange, vehicleId, vehiclePlate, onSuccess }: TireRotationWizardProps) {
  const { user } = useAuth();
  const { currentCompany } = useMultiTenant();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tires, setTires] = useState<TireData[]>([]);
  const [positions, setPositions] = useState<TirePosition[]>([]);
  const [vehicleType, setVehicleType] = useState<"truck" | "trailer" | "rigid">("truck");
  const [axleCount, setAxleCount] = useState(2);
  const [currentKm, setCurrentKm] = useState(0);
  const [pendingMoves, setPendingMoves] = useState<PendingMove[]>([]);
  const [dragSource, setDragSource] = useState<{ tireId: string; position: string } | null>(null);
  const [dragOverTarget, setDragOverTarget] = useState<string | null>(null);

  useEffect(() => {
    if (open && vehicleId && currentCompany?.id) {
      fetchData();
      setPendingMoves([]);
    }
  }, [open, vehicleId, currentCompany?.id]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [vehicleRes, tiresRes, fuelRes] = await Promise.all([
        supabase.from("vehicles").select("id, plate, model, vehicle_type, axle_count, trailer_type").eq("id", vehicleId).single(),
        supabase.from("tire_assets").select("id, current_position, brand, model, serial_number, size, installation_km").eq("current_vehicle_id", vehicleId).eq("company_id", currentCompany!.id).eq("status", "installed"),
        supabase.from("fuel_expenses").select("odometer").eq("vehicle_id", vehicleId).order("date", { ascending: false }).limit(1).single(),
      ]);

      if (vehicleRes.data) {
        const v = vehicleRes.data;
        const vType = (v.vehicle_type || "truck") as "truck" | "trailer" | "rigid";
        setVehicleType(vType);
        const ac = v.axle_count || (vType === "trailer" ? inferTrailerAxles(v.trailer_type, v.model) : inferAxleConfig(v.model).totalAxles);
        setAxleCount(ac);
        setPositions(vType === "trailer" ? getTrailerPositions(ac) : getTruckPositions(ac));
      }
      if (tiresRes.data) setTires(tiresRes.data as TireData[]);
      if (fuelRes.data?.odometer) setCurrentKm(fuelRes.data.odometer);
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  };

  // Compute current tire positions after applying pending moves
  const getCurrentPosition = useCallback((tireId: string): string | null => {
    let pos: string | null = tires.find(t => t.id === tireId)?.current_position || null;
    for (const move of pendingMoves) {
      if (move.tireId === tireId) pos = move.toPosition;
    }
    return pos;
  }, [tires, pendingMoves]);

  const getTireAtPosition = useCallback((positionId: string): TireData | null => {
    // Find which tire is currently at this position after moves
    for (const tire of tires) {
      if (getCurrentPosition(tire.id) === positionId) return tire;
    }
    return null;
  }, [tires, getCurrentPosition]);

  const isMoved = useCallback((tireId: string): boolean => {
    return pendingMoves.some(m => m.tireId === tireId);
  }, [pendingMoves]);

  const handleDragStart = (e: React.DragEvent, tireId: string, position: string) => {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", tireId);
    setDragSource({ tireId, position });
  };

  const handleDragOver = (e: React.DragEvent, positionId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverTarget(positionId);
  };

  const handleDragLeave = () => {
    setDragOverTarget(null);
  };

  const handleDrop = (e: React.DragEvent, targetPositionId: string) => {
    e.preventDefault();
    setDragOverTarget(null);
    if (!dragSource) return;

    const sourcePosition = dragSource.position;
    if (sourcePosition === targetPositionId) {
      setDragSource(null);
      return;
    }

    const sourceTireId = dragSource.tireId;
    const targetTire = getTireAtPosition(targetPositionId);

    // Remove any previous moves for these tires
    const newMoves = pendingMoves.filter(m => m.tireId !== sourceTireId && (targetTire ? m.tireId !== targetTire.id : true));

    // Source tire original position
    const sourceTireOriginal = tires.find(t => t.id === sourceTireId)?.current_position || sourcePosition;

    // Add move for source tire
    if (sourceTireOriginal !== targetPositionId) {
      newMoves.push({ tireId: sourceTireId, fromPosition: sourceTireOriginal, toPosition: targetPositionId });
    }

    // If target had a tire, swap it to source position
    if (targetTire) {
      const targetTireOriginal = tires.find(t => t.id === targetTire.id)?.current_position || targetPositionId;
      if (targetTireOriginal !== sourcePosition) {
        newMoves.push({ tireId: targetTire.id, fromPosition: targetTireOriginal, toPosition: sourcePosition });
      }
    }

    setPendingMoves(newMoves);
    setDragSource(null);
  };

  const handleConfirm = async () => {
    if (!user || !currentCompany || pendingMoves.length === 0) return;
    setSaving(true);
    try {
      for (const move of pendingMoves) {
        await supabase.from("tire_assets").update({
          current_position: move.toPosition,
          installation_km: currentKm,
        }).eq("id", move.tireId);

        await supabase.from("tire_history").insert({
          company_id: currentCompany.id,
          tire_id: move.tireId,
          vehicle_id: vehicleId,
          vehicle_plate: vehiclePlate,
          action: "rotation",
          position: move.toPosition,
          km_at_action: currentKm,
          km_driven: 0,
          notes: `Rodízio: ${move.fromPosition} → ${move.toPosition}`,
          user_id: user.id,
        });
      }
      toast.success(`Rodízio confirmado! ${pendingMoves.length} pneu(s) movido(s).`);
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error:", error);
      toast.error("Erro ao confirmar rodízio: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  const renderSlot = (position: TirePosition, size: "normal" | "small" = "normal") => {
    const tire = getTireAtPosition(position.id);
    const sizeClasses = size === "small" ? "w-12 h-12" : "w-14 h-14";
    const textSize = size === "small" ? "text-[8px]" : "text-[10px]";
    const moved = tire ? isMoved(tire.id) : false;
    const isOver = dragOverTarget === position.id;

    return (
      <Tooltip key={position.id}>
        <TooltipTrigger asChild>
          <div
            draggable={!!tire}
            onDragStart={tire ? (e) => handleDragStart(e, tire.id, position.id) : undefined}
            onDragOver={(e) => handleDragOver(e, position.id)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, position.id)}
            className={cn(
              sizeClasses,
              "rounded-full border-4 flex flex-col items-center justify-center cursor-grab transition-all relative select-none",
              tire ? (moved ? "border-dashed border-blue-500 bg-blue-500/20" : "bg-primary/20 border-primary") : "bg-muted border-dashed border-muted-foreground/30",
              isOver && "ring-2 ring-blue-400 scale-110",
              tire && "active:cursor-grabbing hover:scale-105"
            )}
          >
            {tire ? (
              <>
                <GripVertical className="w-3 h-3 text-muted-foreground/50 absolute -top-0.5" />
                <span className={cn(textSize, "font-bold truncate max-w-[90%]")}>{position.shortLabel}</span>
                {moved && (
                  <Badge className="absolute -bottom-2 text-[7px] px-1 py-0 bg-blue-500 text-white">Movido</Badge>
                )}
              </>
            ) : (
              <>
                <Circle className="w-4 h-4 text-muted-foreground/50" />
                <span className={cn(textSize, "text-muted-foreground/50")}>{position.shortLabel}</span>
              </>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="top">
          <p className="font-semibold">{position.label}</p>
          {tire ? (
            <p className="text-sm">{tire.brand} {tire.model} (SN: {tire.serial_number})</p>
          ) : (
            <p className="text-sm text-muted-foreground">Posição vazia - arraste um pneu aqui</p>
          )}
        </TooltipContent>
      </Tooltip>
    );
  };

  const frontAxle = positions.filter(p => p.axle === 1);
  const rearAxles = positions.filter(p => p.axle > 0 && p.axle !== 1);
  const spare = positions.find(p => p.id === "ESP");
  const axleGroups: Record<number, TirePosition[]> = {};
  rearAxles.forEach(p => {
    if (!axleGroups[p.axle]) axleGroups[p.axle] = [];
    axleGroups[p.axle].push(p);
  });

  const isTruck = vehicleType === "truck" || vehicleType === "rigid";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowLeftRight className="h-5 w-5" />
            Rodízio Visual - {vehiclePlate}
          </DialogTitle>
          <DialogDescription>
            Arraste os pneus entre posições para planejar o rodízio. Confirme quando estiver satisfeito.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : tires.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>Nenhum pneu instalado neste veículo.</p>
          </div>
        ) : (
          <TooltipProvider delayDuration={200}>
            <div className="w-full max-w-[320px] mx-auto">
              <div className="relative bg-muted/50 rounded-xl border-2 border-border p-4">
                {isTruck ? (
                  <>
                    {/* Cabine */}
                    <div className="relative bg-slate-200 dark:bg-slate-700 rounded-t-2xl border-2 border-slate-300 dark:border-slate-600 p-4 mb-2">
                      <div className="absolute top-1 left-1/2 -translate-x-1/2 text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1">
                        <Truck className="w-3 h-3" />
                        {vehiclePlate}
                      </div>
                      <div className="flex justify-between items-center pt-4">
                        <div className="flex items-center gap-1">
                          {frontAxle.filter(p => p.side === "left").map(pos => renderSlot(pos))}
                        </div>
                        <div className="flex-1 h-1.5 bg-slate-400 dark:bg-slate-500 mx-2 rounded-full" />
                        <div className="flex items-center gap-1">
                          {frontAxle.filter(p => p.side === "right").map(pos => renderSlot(pos))}
                        </div>
                      </div>
                    </div>
                    {/* Chassi */}
                    <div className="relative bg-slate-100 dark:bg-slate-800 rounded-b-lg border-2 border-t-0 border-slate-300 dark:border-slate-600 p-4 pt-6">
                      <div className="absolute top-1 left-1/2 -translate-x-1/2 text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        Chassi ({axleCount} eixos)
                      </div>
                      <div className="space-y-3 mb-4">
                        {Object.entries(axleGroups).sort(([a], [b]) => Number(a) - Number(b)).map(([, axlePositions]) => (
                          <div key={axlePositions[0]?.id} className="flex justify-between items-center">
                            <div className="flex items-center gap-1">
                              {axlePositions.filter(p => p.side === "left").sort((a, b) => (a.isInner ? 0 : 1) - (b.isInner ? 0 : 1)).map(pos => renderSlot(pos, "small"))}
                            </div>
                            <div className="flex-1 h-1.5 bg-slate-400 dark:bg-slate-500 mx-2 rounded-full" />
                            <div className="flex items-center gap-1">
                              {axlePositions.filter(p => p.side === "right").sort((a, b) => (a.isInner ? 0 : 1) - (b.isInner ? 0 : 1)).map(pos => renderSlot(pos, "small"))}
                            </div>
                          </div>
                        ))}
                      </div>
                      {spare && (
                        <div className="flex flex-col items-center">
                          <div className="text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Estepe</div>
                          {renderSlot(spare, "small")}
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    {/* Carreta body */}
                    <div className="relative bg-orange-100 dark:bg-orange-900/30 rounded-t-lg border-2 border-orange-300 dark:border-orange-700 p-4 mb-2">
                      <div className="absolute top-1 left-1/2 -translate-x-1/2 text-[10px] font-medium text-orange-600 dark:text-orange-400 uppercase tracking-wider flex items-center gap-1">
                        <Container className="w-3 h-3" />
                        {vehiclePlate}
                      </div>
                      <div className="h-8" />
                    </div>
                    <div className="relative bg-slate-100 dark:bg-slate-800 rounded-b-lg border-2 border-t-0 border-slate-300 dark:border-slate-600 p-4 pt-6">
                      <div className="absolute top-1 left-1/2 -translate-x-1/2 text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        {axleCount} eixos
                      </div>
                      <div className="space-y-3 mb-4">
                        {Object.entries(axleGroups).sort(([a], [b]) => Number(a) - Number(b)).map(([, axlePositions]) => (
                          <div key={axlePositions[0]?.id} className="flex justify-between items-center">
                            <div className="flex items-center gap-1">
                              {axlePositions.filter(p => p.side === "left").sort((a, b) => (a.isInner ? 0 : 1) - (b.isInner ? 0 : 1)).map(pos => renderSlot(pos, "small"))}
                            </div>
                            <div className="flex-1 h-1.5 bg-slate-400 dark:bg-slate-500 mx-2 rounded-full" />
                            <div className="flex items-center gap-1">
                              {axlePositions.filter(p => p.side === "right").sort((a, b) => (a.isInner ? 0 : 1) - (b.isInner ? 0 : 1)).map(pos => renderSlot(pos, "small"))}
                            </div>
                          </div>
                        ))}
                      </div>
                      {spare && (
                        <div className="flex flex-col items-center">
                          <div className="text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Estepe</div>
                          {renderSlot(spare, "small")}
                        </div>
                      )}
                    </div>
                  </>
                )}
                <div className="absolute -top-2 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-[10px] font-bold px-2 py-0.5 rounded-full">
                  FRENTE ▲
                </div>
              </div>
            </div>
          </TooltipProvider>
        )}

        <div className="flex items-center justify-between pt-2">
          <div className="text-sm text-muted-foreground">
            {pendingMoves.length > 0 ? (
              <Badge variant="secondary">
                <ArrowLeftRight className="h-3 w-3 mr-1" />
                {pendingMoves.length} troca(s) pendente(s)
              </Badge>
            ) : (
              "Arraste pneus para trocar posições"
            )}
          </div>
          {pendingMoves.length > 0 && (
            <Button variant="ghost" size="sm" onClick={() => setPendingMoves([])}>
              <Undo2 className="h-4 w-4 mr-1" />
              Desfazer tudo
            </Button>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleConfirm} disabled={saving || pendingMoves.length === 0}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirmar Rodízio ({pendingMoves.length})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
