import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useMultiTenant } from './useMultiTenant';

interface RouteInfo {
  origin: string;
  destination: string;
  count: number;
}

export interface CustomerProfitability {
  customerId: string;
  customerName: string;
  customerDocument: string | null;
  totalRevenue: number;
  totalExpenses: number;
  profit: number;
  margin: number;
  journeyCount: number;
  avgTicket: number;
  avgCostPerKm: number;
  totalDistance: number;
  topRoutes: RouteInfo[];
  avgPaymentDays: number;
}

export function useCustomerProfitability(startDate?: Date, endDate?: Date) {
  const { currentCompany } = useMultiTenant();
  const [data, setData] = useState<CustomerProfitability[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (currentCompany?.id) {
      fetchCustomerProfitability();
    }
  }, [currentCompany?.id, startDate, endDate]);

  const fetchCustomerProfitability = async () => {
    try {
      setLoading(true);
      setError(null);

      // Buscar clientes cadastrados
      const { data: customers, error: customersError } = await supabase
        .from('parties')
        .select('id, name, document')
        .eq('company_id', currentCompany?.id)
        .eq('type', 'customer')
        .eq('is_active', true);

      if (customersError) throw customersError;

      if (!customers || customers.length === 0) {
        setData([]);
        return;
      }

      const customerProfitability: CustomerProfitability[] = [];

      for (const customer of customers) {
        // Buscar jornadas vinculadas ao cliente
        let journeysQuery = supabase
          .from('journeys')
          .select('id, origin, destination, distance, start_date, end_date, freight_value')
          .eq('company_id', currentCompany?.id)
          .eq('customer_id', customer.id)
          .eq('status', 'completed')
          .is('deleted_at', null);

        if (startDate) {
          journeysQuery = journeysQuery.gte('start_date', startDate.toISOString());
        }
        if (endDate) {
          journeysQuery = journeysQuery.lte('start_date', endDate.toISOString());
        }

        const { data: journeys, error: journeysError } = await journeysQuery;
        if (journeysError) throw journeysError;

        if (!journeys || journeys.length === 0) continue;

        const journeyIds = journeys.map(j => j.id);

        // Buscar receitas das jornadas
        const { data: revenues } = await supabase
          .from('revenue')
          .select('amount, date, payment_date')
          .in('journey_id', journeyIds)
          .eq('company_id', currentCompany?.id);

        const totalRevenue = revenues?.reduce((sum, r) => sum + (r.amount || 0), 0) || 0;

        // Se não houver receitas, usar freight_value como fallback
        const fallbackRevenue = totalRevenue === 0 
          ? journeys.reduce((sum, j) => sum + (j.freight_value || 0), 0)
          : totalRevenue;

        // Buscar despesas das jornadas
        const { data: expenses } = await supabase
          .from('expenses')
          .select('amount')
          .in('journey_id', journeyIds)
          .eq('company_id', currentCompany?.id)
          .is('deleted_at', null)
          .or('is_ignored.is.null,is_ignored.eq.false');

        const expensesCost = expenses?.reduce((sum, e) => sum + (e.amount || 0), 0) || 0;

        // Buscar combustível das jornadas
        const { data: fuelExpenses } = await supabase
          .from('fuel_expenses')
          .select('total_amount')
          .in('journey_id', journeyIds)
          .eq('company_id', currentCompany?.id)
          .is('deleted_at', null)
          .or('is_ignored.is.null,is_ignored.eq.false');

        const fuelCost = fuelExpenses?.reduce((sum, f) => sum + (f.total_amount || 0), 0) || 0;

        const totalExpenses = expensesCost + fuelCost;
        const profit = fallbackRevenue - totalExpenses;
        const margin = fallbackRevenue > 0 ? (profit / fallbackRevenue) * 100 : 0;
        const journeyCount = journeys.length;
        const avgTicket = journeyCount > 0 ? fallbackRevenue / journeyCount : 0;

        // Calcular distância total
        const totalDistance = journeys.reduce((sum, j) => sum + (j.distance || 0), 0);
        const avgCostPerKm = totalDistance > 0 ? totalExpenses / totalDistance : 0;

        // Calcular rotas mais frequentes
        const routeCounts: Record<string, number> = {};
        for (const journey of journeys) {
          const routeKey = `${journey.origin || 'N/A'} → ${journey.destination || 'N/A'}`;
          routeCounts[routeKey] = (routeCounts[routeKey] || 0) + 1;
        }

        const topRoutes: RouteInfo[] = Object.entries(routeCounts)
          .map(([route, count]) => {
            const [origin, destination] = route.split(' → ');
            return { origin, destination, count };
          })
          .sort((a, b) => b.count - a.count)
          .slice(0, 3);

        // Calcular prazo médio de pagamento
        let avgPaymentDays = 0;
        if (revenues && revenues.length > 0) {
          const paymentDays = revenues
            .filter(r => r.date && r.payment_date)
            .map(r => {
              const emissionDate = new Date(r.date);
              const receivedDate = new Date(r.payment_date);
              return Math.floor((receivedDate.getTime() - emissionDate.getTime()) / (1000 * 60 * 60 * 24));
            });
          
          if (paymentDays.length > 0) {
            avgPaymentDays = paymentDays.reduce((sum, d) => sum + d, 0) / paymentDays.length;
          }
        }

        customerProfitability.push({
          customerId: customer.id,
          customerName: customer.name,
          customerDocument: customer.document,
          totalRevenue: fallbackRevenue,
          totalExpenses,
          profit,
          margin,
          journeyCount,
          avgTicket,
          avgCostPerKm,
          totalDistance,
          topRoutes,
          avgPaymentDays,
        });
      }

      // Ordenar por margem (do melhor para o pior)
      customerProfitability.sort((a, b) => b.margin - a.margin);

      setData(customerProfitability);
    } catch (err: any) {
      console.error('Error fetching customer profitability:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const bestCustomer = data.length > 0 ? data[0] : null;
  const worstCustomer = data.length > 1 ? data[data.length - 1] : null;

  return {
    data,
    bestCustomer,
    worstCustomer,
    loading,
    error,
    refetch: fetchCustomerProfitability,
  };
}
