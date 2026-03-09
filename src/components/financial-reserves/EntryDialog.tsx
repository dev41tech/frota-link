import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useFinancialReserves, type FinancialReserve } from '@/hooks/useFinancialReserves';
import { formatCurrency } from '@/lib/profitabilityCalculations';

interface EntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reserve: FinancialReserve;
  defaultEntryType?: 'manual_deposit' | 'withdrawal';
}

export function EntryDialog({ open, onOpenChange, reserve, defaultEntryType = 'manual_deposit' }: EntryDialogProps) {
  const { toast } = useToast();
  const { addEntry, isAddingEntry } = useFinancialReserves();

  const [formData, setFormData] = useState({
    amount: '',
    description: '',
    date: new Date().toISOString().split('T')[0],
    entry_type: defaultEntryType as 'manual_deposit' | 'withdrawal',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(formData.amount);
    if (!amount || amount <= 0) {
      toast({ title: 'Erro', description: 'Valor deve ser maior que zero', variant: 'destructive' });
      return;
    }

    try {
      await addEntry({
        reserve_id: reserve.id,
        amount,
        entry_type: formData.entry_type,
        description: formData.description || undefined,
        date: formData.date,
      });

      const label = formData.entry_type === 'withdrawal' ? 'Retirada' : 'Aporte';
      toast({
        title: `${label} registrado!`,
        description: `${formatCurrency(amount)} ${formData.entry_type === 'withdrawal' ? 'retirado de' : 'adicionado a'} "${reserve.name}".`,
      });
      setFormData({ amount: '', description: '', date: new Date().toISOString().split('T')[0], entry_type: defaultEntryType });
      onOpenChange(false);
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    }
  };

  const isWithdrawal = formData.entry_type === 'withdrawal';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle
            style={{ color: reserve.color }}
          >
            {reserve.name}
          </DialogTitle>
          <DialogDescription>
            Saldo atual: <strong>{formatCurrency(reserve.current_balance)}</strong>
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Tipo de Movimentação</Label>
            <Select
              value={formData.entry_type}
              onValueChange={(v) => setFormData(prev => ({ ...prev, entry_type: v as any }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="manual_deposit">Aporte (Depósito)</SelectItem>
                <SelectItem value="withdrawal">Retirada</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="entry-amount">Valor (R$) *</Label>
            <Input
              id="entry-amount"
              type="number"
              step="0.01"
              min="0.01"
              placeholder="0,00"
              value={formData.amount}
              onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
              required
            />
            {isWithdrawal && parseFloat(formData.amount) > reserve.current_balance && (
              <p className="text-xs text-red-500">
                Valor maior que o saldo disponível ({formatCurrency(reserve.current_balance)})
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="entry-description">Descrição</Label>
            <Input
              id="entry-description"
              placeholder="Motivo da movimentação..."
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="entry-date">Data</Label>
            <Input
              id="entry-date"
              type="date"
              value={formData.date}
              onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
              required
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isAddingEntry || (isWithdrawal && parseFloat(formData.amount) > reserve.current_balance)}
              className={isWithdrawal ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-green-600 hover:bg-green-700 text-white'}
            >
              {isAddingEntry ? 'Salvando...' : isWithdrawal ? 'Confirmar Retirada' : 'Confirmar Aporte'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
