import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useMultiTenant } from "@/hooks/useMultiTenant";

export interface TireAlert {
  id: string;
  tire_id: string;
  vehicle_id: string;
  vehicle_plate: string;
  tire_brand: string;
  tire_model: string;
  tire_size: string;
  current_position: string;
  installation_km: number;
  current_vehicle_km: number;
  km_driven: number;
  alert_rotation_km: number;
  alert_replacement_km: number;
  alert_type: "rotation" | "replacement" | "critical_replacement";
  km_until_rotation: number;
  km_until_replacement: number;
}

export function useTireAlerts() {
  const { user } = useAuth();
  const { currentCompany } = useMultiTenant();
  const [alerts, setAlerts] = useState<TireAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [rotationCount, setRotationCount] = useState(0);
  const [replacementCount, setReplacementCount] = useState(0);

  useEffect(() => {
    if (!user || !currentCompany?.id) {
      setLoading(false);
      return;
    }

    fetchAlerts();
  }, [user, currentCompany?.id]);

  const fetchAlerts = async () => {
    if (!currentCompany?.id) return;

    try {
      setLoading(true);

      // Fetch tires that are in use (have a vehicle assigned)
      const { data: tires, error: tiresError } = await supabase
        .from("tire_assets")
        .select("*")
        .eq("company_id", currentCompany.id)
        .eq("status", "installed")
        .not("current_vehicle_id", "is", null);

      if (tiresError) throw tiresError;

      // Fetch vehicles for plate info
      const { data: vehicles, error: vehiclesError } = await supabase
        .from("vehicles")
        .select("id, plate, model")
        .eq("company_id", currentCompany.id);

      if (vehiclesError) throw vehiclesError;

      // Fetch latest fuel expenses to get current odometer per vehicle
      const { data: fuelExpenses, error: fuelError } = await supabase
        .from("fuel_expenses")
        .select("vehicle_id, odometer")
        .eq("company_id", currentCompany.id)
        .order("date", { ascending: false });

      if (fuelError) throw fuelError;

      // Create map of vehicle_id to latest odometer
      const vehicleOdometers: Record<string, number> = {};
      fuelExpenses?.forEach((fe) => {
        if (fe.odometer && !vehicleOdometers[fe.vehicle_id]) {
          vehicleOdometers[fe.vehicle_id] = fe.odometer;
        }
      });

      const vehicleMap = new Map(vehicles?.map((v) => [v.id, v]) || []);

      const processedAlerts: TireAlert[] = [];

      tires?.forEach((tire: any) => {
        const vehicle = vehicleMap.get(tire.current_vehicle_id);
        if (!vehicle) return;

        const currentVehicleKm = vehicleOdometers[tire.current_vehicle_id] || 0;
        const installationKm = tire.installation_km || 0;
        const kmDriven = currentVehicleKm - installationKm;

        const alertRotationKm = tire.alert_rotation_km || 20000;
        const alertReplacementKm = tire.alert_replacement_km || 80000;

        const kmUntilRotation = alertRotationKm - kmDriven;
        const kmUntilReplacement = alertReplacementKm - kmDriven;

        let alertType: "rotation" | "replacement" | "critical_replacement" | null = null;

        // Check replacement first (higher priority)
        if (kmUntilReplacement <= 0) {
          alertType = "critical_replacement";
        } else if (kmUntilReplacement <= 5000) {
          alertType = "replacement";
        } else if (kmUntilRotation <= 0 || kmUntilRotation <= 2000) {
          alertType = "rotation";
        }

        if (alertType) {
          processedAlerts.push({
            id: `${tire.id}-alert`,
            tire_id: tire.id,
            vehicle_id: tire.current_vehicle_id,
            vehicle_plate: vehicle.plate,
            tire_brand: tire.brand || "N/A",
            tire_model: tire.model || "N/A",
            tire_size: tire.size || "N/A",
            current_position: tire.current_position || "N/A",
            installation_km: installationKm,
            current_vehicle_km: currentVehicleKm,
            km_driven: kmDriven,
            alert_rotation_km: alertRotationKm,
            alert_replacement_km: alertReplacementKm,
            alert_type: alertType,
            km_until_rotation: kmUntilRotation,
            km_until_replacement: kmUntilReplacement,
          });
        }
      });

      // Sort by priority: critical_replacement > replacement > rotation
      processedAlerts.sort((a, b) => {
        const priority = { critical_replacement: 0, replacement: 1, rotation: 2 };
        return priority[a.alert_type] - priority[b.alert_type];
      });

      setAlerts(processedAlerts);
      setRotationCount(processedAlerts.filter((a) => a.alert_type === "rotation").length);
      setReplacementCount(
        processedAlerts.filter((a) => a.alert_type === "replacement" || a.alert_type === "critical_replacement").length
      );
    } catch (error) {
      console.error("Error fetching tire alerts:", error);
    } finally {
      setLoading(false);
    }
  };

  return {
    alerts,
    loading,
    rotationCount,
    replacementCount,
    totalAlerts: alerts.length,
    refetch: fetchAlerts,
  };
}
