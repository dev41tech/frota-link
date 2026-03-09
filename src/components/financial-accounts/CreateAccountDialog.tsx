import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useFinancialAccounts, type FinancialAccount, type CreateAccountData, getAccountTypeLabel } from '@/hooks/useFinancialAccounts';

const PRESET_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e',
  '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#3b82f6', '#64748b',
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingAccount?: FinancialAccount | null;
}

export function CreateAccountDialog({ open, onOpenChange, editingAccount }: Props) {
  const { toast } = useToast();
  const { createAccount, updateAccount, isCreating, isUpdating } = useFinancialAccounts();

  const [form, setForm] = useState<CreateAccountData>({
    name: editingAccount?.name || '',
    type: editingAccount?.type || 'checking',
    initial_balance: editingAccount?.initial_balance ?? 0,
    initial_balance_date: editingAccount?.initial_balance_date || new Date().toISOString().split('T')[0],
    color: editingAccount?.color || '#6366f1',
  });

  // Sincronizar form quando editingAccount muda
  useState(() => {
    if (editingAccount) {
      setForm({
        name: editingAccount.name,
        type: editingAccount.type,
        initial_balance: editingAccount.initial_balance,
        initial_balance_date: editingAccount.initial_balance_date,
        color: editingAccount.color,
      });
    }
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingAccount) {
        await updateAccount({ id: editingAccount.id, ...form });
        toast({ title: 'Conta atualizada com sucesso!' });
      } else {
        await createAccount(form);
        toast({ title: 'Conta criada com sucesso!' });
        setForm({ name: '', type: 'checking', initial_balance: 0, initial_balance_date: new Date().toISOString().split('T')[0], color: '#6366f1' });
      }
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editingAccount ? 'Editar Conta' : 'Nova Conta / Carteira'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome da Conta *</Label>
            <Input
              id="name"
              placeholder="Ex: Itaú Corrente, Caixa Físico..."
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Tipo de Conta *</Label>
            <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v as any }))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="checking">Conta Corrente</SelectItem>
                <SelectItem value="savings">Conta Poupança</SelectItem>
                <SelectItem value="cash">Dinheiro Físico</SelectItem>
                <SelectItem value="reserve">Reserva / Caixinha</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="initial_balance">Saldo Inicial (R$) *</Label>
              <Input
                id="initial_balance"
                type="number"
                step="0.01"
                value={form.initial_balance}
                onChange={e => setForm(f => ({ ...f, initial_balance: parseFloat(e.target.value) || 0 }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="initial_balance_date">Data do Saldo Inicial *</Label>
              <Input
                id="initial_balance_date"
                type="date"
                value={form.initial_balance_date}
                onChange={e => setForm(f => ({ ...f, initial_balance_date: e.target.value }))}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Cor</Label>
            <div className="flex gap-2 flex-wrap">
              {PRESET_COLORS.map(color => (
                <button
                  key={color}
                  type="button"
                  className={`w-8 h-8 rounded-full border-2 transition-all ${form.color === color ? 'border-foreground scale-110' : 'border-transparent'}`}
                  style={{ backgroundColor: color }}
                  onClick={() => setForm(f => ({ ...f, color }))}
                />
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isCreating || isUpdating}>
              {(isCreating || isUpdating) ? 'Salvando...' : editingAccount ? 'Atualizar' : 'Criar Conta'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
