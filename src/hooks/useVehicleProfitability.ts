import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useMultiTenant } from './useMultiTenant';

interface VehicleProfitability {
  vehicleId: string;
  plate: string;
  model: string;
  totalRevenue: number;
  totalExpenses: number;
  totalProfit: number;
  margin: number;
  journeyCount: number;
  avgProfitPerJourney: number;
  // Data quality indicators
  hasFreightValueOnly: boolean;
  unlinkedExpensesCount: number;
  // Breakdown
  maintenanceCost: number;
  fuelCost: number;
  otherExpensesCost: number;
  // Fuel consumption
  fuelConsumption: number | null;
  totalDistance: number;
  totalLiters: number;
}

interface DataQuality {
  vehiclesWithFreightValueOnly: number;
  totalUnlinkedExpenses: number;
  revenueSource: 'revenue_table' | 'freight_value' | 'mixed';
}

export interface UnlinkedExpense {
  id: string;
  type: 'expense' | 'fuel';
  description: string;
  amount: number;
  date: string;
  vehicleId: string;
  vehiclePlate: string;
  categoryName?: string;
}

export function useVehicleProfitability(startDate?: Date, endDate?: Date) {
  const { currentCompany } = useMultiTenant();
  const [data, setData] = useState<VehicleProfitability[]>([]);
  const [unlinkedExpenses, setUnlinkedExpenses] = useState<UnlinkedExpense[]>([]);
  const [dataQuality, setDataQuality] = useState<DataQuality>({
    vehiclesWithFreightValueOnly: 0,
    totalUnlinkedExpenses: 0,
    revenueSource: 'revenue_table'
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (currentCompany?.id) {
      fetchVehicleProfitability();
    }
  }, [currentCompany?.id, startDate, endDate]);

  const fetchVehicleProfitability = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch vehicles
      const { data: vehicles, error: vehiclesError } = await supabase
        .from('vehicles')
        .select('id, plate, model')
        .eq('company_id', currentCompany?.id);

      if (vehiclesError) throw vehiclesError;

      // Create vehicle map for quick lookup
      const vehicleMap = new Map(vehicles?.map(v => [v.id, v]) || []);

      const vehicleProfitability: VehicleProfitability[] = [];
      const allUnlinkedExpenses: UnlinkedExpense[] = [];
      let vehiclesWithFreightValueOnly = 0;
      let totalUnlinkedExpenses = 0;
      let usedRevenueTable = false;
      let usedFreightValue = false;

      for (const vehicle of vehicles || []) {
        // CORREÇÃO: Buscar receitas PRIMEIRO, filtradas por revenue.date (não pela data da jornada)
        let revenuesQuery = supabase
          .from('revenue')
          .select('amount, journey_id')
          .eq('company_id', currentCompany?.id);

        if (startDate) {
          revenuesQuery = revenuesQuery.gte('date', startDate.toISOString().split('T')[0]);
        }
        if (endDate) {
          revenuesQuery = revenuesQuery.lte('date', endDate.toISOString().split('T')[0]);
        }

        const { data: allRevenues } = await revenuesQuery;

        // Buscar jornadas do veículo para filtrar receitas
        const { data: vehicleJourneys } = await supabase
          .from('journeys')
          .select('id, freight_value, distance, start_km, end_km')
          .eq('vehicle_id', vehicle.id)
          .eq('status', 'completed');

        const vehicleJourneyIds = new Set(vehicleJourneys?.map(j => j.id) || []);
        
        // Filtrar receitas que pertencem a jornadas deste veículo
        const vehicleRevenues = allRevenues?.filter(r => r.journey_id && vehicleJourneyIds.has(r.journey_id)) || [];
        const revenueFromTable = vehicleRevenues.reduce((sum, r) => sum + (r.amount || 0), 0);
        
        // IDs das jornadas que têm receitas no período
        const journeyIdsWithRevenue = new Set(vehicleRevenues.map(r => r.journey_id).filter(Boolean));
        const journeyCount = journeyIdsWithRevenue.size;

        // Fallback para freight_value das jornadas que têm receitas no período
        const journeysWithRevenue = vehicleJourneys?.filter(j => journeyIdsWithRevenue.has(j.id)) || [];
        const freightValueTotal = journeysWithRevenue.reduce((sum, j) => sum + (j.freight_value || 0), 0);
        
        let totalRevenue: number;
        let hasFreightValueOnly = false;
        
        if (revenueFromTable > 0) {
          totalRevenue = revenueFromTable;
          usedRevenueTable = true;
        } else if (freightValueTotal > 0) {
          totalRevenue = freightValueTotal;
          hasFreightValueOnly = true;
          vehiclesWithFreightValueOnly++;
          usedFreightValue = true;
        } else {
          totalRevenue = 0;
        }

        // Buscar despesas por vehicle_id + período (filtrado por expense.date)
        // Filtrar despesas não ignoradas e não deletadas
        let expensesQuery = supabase
          .from('expenses')
          .select('id, amount, journey_id, description, date, category, is_ignored')
          .eq('company_id', currentCompany?.id)
          .eq('vehicle_id', vehicle.id)
          .is('deleted_at', null)
          .or('is_ignored.is.null,is_ignored.eq.false');

        if (startDate) {
          expensesQuery = expensesQuery.gte('date', startDate.toISOString().split('T')[0]);
        }
        if (endDate) {
          expensesQuery = expensesQuery.lte('date', endDate.toISOString().split('T')[0]);
        }

        const { data: expenses } = await expensesQuery;

        // Buscar combustível por vehicle_id + período (filtrado por fuel_expense.date)
        // Filtrar combustíveis não ignorados e não deletados
        let fuelQuery = supabase
          .from('fuel_expenses')
          .select('id, total_amount, journey_id, date, liters, price_per_liter, is_ignored')
          .eq('company_id', currentCompany?.id)
          .eq('vehicle_id', vehicle.id)
          .is('deleted_at', null)
          .or('is_ignored.is.null,is_ignored.eq.false');

        if (startDate) {
          fuelQuery = fuelQuery.gte('date', startDate.toISOString().split('T')[0]);
        }
        if (endDate) {
          fuelQuery = fuelQuery.lte('date', endDate.toISOString().split('T')[0]);
        }

        const { data: fuelExpenses } = await fuelQuery;

        // Buscar manutenções concluídas do veículo no período
        let maintenanceQuery = supabase
          .from('vehicle_maintenances')
          .select('id, total_cost, service_date')
          .eq('company_id', currentCompany?.id)
          .eq('vehicle_id', vehicle.id)
          .eq('status', 'completed')
          .is('deleted_at', null);

        if (startDate) {
          maintenanceQuery = maintenanceQuery.gte('service_date', startDate.toISOString().split('T')[0]);
        }
        if (endDate) {
          maintenanceQuery = maintenanceQuery.lte('service_date', endDate.toISOString().split('T')[0]);
        }

        const { data: maintenances } = await maintenanceQuery;

        // Coletar despesas não vinculadas com detalhes
        const unlinkedRegularExpenses = expenses?.filter(e => !e.journey_id) || [];
        const unlinkedFuelExpenses = fuelExpenses?.filter(f => !f.journey_id) || [];

        // Adicionar despesas regulares não vinculadas
        for (const expense of unlinkedRegularExpenses) {
          allUnlinkedExpenses.push({
            id: expense.id,
            type: 'expense',
            description: expense.description || expense.category || 'Despesa',
            amount: expense.amount,
            date: expense.date,
            vehicleId: vehicle.id,
            vehiclePlate: vehicle.plate,
            categoryName: expense.category
          });
        }

        // Adicionar despesas de combustível não vinculadas
        for (const fuel of unlinkedFuelExpenses) {
          allUnlinkedExpenses.push({
            id: fuel.id,
            type: 'fuel',
            description: `Abastecimento: ${fuel.liters?.toFixed(2) || 0}L @ R$ ${fuel.price_per_liter?.toFixed(2) || 0}`,
            amount: fuel.total_amount,
            date: fuel.date,
            vehicleId: vehicle.id,
            vehiclePlate: vehicle.plate,
            categoryName: 'Combustível'
          });
        }

        // Contar despesas não vinculadas a jornadas
        const unlinkedExpensesCount = unlinkedRegularExpenses.length + unlinkedFuelExpenses.length;
        totalUnlinkedExpenses += unlinkedExpensesCount;

        // Calcular totais por categoria
        const otherExpensesCost = expenses?.reduce((sum, e) => sum + e.amount, 0) || 0;
        const fuelCost = fuelExpenses?.reduce((sum, f) => sum + f.total_amount, 0) || 0;
        const maintenanceCost = maintenances?.reduce((sum, m) => sum + (m.total_cost || 0), 0) || 0;

        // Calcular distância total das jornadas completadas
        // Prioridade: end_km - start_km (hodômetro real) > distance (manual/planejado)
        const totalDistance = (vehicleJourneys || []).reduce((sum, j) => {
          if (j.end_km && j.start_km && j.end_km > j.start_km) {
            return sum + (j.end_km - j.start_km);
          }
          if (j.distance && j.distance > 0) {
            return sum + j.distance;
          }
          return sum;
        }, 0);

        // Calcular total de litros abastecidos
        const totalLiters = fuelExpenses?.reduce((sum, f) => sum + (f.liters || 0), 0) || 0;

        // Calcular média km/l com filtro MAX_REALISTIC (15 km/l)
        const MAX_REALISTIC_CONSUMPTION = 15;
        const rawConsumption = totalLiters > 0 ? totalDistance / totalLiters : null;
        const fuelConsumption = rawConsumption !== null && rawConsumption <= MAX_REALISTIC_CONSUMPTION ? rawConsumption : null;

        const totalExpenses = otherExpensesCost + fuelCost + maintenanceCost;

        const totalProfit = totalRevenue - totalExpenses;
        const margin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;
        const avgProfitPerJourney = journeyCount > 0 ? totalProfit / journeyCount : 0;

        vehicleProfitability.push({
          vehicleId: vehicle.id,
          plate: vehicle.plate,
          model: vehicle.model,
          totalRevenue,
          totalExpenses,
          totalProfit,
          margin,
          journeyCount,
          avgProfitPerJourney,
          hasFreightValueOnly,
          unlinkedExpensesCount,
          maintenanceCost,
          fuelCost,
          otherExpensesCost,
          fuelConsumption,
          totalDistance,
          totalLiters
        });
      }

      // Determine revenue source
      let revenueSource: DataQuality['revenueSource'] = 'revenue_table';
      if (usedRevenueTable && usedFreightValue) {
        revenueSource = 'mixed';
      } else if (usedFreightValue && !usedRevenueTable) {
        revenueSource = 'freight_value';
      }

      setData(vehicleProfitability);
      setUnlinkedExpenses(allUnlinkedExpenses);
      setDataQuality({
        vehiclesWithFreightValueOnly,
        totalUnlinkedExpenses,
        revenueSource
      });
    } catch (err: any) {
      setError(err.message);
      console.error('Error fetching vehicle profitability:', err);
    } finally {
      setLoading(false);
    }
  };

  return { data, dataQuality, unlinkedExpenses, loading, error, refetch: fetchVehicleProfitability };
}
