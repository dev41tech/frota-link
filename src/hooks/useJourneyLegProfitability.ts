import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface LegProfitData {
  legId: string;
  legNumber: number;
  origin: string;
  destination: string;
  distance: number | null;
  status: string;
  freightValue: number;
  revenue: number;
  directExpenses: number;
  fuelExpenses: number;
  totalExpenses: number;
  profit: number;
  margin: number;
  rank: number;
}

export function useJourneyLegProfitability(journeyId: string | null) {
  const [legs, setLegs] = useState<LegProfitData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLegProfitability = async () => {
    if (!journeyId) return;

    try {
      setLoading(true);
      setError(null);

      // Fetch all legs, revenues, expenses, fuel in parallel
      const [legsRes, revenuesRes, expensesRes, fuelRes] = await Promise.all([
        supabase
          .from('journey_legs')
          .select('id, leg_number, origin, destination, distance, status, freight_value')
          .eq('journey_id', journeyId)
          .order('leg_number'),
        supabase
          .from('revenue')
          .select('journey_leg_id, amount')
          .eq('journey_id', journeyId)
          .not('journey_leg_id', 'is', null),
        supabase
          .from('expenses')
          .select('journey_leg_id, amount')
          .eq('journey_id', journeyId)
          .not('journey_leg_id', 'is', null),
        supabase
          .from('fuel_expenses')
          .select('journey_leg_id, total_amount')
          .eq('journey_id', journeyId)
          .not('journey_leg_id', 'is', null),
      ]);

      if (legsRes.error) throw legsRes.error;
      if (!legsRes.data || legsRes.data.length === 0) {
        setLegs([]);
        return;
      }

      // Build maps
      const revenueMap = new Map<string, number>();
      revenuesRes.data?.forEach(r => {
        if (r.journey_leg_id) {
          revenueMap.set(r.journey_leg_id, (revenueMap.get(r.journey_leg_id) || 0) + (r.amount || 0));
        }
      });

      const expenseMap = new Map<string, number>();
      expensesRes.data?.forEach(e => {
        if (e.journey_leg_id) {
          expenseMap.set(e.journey_leg_id, (expenseMap.get(e.journey_leg_id) || 0) + (e.amount || 0));
        }
      });

      const fuelMap = new Map<string, number>();
      fuelRes.data?.forEach(f => {
        if (f.journey_leg_id) {
          fuelMap.set(f.journey_leg_id, (fuelMap.get(f.journey_leg_id) || 0) + (f.total_amount || 0));
        }
      });

      // Calculate profitability per leg
      const legData: LegProfitData[] = legsRes.data.map(leg => {
        const revenueFromTable = revenueMap.get(leg.id) || 0;
        const revenue = revenueFromTable > 0 ? revenueFromTable : (leg.freight_value || 0);
        const directExpenses = expenseMap.get(leg.id) || 0;
        const fuelExpenses = fuelMap.get(leg.id) || 0;
        const totalExpenses = directExpenses + fuelExpenses;
        const profit = revenue - totalExpenses;
        const margin = revenue > 0 ? (profit / revenue) * 100 : 0;

        return {
          legId: leg.id,
          legNumber: leg.leg_number,
          origin: leg.origin,
          destination: leg.destination,
          distance: leg.distance,
          status: leg.status,
          freightValue: leg.freight_value || 0,
          revenue,
          directExpenses,
          fuelExpenses,
          totalExpenses,
          profit,
          margin,
          rank: 0,
        };
      });

      // Sort by profit descending and assign ranks
      const sorted = [...legData].sort((a, b) => b.profit - a.profit);
      sorted.forEach((leg, idx) => {
        leg.rank = idx + 1;
      });

      // Return in original leg_number order but with ranks assigned
      const rankedMap = new Map(sorted.map(l => [l.legId, l.rank]));
      legData.forEach(l => {
        l.rank = rankedMap.get(l.legId) || 0;
      });

      setLegs(legData);
    } catch (err: any) {
      setError(err.message);
      console.error('Error fetching leg profitability:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (journeyId) {
      fetchLegProfitability();
    } else {
      setLegs([]);
    }
  }, [journeyId]);

  return { legs, loading, error, refetch: fetchLegProfitability };
}
