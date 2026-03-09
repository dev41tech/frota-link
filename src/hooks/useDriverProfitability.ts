import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useMultiTenant } from './useMultiTenant';

interface DriverProfitability {
  driverId: string;
  name: string;
  totalRevenue: number;
  totalExpenses: number;
  totalProfit: number;
  margin: number;
  journeyCount: number;
  completionRate: number;
  avgProfitPerJourney: number;
  // Data quality indicators
  hasFreightValueOnly: boolean;
}

interface DataQuality {
  driversWithFreightValueOnly: number;
  revenueSource: 'revenue_table' | 'freight_value' | 'mixed';
}

export function useDriverProfitability(startDate?: Date, endDate?: Date) {
  const { currentCompany } = useMultiTenant();
  const [data, setData] = useState<DriverProfitability[]>([]);
  const [dataQuality, setDataQuality] = useState<DataQuality>({
    driversWithFreightValueOnly: 0,
    revenueSource: 'revenue_table'
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (currentCompany?.id) {
      fetchDriverProfitability();
    }
  }, [currentCompany?.id, startDate, endDate]);

  const fetchDriverProfitability = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch drivers
      const { data: drivers, error: driversError } = await supabase
        .from('drivers')
        .select('id, name')
        .eq('company_id', currentCompany?.id)
        .eq('status', 'active');

      if (driversError) throw driversError;

      const driverProfitability: DriverProfitability[] = [];
      let driversWithFreightValueOnly = 0;
      let usedRevenueTable = false;
      let usedFreightValue = false;

      for (const driver of drivers || []) {
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

        // Buscar jornadas do motorista para filtrar receitas
        const { data: driverJourneys } = await supabase
          .from('journeys')
          .select('id, freight_value, status, vehicle_id')
          .eq('driver_id', driver.id);

        const completedJourneys = driverJourneys?.filter(j => j.status === 'completed') || [];
        const driverJourneyIds = new Set(completedJourneys.map(j => j.id));

        // Filtrar receitas que pertencem a jornadas deste motorista
        const driverRevenues = allRevenues?.filter(r => r.journey_id && driverJourneyIds.has(r.journey_id)) || [];
        const revenueFromTable = driverRevenues.reduce((sum, r) => sum + (r.amount || 0), 0);

        // IDs das jornadas que têm receitas no período
        const journeyIdsWithRevenue = new Set(driverRevenues.map(r => r.journey_id).filter(Boolean));
        const journeyCount = journeyIdsWithRevenue.size;
        const vehicleIds = [...new Set(completedJourneys.filter(j => journeyIdsWithRevenue.has(j.id)).map(j => j.vehicle_id).filter(Boolean))];

        const totalJourneyCount = driverJourneys?.length || 0;
        const completionRate = totalJourneyCount > 0 
          ? (completedJourneys.length / totalJourneyCount) * 100 
          : 0;

        // Se não houver receitas no período, pular
        if (journeyIdsWithRevenue.size === 0 && revenueFromTable === 0) {
          // Verificar se há despesas no período para incluir o motorista
          let expensesQuery = supabase
            .from('expenses')
            .select('amount')
            .eq('company_id', currentCompany?.id)
            .in('journey_id', Array.from(driverJourneyIds));

          if (startDate) {
            expensesQuery = expensesQuery.gte('date', startDate.toISOString().split('T')[0]);
          }
          if (endDate) {
            expensesQuery = expensesQuery.lte('date', endDate.toISOString().split('T')[0]);
          }

          const { data: periodExpenses } = await expensesQuery;
          const hasExpensesInPeriod = (periodExpenses?.length || 0) > 0;

          if (!hasExpensesInPeriod) {
            continue; // Sem dados financeiros no período
          }
        }

        // Fallback para freight_value das jornadas que têm receitas no período
        const journeysWithRevenue = completedJourneys.filter(j => journeyIdsWithRevenue.has(j.id));
        const freightValueTotal = journeysWithRevenue.reduce((sum, j) => sum + (j.freight_value || 0), 0);

        let totalRevenue: number;
        let hasFreightValueOnly = false;

        if (revenueFromTable > 0) {
          totalRevenue = revenueFromTable;
          usedRevenueTable = true;
        } else if (freightValueTotal > 0) {
          totalRevenue = freightValueTotal;
          hasFreightValueOnly = true;
          driversWithFreightValueOnly++;
          usedFreightValue = true;
        } else {
          totalRevenue = 0;
        }

        const journeyIds = Array.from(journeyIdsWithRevenue);

        // CORREÇÃO 2: Buscar despesas das jornadas do motorista + despesas dos veículos no período
        const { data: journeyExpenses } = await supabase
          .from('expenses')
          .select('amount')
          .in('journey_id', journeyIds);

        // Também buscar despesas dos veículos usados pelo motorista no período
        let vehicleExpensesTotal = 0;
        if (vehicleIds.length > 0) {
          let vehicleExpensesQuery = supabase
            .from('expenses')
            .select('amount')
            .in('vehicle_id', vehicleIds)
            .is('journey_id', null); // Apenas despesas não vinculadas a jornadas

          if (startDate) {
            vehicleExpensesQuery = vehicleExpensesQuery.gte('date', startDate.toISOString().split('T')[0]);
          }
          if (endDate) {
            vehicleExpensesQuery = vehicleExpensesQuery.lte('date', endDate.toISOString().split('T')[0]);
          }

          const { data: vehicleExpenses } = await vehicleExpensesQuery;
          vehicleExpensesTotal = vehicleExpenses?.reduce((sum, e) => sum + e.amount, 0) || 0;
        }

        // Combustível das jornadas
        const { data: journeyFuel } = await supabase
          .from('fuel_expenses')
          .select('total_amount')
          .in('journey_id', journeyIds);

        // Combustível dos veículos no período (não vinculado a jornadas)
        let vehicleFuelTotal = 0;
        if (vehicleIds.length > 0) {
          let vehicleFuelQuery = supabase
            .from('fuel_expenses')
            .select('total_amount')
            .in('vehicle_id', vehicleIds)
            .is('journey_id', null);

          if (startDate) {
            vehicleFuelQuery = vehicleFuelQuery.gte('date', startDate.toISOString().split('T')[0]);
          }
          if (endDate) {
            vehicleFuelQuery = vehicleFuelQuery.lte('date', endDate.toISOString().split('T')[0]);
          }

          const { data: vehicleFuel } = await vehicleFuelQuery;
          vehicleFuelTotal = vehicleFuel?.reduce((sum, f) => sum + f.total_amount, 0) || 0;
        }

        const totalExpenses =
          (journeyExpenses?.reduce((sum, e) => sum + e.amount, 0) || 0) +
          vehicleExpensesTotal +
          (journeyFuel?.reduce((sum, f) => sum + f.total_amount, 0) || 0) +
          vehicleFuelTotal;

        const totalProfit = totalRevenue - totalExpenses;
        const margin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;
        const avgProfitPerJourney = journeyIds.length > 0 ? totalProfit / journeyIds.length : 0;

        driverProfitability.push({
          driverId: driver.id,
          name: driver.name,
          totalRevenue,
          totalExpenses,
          totalProfit,
          margin,
          journeyCount: totalJourneyCount,
          completionRate,
          avgProfitPerJourney,
          hasFreightValueOnly
        });
      }

      // Determine revenue source
      let revenueSource: DataQuality['revenueSource'] = 'revenue_table';
      if (usedRevenueTable && usedFreightValue) {
        revenueSource = 'mixed';
      } else if (usedFreightValue && !usedRevenueTable) {
        revenueSource = 'freight_value';
      }

      setData(driverProfitability);
      setDataQuality({
        driversWithFreightValueOnly,
        revenueSource
      });
    } catch (err: any) {
      setError(err.message);
      console.error('Error fetching driver profitability:', err);
    } finally {
      setLoading(false);
    }
  };

  return { data, dataQuality, loading, error, refetch: fetchDriverProfitability };
}
