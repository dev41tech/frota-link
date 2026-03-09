import { useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowDownCircle, ArrowUpCircle, Trash2 } from 'lucide-react';
import { formatCurrency } from '@/lib/profitabilityCalculations';
import { type FinancialReserve } from '@/hooks/useFinancialReserves';
import { EntryDialog } from './EntryDialog';

interface ReserveCardProps {
  reserve: FinancialReserve;
  onDelete?: (id: string) => void;
}

export function ReserveCard({ reserve, onDelete }: ReserveCardProps) {
  const [entryDialogOpen, setEntryDialogOpen] = useState(false);
  const [defaultEntryType, setDefaultEntryType] = useState<'manual_deposit' | 'withdrawal'>('manual_deposit');

  const openDeposit = () => {
    setDefaultEntryType('manual_deposit');
    setEntryDialogOpen(true);
  };

  const openWithdrawal = () => {
    setDefaultEntryType('withdrawal');
    setEntryDialogOpen(true);
  };

  return (
    <>
      <Card className="overflow-hidden">
        {/* Colored Header */}
        <CardHeader
          className="pb-3 pt-4 px-5"
          style={{ backgroundColor: reserve.color }}
        >
          <div className="flex items-center justify-between">
            <h3 className="text-white font-semibold text-base truncate">{reserve.name}</h3>
            {onDelete && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-white/70 hover:text-white hover:bg-white/20"
                onClick={() => onDelete(reserve.id)}
                title="Excluir caixa"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
          {reserve.description && (
            <p className="text-white/80 text-xs mt-0.5 truncate">{reserve.description}</p>
          )}
        </CardHeader>

        <CardContent className="pt-4 pb-5 px-5 space-y-4">
          {/* Balance */}
          <div>
            <p className="text-xs text-muted-foreground">Saldo Atual</p>
            <p className="text-2xl font-bold" style={{ color: reserve.color }}>
              {formatCurrency(reserve.current_balance)}
            </p>
          </div>

          {/* Default percentage badge */}
          {reserve.default_percentage != null && reserve.default_percentage > 0 && (
            <Badge variant="secondary" className="text-xs">
              {reserve.default_percentage}% padrão
            </Badge>
          )}

          {/* Action buttons */}
          <div className="flex gap-2 pt-1">
            <Button
              size="sm"
              variant="outline"
              className="flex-1 border-green-300 text-green-700 hover:bg-green-50"
              onClick={openDeposit}
            >
              <ArrowUpCircle className="h-4 w-4 mr-1" />
              Aporte
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="flex-1 border-red-300 text-red-700 hover:bg-red-50"
              onClick={openWithdrawal}
              disabled={reserve.current_balance <= 0}
            >
              <ArrowDownCircle className="h-4 w-4 mr-1" />
              Retirada
            </Button>
          </div>
        </CardContent>
      </Card>

      <EntryDialog
        open={entryDialogOpen}
        onOpenChange={setEntryDialogOpen}
        reserve={reserve}
        defaultEntryType={defaultEntryType}
      />
    </>
  );
}
