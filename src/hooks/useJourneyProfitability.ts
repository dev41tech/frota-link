import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { calculateJourneyProfit, JourneyProfitData } from '@/lib/profitabilityCalculations';

export function useJourneyProfitability(journeyId: string | null) {
  const [profitData, setProfitData] = useState<JourneyProfitData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!journeyId) {
      setLoading(false);
      return;
    }

    fetchJourneyProfitability();
  }, [journeyId]);

  const fetchJourneyProfitability = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch journey data
      const { data: journey, error: journeyError } = await supabase
        .from('journeys')
        .select('freight_value, distance')
        .eq('id', journeyId)
        .single();

      if (journeyError) throw journeyError;

      // Fetch actual revenues linked to this journey
      const { data: revenues, error: revenuesError } = await supabase
        .from('revenue')
        .select('amount')
        .eq('journey_id', journeyId);

      if (revenuesError) throw revenuesError;

      // Fetch direct expenses
      const { data: expenses, error: expensesError } = await supabase
        .from('expenses')
        .select('amount')
        .eq('journey_id', journeyId);

      if (expensesError) throw expensesError;

      // Fetch fuel expenses
      const { data: fuelExpenses, error: fuelError } = await supabase
        .from('fuel_expenses')
        .select('total_amount')
        .eq('journey_id', journeyId);

      if (fuelError) throw fuelError;

      // Calculate actual revenue from linked revenues
      const actualRevenue = revenues?.reduce((sum, r) => sum + r.amount, 0) || 0;
      const directExpenses = expenses?.reduce((sum, e) => sum + e.amount, 0) || 0;
      const fuelExpensesTotal = fuelExpenses?.reduce((sum, f) => sum + f.total_amount, 0) || 0;
      const distance = journey?.distance || undefined;

      const calculatedProfit = calculateJourneyProfit(
        actualRevenue,
        directExpenses,
        fuelExpensesTotal,
        distance
      );

      // Add planned value for comparison
      setProfitData({
        ...calculatedProfit,
        plannedRevenue: journey?.freight_value || 0
      });
    } catch (err: any) {
      setError(err.message);
      console.error('Error fetching journey profitability:', err);
    } finally {
      setLoading(false);
    }
  };

  return { profitData, loading, error, refetch: fetchJourneyProfitability };
}
