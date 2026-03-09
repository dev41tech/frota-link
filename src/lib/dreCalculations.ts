/**
 * Cálculos e utilitários para o Demonstrativo de Resultado do Exercício (DRE)
 */

export interface CategoryData {
  id: string;
  name: string;
  icon: string;
  color: string;
  amount: number;
  classification?: 'direct' | 'indirect';
}

export interface DREData {
  period: {
    start: Date;
    end: Date;
  };
  journeys: {
    count: number;
    totalDistance: number;
  };
  revenue: {
    total: number;
    categories: CategoryData[];
  };
  cashFlow: {
    advances: number;
    commissions: number;
    balance: number;
  };
  directExpenses: {
    categories: CategoryData[];
    fuel: {
      total: number;
      liters: number;
    };
    maintenance: {
      total: number;
      count: number;
    };
    paidAccounts: {
      total: number;
      count: number;
    };
    total: number;
  };
  indirectExpenses: {
    categories: CategoryData[];
    paidAccounts: {
      total: number;
      count: number;
    };
    total: number;
  };
  pendingAccounts: {
    total: number;
  };
  result: {
    profit: number;
    margin: number;
  };
  indicators: {
    financial: {
      revenuePerKm: number;
      profitPerKm: number;
      marginPercent: number;
    };
    operational: {
      totalVolume: number;
      avgPrice: number;
      avgConsumption: number;
    };
  };
}

/**
 * Agrupa itens por categoria com dados enriquecidos (nome, ícone, cor)
 */
export function groupByCategoryEnriched(
  items: Array<{
    category_id: string | null;
    amount: number;
    expense_categories?: {
      id: string;
      name: string;
      icon: string;
      color: string;
      classification: string;
    } | null;
    revenue_categories?: {
      id: string;
      name: string;
      icon: string;
      color: string;
    } | null;
  }>
): CategoryData[] {
  const grouped = new Map<string, CategoryData>();
  
  items?.forEach((item) => {
    const category = item.expense_categories || item.revenue_categories;
    if (!category) return;
    const categoryId = item.category_id || category.id;
    
    const existing = grouped.get(categoryId);
    if (existing) {
      existing.amount += item.amount;
    } else {
      grouped.set(categoryId, {
        id: categoryId,
        name: category.name,
        icon: category.icon,
        color: category.color,
        amount: item.amount,
        classification: item.expense_categories?.classification as 'direct' | 'indirect' | undefined,
      });
    }
  });
  
  return Array.from(grouped.values());
}

/**
 * Agrupa despesas por categoria
 */
export function groupByCategory(expenses: Array<{ category: string; amount: number }>): Record<string, number> {
  const grouped: Record<string, number> = {};
  expenses?.forEach((e) => {
    grouped[e.category] = (grouped[e.category] || 0) + e.amount;
  });
  return grouped;
}

/**
 * Calcula o resultado final do DRE
 */
export function calculateDREResult(
  totalRevenue: number,
  totalDirectExpenses: number,
  totalIndirectExpenses: number
): { profit: number; margin: number } {
  const totalExpenses = totalDirectExpenses + totalIndirectExpenses;
  const profit = totalRevenue - totalExpenses;
  const margin = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0;

  return { profit, margin };
}

/**
 * Calcula indicadores financeiros
 */
export function calculateFinancialIndicators(
  totalRevenue: number,
  profit: number,
  totalDistance: number,
  margin: number
): { revenuePerKm: number; profitPerKm: number; marginPercent: number } {
  return {
    revenuePerKm: totalDistance > 0 ? totalRevenue / totalDistance : 0,
    profitPerKm: totalDistance > 0 ? profit / totalDistance : 0,
    marginPercent: margin,
  };
}

/**
 * Calcula indicadores operacionais
 */
export function calculateOperationalIndicators(
  totalLiters: number,
  totalFuelCost: number,
  totalDistance: number
): { totalVolume: number; avgPrice: number; avgConsumption: number } {
  return {
    totalVolume: totalLiters,
    avgPrice: totalLiters > 0 ? totalFuelCost / totalLiters : 0,
    avgConsumption: totalLiters > 0 ? totalDistance / totalLiters : 0,
  };
}

/**
 * Formata valor monetário
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}
