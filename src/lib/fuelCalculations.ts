/**
 * Fuel calculation utilities
 * Centralized functions for fuel consumption and efficiency calculations
 */

export interface FuelExpenseRecord {
  id: string;
  vehicle_id: string;
  total_amount: number;
  liters: number;
  price_per_liter: number;
  distance_traveled: number | null;
  odometer: number | null;
  odometer_final: number | null;
  date: string;
  location_address: string | null;
  vehicles?: {
    plate: string;
    target_consumption: number | null;
  };
}

export interface MonthlyFuelData {
  month: string;
  monthKey: string;
  totalLiters: number;
  totalCost: number;
  avgPricePerLiter: number;
  totalDistance: number;
  avgConsumption: number;
  costPerKm: number;
  priceVariation: number;
}

export interface VehicleFuelData {
  vehicleId: string;
  vehiclePlate: string;
  totalCost: number;
  totalLiters: number;
  totalDistance: number;
  avgConsumption: number;
  targetConsumption: number | null;
  efficiencyVsTarget: number | null;
  costPerKm: number;
  status: 'excellent' | 'good' | 'warning' | 'critical';
}

export interface GasStationData {
  name: string;
  totalLiters: number;
  totalCost: number;
  avgPrice: number;
  fillCount: number;
}

/**
 * Calculate distance from fuel expense record
 * Priority: distance_traveled > (odometer_final - odometer) > calculated_distance (from consecutive)
 */
export function calculateDistance(expense: FuelExpenseRecord & { calculated_distance?: number }): number {
  if (expense.distance_traveled && expense.distance_traveled > 0) {
    return expense.distance_traveled;
  }
  
  if (expense.odometer_final && expense.odometer && expense.odometer_final > expense.odometer) {
    return expense.odometer_final - expense.odometer;
  }
  
  // Use pre-calculated distance from consecutive odometers
  if (expense.calculated_distance && expense.calculated_distance > 0) {
    return expense.calculated_distance;
  }
  
  return 0;
}

/**
 * Calculate distances from consecutive odometer readings for all expenses
 * Groups by vehicle and sorts by date, then calculates distance between readings
 */
export function calculateDistancesFromConsecutiveOdometers(
  expenses: FuelExpenseRecord[]
): (FuelExpenseRecord & { calculated_distance: number })[] {
  // Group expenses by vehicle
  const vehicleExpenses = new Map<string, FuelExpenseRecord[]>();
  
  expenses.forEach(expense => {
    const vehicleId = expense.vehicle_id;
    if (!vehicleExpenses.has(vehicleId)) {
      vehicleExpenses.set(vehicleId, []);
    }
    vehicleExpenses.get(vehicleId)!.push(expense);
  });
  
  const result: (FuelExpenseRecord & { calculated_distance: number })[] = [];
  
  // Process each vehicle's expenses
  vehicleExpenses.forEach((vehicleExps) => {
    // Sort by date ascending
    const sorted = [...vehicleExps].sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    
    // Calculate distances between consecutive odometers
    for (let i = 0; i < sorted.length; i++) {
      const current = sorted[i];
      let calculatedDistance = 0;
      
      // First check if we already have distance info
      if (current.distance_traveled && current.distance_traveled > 0) {
        calculatedDistance = current.distance_traveled;
      } else if (current.odometer_final && current.odometer && current.odometer_final > current.odometer) {
        calculatedDistance = current.odometer_final - current.odometer;
      } else if (current.odometer && i < sorted.length - 1) {
        // Look for next expense with valid odometer
        const nextWithOdometer = sorted.slice(i + 1).find(e => e.odometer && e.odometer > 0);
        if (nextWithOdometer && nextWithOdometer.odometer && nextWithOdometer.odometer > current.odometer) {
          calculatedDistance = nextWithOdometer.odometer - current.odometer;
        }
      }
      
      result.push({
        ...current,
        calculated_distance: calculatedDistance
      });
    }
  });
  
  return result;
}

/**
 * Maximum realistic consumption for trucks (km/L)
 * Values above this threshold are considered data errors
 */
export const MAX_REALISTIC_CONSUMPTION = 15;

/**
 * Calculate consumption in km/L
 * Returns 0 for invalid data or unrealistic values (> 15 km/L)
 * Note: Returns 0 (not null) for backward compatibility with FuelReports aggregation
 */
export function calculateConsumption(distance: number, liters: number): number {
  if (liters <= 0 || distance <= 0) return 0;
  const consumption = distance / liters;
  if (consumption > MAX_REALISTIC_CONSUMPTION) return 0;
  return consumption;
}

/**
 * Calculate cost per km
 */
export function calculateCostPerKm(cost: number, distance: number): number {
  if (distance <= 0) return 0;
  return cost / distance;
}

/**
 * Get consumption status based on km/L value
 * Standard thresholds: green >= 3.5, yellow >= 2.5, red < 2.5
 */
export function getConsumptionStatus(consumption: number, target?: number | null): 'excellent' | 'good' | 'warning' | 'critical' {
  if (target && target > 0) {
    const efficiency = (consumption / target) * 100;
    if (efficiency >= 100) return 'excellent';
    if (efficiency >= 85) return 'good';
    if (efficiency >= 70) return 'warning';
    return 'critical';
  }
  
  // Default thresholds for trucks (standardized across all modules)
  if (consumption >= 3.5) return 'excellent';
  if (consumption >= 2.5) return 'good';
  return 'critical';
}

/**
 * Get status color class
 */
export function getStatusColor(status: 'excellent' | 'good' | 'warning' | 'critical'): string {
  switch (status) {
    case 'excellent': return 'text-green-600';
    case 'good': return 'text-blue-600';
    case 'warning': return 'text-yellow-600';
    case 'critical': return 'text-red-600';
  }
}

/**
 * Get status background color class
 */
export function getStatusBgColor(status: 'excellent' | 'good' | 'warning' | 'critical'): string {
  switch (status) {
    case 'excellent': return 'bg-green-100 text-green-800';
    case 'good': return 'bg-blue-100 text-blue-800';
    case 'warning': return 'bg-yellow-100 text-yellow-800';
    case 'critical': return 'bg-red-100 text-red-800';
  }
}

/**
 * Calculate efficiency percentage vs target
 */
export function calculateEfficiencyVsTarget(consumption: number, target: number | null): number | null {
  if (!target || target <= 0 || consumption <= 0) return null;
  return (consumption / target) * 100;
}

/**
 * Calculate price variation percentage
 */
export function calculatePriceVariation(currentPrice: number, previousPrice: number): number {
  if (previousPrice <= 0) return 0;
  return ((currentPrice - previousPrice) / previousPrice) * 100;
}

/**
 * Format currency
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
}

/**
 * Format number with 2 decimals
 */
export function formatNumber(value: number, decimals: number = 2): string {
  return value.toFixed(decimals);
}

/**
 * Aggregate fuel expenses by month
 */
export function aggregateFuelByMonth(
  expenses: FuelExpenseRecord[],
  months: number
): Map<string, { liters: number; cost: number; distance: number; prices: number[] }> {
  const monthMap = new Map<string, { liters: number; cost: number; distance: number; prices: number[] }>();
  
  expenses.forEach(expense => {
    const date = new Date(expense.date);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    
    const current = monthMap.get(monthKey) || { liters: 0, cost: 0, distance: 0, prices: [] };
    const distance = calculateDistance(expense);
    
    monthMap.set(monthKey, {
      liters: current.liters + Number(expense.liters),
      cost: current.cost + Number(expense.total_amount),
      distance: current.distance + distance,
      prices: [...current.prices, Number(expense.price_per_liter)]
    });
  });
  
  return monthMap;
}

/**
 * Aggregate fuel expenses by vehicle
 */
export function aggregateFuelByVehicle(
  expenses: FuelExpenseRecord[]
): Map<string, VehicleFuelData> {
  const vehicleMap = new Map<string, VehicleFuelData>();
  
  expenses.forEach(expense => {
    const vehicleId = expense.vehicle_id;
    const plate = expense.vehicles?.plate || 'Desconhecido';
    const target = expense.vehicles?.target_consumption || null;
    const distance = calculateDistance(expense);
    
    const current = vehicleMap.get(vehicleId);
    
    if (current) {
      current.totalCost += Number(expense.total_amount);
      current.totalLiters += Number(expense.liters);
      current.totalDistance += distance;
    } else {
      vehicleMap.set(vehicleId, {
        vehicleId,
        vehiclePlate: plate,
        totalCost: Number(expense.total_amount),
        totalLiters: Number(expense.liters),
        totalDistance: distance,
        avgConsumption: 0,
        targetConsumption: target,
        efficiencyVsTarget: null,
        costPerKm: 0,
        status: 'good'
      });
    }
  });
  
  // Calculate derived values
  vehicleMap.forEach((data, key) => {
    data.avgConsumption = calculateConsumption(data.totalDistance, data.totalLiters);
    data.costPerKm = calculateCostPerKm(data.totalCost, data.totalDistance);
    data.efficiencyVsTarget = calculateEfficiencyVsTarget(data.avgConsumption, data.targetConsumption);
    data.status = getConsumptionStatus(data.avgConsumption, data.targetConsumption);
    vehicleMap.set(key, data);
  });
  
  return vehicleMap;
}
