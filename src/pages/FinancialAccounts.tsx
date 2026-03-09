import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Wallet, Plus, TrendingUp } from 'lucide-react';
import { useFinancialAccounts, type FinancialAccount } from '@/hooks/useFinancialAccounts';
import { AccountCard } from '@/components/financial-accounts/AccountCard';
import { CreateAccountDialog } from '@/components/financial-accounts/CreateAccountDialog';
import { DeleteConfirmationDialog } from '@/components/ui/delete-confirmation-dialog';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/profitabilityCalculations';

export default function FinancialAccounts() {
  const { accounts, isLoading, totalBalance, deleteAccount } = useFinancialAccounts();
  const { toast } = useToast();

  const [createOpen, setCreateOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<FinancialAccount | null>(null);
  const [deletingAccount, setDeletingAccount] = useState<FinancialAccount | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!deletingAccount) return;
    setIsDeleting(true);
    try {
      await deleteAccount(deletingAccount.id);
      toast({ title: 'Conta desativada com sucesso!' });
      setDeletingAccount(null);
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <div className="text-muted-foreground">Carregando contas...</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wallet className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Contas e Saldos</h1>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Nova Conta
        </Button>
      </div>

      {/* Card totalizador */}
      <Card className="bg-primary text-primary-foreground">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base font-medium opacity-90">
            <TrendingUp className="h-4 w-4" />
            Saldo Consolidado
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-4xl font-bold">{formatCurrency(totalBalance)}</p>
          <p className="text-sm opacity-75 mt-1">
            {accounts.length} conta{accounts.length !== 1 ? 's' : ''} ativa{accounts.length !== 1 ? 's' : ''}
          </p>
        </CardContent>
      </Card>

      {/* Grid de contas */}
      {accounts.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Wallet className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <p className="text-lg font-medium">Nenhuma conta cadastrada</p>
          <p className="text-sm">Crie sua primeira conta para controlar o fluxo de caixa</p>
          <Button className="mt-4" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Criar Primeira Conta
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {accounts.map(account => (
            <AccountCard
              key={account.id}
              account={account}
              onEdit={acc => {
                setEditingAccount(acc);
                setCreateOpen(true);
              }}
              onDelete={setDeletingAccount}
            />
          ))}
        </div>
      )}

      {/* Dialogs */}
      <CreateAccountDialog
        open={createOpen}
        onOpenChange={open => {
          setCreateOpen(open);
          if (!open) setEditingAccount(null);
        }}
        editingAccount={editingAccount}
      />

      <DeleteConfirmationDialog
        open={!!deletingAccount}
        onOpenChange={open => !open && setDeletingAccount(null)}
        onConfirm={handleDelete}
        title="Desativar conta?"
        description={`A conta "${deletingAccount?.name}" será desativada. Transações existentes serão mantidas.`}
        isDeleting={isDeleting}
      />
    </div>
  );
}
