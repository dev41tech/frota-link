import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, PiggyBank, Loader2, ArrowUpCircle, ArrowDownCircle, Route } from 'lucide-react';
import { formatCurrency } from '@/lib/profitabilityCalculations';
import { useFinancialReserves } from '@/hooks/useFinancialReserves';
import { CreateReserveDialog } from '@/components/financial-reserves/CreateReserveDialog';
import { ReserveCard } from '@/components/financial-reserves/ReserveCard';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function FinancialReserves() {
  const { toast } = useToast();
  const { reserves, entries, isLoading, isLoadingEntries, deleteReserve } = useFinancialReserves();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const handleDeleteReserve = async (id: string) => {
    const reserve = reserves.find(r => r.id === id);
    if (!reserve) return;
    if (!confirm(`Excluir a caixa "${reserve.name}"? Esta ação não pode ser desfeita.`)) return;

    try {
      await deleteReserve(id);
      toast({ title: 'Caixa excluída', description: `"${reserve.name}" foi removida.` });
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    }
  };

  const getEntryTypeLabel = (type: string) => {
    switch (type) {
      case 'journey_contribution': return 'Aporte de Jornada';
      case 'manual_deposit': return 'Depósito Manual';
      case 'withdrawal': return 'Retirada';
      default: return type;
    }
  };

  const getEntryTypeColor = (type: string) => {
    switch (type) {
      case 'withdrawal': return 'bg-red-100 text-red-800';
      default: return 'bg-green-100 text-green-800';
    }
  };

  const totalBalance = reserves.reduce((sum, r) => sum + r.current_balance, 0);

  if (isLoading) {
    return (
      <div className="p-8 flex justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <PiggyBank className="h-8 w-8 text-primary" />
            Caixas de Reserva
          </h1>
          <p className="text-muted-foreground">Gerencie seus fundos de reserva e aportes automáticos</p>
        </div>
        <Button
          className="bg-gradient-primary shadow-primary"
          onClick={() => setCreateDialogOpen(true)}
        >
          <Plus className="h-4 w-4 mr-2" />
          Nova Caixa
        </Button>
      </div>

      {/* Summary card */}
      {reserves.length > 0 && (
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Saldo Total em Reservas</p>
                <p className="text-2xl font-bold text-primary">{formatCurrency(totalBalance)}</p>
              </div>
              <PiggyBank className="h-10 w-10 text-primary/30" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Reserve Cards Grid */}
      {reserves.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <PiggyBank className="h-14 w-14 text-muted-foreground/40 mb-4" />
            <h3 className="text-lg font-semibold text-muted-foreground">Nenhuma caixa de reserva</h3>
            <p className="text-sm text-muted-foreground mt-1 mb-4">
              Crie caixas para acumular recursos automaticamente nas jornadas.
            </p>
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Criar Primeira Caixa
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {reserves.map((reserve) => (
            <ReserveCard
              key={reserve.id}
              reserve={reserve}
              onDelete={handleDeleteReserve}
            />
          ))}
        </div>
      )}

      {/* Entries History */}
      {(entries.length > 0 || !isLoadingEntries) && (
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Route className="h-5 w-5" />
              Historico de Movimentacoes
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoadingEntries ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : entries.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                Nenhuma movimentacao registrada ainda.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Caixa</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Descricao</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((entry) => {
                    const reserve = reserves.find(r => r.id === entry.reserve_id);
                    const isWithdrawal = entry.entry_type === 'withdrawal';
                    return (
                      <TableRow key={entry.id}>
                        <TableCell className="text-muted-foreground text-sm">
                          {entry.date
                            ? format(new Date(entry.date), 'dd/MM/yyyy', { locale: ptBR })
                            : format(new Date(entry.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {reserve && (
                              <div
                                className="w-3 h-3 rounded-full flex-shrink-0"
                                style={{ backgroundColor: reserve.color }}
                              />
                            )}
                            <span className="font-medium text-sm">
                              {entry.reserve_name || reserve?.name || 'Caixa'}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={`text-xs ${getEntryTypeColor(entry.entry_type)}`}>
                            <span className="flex items-center gap-1">
                              {isWithdrawal
                                ? <ArrowDownCircle className="h-3 w-3" />
                                : <ArrowUpCircle className="h-3 w-3" />}
                              {getEntryTypeLabel(entry.entry_type)}
                            </span>
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {entry.description || '-'}
                          {entry.percentage_applied != null && (
                            <span className="ml-1 text-xs text-blue-600">
                              ({entry.percentage_applied}%)
                            </span>
                          )}
                        </TableCell>
                        <TableCell className={`text-right font-semibold ${isWithdrawal ? 'text-red-600' : 'text-green-600'}`}>
                          {isWithdrawal ? '-' : '+'}{formatCurrency(entry.amount)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      <CreateReserveDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
      />
    </div>
  );
}
