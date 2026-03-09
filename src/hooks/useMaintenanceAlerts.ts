import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useMultiTenant } from "@/hooks/useMultiTenant";

interface MaintenanceAlert {
  id: string;
  vehicle_id: string;
  vehicle_plate: string;
  vehicle_model: string;
  description: string;
  next_due_date: string | null;
  next_due_km: number | null;
  current_odometer: number | null;
  days_until_due: number | null;
  km_until_due: number | null;
  alert_type: "upcoming" | "overdue" | "critical";
}

export function useMaintenanceAlerts() {
  const { user } = useAuth();
  const { currentCompany } = useMultiTenant();
  const [alerts, setAlerts] = useState<MaintenanceAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [overdueCount, setOverdueCount] = useState(0);
  const [upcomingCount, setUpcomingCount] = useState(0);

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

      // Fetch maintenance schedules (configurations) for the company
      const { data: schedules } = await supabase
        .from("maintenance_schedules")
        .select("*")
        .eq("company_id", currentCompany.id)
        .eq("is_active", true);

      // Create a map of schedules by category and vehicle
      const scheduleMap: Record<string, { alert_days_before: number; alert_km_before: number }> = {};
      schedules?.forEach((s) => {
        const key = s.vehicle_id ? `${s.service_category}_${s.vehicle_id}` : s.service_category;
        scheduleMap[key] = {
          alert_days_before: s.alert_days_before ?? 7,
          alert_km_before: s.alert_km_before ?? 500,
        };
      });

      // Helper to get config for a specific category/vehicle
      const getAlertConfig = (category: string, vehicleId: string) => {
        // First try vehicle-specific config
        const vehicleKey = `${category}_${vehicleId}`;
        if (scheduleMap[vehicleKey]) return scheduleMap[vehicleKey];
        // Then try category-only config
        if (scheduleMap[category]) return scheduleMap[category];
        // Default values
        return { alert_days_before: 7, alert_km_before: 500 };
      };

      // Fetch preventive maintenances with next_due_date or next_due_km
      const { data: maintenances, error } = await supabase
        .from("vehicle_maintenances")
        .select(`
          id,
          vehicle_id,
          description,
          next_due_date,
          next_due_km,
          service_category
        `)
        .eq("company_id", currentCompany.id)
        .eq("maintenance_type", "preventive")
        .eq("status", "completed")
        .or("next_due_date.not.is.null,next_due_km.not.is.null");

      if (error) throw error;

      // Fetch vehicles for plate and odometer info
      const { data: vehicles, error: vehiclesError } = await supabase
        .from("vehicles")
        .select("id, plate, model, avg_consumption")
        .eq("company_id", currentCompany.id);

      if (vehiclesError) throw vehiclesError;

      // Fetch latest fuel expenses to get current odometer
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

      const today = new Date();
      const processedAlerts: MaintenanceAlert[] = [];

      maintenances?.forEach((m) => {
        const vehicle = vehicleMap.get(m.vehicle_id);
        if (!vehicle) return;

        // Get alert configuration from maintenance_schedules
        const config = getAlertConfig(m.service_category, m.vehicle_id);
        const alertDaysBefore = config.alert_days_before;
        const alertKmBefore = config.alert_km_before;

        let alertType: "upcoming" | "overdue" | "critical" | null = null;
        let daysUntilDue: number | null = null;
        let kmUntilDue: number | null = null;

        // Check date-based alerts using configured thresholds
        if (m.next_due_date) {
          const dueDate = new Date(m.next_due_date);
          daysUntilDue = Math.ceil(
            (dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
          );

          if (daysUntilDue < 0) {
            alertType = "overdue";
          } else if (daysUntilDue <= alertDaysBefore) {
            alertType = "critical";
          } else if (daysUntilDue <= alertDaysBefore * 4) {
            alertType = "upcoming";
          }
        }

        // Check km-based alerts using configured thresholds
        const currentOdometer = vehicleOdometers[m.vehicle_id];
        if (m.next_due_km && currentOdometer) {
          kmUntilDue = m.next_due_km - currentOdometer;

          if (kmUntilDue < 0) {
            alertType = "overdue";
          } else if (kmUntilDue <= alertKmBefore) {
            alertType = alertType === "overdue" ? "overdue" : "critical";
          } else if (kmUntilDue <= alertKmBefore * 4) {
            alertType = alertType || "upcoming";
          }
        }

        if (alertType) {
          processedAlerts.push({
            id: m.id,
            vehicle_id: m.vehicle_id,
            vehicle_plate: vehicle.plate,
            vehicle_model: vehicle.model,
            description: m.description,
            next_due_date: m.next_due_date,
            next_due_km: m.next_due_km,
            current_odometer: currentOdometer || null,
            days_until_due: daysUntilDue,
            km_until_due: kmUntilDue,
            alert_type: alertType,
          });
        }
      });

      // Sort by priority: overdue > critical > upcoming
      processedAlerts.sort((a, b) => {
        const priority = { overdue: 0, critical: 1, upcoming: 2 };
        return priority[a.alert_type] - priority[b.alert_type];
      });

      setAlerts(processedAlerts);
      setOverdueCount(processedAlerts.filter((a) => a.alert_type === "overdue").length);
      setUpcomingCount(
        processedAlerts.filter((a) => a.alert_type !== "overdue").length
      );
    } catch (error) {
      console.error("Error fetching maintenance alerts:", error);
    } finally {
      setLoading(false);
    }
  };

  return {
    alerts,
    loading,
    overdueCount,
    upcomingCount,
    totalAlerts: alerts.length,
    refetch: fetchAlerts,
  };
}
