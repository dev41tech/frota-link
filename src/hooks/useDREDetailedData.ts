import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useMultiTenant } from './useMultiTenant';

export type ReportViewMode = 'competency' | 'journey';

export interface DetailedExpense {
  id: string;
  date: string;
  description: string;
  amount: number;
  category: string;
  categoryName: string;
  categoryColor: string;
  supplier?: string;
  vehicle?: string;
  classification: 'direct' | 'indirect';
  source: 'expense' | 'fuel' | 'maintenance' | 'paid_account';
}

export interface DetailedRevenue {
  id: string;
  date: string;
  description: string;
  amount: number;
  category: string;
  categoryName: string;
  categoryColor: string;
  journeyNumber?: string;
}

export interface DRESummary {
  totalRevenue: number;
  totalDirectExpenses: number;
  totalIndirectExpenses: number;
  totalFuel: number;
  totalMaintenance: number;
  totalPaidAccounts: number;
}

export interface DetailedDREData {
  revenues: DetailedRevenue[];
  directExpenses: DetailedExpense[];
  indirectExpenses: DetailedExpense[];
  fuelExpenses: DetailedExpense[];
  maintenanceExpenses: DetailedExpense[];
  summary: DRESummary;
}

interface UseDREDetailedDataOptions {
  startDate: Date;
  endDate: Date;
  vehicleId?: string;
  driverId?: string;
  viewMode?: ReportViewMode;
  selectedRevenueCategories?: string[];
  selectedExpenseCategories?: string[];
}

export function useDREDetailedData() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { currentCompany } = useMultiTenant();

  const fetchDetailedData = useCallback(async ({
    startDate,
    endDate,
    vehicleId,
    driverId,
    viewMode = 'competency',
    selectedRevenueCategories,
    selectedExpenseCategories,
  }: UseDREDetailedDataOptions): Promise<DetailedDREData | null> => {
    if (!currentCompany?.id) return null;

    setLoading(true);
    setError(null);

    try {
      // 1. Buscar jornadas do período (mesma lógica do useCompleteDRE)
      let journeysQuery = supabase
        .from('journeys')
        .select('id, journey_number, start_date, end_date, vehicle_id')
        .eq('company_id', currentCompany.id)
        .eq('status', 'completed')
        .is('deleted_at', null)
        .or(`and(start_date.gte.${startDate.toISOString()},start_date.lte.${endDate.toISOString()}),and(start_date.is.null,end_date.gte.${startDate.toISOString()},end_date.lte.${endDate.toISOString()})`);

      if (vehicleId) journeysQuery = journeysQuery.eq('vehicle_id', vehicleId);
      if (driverId) journeysQuery = journeysQuery.eq('driver_id', driverId);

      const { data: journeys } = await journeysQuery;
      const journeyIds = journeys?.map(j => j.id) || [];
      const journeyMap = new Map(journeys?.map(j => [j.id, j.journey_number]) || []);

      // 2. Buscar receitas detalhadas (alinhado com useCompleteDRE)
      let revenuesData: any[] = [];

      if (viewMode === 'journey') {
        if (journeyIds.length > 0) {
          const { data } = await supabase
            .from('revenue')
            .select(`id, date, description, amount, category, category_id, journey_id, revenue_categories (id, name, color)`)
            .eq('company_id', currentCompany.id)
            .is('deleted_at', null)
            .in('journey_id', journeyIds);
          revenuesData = data || [];
        }
      } else if (vehicleId || driverId) {
        // Competência com filtro de veículo/motorista: receitas das jornadas + filtro de data
        if (journeyIds.length > 0) {
          const { data } = await supabase
            .from('revenue')
            .select(`id, date, description, amount, category, category_id, journey_id, revenue_categories (id, name, color)`)
            .eq('company_id', currentCompany.id)
            .is('deleted_at', null)
            .in('journey_id', journeyIds)
            .gte('date', startDate.toISOString())
            .lte('date', endDate.toISOString());
          revenuesData = data || [];
        }
      } else {
        // Competência sem filtro: todas as receitas por data
        const { data } = await supabase
          .from('revenue')
          .select(`id, date, description, amount, category, category_id, journey_id, revenue_categories (id, name, color)`)
          .eq('company_id', currentCompany.id)
          .is('deleted_at', null)
          .gte('date', startDate.toISOString())
          .lte('date', endDate.toISOString());
        revenuesData = data || [];
      }

      // 3. Buscar despesas detalhadas (alinhado com useCompleteDRE)
      let expensesQuery = supabase
        .from('expenses')
        .select(`id, date, description, amount, category, category_id, supplier, vehicle_id, journey_id, is_direct,
          expense_categories (id, name, color, classification),
          vehicles (plate)`)
        .eq('company_id', currentCompany.id)
        .is('deleted_at', null);

      if (viewMode === 'competency' || viewMode === undefined) {
        expensesQuery = expensesQuery
          .gte('date', startDate.toISOString())
          .lte('date', endDate.toISOString());
      } else if (viewMode === 'journey') {
        if (journeyIds.length > 0) {
          expensesQuery = expensesQuery.or(
            `journey_id.in.(${journeyIds.join(',')}),and(journey_id.is.null,date.gte.${startDate.toISOString()},date.lte.${endDate.toISOString()})`
          );
        } else {
          expensesQuery = expensesQuery
            .is('journey_id', null)
            .gte('date', startDate.toISOString())
            .lte('date', endDate.toISOString());
        }
      }

      // Filtro de veículo: APÓS modo, usando mesma lógica do useCompleteDRE
      if (vehicleId) {
        if (journeyIds.length > 0) {
          expensesQuery = expensesQuery.or(
            `vehicle_id.eq.${vehicleId},journey_id.in.(${journeyIds.join(',')})`
          );
        } else {
          expensesQuery = expensesQuery.eq('vehicle_id', vehicleId);
        }
      }

      const { data: expenses } = await expensesQuery;

      // 4. Buscar combustível (alinhado com useCompleteDRE)
      let fuelQuery = supabase
        .from('fuel_expenses')
        .select(`id, date, total_amount, liters, price_per_liter, vehicle_id, journey_id, notes,
          gas_stations (name),
          vehicles (plate)`)
        .eq('company_id', currentCompany.id)
        .is('deleted_at', null);

      if (viewMode === 'competency' || viewMode === undefined) {
        fuelQuery = fuelQuery
          .gte('date', startDate.toISOString())
          .lte('date', endDate.toISOString());
      } else if (viewMode === 'journey') {
        if (journeyIds.length > 0) {
          fuelQuery = fuelQuery.or(
            `journey_id.in.(${journeyIds.join(',')}),and(journey_id.is.null,date.gte.${startDate.toISOString()},date.lte.${endDate.toISOString()})`
          );
        } else {
          fuelQuery = fuelQuery
            .is('journey_id', null)
            .gte('date', startDate.toISOString())
            .lte('date', endDate.toISOString());
        }
      }

      // Filtro de veículo para combustível (mesma lógica do useCompleteDRE)
      if (vehicleId) {
        if (journeyIds.length > 0) {
          fuelQuery = fuelQuery.or(
            `vehicle_id.eq.${vehicleId},journey_id.in.(${journeyIds.join(',')})`
          );
        } else {
          fuelQuery = fuelQuery.eq('vehicle_id', vehicleId);
        }
      }

      const { data: fuelExpenses } = await fuelQuery;

      // 5. Buscar manutenções (mesma lógica do useCompleteDRE)
      let maintenanceQuery = supabase
        .from('vehicle_maintenances')
        .select(`id, service_date, description, total_cost, labor_cost, parts_cost, 
          service_category, provider_name, vehicle_id,
          vehicles (plate)`)
        .eq('company_id', currentCompany.id)
        .eq('status', 'completed')
        .is('deleted_at', null)
        .gte('service_date', startDate.toISOString().split('T')[0])
        .lte('service_date', endDate.toISOString().split('T')[0]);

      if (vehicleId) {
        maintenanceQuery = maintenanceQuery.eq('vehicle_id', vehicleId);
      }

      const { data: maintenances } = await maintenanceQuery;

      // 6. Buscar contas pagas órfãs (mesma lógica do useCompleteDRE)
      let paidAccountsQuery = supabase
        .from('accounts_payable')
        .select(`id, payment_date, due_date, description, amount, category, category_id, supplier, is_direct,
          expense_categories (id, name, color, classification)`)
        .eq('company_id', currentCompany.id)
        .eq('status', 'paid')
        .is('deleted_at', null)
        .is('expense_id', null)
        .is('maintenance_id', null);

      if (viewMode === 'competency' || viewMode === undefined) {
        paidAccountsQuery = paidAccountsQuery
          .gte('payment_date', startDate.toISOString().split('T')[0])
          .lte('payment_date', endDate.toISOString().split('T')[0]);
      } else {
        paidAccountsQuery = paidAccountsQuery
          .gte('due_date', startDate.toISOString().split('T')[0])
          .lte('due_date', endDate.toISOString().split('T')[0]);
      }

      const { data: paidAccounts } = await paidAccountsQuery;

      // ===== PROCESSAR DADOS =====

      // Processar receitas
      let detailedRevenues: DetailedRevenue[] = (revenuesData || []).map(r => ({
        id: r.id,
        date: r.date,
        description: r.description || r.category || 'Receita',
        amount: r.amount,
        category: r.category_id || r.category,
        categoryName: (r.revenue_categories as any)?.name || r.category || 'Outros',
        categoryColor: (r.revenue_categories as any)?.color || '#6B7280',
        journeyNumber: r.journey_id ? journeyMap.get(r.journey_id) : undefined,
      }));

      // Aplicar filtro de categorias de receita
      if (selectedRevenueCategories?.length) {
        detailedRevenues = detailedRevenues.filter(r =>
          selectedRevenueCategories.includes(r.category)
        );
      }

      // Processar despesas
      const directExpenses: DetailedExpense[] = [];
      const indirectExpenses: DetailedExpense[] = [];

      (expenses || []).forEach(e => {
        const expCat = e.expense_categories as any;
        const classification = expCat?.classification || (e.is_direct ? 'direct' : 'indirect');
        const categoryId = e.category_id || e.category;

        // Aplicar filtro de categorias de despesa
        if (selectedExpenseCategories?.length && !selectedExpenseCategories.includes(categoryId)) {
          return;
        }

        const item: DetailedExpense = {
          id: e.id,
          date: e.date,
          description: e.description || e.category || 'Despesa',
          amount: e.amount,
          category: categoryId,
          categoryName: expCat?.name || e.category || 'Outros',
          categoryColor: expCat?.color || '#6B7280',
          supplier: e.supplier,
          vehicle: (e.vehicles as any)?.plate,
          classification: classification as 'direct' | 'indirect',
          source: 'expense',
        };
        if (classification === 'direct') {
          directExpenses.push(item);
        } else {
          indirectExpenses.push(item);
        }
      });

      // Processar contas pagas
      (paidAccounts || []).forEach(a => {
        const expCat = a.expense_categories as any;
        const classification = expCat?.classification || (a.is_direct ? 'direct' : 'indirect');
        const categoryId = a.category_id || a.category;

        // Aplicar filtro de categorias de despesa
        if (selectedExpenseCategories?.length && !selectedExpenseCategories.includes(categoryId)) {
          return;
        }

        const item: DetailedExpense = {
          id: a.id,
          date: a.payment_date || a.due_date,
          description: a.description || a.category || 'Conta Paga',
          amount: a.amount,
          category: categoryId,
          categoryName: expCat?.name || a.category || 'Outros',
          categoryColor: expCat?.color || '#6B7280',
          supplier: a.supplier,
          classification: classification as 'direct' | 'indirect',
          source: 'paid_account',
        };
        if (classification === 'direct') {
          directExpenses.push(item);
        } else {
          indirectExpenses.push(item);
        }
      });

      // Processar combustível
      const fuelItems: DetailedExpense[] = (fuelExpenses || []).map(f => {
        const gasStation = (f.gas_stations as any)?.name || 'Posto não informado';
        const vehicle = (f.vehicles as any)?.plate || '';
        return {
          id: f.id,
          date: f.date,
          description: `${f.liters?.toFixed(1)}L @ R$ ${f.price_per_liter?.toFixed(3)} - ${gasStation}${f.notes ? ` (${f.notes})` : ''}`,
          amount: f.total_amount,
          category: 'Combustível',
          categoryName: 'Combustível',
          categoryColor: '#f59e0b',
          vehicle,
          classification: 'direct',
          source: 'fuel',
        };
      });

      // Processar manutenções
      const maintenanceItems: DetailedExpense[] = (maintenances || []).map(m => {
        const vehicle = (m.vehicles as any)?.plate || '';
        const provider = m.provider_name || 'Oficina não informada';
        const serviceType = m.service_category || 'Manutenção';
        return {
          id: m.id,
          date: m.service_date,
          description: `${serviceType}${m.description ? ` - ${m.description}` : ''} (${provider})`,
          amount: m.total_cost || 0,
          category: 'Manutenção',
          categoryName: 'Manutenção',
          categoryColor: '#ef4444',
          supplier: provider,
          vehicle,
          classification: 'direct',
          source: 'maintenance',
        };
      });

      // Calcular totais para conferência
      const totalRevenue = detailedRevenues.reduce((s, r) => s + r.amount, 0);
      const totalFuel = fuelItems.reduce((s, f) => s + f.amount, 0);
      const totalMaintenance = maintenanceItems.reduce((s, m) => s + m.amount, 0);
      const totalDirectExp = directExpenses.reduce((s, e) => s + e.amount, 0);
      const totalIndirectExp = indirectExpenses.reduce((s, e) => s + e.amount, 0);
      const totalPaidAccounts = (paidAccounts || []).reduce((s, a) => s + a.amount, 0);

      const summary: DRESummary = {
        totalRevenue,
        totalDirectExpenses: totalDirectExp + totalFuel + totalMaintenance,
        totalIndirectExpenses: totalIndirectExp,
        totalFuel,
        totalMaintenance,
        totalPaidAccounts,
      };

      return {
        revenues: detailedRevenues.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
        directExpenses: directExpenses.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
        indirectExpenses: indirectExpenses.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
        fuelExpenses: fuelItems.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
        maintenanceExpenses: maintenanceItems.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
        summary,
      };
    } catch (err: any) {
      console.error('Erro ao buscar dados detalhados do DRE:', err);
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [currentCompany?.id]);

  return { fetchDetailedData, loading, error };
}
