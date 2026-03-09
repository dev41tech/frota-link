import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Edit, Trash2, Wallet, Landmark, PiggyBank, Coins } from 'lucide-react';
import { type FinancialAccount, getAccountTypeLabel } from '@/hooks/useFinancialAccounts';
import { formatCurrency } from '@/lib/profitabilityCalculations';

const TYPE_ICONS: Record<string, React.ElementType> = {
  checking: Landmark,
  savings: Landmark,
  cash: Coins,
  reserve: PiggyBank,
};

interface Props {
  account: FinancialAccount;
  onEdit: (account: FinancialAccount) => void;
  onDelete: (account: FinancialAccount) => void;
}

export function AccountCard({ account, onEdit, onDelete }: Props) {
  const balance = account.current_balance ?? account.initial_balance;
  const isNegative = balance < 0;
  const Icon = TYPE_ICONS[account.type] || Wallet;

  return (
    <Card className="overflow-hidden">
      {/* Cabeçalho colorido */}
      <div className="h-2 w-full" style={{ backgroundColor: account.color }} />

      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <div
              className="p-2 rounded-lg"
              style={{ backgroundColor: `${account.color}20` }}
            >
              <Icon className="h-4 w-4" style={{ color: account.color }} />
            </div>
            <div>
              <p className="font-semibold text-sm leading-tight">{account.name}</p>
              <Badge variant="outline" className="text-xs mt-0.5">
                {getAccountTypeLabel(account.type)}
              </Badge>
            </div>
          </div>
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" onClick={() => onEdit(account)} className="h-7 w-7 p-0">
              <Edit className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => onDelete(account)} className="h-7 w-7 p-0 text-destructive hover:text-destructive">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div>
          <p className="text-xs text-muted-foreground mb-1">Saldo Atual</p>
          <p className={`text-2xl font-bold ${isNegative ? 'text-destructive' : 'text-foreground'}`}>
            {formatCurrency(balance)}
          </p>
        </div>
        <div className="mt-2 text-xs text-muted-foreground">
          Saldo inicial: {formatCurrency(account.initial_balance)} em {new Date(account.initial_balance_date + 'T00:00:00').toLocaleDateString('pt-BR')}
        </div>
      </CardContent>
    </Card>
  );
}
