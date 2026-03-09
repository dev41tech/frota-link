import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useMultiTenant } from '@/hooks/useMultiTenant';
import { differenceInDays, parseISO, startOfDay, endOfDay } from 'date-fns';

export interface TrailerMetrics {
  trailerId: string;
  plate: string;
  model: string | null;
  trailerType: string | null;
  axleCount: number | null;
  loadCapacity: number | null;

  // Utilização
  totalDaysInPeriod: number;
  daysInUse: number;
  occupancyRate: number; // percentage

  // Operacional
  totalKm: number;
  journeyCount: number;
  avgKmPerJourney: number;

  // Financeiro
  maintenanceCost: number;
  otherCosts: number;
  totalCosts: number;
  proportionalRevenue: number; // receita / (1 + num_carretas)
  costPerKm: number;
  profit: number;
  margin: number;

  // Último uso
  lastCoupledAt: string | null;
  lastTruckPlate: string | null;
}

export interface TrailerUtilizationSummary {
  totalTrailers: number;
  averageOccupancy: number;
  totalKm: number;
  totalMaintenanceCost: number;
  trailersByType: Record<string, number>;
}

export function useTrailerUtilization(startDate?: Date, endDate?: Date) {
  const { currentCompany } = useMultiTenant();
  const [data, setData] = useState<TrailerMetrics[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (currentCompany) {
      fetchData();
    }
  }, [currentCompany, startDate, endDate]);

  const fetchData = async () => {
    if (!currentCompany?.id) return;
    
    try {
      setLoading(true);
      setError(null);

      // Período de análise
      const periodStart = startDate ? startOfDay(startDate) : startOfDay(new Date(new Date().setMonth(new Date().getMonth() - 1)));
      const periodEnd = endDate ? endOfDay(endDate) : endOfDay(new Date());
      const totalDaysInPeriod = Math.max(1, differenceInDays(periodEnd, periodStart) + 1);

      // 1. Buscar todas as carretas da empresa
      const { data: trailersData, error: trailersError } = await (supabase as any)
        .from('vehicles')
        .select('id, plate, model, trailer_type, axle_count, load_capacity')
        .eq('company_id', currentCompany.id)
        .eq('vehicle_type', 'trailer')
        .eq('status', 'active');

      if (trailersError) throw trailersError;
      const trailers = (trailersData || []) as Array<{ id: string; plate: string; model: string | null; trailer_type: string | null; axle_count: number | null; load_capacity: number | null }>;
      if (trailers.length === 0) {
        setData([]);
        setLoading(false);
        return;
      }

      const trailerIds = trailers.map(t => t.id);

      // 2. Buscar couplings que estavam ativos no período
      const { data: couplingsData } = await supabase
        .from('vehicle_couplings')
        .select('id, truck_id, coupling_type, coupled_at, decoupled_at')
        .eq('company_id', currentCompany.id)
        .or(`decoupled_at.is.null,decoupled_at.gte.${periodStart.toISOString()}`);

      const couplings = couplingsData || [];
      const couplingIds = couplings.map(c => c.id);

      // Buscar coupling items separadamente
      const { data: couplingItemsData } = couplingIds.length > 0
        ? await supabase
            .from('vehicle_coupling_items')
            .select('coupling_id, trailer_id, position')
            .in('coupling_id', couplingIds)
        : { data: [] };
      
      const couplingItems = couplingItemsData || [];

      // Buscar placas dos cavalos
      const truckIds = [...new Set(couplings.map(c => c.truck_id).filter(Boolean))];
      const { data: trucksData } = truckIds.length > 0
        ? await supabase
            .from('vehicles')
            .select('id, plate')
            .in('id', truckIds)
        : { data: [] };
      
      const trucksMap = new Map((trucksData || []).map(t => [t.id, t.plate]));

      // 3. Buscar jornadas completadas no período
      const { data: journeys } = await supabase
        .from('journeys')
        .select('id, vehicle_id, distance, start_date, end_date')
        .eq('company_id', currentCompany.id)
        .eq('status', 'completed')
        .gte('start_date', periodStart.toISOString())
        .lte('start_date', periodEnd.toISOString());

      // 4. Buscar despesas vinculadas aos trailers no período
      const { data: expenses } = await supabase
        .from('expenses')
        .select('vehicle_id, amount, category')
        .in('vehicle_id', trailerIds)
        .gte('date', periodStart.toISOString().split('T')[0])
        .lte('date', periodEnd.toISOString().split('T')[0]);

      // 5. Buscar receitas das jornadas
      const journeyIds = journeys?.map(j => j.id) || [];
      const { data: revenues } = journeyIds.length > 0 
        ? await supabase
            .from('revenue')
            .select('journey_id, amount')
            .in('journey_id', journeyIds)
        : { data: [] };

      // Criar mapa de coupling items por coupling_id
      const couplingItemsMap = new Map<string, Array<{ trailer_id: string | null; position: number | null }>>();
      couplingItems.forEach(item => {
        if (!couplingItemsMap.has(item.coupling_id)) {
          couplingItemsMap.set(item.coupling_id, []);
        }
        couplingItemsMap.get(item.coupling_id)!.push({ trailer_id: item.trailer_id, position: item.position });
      });

      // Mapear jornadas por vehicle_id (truck) e identificar quais trailers estavam engatados
      const trailerJourneyMap = new Map<string, Array<{ journeyId: string; distance: number; revenue: number; trailerCount: number }>>();
      const trailerDaysInUse = new Map<string, Set<string>>(); // trailer_id -> Set of date strings

      journeys?.forEach(journey => {
        // Encontrar o coupling ativo durante esta jornada
        const journeyDate = journey.start_date ? parseISO(journey.start_date) : null;
        if (!journeyDate) return;

        const activeCoupling = couplings.find(c => {
          const coupledAt = c.coupled_at ? parseISO(c.coupled_at) : null;
          const decoupledAt = c.decoupled_at ? parseISO(c.decoupled_at) : null;
          
          return c.truck_id === journey.vehicle_id &&
            coupledAt && coupledAt <= journeyDate &&
            (!decoupledAt || decoupledAt >= journeyDate);
        });

        if (!activeCoupling) return;

        const trailerItemsList = couplingItemsMap.get(activeCoupling.id) || [];
        const trailerCount = trailerItemsList.length;
        
        // Receita da jornada
        const journeyRevenue = revenues?.filter(r => r.journey_id === journey.id).reduce((sum, r) => sum + (r.amount || 0), 0) || 0;

        trailerItemsList.forEach((item) => {
          if (!item.trailer_id) return;

          // Adicionar jornada ao mapa
          if (!trailerJourneyMap.has(item.trailer_id)) {
            trailerJourneyMap.set(item.trailer_id, []);
          }
          trailerJourneyMap.get(item.trailer_id)!.push({
            journeyId: journey.id,
            distance: journey.distance || 0,
            revenue: journeyRevenue,
            trailerCount: trailerCount + 1, // +1 para incluir o cavalo
          });

          // Marcar dia como em uso
          if (!trailerDaysInUse.has(item.trailer_id)) {
            trailerDaysInUse.set(item.trailer_id, new Set());
          }
          trailerDaysInUse.get(item.trailer_id)!.add(journey.start_date!.split('T')[0]);
        });
      });

      // Mapear despesas por trailer
      const expensesByTrailer = new Map<string, { maintenance: number; other: number }>();
      expenses?.forEach(exp => {
        if (!exp.vehicle_id) return;
        
        if (!expensesByTrailer.has(exp.vehicle_id)) {
          expensesByTrailer.set(exp.vehicle_id, { maintenance: 0, other: 0 });
        }
        
        const category = (exp.category || '').toLowerCase();
        if (category.includes('manutenção') || category.includes('manutencao') || category.includes('pneu') || category.includes('borracharia')) {
          expensesByTrailer.get(exp.vehicle_id)!.maintenance += exp.amount || 0;
        } else {
          expensesByTrailer.get(exp.vehicle_id)!.other += exp.amount || 0;
        }
      });

      // Encontrar último coupling de cada trailer
      const lastCouplingByTrailer = new Map<string, { date: string; truckPlate: string }>();
      couplings.forEach(c => {
        const items = couplingItemsMap.get(c.id) || [];
        const truckPlate = trucksMap.get(c.truck_id) || '-';
        
        items.forEach((item) => {
          if (!item.trailer_id) return;
          
          const coupledAt = c.coupled_at || '';
          const existing = lastCouplingByTrailer.get(item.trailer_id);
          
          if (!existing || coupledAt > existing.date) {
            lastCouplingByTrailer.set(item.trailer_id, {
              date: coupledAt,
              truckPlate,
            });
          }
        });
      });


      // Montar métricas por trailer
      const metrics: TrailerMetrics[] = trailers.map(trailer => {
        const journeyData = trailerJourneyMap.get(trailer.id) || [];
        const daysInUseSet = trailerDaysInUse.get(trailer.id) || new Set();
        const expData = expensesByTrailer.get(trailer.id) || { maintenance: 0, other: 0 };
        const lastCoupling = lastCouplingByTrailer.get(trailer.id);

        const totalKm = journeyData.reduce((sum, j) => sum + j.distance, 0);
        const proportionalRevenue = journeyData.reduce((sum, j) => sum + (j.revenue / j.trailerCount), 0);
        const totalCosts = expData.maintenance + expData.other;
        const profit = proportionalRevenue - totalCosts;
        const daysInUse = daysInUseSet.size;

        return {
          trailerId: trailer.id,
          plate: trailer.plate,
          model: trailer.model,
          trailerType: trailer.trailer_type,
          axleCount: trailer.axle_count,
          loadCapacity: trailer.load_capacity,
          
          totalDaysInPeriod,
          daysInUse,
          occupancyRate: (daysInUse / totalDaysInPeriod) * 100,
          
          totalKm,
          journeyCount: journeyData.length,
          avgKmPerJourney: journeyData.length > 0 ? totalKm / journeyData.length : 0,
          
          maintenanceCost: expData.maintenance,
          otherCosts: expData.other,
          totalCosts,
          proportionalRevenue,
          costPerKm: totalKm > 0 ? totalCosts / totalKm : 0,
          profit,
          margin: proportionalRevenue > 0 ? (profit / proportionalRevenue) * 100 : 0,
          
          lastCoupledAt: lastCoupling?.date || null,
          lastTruckPlate: lastCoupling?.truckPlate || null,
        };
      });

      // Ordenar por taxa de ocupação (maior primeiro)
      metrics.sort((a, b) => b.occupancyRate - a.occupancyRate);

      setData(metrics);
    } catch (err) {
      console.error('Error fetching trailer utilization:', err);
      setError('Erro ao carregar dados de utilização de carretas');
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  // Sumário
  const summary = useMemo<TrailerUtilizationSummary>(() => {
    if (data.length === 0) {
      return {
        totalTrailers: 0,
        averageOccupancy: 0,
        totalKm: 0,
        totalMaintenanceCost: 0,
        trailersByType: {},
      };
    }

    const trailersByType: Record<string, number> = {};
    data.forEach(t => {
      const type = t.trailerType || 'Não especificado';
      trailersByType[type] = (trailersByType[type] || 0) + 1;
    });

    return {
      totalTrailers: data.length,
      averageOccupancy: data.reduce((sum, t) => sum + t.occupancyRate, 0) / data.length,
      totalKm: data.reduce((sum, t) => sum + t.totalKm, 0),
      totalMaintenanceCost: data.reduce((sum, t) => sum + t.maintenanceCost, 0),
      trailersByType,
    };
  }, [data]);

  // Top performers
  const topPerformers = useMemo(() => {
    return [...data]
      .sort((a, b) => b.occupancyRate - a.occupancyRate)
      .slice(0, 3);
  }, [data]);

  // Carretas ociosas (menos de 20% ocupação)
  const idleTrailers = useMemo(() => {
    return data.filter(t => t.occupancyRate < 20);
  }, [data]);

  return {
    data,
    loading,
    error,
    summary,
    topPerformers,
    idleTrailers,
    refetch: fetchData,
  };
}
