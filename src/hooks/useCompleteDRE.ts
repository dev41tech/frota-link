import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useMultiTenant } from './useMultiTenant';
import {
  DREData,
  groupByCategoryEnriched,
  calculateDREResult,
  calculateFinancialIndicators,
} from '@/lib/dreCalculations';
import {
  calculateJourneyDistance,
  calculateFleetConsumption,
  type FuelRecord,
  type JourneyRecord,
  type VehicleInfo,
} from '@/lib/fleetConsumptionCalculations';

export type ReportViewMode = 'competency' | 'journey';

interface UseDREOptions {
  startDate: Date;
  endDate: Date;
  vehicleId?: string;
  driverId?: string;
  viewMode?: ReportViewMode;
}

export interface ExtendedDREData extends DREData {
  dataQuality: {
    journeysWithoutDistance: number;
    unlinkedFuelCount: number;
  };
}

export function useCompleteDRE({ startDate, endDate, vehicleId, driverId, viewMode = 'competency' }: UseDREOptions) {
  const [dreData, setDreData] = useState<ExtendedDREData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { currentCompany } = useMultiTenant();

  useEffect(() => {
    if (currentCompany?.id) {
      fetchCompleteDRE();
    }
  }, [currentCompany?.id, startDate, endDate, vehicleId, driverId, viewMode]);

  const fetchCompleteDRE = async () => {
    try {
      setLoading(true);
      setError(null);

      // 1. Buscar jornadas do período com filtros (excluindo deletadas)
      // Incluir jornadas com start_date no período OU jornadas com start_date NULL mas end_date no período
      let journeysQuery = supabase
        .from('journeys')
        .select('*, vehicles(*), drivers(*)')
        .eq('company_id', currentCompany!.id)
        .eq('status', 'completed')
        .is('deleted_at', null)
        .or(`and(start_date.gte.${startDate.toISOString()},start_date.lte.${endDate.toISOString()}),and(start_date.is.null,end_date.gte.${startDate.toISOString()},end_date.lte.${endDate.toISOString()})`);

      if (vehicleId) {
        journeysQuery = journeysQuery.eq('vehicle_id', vehicleId);
      }

      if (driverId) {
        journeysQuery = journeysQuery.eq('driver_id', driverId);
      }

      const { data: journeys, error: journeysError } = await journeysQuery;
      if (journeysError) throw journeysError;

      const totalJourneys = journeys?.length || 0;
      const totalDistance = journeys?.reduce((sum, j) => sum + calculateJourneyDistance(j), 0) || 0;
      
      // Contar jornadas sem distância para alerta de qualidade
      const journeysWithoutDistance = journeys?.filter(j => !j.distance || j.distance === 0).length || 0;

      // 2. Buscar receitas com categorias (excluindo deletadas)
      // Modo "journey": buscar receitas vinculadas às jornadas do período (sem filtro de data)
      // Modo "competency": buscar receitas filtradas por data
      let revenuesData: any[] = [];
      const journeyIds = journeys?.map(j => j.id) || [];
      
      if (viewMode === 'journey') {
        // MODO POR JORNADA: Buscar receitas das jornadas do período, ignorando data da receita
        if (journeyIds.length > 0) {
          const { data: journeyRevenues, error: journeyRevenueError } = await supabase
            .from('revenue')
            .select(`
              amount, 
              description, 
              category,
              category_id,
              journey_id,
              revenue_categories (
                id,
                name,
                icon,
                color
              )
            `)
            .eq('company_id', currentCompany!.id)
            .is('deleted_at', null)
            .in('journey_id', journeyIds);
          
          if (journeyRevenueError) throw journeyRevenueError;
          revenuesData = journeyRevenues || [];
        }
      } else if (vehicleId || driverId) {
        // MODO COMPETÊNCIA com filtro de veículo/motorista
        if (journeyIds.length > 0) {
          const { data: linkedRevenues, error: linkedRevenueError } = await supabase
            .from('revenue')
            .select(`
              amount, 
              description, 
              category,
              category_id,
              journey_id,
              revenue_categories (
                id,
                name,
                icon,
                color
              )
            `)
            .eq('company_id', currentCompany!.id)
            .is('deleted_at', null)
            .in('journey_id', journeyIds)
            .gte('date', startDate.toISOString())
            .lte('date', endDate.toISOString());
          
          if (linkedRevenueError) throw linkedRevenueError;
          revenuesData = linkedRevenues || [];
        }
      } else {
        // MODO COMPETÊNCIA: buscar todas as receitas por data
        const { data: allRevenues, error: revenueError } = await supabase
          .from('revenue')
          .select(`
            amount, 
            description, 
            category,
            category_id,
            journey_id,
            revenue_categories (
              id,
              name,
              icon,
              color
            )
          `)
          .eq('company_id', currentCompany!.id)
          .is('deleted_at', null)
          .gte('date', startDate.toISOString())
          .lte('date', endDate.toISOString());

        if (revenueError) throw revenueError;
        revenuesData = allRevenues || [];
      }

      const totalRevenue = revenuesData.reduce((sum, r) => sum + r.amount, 0) || 0;

      // 3. Buscar despesas com filtro de veículo se aplicável
      // Modo "journey": buscar despesas das jornadas do período (sem filtro de data)
      // Modo "competency": buscar despesas por data
      let expensesQuery = supabase
        .from('expenses')
        .select(`
          amount,
          category,
          category_id,
          is_direct,
          vehicle_id,
          journey_id,
          expense_categories (
            id,
            name,
            icon,
            color,
            classification
          )
        `)
        .eq('company_id', currentCompany!.id)
        .is('deleted_at', null);

      if (viewMode === 'competency' || viewMode === undefined) {
        // MODO COMPETÊNCIA (padrão): Buscar TODAS as despesas pela data do lançamento
        // Este é o comportamento mais seguro e esperado
        expensesQuery = expensesQuery
          .gte('date', startDate.toISOString())
          .lte('date', endDate.toISOString());
      } else if (viewMode === 'journey') {
        // MODO POR JORNADA: Buscar despesas das jornadas do período
        // MAS também incluir despesas do período que não estão vinculadas a nenhuma jornada
        if (journeyIds.length > 0) {
          // Incluir despesas vinculadas às jornadas OU despesas sem vínculo no período
          expensesQuery = expensesQuery.or(
            `journey_id.in.(${journeyIds.join(',')}),and(journey_id.is.null,date.gte.${startDate.toISOString()},date.lte.${endDate.toISOString()})`
          );
        } else {
          // Se não há jornadas no período, buscar apenas despesas sem vínculo
          expensesQuery = expensesQuery
            .is('journey_id', null)
            .gte('date', startDate.toISOString())
            .lte('date', endDate.toISOString());
        }
      }

      // Aplicar filtro de veículo se especificado
      // Incluir despesas vinculadas diretamente ao veículo OU vinculadas a jornadas desse veículo
      if (vehicleId) {
        if (journeyIds.length > 0) {
          expensesQuery = expensesQuery.or(
            `vehicle_id.eq.${vehicleId},journey_id.in.(${journeyIds.join(',')})`
          );
        } else {
          expensesQuery = expensesQuery.eq('vehicle_id', vehicleId);
        }
      }

      const { data: allExpenses, error: expensesError } = await expensesQuery;
      if (expensesError) throw expensesError;

      // Separar por classificação da categoria (mais confiável que is_direct)
      const directExpenses = allExpenses?.filter(
        e => e.expense_categories?.classification === 'direct' || 
        (e.is_direct === true && !e.expense_categories?.classification)
      ) || [];
      
      const indirectExpenses = allExpenses?.filter(
        e => e.expense_categories?.classification === 'indirect' || 
        (e.is_direct === false && !e.expense_categories?.classification)
      ) || [];

      // 4. Buscar combustível (excluindo deletados)
      // Modo "journey": buscar combustível das jornadas do período (sem filtro de data)
      // Modo "competency": buscar combustível por data
      let fuelQuery = supabase
        .from('fuel_expenses')
        .select('total_amount, liters, price_per_liter, distance_traveled, journey_id, vehicle_id')
        .eq('company_id', currentCompany!.id)
        .is('deleted_at', null);

      if (viewMode === 'competency' || viewMode === undefined) {
        // MODO COMPETÊNCIA (padrão): Buscar TODO combustível pela data do lançamento
        fuelQuery = fuelQuery
          .gte('date', startDate.toISOString())
          .lte('date', endDate.toISOString());
      } else if (viewMode === 'journey') {
        // MODO POR JORNADA: Buscar combustível das jornadas do período
        // MAS também incluir combustível do período que não está vinculado a nenhuma jornada
        if (journeyIds.length > 0) {
          fuelQuery = fuelQuery.or(
            `journey_id.in.(${journeyIds.join(',')}),and(journey_id.is.null,date.gte.${startDate.toISOString()},date.lte.${endDate.toISOString()})`
          );
        } else {
          // Se não há jornadas no período, buscar apenas combustível sem vínculo
          fuelQuery = fuelQuery
            .is('journey_id', null)
            .gte('date', startDate.toISOString())
            .lte('date', endDate.toISOString());
        }
      }
      
      // Aplicar filtro de veículo se especificado
      // Incluir combustível vinculado diretamente ao veículo OU vinculado a jornadas desse veículo
      if (vehicleId) {
        if (journeyIds.length > 0) {
          fuelQuery = fuelQuery.or(
            `vehicle_id.eq.${vehicleId},journey_id.in.(${journeyIds.join(',')})`
          );
        } else {
          fuelQuery = fuelQuery.eq('vehicle_id', vehicleId);
        }
      }

      const { data: fuelExpenses, error: fuelError } = await fuelQuery;
      if (fuelError) throw fuelError;
      
      // Contar abastecimentos não vinculados a jornadas para info
      const unlinkedFuelCount = fuelExpenses?.filter(f => !f.journey_id).length || 0;

      // 4.5. Buscar custos de manutenção diretamente da tabela vehicle_maintenances
      let maintenanceQuery = supabase
        .from('vehicle_maintenances')
        .select('total_cost, labor_cost, parts_cost, service_date, vehicle_id, service_category')
        .eq('company_id', currentCompany!.id)
        .eq('status', 'completed')
        .is('deleted_at', null)
        .gte('service_date', startDate.toISOString().split('T')[0])
        .lte('service_date', endDate.toISOString().split('T')[0]);

      // Filtrar por veículo se especificado
      if (vehicleId) {
        maintenanceQuery = maintenanceQuery.eq('vehicle_id', vehicleId);
      }

      const { data: maintenances, error: maintenanceError } = await maintenanceQuery;
      if (maintenanceError) throw maintenanceError;

      const totalMaintenanceCost = maintenances?.reduce((sum, m) => sum + (m.total_cost || 0), 0) || 0;
      const maintenanceCount = maintenances?.length || 0;

      // 5. Buscar contas a pagar PENDENTES (excluindo deletadas)
      const { data: pendingAccounts, error: accountsError } = await supabase
        .from('accounts_payable')
        .select('amount')
        .eq('company_id', currentCompany!.id)
        .eq('status', 'pending')
        .is('deleted_at', null)
        .lte('due_date', endDate.toISOString());

      if (accountsError) throw accountsError;

      // 5.5. Buscar contas a pagar PAGAS (que não estão em expenses ou maintenances)
      // Isso evita duplicidade: só incluir contas "órfãs" sem vínculo
      let paidAccountsQuery = supabase
        .from('accounts_payable')
        .select(`
          amount,
          category,
          category_id,
          is_direct,
          payment_date,
          due_date,
          expense_categories (
            id,
            name,
            icon,
            color,
            classification
          )
        `)
        .eq('company_id', currentCompany!.id)
        .eq('status', 'paid')
        .is('deleted_at', null)
        .is('expense_id', null)        // Evita duplicidade com expenses
        .is('maintenance_id', null);   // Evita duplicidade com maintenances

      // Filtrar por data de pagamento (modo competência) ou data de vencimento (modo jornada)
      if (viewMode === 'competency' || viewMode === undefined) {
        paidAccountsQuery = paidAccountsQuery
          .gte('payment_date', startDate.toISOString().split('T')[0])
          .lte('payment_date', endDate.toISOString().split('T')[0]);
      } else {
        // Modo journey: usar due_date para contas
        paidAccountsQuery = paidAccountsQuery
          .gte('due_date', startDate.toISOString().split('T')[0])
          .lte('due_date', endDate.toISOString().split('T')[0]);
      }

      const { data: paidAccounts, error: paidAccountsError } = await paidAccountsQuery;
      if (paidAccountsError) throw paidAccountsError;

      // Separar contas pagas por classificação
      const paidDirectAccounts = paidAccounts?.filter(
        a => a.expense_categories?.classification === 'direct' || a.is_direct === true
      ) || [];

      const paidIndirectAccounts = paidAccounts?.filter(
        a => a.expense_categories?.classification === 'indirect' || 
        (a.is_direct === false && a.expense_categories?.classification !== 'direct')
      ) || [];

      const totalPaidDirectAccounts = paidDirectAccounts.reduce((s, a) => s + Number(a.amount), 0);
      const totalPaidIndirectAccounts = paidIndirectAccounts.reduce((s, a) => s + Number(a.amount), 0);

      // 6. Calcular totais
      const totalAdvances = journeys?.reduce((sum, j) => sum + (j.advance_value || 0), 0) || 0;
      const totalCommissions = journeys?.reduce((sum, j) => sum + (j.commission_value || 0), 0) || 0;
      
      const totalLiters = fuelExpenses?.reduce((sum, f) => sum + (f.liters || 0), 0) || 0;
      const totalFuelCost = fuelExpenses?.reduce((sum, f) => sum + (f.total_amount || 0), 0) || 0;
      
      // Calcular distância das jornadas usando função centralizada (prioriza hodômetro)
      const journeyTotalDistance = journeys?.reduce((sum, j) => sum + calculateJourneyDistance(j), 0) || 0;
      
      // Agrupar categorias com dados enriquecidos
      const revenueCategories = groupByCategoryEnriched(revenuesData || []);
      
      // Converter paidAccounts para formato compatível com groupByCategoryEnriched
      const paidDirectAsExpenses = paidDirectAccounts.map(a => ({
        amount: Number(a.amount),
        category_id: a.category_id,
        expense_categories: a.expense_categories,
      }));
      
      const paidIndirectAsExpenses = paidIndirectAccounts.map(a => ({
        amount: Number(a.amount),
        category_id: a.category_id,
        expense_categories: a.expense_categories,
      }));
      
      // Converter manutenções para formato compatível com groupByCategoryEnriched
      // Manutenções são sempre despesas diretas
      const maintenancesAsExpenses = (maintenances || []).map(m => ({
        amount: Number(m.total_cost || 0),
        category_id: null,
        expense_categories: {
          id: 'maintenance-system',
          name: 'Manutenção',
          icon: 'Wrench',
          color: '#ef4444',
          classification: 'direct',
        },
      }));
      
      // Combinar expenses + paidAccounts + maintenances antes de agrupar
      const allDirectExpensesForGrouping = [...directExpenses, ...paidDirectAsExpenses, ...maintenancesAsExpenses];
      const allIndirectExpensesForGrouping = [...indirectExpenses, ...paidIndirectAsExpenses];
      
      const directExpenseCategories = groupByCategoryEnriched(allDirectExpensesForGrouping);
      const indirectExpenseCategories = groupByCategoryEnriched(allIndirectExpensesForGrouping);
      
      // Incluir manutenção E contas pagas nos custos diretos
      const totalDirectExpenses = (directExpenses.reduce((s, e) => s + e.amount, 0)) + totalFuelCost + totalMaintenanceCost + totalPaidDirectAccounts;
      const totalIndirectExpenses = indirectExpenses.reduce((s, e) => s + e.amount, 0) + totalPaidIndirectAccounts;

      // 7. Calcular resultado
      const result = calculateDREResult(totalRevenue, totalDirectExpenses, totalIndirectExpenses);

      // 8. Calcular indicadores (usar distância das jornadas para indicadores financeiros)
      const financialIndicators = calculateFinancialIndicators(
        totalRevenue,
        result.profit,
        journeyTotalDistance, // Usar distância real das jornadas para métricas financeiras
        result.margin
      );

      // Usar cálculo centralizado (mesmo do Dashboard) para consumo
      // Montar dados no formato esperado por calculateFleetConsumption
      const fuelRecords: FuelRecord[] = (fuelExpenses || []).map(f => ({
        liters: Number(f.liters || 0),
        distance_traveled: f.distance_traveled ? Number(f.distance_traveled) : null,
        vehicle_id: f.vehicle_id,
      }));

      const journeyRecords: JourneyRecord[] = (journeys || []).map(j => ({
        distance: j.distance ? Number(j.distance) : null,
        start_km: j.start_km ? Number(j.start_km) : null,
        end_km: j.end_km ? Number(j.end_km) : null,
        vehicle_id: j.vehicle_id,
      }));

      // Extrair veículos únicos das jornadas
      const vehicleMap = new Map<string, VehicleInfo>();
      (journeys || []).forEach(j => {
        if (j.vehicle_id && j.vehicles && !vehicleMap.has(j.vehicle_id)) {
          vehicleMap.set(j.vehicle_id, {
            id: j.vehicle_id,
            plate: j.vehicles.plate || '',
            model: j.vehicles.model || '',
            target_consumption: j.vehicles.target_consumption || (currentCompany as any)?.default_target_consumption || 3.5,
          });
        }
      });

      // Também incluir veículos do combustível que podem não ter jornada
      (fuelExpenses || []).forEach(f => {
        if (f.vehicle_id && !vehicleMap.has(f.vehicle_id)) {
          vehicleMap.set(f.vehicle_id, {
            id: f.vehicle_id,
            plate: '',
            model: '',
            target_consumption: (currentCompany as any)?.default_target_consumption || 3.5,
          });
        }
      });

      const vehiclesList = Array.from(vehicleMap.values());
      const fleetResult = calculateFleetConsumption(
        fuelRecords,
        journeyRecords,
        vehiclesList,
        (currentCompany as any)?.default_target_consumption || 3.5
      );

      const avgPrice = totalLiters > 0 ? totalFuelCost / totalLiters : 0;
      
      const operationalIndicators = {
        totalVolume: totalLiters,
        avgPrice,
        avgConsumption: fleetResult.avgConsumption || 0
      };

      // 9. Montar DRE completo com dados de qualidade
      const dre: ExtendedDREData = {
        period: { start: startDate, end: endDate },
        journeys: { count: totalJourneys, totalDistance: journeyTotalDistance },
        revenue: {
          total: totalRevenue,
          categories: revenueCategories,
        },
        cashFlow: {
          advances: totalAdvances,
          commissions: totalCommissions,
          balance: totalAdvances - totalCommissions,
        },
        directExpenses: {
          categories: directExpenseCategories,
          fuel: { total: totalFuelCost, liters: totalLiters },
          maintenance: { total: totalMaintenanceCost, count: maintenanceCount },
          paidAccounts: { total: totalPaidDirectAccounts, count: paidDirectAccounts.length },
          total: totalDirectExpenses,
        },
        indirectExpenses: {
          categories: indirectExpenseCategories,
          paidAccounts: { total: totalPaidIndirectAccounts, count: paidIndirectAccounts.length },
          total: totalIndirectExpenses,
        },
        pendingAccounts: {
          total: pendingAccounts?.reduce((s, a) => s + a.amount, 0) || 0,
        },
        result,
        indicators: {
          financial: financialIndicators,
          operational: operationalIndicators,
        },
        dataQuality: {
          journeysWithoutDistance,
          unlinkedFuelCount,
        },
      };

      setDreData(dre);
    } catch (err: any) {
      console.error('Erro ao buscar DRE:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return { dreData, loading, error, refetch: fetchCompleteDRE };
}
