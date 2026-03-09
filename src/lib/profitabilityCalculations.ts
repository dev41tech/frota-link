/**
 * Profitability calculation utilities
 * Centralizes all profitability-related calculations
 */

export interface JourneyProfitData {
  revenue: number;
  directExpenses: number;
  fuelExpenses: number;
  profit: number;
  margin: number;
  profitPerKm?: number;
  plannedRevenue?: number;
}

/**
 * Calculate profitability metrics for a journey
 */
export function calculateJourneyProfit(
  revenue: number,
  directExpenses: number,
  fuelExpenses: number,
  distance?: number
): JourneyProfitData {
  const totalExpenses = directExpenses + fuelExpenses;
  const profit = revenue - totalExpenses;
  const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
  const profitPerKm = distance && distance > 0 ? profit / distance : undefined;

  return {
    revenue,
    directExpenses,
    fuelExpenses,
    profit,
    margin,
    profitPerKm
  };
}

/**
 * Get margin color classification
 */
export function getMarginColor(margin: number): 'success' | 'warning' | 'danger' {
  if (margin >= 80) return 'success';
  if (margin >= 60) return 'warning';
  return 'danger';
}

/**
 * Get margin badge text
 */
export function getMarginBadge(margin: number): string {
  if (margin >= 80) return 'Excelente';
  if (margin >= 60) return 'Normal';
  if (margin >= 40) return 'Baixa';
  return 'Crítica';
}

/**
 * Calculate expense breakdown percentages
 */
export function calculateExpenseBreakdown(expenses: Array<{ category: string; amount: number }>) {
  const total = expenses.reduce((sum, e) => sum + e.amount, 0);
  
  return expenses.map(expense => ({
    ...expense,
    percentage: total > 0 ? (expense.amount / total) * 100 : 0
  }));
}

/**
 * Format currency value
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
}

/**
 * Calculate indirect expense allocation per journey
 * Distributes indirect expenses proportionally based on total journeys or km
 */
export function allocateIndirectExpenses(
  totalIndirectExpenses: number,
  totalJourneys: number,
  journeyWeight: number = 1
): number {
  if (totalJourneys === 0) return 0;
  return (totalIndirectExpenses / totalJourneys) * journeyWeight;
}
