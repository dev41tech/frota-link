import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { 
  TrendingUp, 
  TrendingDown, 
  CheckCircle, 
  Clock, 
  XCircle,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import type { ReconciliationStats as Stats } from '@/hooks/useBankReconciliation';

interface ReconciliationStatsProps {
  stats: Stats | null;
}

export function ReconciliationStats({ stats }: ReconciliationStatsProps) {
  if (!stats) return null;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const progressPercent = stats.totalTransactions > 0
    ? Math.round((stats.reconciledCount / stats.totalTransactions) * 100)
    : 0;

  const creditsProgress = stats.totalCredits > 0
    ? Math.round((stats.reconciledCredits / stats.totalCredits) * 100)
    : 0;

  const debitsProgress = stats.totalDebits > 0
    ? Math.round((stats.reconciledDebits / stats.totalDebits) * 100)
    : 0;

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Total de Transações
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.totalTransactions}</div>
          <Progress value={progressPercent} className="mt-2 h-2" />
          <p className="text-xs text-muted-foreground mt-1">
            {progressPercent}% conciliado
          </p>
        </CardContent>
      </Card>

      <Card className="border-green-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2 text-green-700">
            <CheckCircle className="h-4 w-4" />
            Conciliadas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-600">{stats.reconciledCount}</div>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-muted-foreground">de {stats.totalTransactions}</span>
          </div>
        </CardContent>
      </Card>

      <Card className="border-orange-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2 text-orange-700">
            <Clock className="h-4 w-4" />
            Pendentes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-orange-600">{stats.pendingCount}</div>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-muted-foreground">
              {stats.pendingCount > 0 ? 'aguardando conciliação' : 'tudo conciliado'}
            </span>
          </div>
        </CardContent>
      </Card>

      <Card className="border-muted">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
            <XCircle className="h-4 w-4" />
            Ignoradas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-muted-foreground">{stats.ignoredCount}</div>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-muted-foreground">
              transações desconsideradas
            </span>
          </div>
        </CardContent>
      </Card>

      <Card className="md:col-span-2">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <ArrowUpRight className="h-4 w-4 text-green-600" />
            Créditos (Entradas)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-between items-center">
            <div>
              <div className="text-xl font-bold text-green-600">
                {formatCurrency(stats.totalCredits)}
              </div>
              <p className="text-xs text-muted-foreground">
                {formatCurrency(stats.reconciledCredits)} conciliado
              </p>
            </div>
            <div className="text-right">
              <Progress value={creditsProgress} className="w-24 h-2" />
              <p className="text-xs text-muted-foreground mt-1">{creditsProgress}%</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="md:col-span-2">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <ArrowDownRight className="h-4 w-4 text-red-600" />
            Débitos (Saídas)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-between items-center">
            <div>
              <div className="text-xl font-bold text-red-600">
                {formatCurrency(stats.totalDebits)}
              </div>
              <p className="text-xs text-muted-foreground">
                {formatCurrency(stats.reconciledDebits)} conciliado
              </p>
            </div>
            <div className="text-right">
              <Progress value={debitsProgress} className="w-24 h-2" />
              <p className="text-xs text-muted-foreground mt-1">{debitsProgress}%</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
