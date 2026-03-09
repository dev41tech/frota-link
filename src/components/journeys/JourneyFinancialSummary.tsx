import { useJourneyProfitability } from '@/hooks/useJourneyProfitability';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, DollarSign, CreditCard } from 'lucide-react';
import { formatCurrency, getMarginColor, getMarginBadge } from '@/lib/profitabilityCalculations';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

interface JourneyFinancialSummaryProps {
  journeyId: string;
}

export function JourneyFinancialSummary({ journeyId }: JourneyFinancialSummaryProps) {
  const { profitData, loading, error } = useJourneyProfitability(journeyId);

  if (loading) {
    return (
      <div className="p-6 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
        <p className="text-muted-foreground mt-2">Carregando resumo financeiro...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-destructive">Erro ao carregar dados: {error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!profitData) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Nenhum dado disponível.</p>
      </div>
    );
  }

  const { revenue, directExpenses, fuelExpenses, profit, margin, profitPerKm } = profitData;

  const expenseData = [
    { name: 'Combustível', value: fuelExpenses, color: 'hsl(var(--chart-1))' },
    { name: 'Outras Despesas', value: directExpenses, color: 'hsl(var(--chart-2))' }
  ].filter(item => item.value > 0);

  const marginColorClass = getMarginColor(margin);
  const marginBadge = getMarginBadge(margin);

  return (
    <div className="p-6 space-y-6">
      {/* Cards de Indicadores */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Receita Real</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(revenue)}</div>
            {profitData.plannedRevenue && profitData.plannedRevenue !== revenue && (
              <div className="text-xs text-muted-foreground mt-1">
                Planejado: {formatCurrency(profitData.plannedRevenue)}
                {revenue > 0 && (
                  <span className={revenue >= profitData.plannedRevenue ? "text-green-600 ml-1" : "text-amber-600 ml-1"}>
                    ({revenue >= profitData.plannedRevenue ? '+' : ''}{formatCurrency(revenue - profitData.plannedRevenue)})
                  </span>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Despesas Diretas</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(directExpenses + fuelExpenses)}</div>
            <div className="text-xs text-muted-foreground mt-1">
              Combustível: {formatCurrency(fuelExpenses)}
            </div>
            <div className="text-xs text-muted-foreground">
              Outras: {formatCurrency(directExpenses)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Lucro Líquido</CardTitle>
            {profit >= 0 ? (
              <TrendingUp className="h-4 w-4 text-success" />
            ) : (
              <TrendingDown className="h-4 w-4 text-destructive" />
            )}
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${profit >= 0 ? 'text-success' : 'text-destructive'}`}>
              {formatCurrency(profit)}
            </div>
            {profitPerKm !== undefined && (
              <div className="text-xs text-muted-foreground mt-1">
                {formatCurrency(profitPerKm)}/km
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Margem de Lucro</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{margin.toFixed(1)}%</div>
            <Badge 
              variant={marginColorClass === 'success' ? 'default' : 'secondary'}
              className="mt-2"
            >
              {marginBadge}
            </Badge>
          </CardContent>
        </Card>
      </div>

      {/* Gráfico de Composição de Despesas */}
      {expenseData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Composição de Despesas</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={expenseData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry: any) => `${entry.name}: ${((entry.value / (directExpenses + fuelExpenses)) * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {expenseData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Análise e Recomendações */}
      <Card>
        <CardHeader>
          <CardTitle>Análise</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {margin >= 80 && (
            <p className="text-sm text-success">
              ✅ Excelente margem de lucro! Esta jornada está muito rentável.
            </p>
          )}
          {margin >= 60 && margin < 80 && (
            <p className="text-sm text-warning">
              ⚠️ Margem normal. Considere otimizar custos para aumentar a rentabilidade.
            </p>
          )}
          {margin >= 40 && margin < 60 && (
            <p className="text-sm text-warning">
              ⚠️ Margem baixa. Revise os custos operacionais desta rota.
            </p>
          )}
          {margin < 40 && (
            <p className="text-sm text-destructive">
              🚨 Margem crítica! Esta jornada pode estar operando com prejuízo ou margem muito baixa.
            </p>
          )}
          
          {revenue > 0 && (
            <>
              <p className="text-sm text-muted-foreground">
                Custo operacional: {((directExpenses + fuelExpenses) / revenue * 100).toFixed(1)}% da receita
              </p>
              {fuelExpenses > 0 && (
                <p className="text-sm text-muted-foreground">
                  Combustível representa {(fuelExpenses / (directExpenses + fuelExpenses) * 100).toFixed(0)}% das despesas
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
