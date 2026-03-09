import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  calculateFleetConsumption,
  FleetConsumptionResult,
  FuelRecord,
  JourneyRecord,
  VehicleInfo,
} from "@/lib/fleetConsumptionCalculations";

interface UseFleetConsumptionOptions {
  companyId?: string;
  vehicleId?: string;
  startDate?: Date;
  endDate?: Date;
}

/**
 * Hook centralizado para consumo da frota
 * Garante consistência entre Dashboard e DRE
 */
export function useFleetConsumption({ companyId, vehicleId, startDate, endDate }: UseFleetConsumptionOptions) {
  const [result, setResult] = useState<FleetConsumptionResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  // Default to last 90 days if no dates provided
  const effectiveDates = useMemo(() => {
    const now = new Date();
    return {
      start: startDate || new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000),
      end: endDate || now,
    };
  }, [startDate, endDate]);

  useEffect(() => {
    if (companyId) {
      fetchData();
    } else {
      setResult(null);
      setLoading(false);
    }
  }, [companyId, vehicleId, effectiveDates.start.getTime(), effectiveDates.end.getTime()]);

  const fetchData = async () => {
    if (!companyId) return;

    try {
      setLoading(true);
      setError(null);

      // 1. Fetch vehicles using match() to avoid TS deep instantiation issue
      const { data: vehicleData, error: vehicleError } = await supabase
        .from("vehicles")
        .select("id, plate, model, target_consumption")
        .match({ company_id: companyId }) // <--- CORREÇÃO: Filtra apenas pelo ID da empresa
        .neq("status", "inactive");

      if (vehicleError) {
        console.error("[FleetConsumption] Vehicle fetch error:", {
          code: vehicleError.code,
          message: vehicleError.message,
          details: vehicleError.details,
          hint: vehicleError.hint,
        });
        throw vehicleError;
      }

      // Filter by vehicleId if provided (post-query to avoid chaining issues)
      let filteredVehicles = vehicleData || [];
      if (vehicleId) {
        filteredVehicles = filteredVehicles.filter((v: any) => v.id === vehicleId);
      }

      const vehicles: VehicleInfo[] = filteredVehicles.map((v: any) => ({
        id: v.id,
        plate: v.plate,
        model: v.model,
        target_consumption: v.target_consumption,
      }));

      const vehicleIds = vehicles.map((v) => v.id);

      if (vehicleIds.length === 0) {
        setResult({
          avgConsumption: null,
          totalDistance: 0,
          totalLiters: 0,
          vehiclesWithValidData: 0,
          totalVehicles: 0,
          consumptionByVehicle: [],
          dataQuality: { unrealisticCount: 0, missingFuelCount: 0 },
        });
        setLoading(false);
        return;
      }

      // 2. Fetch fuel records in date range
      const { data: fuelData, error: fuelError } = await supabase
        .from("fuel_expenses")
        .select("liters, distance_traveled, vehicle_id")
        .in("vehicle_id", vehicleIds)
        .is("deleted_at", null)
        .gte("date", effectiveDates.start.toISOString())
        .lte("date", effectiveDates.end.toISOString());

      if (fuelError) {
        console.error("[FleetConsumption] Fuel fetch error:", {
          code: fuelError.code,
          message: fuelError.message,
          details: fuelError.details,
          hint: fuelError.hint,
        });
        throw fuelError;
      }

      const fuelRecords: FuelRecord[] = (fuelData || []).map((f: any) => ({
        liters: Number(f.liters || 0),
        distance_traveled: f.distance_traveled ? Number(f.distance_traveled) : null,
        vehicle_id: f.vehicle_id,
      }));

      // 3. Fetch journey records in date range (for distance fallback)
      const { data: journeyData, error: journeyError } = await supabase
        .from("journeys")
        .select("distance, start_km, end_km, vehicle_id")
        .in("vehicle_id", vehicleIds)
        .eq("status", "completed")
        .is("deleted_at", null)
        .gte("created_at", effectiveDates.start.toISOString())
        .lte("created_at", effectiveDates.end.toISOString());

      if (journeyError) {
        console.error("[FleetConsumption] Journey fetch error:", {
          code: journeyError.code,
          message: journeyError.message,
          details: journeyError.details,
          hint: journeyError.hint,
        });
        throw journeyError;
      }

      const journeyRecords: JourneyRecord[] = (journeyData || []).map((j: any) => ({
        distance: j.distance ? Number(j.distance) : null,
        start_km: j.start_km ? Number(j.start_km) : null,
        end_km: j.end_km ? Number(j.end_km) : null,
        vehicle_id: j.vehicle_id,
      }));

      // 4. Get company default target consumption
      const { data: companyData } = await supabase
        .from("companies")
        .select("default_target_consumption")
        .eq("id", companyId)
        .single();

      const defaultTarget = companyData?.default_target_consumption || 3.5;

      // 5. Calculate using centralized function
      const consumptionResult = calculateFleetConsumption(fuelRecords, journeyRecords, vehicles, defaultTarget);

      setResult(consumptionResult);
    } catch (err: any) {
      const errorMessage = err?.message || "Erro desconhecido ao carregar dados de consumo";
      setError(errorMessage);
      console.error("[FleetConsumption] Error:", err);
      toast({
        title: "Erro ao carregar dados de consumo",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return {
    result,
    loading,
    error,
    refetch: fetchData,
    // Convenience accessors
    avgConsumption: result?.avgConsumption ?? null,
    totalDistance: result?.totalDistance ?? 0,
    totalLiters: result?.totalLiters ?? 0,
    vehiclesWithValidData: result?.vehiclesWithValidData ?? 0,
    totalVehicles: result?.totalVehicles ?? 0,
  };
}
