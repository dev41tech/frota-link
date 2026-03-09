import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useMultiTenant } from '@/hooks/useMultiTenant';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, getMarginBadge } from '@/lib/profitabilityCalculations';
import { ArrowUpDown, AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface Journey {
  id: string;
  journey_number: string;
  origin: string;
  destination: string;
  freight_value: number;
  vehicles: { plate: string; model: string } | null;
  drivers: { name: string } | null;
}

interface JourneyProfit {
  journey: Journey;
  revenue: number;
  revenueSource: 'revenue_table' | 'freight_value';
  expenses: number;
  profit: number;
  margin: number;
}

export type ReportViewMode = 'competency' | 'journey';

interface JourneyProfitTableProps {
  startDate?: Date;
  endDate?: Date;
  viewMode?: ReportViewMode;
  onDateRangeChange?: (range: { start?: Date; end?: Date }) => void;
}

export function JourneyProfitTable({ startDate, endDate, viewMode = 'competency', onDateRangeChange }: JourneyProfitTableProps) {
  const { user } = useAuth();
  const { currentCompany } = useMultiTenant();
  const [data, setData] = useState<JourneyProfit[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortColumn, setSortColumn] = useState<keyof JourneyProfit>('margin');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [dataQualityWarning, setDataQualityWarning] = useState<string | null>(null);

  useEffect(() => {
    if (user && currentCompany) {
      fetchData();
    }
  }, [user, currentCompany, startDate, endDate, viewMode]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Buscar jornadas do período, incluindo as que têm start_date NULL mas end_date no período
      let query = supabase
        .from('journeys')
        .select(`
          *,
          vehicles(plate, model),
          drivers(name)
        `)
        .eq('status', 'completed')
        .order('start_date', { ascending: false });

      if (startDate && endDate) {
        // Incluir jornadas com start_date no período OU jornadas com start_date NULL mas end_date no período
        query = query.or(`and(start_date.gte.${startDate.toISOString()},start_date.lte.${endDate.toISOString()}),and(start_date.is.null,end_date.gte.${startDate.toISOString()},end_date.lte.${endDate.toISOString()})`);
      } else if (startDate) {
        query = query.or(`start_date.gte.${startDate.toISOString()},and(start_date.is.null,end_date.gte.${startDate.toISOString()})`);
      } else if (endDate) {
        query = query.or(`start_date.lte.${endDate.toISOString()},and(start_date.is.null,end_date.lte.${endDate.toISOString()})`);
      }

      const { data: journeys, error: journeyError } = await query;
      if (journeyError) throw journeyError;

      const journeyIds = (journeys || []).map(j => j.id);
      let journeysUsingFreightValue = 0;

      // No modo "journey", buscar receitas/despesas de TODAS as jornadas do período
      // No modo "competency", buscar receitas/despesas filtradas por data individual

      const profitData: JourneyProfit[] = await Promise.all(
        (journeys || []).map(async (journey) => {
          // Buscar receita da tabela revenue
          let revenueQuery = supabase
            .from('revenue')
            .select('amount')
            .eq('journey_id', journey.id);
          
          // No modo competência, filtrar por data da receita
          if (viewMode === 'competency' && startDate && endDate) {
            revenueQuery = revenueQuery
              .gte('date', startDate.toISOString())
              .lte('date', endDate.toISOString());
          }
          
          const { data: revenues } = await revenueQuery;
          const revenueFromTable = revenues?.reduce((sum, r) => sum + (r.amount || 0), 0) || 0;
          
          // Usar freight_value como fallback
          let revenue: number;
          let revenueSource: 'revenue_table' | 'freight_value';
          
          if (revenueFromTable > 0) {
            revenue = revenueFromTable;
            revenueSource = 'revenue_table';
          } else {
            revenue = journey.freight_value || 0;
            revenueSource = 'freight_value';
            if (revenue > 0) {
              journeysUsingFreightValue++;
            }
          }

          // Fetch expenses
          let expensesQuery = supabase
            .from('expenses')
            .select('amount')
            .eq('journey_id', journey.id);
          
          if (viewMode === 'competency' && startDate && endDate) {
            expensesQuery = expensesQuery
              .gte('date', startDate.toISOString())
              .lte('date', endDate.toISOString());
          }
          
          const { data: expenses } = await expensesQuery;

          // Fetch fuel expenses
          let fuelQuery = supabase
            .from('fuel_expenses')
            .select('total_amount')
            .eq('journey_id', journey.id);
          
          if (viewMode === 'competency' && startDate && endDate) {
            fuelQuery = fuelQuery
              .gte('date', startDate.toISOString())
              .lte('date', endDate.toISOString());
          }
          
          const { data: fuelExpenses } = await fuelQuery;

          const totalExpenses =
            (expenses?.reduce((sum, e) => sum + e.amount, 0) || 0) +
            (fuelExpenses?.reduce((sum, f) => sum + f.total_amount, 0) || 0);
          const profit = revenue - totalExpenses;
          const margin = revenue > 0 ? (profit / revenue) * 100 : 0;

          return {
            journey,
            revenue,
            revenueSource,
            expenses: totalExpenses,
            profit,
            margin
          };
        })
      );

      // Set data quality warning
      if (journeysUsingFreightValue > 0) {
        setDataQualityWarning(
          `${journeysUsingFreightValue} jornada(s) usando valor de frete planejado. Cadastre receitas reais para maior precisão.`
        );
      } else {
        setDataQualityWarning(null);
      }

      setData(profitData);
    } catch (error) {
      console.error('Error fetching journey profitability:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (column: keyof JourneyProfit) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('desc');
    }
  };

  const filteredAndSorted = data
    .filter((item) => {
      const searchLower = searchTerm.toLowerCase();
      return (
        item.journey.journey_number.toLowerCase().includes(searchLower) ||
        item.journey.origin.toLowerCase().includes(searchLower) ||
        item.journey.destination.toLowerCase().includes(searchLower) ||
        item.journey.vehicles?.plate.toLowerCase().includes(searchLower) ||
        item.journey.drivers?.name.toLowerCase().includes(searchLower)
      );
    })
    .sort((a, b) => {
      const aVal = a[sortColumn];
      const bVal = b[sortColumn];
      
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
      }
      return 0;
    });

  const getMarginColor = (margin: number) => {
    if (margin >= 80) return 'text-success';
    if (margin >= 60) return 'text-primary';
    if (margin >= 40) return 'text-warning';
    return 'text-destructive';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Lucratividade por Jornada</CardTitle>
        <div className="flex gap-2 mt-4">
          <Input
            placeholder="Buscar por jornada, rota, veículo ou motorista..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-md"
          />
        </div>
      </CardHeader>
      <CardContent>
        {dataQualityWarning && (
          <Alert className="mb-4 border-warning/50 bg-warning/10">
            <AlertTriangle className="h-4 w-4 text-warning" />
            <AlertDescription className="text-sm text-warning">
              {dataQualityWarning}
            </AlertDescription>
          </Alert>
        )}
        
        {loading ? (
          <p className="text-muted-foreground text-center py-8">Carregando...</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Jornada</TableHead>
                  <TableHead>Rota</TableHead>
                  <TableHead>Veículo</TableHead>
                  <TableHead>Motorista</TableHead>
                  <TableHead className="text-right cursor-pointer" onClick={() => handleSort('revenue')}>
                    Receita <ArrowUpDown className="h-4 w-4 inline ml-1" />
                  </TableHead>
                  <TableHead className="text-right cursor-pointer" onClick={() => handleSort('expenses')}>
                    Despesas <ArrowUpDown className="h-4 w-4 inline ml-1" />
                  </TableHead>
                  <TableHead className="text-right cursor-pointer" onClick={() => handleSort('profit')}>
                    Lucro <ArrowUpDown className="h-4 w-4 inline ml-1" />
                  </TableHead>
                  <TableHead className="text-right cursor-pointer" onClick={() => handleSort('margin')}>
                    Margem <ArrowUpDown className="h-4 w-4 inline ml-1" />
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAndSorted.map((item) => (
                  <TableRow key={item.journey.id}>
                    <TableCell className="font-medium">{item.journey.journey_number}</TableCell>
                    <TableCell>
                      {item.journey.origin} → {item.journey.destination}
                    </TableCell>
                    <TableCell>
                      {item.journey.vehicles?.plate || '-'} {item.journey.vehicles?.model || ''}
                    </TableCell>
                    <TableCell>{item.journey.drivers?.name || '-'}</TableCell>
                    <TableCell className="text-right">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className={item.revenueSource === 'freight_value' ? 'text-warning cursor-help' : ''}>
                              {formatCurrency(item.revenue)}
                              {item.revenueSource === 'freight_value' && ' *'}
                            </span>
                          </TooltipTrigger>
                          {item.revenueSource === 'freight_value' && (
                            <TooltipContent>
                              <p>Usando valor de frete planejado (não há receita cadastrada)</p>
                            </TooltipContent>
                          )}
                        </Tooltip>
                      </TooltipProvider>
                    </TableCell>
                    <TableCell className="text-right">{formatCurrency(item.expenses)}</TableCell>
                    <TableCell className={`text-right font-semibold ${item.profit >= 0 ? 'text-success' : 'text-destructive'}`}>
                      {formatCurrency(item.profit)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant="outline" className={getMarginColor(item.margin)}>
                        {item.margin.toFixed(1)}% • {getMarginBadge(item.margin)}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredAndSorted.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                      Nenhuma jornada encontrada
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
