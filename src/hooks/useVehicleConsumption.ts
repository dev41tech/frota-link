import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

// Maximum realistic consumption for trucks (km/L)
const MAX_REALISTIC_CONSUMPTION = 15;

interface ConsumptionData {
  vehicleId: string;
  plate: string;
  model: string;
  actualConsumption: number | null;
  targetConsumption: number | null;
  status: 'excellent' | 'good' | 'warning' | 'critical' | 'unknown' | 'insufficient_data';
  variancePercent: number;
  lastUpdated: string | null;
  totalDistance: number;
  totalLiters: number;
  dataQualityIssue?: 'unrealistic_consumption' | 'missing_fuel_data' | 'mixed_sources';
}

export function useVehicleConsumption(companyId?: string, vehicleId?: string) {
  const [data, setData] = useState<ConsumptionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (companyId) {
      fetchConsumptionData();
    }
  }, [companyId, vehicleId]);

  const fetchConsumptionData = async () => {
    if (!companyId) {
      setData([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      let query = supabase
        .from('vehicles')
        .select(`
          id,
          plate,
          model,
          actual_consumption,
          target_consumption,
          consumption_last_updated,
          company_id
        `)
        .eq('company_id', companyId);

      if (vehicleId) {
        query = query.eq('id', vehicleId);
      }

      const { data: vehicles, error: vehiclesError } = await query;

      if (vehiclesError) throw vehiclesError;

      // Get company settings
      const companyIds = [...new Set(vehicles?.map(v => v.company_id))];
      const { data: companies } = await supabase
        .from('companies')
        .select('id, default_target_consumption, consumption_alert_threshold')
        .in('id', companyIds);

      const companiesMap = new Map(companies?.map(c => [c.id, c]) || []);

      const consumptionData: ConsumptionData[] = [];

      for (const vehicle of vehicles || []) {
        const company = companiesMap.get(vehicle.company_id);
        
        // Use vehicle target or company default
        const targetConsumption = vehicle.target_consumption || 
                                  company?.default_target_consumption || 
                                  3.5;

        // Calculate variance percentage
        const variancePercent = vehicle.actual_consumption && targetConsumption
          ? ((vehicle.actual_consumption - targetConsumption) / targetConsumption) * 100
          : 0;

        // Determine status
        const threshold = company?.consumption_alert_threshold || 15;
        let status: ConsumptionData['status'] = 'unknown';
        
        if (vehicle.actual_consumption && targetConsumption) {
          if (variancePercent >= threshold) status = 'excellent';
          else if (variancePercent >= 0) status = 'good';
          else if (variancePercent >= -threshold) status = 'warning';
          else status = 'critical';
        }

        // Get fuel data from last 90 days using distance_traveled
        const { data: fuelData } = await supabase
          .from('fuel_expenses')
          .select('liters, distance_traveled')
          .eq('vehicle_id', vehicle.id)
          .is('deleted_at', null)
          .gte('date', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString());

        // Get journey distances as fallback (like DRE does)
        // Buscar jornadas com dados completos para calcular distância
        const { data: journeyData } = await supabase
          .from('journeys')
          .select('distance, start_km, end_km')
          .eq('vehicle_id', vehicle.id)
          .eq('status', 'completed')
          .is('deleted_at', null)
          .gte('created_at', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString());

        const totalLiters = fuelData?.reduce((sum, f) => sum + Number(f.liters || 0), 0) || 0;
        const fuelDistance = fuelData?.reduce((sum, f) => sum + Number(f.distance_traveled || 0), 0) || 0;
        
        // Calcular distância das jornadas de forma robusta (igual ao DRE)
        const journeyDistance = journeyData?.reduce((sum, j) => {
          if (j.distance && j.distance > 0) return sum + Number(j.distance);
          if (j.end_km && j.start_km && j.end_km > j.start_km) {
            return sum + (j.end_km - j.start_km);
          }
          return sum;
        }, 0) || 0;
        
        // Determine data source consistency
        const usingFuelDistance = fuelDistance > 0;
        const usingJourneyDistance = !usingFuelDistance && journeyDistance > 0;
        const totalDistance = usingFuelDistance ? fuelDistance : journeyDistance;
        
        // Detect data quality issues
        let dataQualityIssue: ConsumptionData['dataQualityIssue'] = undefined;
        
        // Calculate consumption dynamically
        const calculatedConsumption = totalLiters > 0 && totalDistance > 0 
          ? totalDistance / totalLiters 
          : null;

        // Validate: consumption > MAX_REALISTIC_CONSUMPTION is impossible for trucks
        // This usually indicates mixed data sources (journey distance with incomplete fuel records)
        const isUnrealisticConsumption = calculatedConsumption && calculatedConsumption > MAX_REALISTIC_CONSUMPTION;
        
        if (isUnrealisticConsumption) {
          dataQualityIssue = usingJourneyDistance ? 'mixed_sources' : 'unrealistic_consumption';
        } else if (totalLiters === 0 && journeyDistance > 0) {
          dataQualityIssue = 'missing_fuel_data';
        }

        // Only use calculated consumption if it's realistic
        // Otherwise, fall back to stored value or null
        const validCalculatedConsumption = calculatedConsumption && !isUnrealisticConsumption 
          ? calculatedConsumption 
          : null;
        
        const effectiveConsumption = validCalculatedConsumption ?? 
          (vehicle.actual_consumption ? Number(vehicle.actual_consumption) : null);

        // Recalculate variance and status with effective consumption
        const effectiveVariance = effectiveConsumption && targetConsumption
          ? ((effectiveConsumption - targetConsumption) / targetConsumption) * 100
          : 0;

        let effectiveStatus: ConsumptionData['status'] = 'unknown';
        
        // If there's a data quality issue, mark as insufficient_data
        if (dataQualityIssue) {
          effectiveStatus = 'insufficient_data';
        } else if (effectiveConsumption && targetConsumption) {
          if (effectiveVariance >= threshold) effectiveStatus = 'excellent';
          else if (effectiveVariance >= 0) effectiveStatus = 'good';
          else if (effectiveVariance >= -threshold) effectiveStatus = 'warning';
          else effectiveStatus = 'critical';
        }

        consumptionData.push({
          vehicleId: vehicle.id,
          plate: vehicle.plate,
          model: vehicle.model,
          actualConsumption: effectiveConsumption,
          targetConsumption: Number(targetConsumption),
          status: effectiveStatus,
          variancePercent: effectiveVariance,
          lastUpdated: vehicle.consumption_last_updated,
          totalDistance,
          totalLiters,
          dataQualityIssue
        });
      }

      setData(consumptionData);
    } catch (err: any) {
      setError(err.message);
      console.error('Error fetching consumption data:', err);
      toast({
        title: "Erro ao carregar dados de consumo",
        description: err.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const updateTargetConsumption = async (vehicleId: string, target: number) => {
    try {
      const { error } = await supabase
        .from('vehicles')
        .update({ target_consumption: target })
        .eq('id', vehicleId);

      if (error) throw error;
      await fetchConsumptionData();
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  };

  return { data, loading, error, refetch: fetchConsumptionData, updateTargetConsumption };
}
