import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { CategoryBadge } from "@/components/categories/CategoryBadge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/dreCalculations";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Badge } from "@/components/ui/badge";
import { parseDateString } from "@/lib/utils";

interface CategoryDrillDownDialogProps {
  drillDownData: {
    type: 'revenue' | 'expense';
    category: any;
    data: any[];
  } | null;
  onClose: () => void;
}

export function CategoryDrillDownDialog({ drillDownData, onClose }: CategoryDrillDownDialogProps) {
  if (!drillDownData) return null;

  const { type, category, data } = drillDownData;

  // Calcular totais
  const total = data.reduce((sum, item) => sum + item.amount, 0);
  const count = data.length;
  const average = count > 0 ? total / count : 0;

  // Dados para gráfico de distribuição por mês
  const monthlyData = data.reduce((acc: any, item) => {
    const month = format(parseDateString(item.date), 'MMM/yy', { locale: ptBR });
    if (!acc[month]) {
      acc[month] = { month, total: 0, count: 0 };
    }
    acc[month].total += item.amount;
    acc[month].count += 1;
    return acc;
  }, {});

  const chartData = Object.values(monthlyData);

  // Dados para gráfico de pizza (top 5 maiores lançamentos)
  const topItems = [...data]
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5)
    .map(item => ({
      name: item.description || `${format(parseDateString(item.date), 'dd/MM/yy')}`,
      value: item.amount
    }));

  const COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

  return (
    <Dialog open={!!drillDownData} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <CategoryBadge
              name={category.name}
              icon={category.icon}
              color={category.color}
              classification={category.classification}
              showClassification={type === 'expense'}
            />
            <span>Detalhes dos Lançamentos</span>
          </DialogTitle>
          <DialogDescription>
            Análise detalhada de todos os lançamentos desta categoria no período
          </DialogDescription>
        </DialogHeader>

        {/* Cards de Resumo */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{formatCurrency(total)}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Quantidade
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{count} lançamentos</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Média por Lançamento
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{formatCurrency(average)}</p>
            </CardContent>
          </Card>
        </div>

        {/* Gráficos */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Gráfico de Barras - Distribuição Mensal */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Distribuição Mensal</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="month" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip 
                    formatter={(value) => formatCurrency(Number(value))}
                    contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }}
                    labelStyle={{ color: 'hsl(var(--foreground))' }}
                  />
                  <Bar dataKey="total" fill={category.color} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Gráfico de Pizza - Top 5 Lançamentos */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Top 5 Maiores Lançamentos</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={topItems}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={(entry: any) => formatCurrency(entry.value)}
                    outerRadius={80}
                    fill="hsl(var(--primary))"
                    dataKey="value"
                  >
                    {topItems.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value) => formatCurrency(Number(value))}
                    contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Tabela de Lançamentos */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Todos os Lançamentos ({count})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-h-[400px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Descrição</TableHead>
                    {type === 'revenue' && <TableHead>Cliente</TableHead>}
                    {type === 'expense' && <TableHead>Fornecedor</TableHead>}
                    <TableHead>Viagem</TableHead>
                    {type === 'expense' && <TableHead>Veículo</TableHead>}
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="whitespace-nowrap">
                        {format(parseDateString(item.date), 'dd/MM/yyyy')}
                      </TableCell>
                      <TableCell>{item.description}</TableCell>
                      {type === 'revenue' && <TableCell>{item.client || '-'}</TableCell>}
                      {type === 'expense' && <TableCell>{item.supplier || '-'}</TableCell>}
                      <TableCell>
                        {item.journeys?.journey_number ? (
                          <Badge variant="outline">
                            {item.journeys.journey_number}
                          </Badge>
                        ) : '-'}
                      </TableCell>
                      {type === 'expense' && (
                        <TableCell>
                          {item.vehicles?.plate || '-'}
                        </TableCell>
                      )}
                      <TableCell className="text-right font-medium">
                        {formatCurrency(item.amount)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={item.status === 'received' || item.status === 'approved' ? 'default' : 'secondary'}>
                          {item.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </DialogContent>
    </Dialog>
  );
}
