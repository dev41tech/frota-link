/**
 * Cálculos centralizados de consumo da frota
 * Usado por Dashboard e DRE para garantir consistência
 */

// Maximum realistic consumption for trucks (km/L)
export const MAX_REALISTIC_CONSUMPTION = 15;

export interface FleetConsumptionResult {
  avgConsumption: number | null;
  totalDistance: number;
  totalLiters: number;
  vehiclesWithValidData: number;
  totalVehicles: number;
  consumptionByVehicle: VehicleConsumption[];
  dataQuality: {
    unrealisticCount: number;
    missingFuelCount: number;
  };
}

export interface VehicleConsumption {
  vehicleId: string;
  plate: string;
  model: string;
  consumption: number | null;
  distance: number;
  liters: number;
  status: 'excellent' | 'good' | 'warning' | 'critical' | 'insufficient_data';
  dataQualityIssue?: 'unrealistic_consumption' | 'missing_fuel_data' | 'mixed_sources';
}

export interface FuelRecord {
  liters: number;
  distance_traveled: number | null;
  vehicle_id: string;
}

export interface JourneyRecord {
  distance: number | null;
  start_km: number | null;
  end_km: number | null;
  vehicle_id: string;
}

export interface VehicleInfo {
  id: string;
  plate: string;
  model: string;
  target_consumption: number | null;
}

/**
 * Calcula consumo médio (km/L) a partir de distância e litros
 */
export function calculateConsumption(distance: number, liters: number): number | null {
  if (liters <= 0 || distance <= 0) return null;
  const consumption = distance / liters;
  
  // Validate realistic consumption
  if (consumption > MAX_REALISTIC_CONSUMPTION) return null;
  
  return consumption;
}

/**
 * Calcula distância robusta de jornadas
 * Usa distance se disponível, senão calcula por end_km - start_km
 */
export function calculateJourneyDistance(journey: JourneyRecord): number {
  // Priorizar hodômetro real sobre distância manual
  if (journey.end_km && journey.start_km && journey.end_km > journey.start_km) {
    return journey.end_km - journey.start_km;
  }
  if (journey.distance && journey.distance > 0) {
    return journey.distance;
  }
  return 0;
}

/**
 * Determina status de consumo baseado em variância do target
 */
export function getConsumptionStatus(
  consumption: number | null,
  targetConsumption: number,
  threshold: number = 15
): VehicleConsumption['status'] {
  if (!consumption) return 'insufficient_data';
  
  const variance = ((consumption - targetConsumption) / targetConsumption) * 100;
  
  if (variance >= threshold) return 'excellent';
  if (variance >= 0) return 'good';
  if (variance >= -threshold) return 'warning';
  return 'critical';
}

/**
 * Calcula métricas de consumo agregadas da frota
 * Esta é a função central usada tanto pelo Dashboard quanto pelo DRE
 */
export function calculateFleetConsumption(
  fuelRecords: FuelRecord[],
  journeyRecords: JourneyRecord[],
  vehicles: VehicleInfo[],
  defaultTargetConsumption: number = 3.5
): FleetConsumptionResult {
  const consumptionByVehicle: VehicleConsumption[] = [];
  let unrealisticCount = 0;
  let missingFuelCount = 0;

  for (const vehicle of vehicles) {
    // Filter records for this vehicle
    const vehicleFuel = fuelRecords.filter(f => f.vehicle_id === vehicle.id);
    const vehicleJourneys = journeyRecords.filter(j => j.vehicle_id === vehicle.id);

    // Calculate totals
    const totalLiters = vehicleFuel.reduce((sum, f) => sum + Number(f.liters || 0), 0);
    const fuelDistance = vehicleFuel.reduce((sum, f) => sum + Number(f.distance_traveled || 0), 0);
    const journeyDistance = vehicleJourneys.reduce((sum, j) => sum + calculateJourneyDistance(j), 0);

    // Use fuel distance if available, otherwise journey distance
    const totalDistance = fuelDistance > 0 ? fuelDistance : journeyDistance;

    // Calculate consumption
    const rawConsumption = totalLiters > 0 && totalDistance > 0
      ? totalDistance / totalLiters
      : null;

    // Validate consumption
    const isUnrealistic = rawConsumption && rawConsumption > MAX_REALISTIC_CONSUMPTION;
    const consumption = isUnrealistic ? null : rawConsumption;

    // Determine data quality issue
    let dataQualityIssue: VehicleConsumption['dataQualityIssue'];
    if (isUnrealistic) {
      dataQualityIssue = fuelDistance === 0 && journeyDistance > 0 ? 'mixed_sources' : 'unrealistic_consumption';
      unrealisticCount++;
    } else if (totalLiters === 0 && journeyDistance > 0) {
      dataQualityIssue = 'missing_fuel_data';
      missingFuelCount++;
    }

    // Get target and status
    const target = vehicle.target_consumption || defaultTargetConsumption;
    const status = dataQualityIssue 
      ? 'insufficient_data' 
      : getConsumptionStatus(consumption, target);

    consumptionByVehicle.push({
      vehicleId: vehicle.id,
      plate: vehicle.plate,
      model: vehicle.model,
      consumption,
      distance: totalDistance,
      liters: totalLiters,
      status,
      dataQualityIssue
    });
  }

  // Calculate fleet-wide aggregates
  const vehiclesWithValidData = consumptionByVehicle.filter(v => v.consumption !== null);
  const totalDistance = consumptionByVehicle.reduce((sum, v) => sum + v.distance, 0);
  const totalLiters = consumptionByVehicle.reduce((sum, v) => sum + v.liters, 0);
  
  // Fleet average consumption (only from valid data)
  const avgConsumption = vehiclesWithValidData.length > 0
    ? vehiclesWithValidData.reduce((sum, v) => sum + (v.consumption || 0), 0) / vehiclesWithValidData.length
    : null;

  return {
    avgConsumption,
    totalDistance,
    totalLiters,
    vehiclesWithValidData: vehiclesWithValidData.length,
    totalVehicles: vehicles.length,
    consumptionByVehicle,
    dataQuality: {
      unrealisticCount,
      missingFuelCount
    }
  };
}

/**
 * Calcula consumo médio global (agregado) da frota
 * Usado quando não precisamos de breakdown por veículo
 */
export function calculateAggregateConsumption(
  totalDistance: number,
  totalLiters: number
): number | null {
  return calculateConsumption(totalDistance, totalLiters);
}
