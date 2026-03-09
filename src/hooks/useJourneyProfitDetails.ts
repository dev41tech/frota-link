import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useMultiTenant } from '@/hooks/useMultiTenant';

export interface ExpenseBreakdown {
  fuel: number;
  toll: number;
  maintenance: number;
  lodging: number;
  other: number;
  maintenanceRecords: number; // Manutenções da tabela vehicle_maintenances
}

export interface CouplingInfo {
  id: string;
  type: string; // 'simple' | 'bitrem' | 'rodotrem'
  trailers: Array<{
    id: string;
    plate: string;
    model: string | null;
    position: number;
  }>;
}

export interface VehicleExpenseBreakdown {
  vehicleId: string;
  vehiclePlate: string;
  vehicleType: 'truck' | 'trailer';
  fuel: number;
  toll: number;
  maintenance: number;
  other: number;
  total: number;
}

export interface JourneyProfitDetail {
  journey: {
    id: string;
    journey_number: string;
    origin: string;
    destination: string;
    start_date: string | null;
    freight_value: number;
    distance: number | null;
    start_km: number | null;
    end_km: number | null;
    coupling_id: string | null;
  };
  vehicle: { plate: string; model: string | null };
  driver: { name: string } | null;
  revenue: number;
  revenueSource: 'revenue_table' | 'freight_value';
  expenseBreakdown: ExpenseBreakdown;
  totalExpenses: number;
  profit: number;
  margin: number;
  insights: string[];
  mainOffender: string | null;
  fuelLiters: number;
  fuelAvgPrice: number;
  // Coupling data
  coupling?: CouplingInfo;
  expensesByVehicle?: VehicleExpenseBreakdown[];
}

interface CategoryMapping {
  [key: string]: keyof ExpenseBreakdown;
}

const CATEGORY_MAPPING: CategoryMapping = {
  'pedágio': 'toll',
  'pedagio': 'toll',
  'manutenção': 'maintenance',
  'manutencao': 'maintenance',
  'hospedagem': 'lodging',
  'diária': 'lodging',
  'diaria': 'lodging',
  'hotel': 'lodging',
  'pernoite': 'lodging',
  'comissão': 'other',
  'comissao': 'other',
};

function mapCategoryToBreakdown(categoryName: string): keyof ExpenseBreakdown {
  const normalized = categoryName.toLowerCase().trim();
  return CATEGORY_MAPPING[normalized] || 'other';
}

function getMainOffender(breakdown: ExpenseBreakdown): string | null {
  const categories = [
    { name: 'Combustível', value: breakdown.fuel },
    { name: 'Pedágio', value: breakdown.toll },
    { name: 'Manutenção (despesa)', value: breakdown.maintenance },
    { name: 'Manutenção (serviço)', value: breakdown.maintenanceRecords },
    { name: 'Hospedagem', value: breakdown.lodging },
    { name: 'Outros', value: breakdown.other },
  ];
  
  const sorted = categories.sort((a, b) => b.value - a.value);
  return sorted[0].value > 0 ? sorted[0].name : null;
}

function generateInsights(
  detail: JourneyProfitDetail,
  averages: { avgFuelCost: number; avgTollPercent: number }
): string[] {
  const insights: string[] = [];
  
  // Combustível acima da média (+20%)
  if (averages.avgFuelCost > 0 && detail.expenseBreakdown.fuel > averages.avgFuelCost * 1.2) {
    const pct = ((detail.expenseBreakdown.fuel / averages.avgFuelCost - 1) * 100).toFixed(0);
    insights.push(`Combustível +${pct}%`);
  }
  
  // Pedágio alto (> 15% da receita)
  if (detail.revenue > 0 && detail.expenseBreakdown.toll / detail.revenue > 0.15) {
    insights.push('Alto Custo de Pedágio');
  }
  
  // Hospedagem/pernoite
  if (detail.expenseBreakdown.lodging > 0) {
    insights.push('Custo Extra: Pernoite');
  }
  
  // Manutenção não planejada
  if (detail.expenseBreakdown.maintenance > 0) {
    insights.push('Manutenção na Viagem');
  }
  
  // Sem receita cadastrada
  if (detail.revenueSource === 'freight_value') {
    insights.push('Sem Receita Cadastrada');
  }
  
  // Margem crítica
  if (detail.margin < 10 && detail.margin >= 0) {
    insights.push('Margem Crítica');
  }
  
  // Prejuízo
  if (detail.profit < 0) {
    insights.push('Prejuízo');
  }
  
  return insights;
}

export type JourneyFilter = 'all' | 'loss' | 'low_margin' | 'high_performance';
export type ReportViewMode = 'competency' | 'journey';

export function useJourneyProfitDetails(startDate?: Date, endDate?: Date, viewMode: ReportViewMode = 'competency') {
  const { currentCompany } = useMultiTenant();
  const [data, setData] = useState<JourneyProfitDetail[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (currentCompany) {
      fetchData();
    }
  }, [currentCompany, startDate, endDate, viewMode]);

  const fetchData = async () => {
    try {
      setLoading(true);

      let journeyIds: string[] = [];
      let revenuesByJourneyMap = new Map<string, number>();

      if (viewMode === 'journey') {
        // MODO POR JORNADA: Buscar jornadas pelo start_date primeiro
        let journeysQuery = supabase
          .from('journeys')
          .select(`
            id,
            journey_number,
            origin,
            destination,
            start_date,
            freight_value,
            distance,
            start_km,
            end_km,
            coupling_id,
            vehicle_id,
            vehicles(id, plate, model),
            drivers(name)
          `)
          .eq('company_id', currentCompany?.id)
          .eq('status', 'completed')
          .order('start_date', { ascending: false });

        // Incluir jornadas com start_date no período OU jornadas com start_date NULL mas end_date no período
        if (startDate && endDate) {
          journeysQuery = journeysQuery.or(`and(start_date.gte.${startDate.toISOString()},start_date.lte.${endDate.toISOString()}),and(start_date.is.null,end_date.gte.${startDate.toISOString()},end_date.lte.${endDate.toISOString()})`);
        } else if (startDate) {
          journeysQuery = journeysQuery.or(`start_date.gte.${startDate.toISOString()},and(start_date.is.null,end_date.gte.${startDate.toISOString()})`);
        } else if (endDate) {
          journeysQuery = journeysQuery.or(`start_date.lte.${endDate.toISOString()},and(start_date.is.null,end_date.lte.${endDate.toISOString()})`);
        }

        const { data: journeys, error: journeyError } = await journeysQuery;
        if (journeyError) throw journeyError;

        if (!journeys || journeys.length === 0) {
          setData([]);
          setLoading(false);
          return;
        }

        journeyIds = journeys.map(j => j.id);

        // Buscar TODAS as receitas vinculadas às jornadas (sem filtro de data)
        const { data: allRevenues } = await supabase
          .from('revenue')
          .select('journey_id, amount')
          .in('journey_id', journeyIds);

        allRevenues?.forEach(r => {
          if (r.journey_id) {
            const current = revenuesByJourneyMap.get(r.journey_id) || 0;
            revenuesByJourneyMap.set(r.journey_id, current + (r.amount || 0));
          }
        });

        // Buscar TODAS as despesas vinculadas às jornadas (sem filtro de data)
        const { data: allExpenses } = await supabase
          .from('expenses')
          .select('journey_id, amount, category')
          .in('journey_id', journeyIds);

        // Buscar TODO o combustível vinculado às jornadas (sem filtro de data)
        const { data: allFuelExpenses } = await supabase
          .from('fuel_expenses')
          .select('journey_id, total_amount, liters, price_per_liter')
          .in('journey_id', journeyIds);

        const expensesByJourney = new Map<string, { breakdown: ExpenseBreakdown; total: number }>();
        allExpenses?.forEach(e => {
          const current = expensesByJourney.get(e.journey_id) || {
            breakdown: { fuel: 0, toll: 0, maintenance: 0, lodging: 0, other: 0, maintenanceRecords: 0 },
            total: 0
          };
          const category = mapCategoryToBreakdown(e.category || '');
          current.breakdown[category] += e.amount || 0;
          current.total += e.amount || 0;
          expensesByJourney.set(e.journey_id, current);
        });

        const fuelByJourney = new Map<string, { amount: number; liters: number; totalPrice: number }>();
        allFuelExpenses?.forEach(f => {
          const current = fuelByJourney.get(f.journey_id) || { amount: 0, liters: 0, totalPrice: 0 };
          current.amount += f.total_amount || 0;
          current.liters += f.liters || 0;
          current.totalPrice += (f.liters || 0) * (f.price_per_liter || 0);
          fuelByJourney.set(f.journey_id, current);
        });

        // Build detail objects
        const details: JourneyProfitDetail[] = journeys.map(journey => {
          const revenueFromTable = revenuesByJourneyMap.get(journey.id) || 0;
          const revenue = revenueFromTable > 0 ? revenueFromTable : (journey.freight_value || 0);
          const revenueSource: 'revenue_table' | 'freight_value' = revenueFromTable > 0 ? 'revenue_table' : 'freight_value';

          const expenseData = expensesByJourney.get(journey.id) || {
            breakdown: { fuel: 0, toll: 0, maintenance: 0, lodging: 0, other: 0, maintenanceRecords: 0 },
            total: 0
          };
          const fuelData = fuelByJourney.get(journey.id) || { amount: 0, liters: 0, totalPrice: 0 };

          const breakdown: ExpenseBreakdown = {
            ...expenseData.breakdown,
            fuel: fuelData.amount,
            maintenanceRecords: expenseData.breakdown.maintenanceRecords || 0,
          };

          const totalExpenses = expenseData.total + fuelData.amount;
          const profit = revenue - totalExpenses;
          const margin = revenue > 0 ? (profit / revenue) * 100 : 0;

          return {
            journey: {
              id: journey.id,
              journey_number: journey.journey_number,
              origin: journey.origin,
              destination: journey.destination,
              start_date: journey.start_date,
              freight_value: journey.freight_value || 0,
              distance: journey.distance,
              start_km: journey.start_km,
              end_km: journey.end_km,
              coupling_id: (journey as any).coupling_id || null,
            },
            vehicle: {
              plate: (journey.vehicles as any)?.plate || '-',
              model: (journey.vehicles as any)?.model || null,
            },
            driver: (journey.drivers as any)?.name ? { name: (journey.drivers as any).name } : null,
            revenue,
            revenueSource,
            expenseBreakdown: breakdown,
            totalExpenses,
            profit,
            margin,
            insights: [],
            mainOffender: profit < 0 || margin < 20 ? getMainOffender(breakdown) : null,
            fuelLiters: fuelData.liters,
            fuelAvgPrice: fuelData.liters > 0 ? fuelData.totalPrice / fuelData.liters : 0,
          };
        });

        // Calculate averages for insights
        const totalFuelCost = details.reduce((sum, d) => sum + d.expenseBreakdown.fuel, 0);
        const avgFuelCost = details.length > 0 ? totalFuelCost / details.length : 0;
        const avgTollPercent = 0.1;

        details.forEach(detail => {
          detail.insights = generateInsights(detail, { avgFuelCost, avgTollPercent });
        });

        setData(details);
        setLoading(false);
        return;
      }

      // MODO COMPETÊNCIA: Buscar receitas PRIMEIRO, filtradas por revenue.date
      let revenuesQuery = supabase
        .from('revenue')
        .select('journey_id, amount')
        .eq('company_id', currentCompany?.id)
        .not('journey_id', 'is', null);

      if (startDate) {
        revenuesQuery = revenuesQuery.gte('date', startDate.toISOString().split('T')[0]);
      }
      if (endDate) {
        revenuesQuery = revenuesQuery.lte('date', endDate.toISOString().split('T')[0]);
      }

      const { data: revenuesInPeriod } = await revenuesQuery;

      // Extrair IDs únicos das jornadas que têm receitas no período
      const journeyIdsWithRevenue = [...new Set(revenuesInPeriod?.map(r => r.journey_id).filter(Boolean) as string[])];

      if (journeyIdsWithRevenue.length === 0) {
        setData([]);
        setLoading(false);
        return;
      }

      // Buscar jornadas usando esses IDs (sem filtro de data na jornada)
      const { data: journeys, error: journeyError } = await supabase
        .from('journeys')
        .select(`
          id,
          journey_number,
          origin,
          destination,
          start_date,
          freight_value,
          distance,
          start_km,
          end_km,
          coupling_id,
          vehicle_id,
          vehicles(id, plate, model),
          drivers(name)
        `)
        .in('id', journeyIdsWithRevenue)
        .eq('status', 'completed')
        .order('start_date', { ascending: false });

      if (journeyError) throw journeyError;

      if (!journeys || journeys.length === 0) {
        setData([]);
        setLoading(false);
        return;
      }

      // Fetch all journey IDs
      journeyIds = journeys.map(j => j.id);

      // Usar as receitas já buscadas filtradas por data
      revenuesInPeriod?.forEach(r => {
        if (r.journey_id) {
          const current = revenuesByJourneyMap.get(r.journey_id) || 0;
          revenuesByJourneyMap.set(r.journey_id, current + (r.amount || 0));
        }
      });

      // Fetch expenses in batch with category (filtradas por expense.date)
      let expensesQuery = supabase
        .from('expenses')
        .select('journey_id, amount, category')
        .in('journey_id', journeyIds);

      if (startDate) {
        expensesQuery = expensesQuery.gte('date', startDate.toISOString().split('T')[0]);
      }
      if (endDate) {
        expensesQuery = expensesQuery.lte('date', endDate.toISOString().split('T')[0]);
      }

      const { data: allExpenses } = await expensesQuery;

      // Fetch fuel expenses in batch (filtradas por fuel_expense.date)
      let fuelQuery = supabase
        .from('fuel_expenses')
        .select('journey_id, total_amount, liters, price_per_liter')
        .in('journey_id', journeyIds);

      if (startDate) {
        fuelQuery = fuelQuery.gte('date', startDate.toISOString().split('T')[0]);
      }
      if (endDate) {
        fuelQuery = fuelQuery.lte('date', endDate.toISOString().split('T')[0]);
      }


      const { data: allFuelExpenses } = await fuelQuery;

      const expensesByJourney = new Map<string, { breakdown: ExpenseBreakdown; total: number }>();
      allExpenses?.forEach(e => {
        const current = expensesByJourney.get(e.journey_id) || {
          breakdown: { fuel: 0, toll: 0, maintenance: 0, lodging: 0, other: 0, maintenanceRecords: 0 },
          total: 0
        };
        const category = mapCategoryToBreakdown(e.category || '');
        current.breakdown[category] += e.amount || 0;
        current.total += e.amount || 0;
        expensesByJourney.set(e.journey_id, current);
      });

      const fuelByJourney = new Map<string, { amount: number; liters: number; totalPrice: number }>();
      allFuelExpenses?.forEach(f => {
        const current = fuelByJourney.get(f.journey_id) || { amount: 0, liters: 0, totalPrice: 0 };
        current.amount += f.total_amount || 0;
        current.liters += f.liters || 0;
        current.totalPrice += (f.liters || 0) * (f.price_per_liter || 0);
        fuelByJourney.set(f.journey_id, current);
      });

      // Build detail objects
      const details: JourneyProfitDetail[] = journeys.map(journey => {
        const revenueFromTable = revenuesByJourneyMap.get(journey.id) || 0;
        const revenue = revenueFromTable > 0 ? revenueFromTable : (journey.freight_value || 0);
        const revenueSource: 'revenue_table' | 'freight_value' = revenueFromTable > 0 ? 'revenue_table' : 'freight_value';

        const expenseData = expensesByJourney.get(journey.id) || {
          breakdown: { fuel: 0, toll: 0, maintenance: 0, lodging: 0, other: 0, maintenanceRecords: 0 },
          total: 0
        };
        const fuelData = fuelByJourney.get(journey.id) || { amount: 0, liters: 0, totalPrice: 0 };

        const breakdown: ExpenseBreakdown = {
          ...expenseData.breakdown,
          fuel: fuelData.amount,
          maintenanceRecords: expenseData.breakdown.maintenanceRecords || 0,
        };

        const totalExpenses = expenseData.total + fuelData.amount;
        const profit = revenue - totalExpenses;
        const margin = revenue > 0 ? (profit / revenue) * 100 : 0;

        return {
          journey: {
            id: journey.id,
            journey_number: journey.journey_number,
            origin: journey.origin,
            destination: journey.destination,
            start_date: journey.start_date,
            freight_value: journey.freight_value || 0,
            distance: journey.distance,
            start_km: journey.start_km,
            end_km: journey.end_km,
            coupling_id: (journey as any).coupling_id || null,
          },
          vehicle: {
            plate: (journey.vehicles as any)?.plate || '-',
            model: (journey.vehicles as any)?.model || null,
          },
          driver: (journey.drivers as any)?.name ? { name: (journey.drivers as any).name } : null,
          revenue,
          revenueSource,
          expenseBreakdown: breakdown,
          totalExpenses,
          profit,
          margin,
          insights: [], // Will be filled after averages calculation
          mainOffender: profit < 0 || margin < 20 ? getMainOffender(breakdown) : null,
          fuelLiters: fuelData.liters,
          fuelAvgPrice: fuelData.liters > 0 ? fuelData.totalPrice / fuelData.liters : 0,
        };
      });

      // Calculate averages for insights
      const totalFuelCost = details.reduce((sum, d) => sum + d.expenseBreakdown.fuel, 0);
      const avgFuelCost = details.length > 0 ? totalFuelCost / details.length : 0;
      const avgTollPercent = 0.1; // 10% baseline

      // Generate insights for each journey
      details.forEach(detail => {
        detail.insights = generateInsights(detail, { avgFuelCost, avgTollPercent });
      });

      setData(details);
    } catch (error) {
      console.error('Error fetching journey profit details:', error);
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  // Computed values
  const mvpJourney = useMemo(() => {
    if (data.length === 0) return null;
    return data.reduce((best, current) => 
      current.profit > best.profit ? current : best
    );
  }, [data]);

  const worstJourney = useMemo(() => {
    if (data.length === 0) return null;
    return data.reduce((worst, current) => 
      current.profit < worst.profit ? current : worst
    );
  }, [data]);

  const filterJourneys = (filter: JourneyFilter): JourneyProfitDetail[] => {
    switch (filter) {
      case 'loss':
        return data.filter(j => j.profit < 0);
      case 'low_margin':
        return data.filter(j => j.margin >= 0 && j.margin < 20);
      case 'high_performance':
        return data.filter(j => j.margin >= 40);
      default:
        return data;
    }
  };

  return {
    data,
    loading,
    mvpJourney,
    worstJourney,
    filterJourneys,
    refetch: fetchData,
  };
}
