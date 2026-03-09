import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useFinancialReserves } from '@/hooks/useFinancialReserves';

interface CreateReserveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PRESET_COLORS = [
  '#3B82F6', // blue
  '#10B981', // green
  '#F59E0B', // amber
  '#EF4444', // red
  '#8B5CF6', // purple
  '#EC4899', // pink
  '#06B6D4', // cyan
  '#F97316', // orange
];

export function CreateReserveDialog({ open, onOpenChange }: CreateReserveDialogProps) {
  const { toast } = useToast();
  const { createReserve, isCreating } = useFinancialReserves();

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    default_percentage: '',
    color: PRESET_COLORS[0],
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast({ title: 'Erro', description: 'Nome é obrigatório', variant: 'destructive' });
      return;
    }

    try {
      await createReserve({
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        default_percentage: formData.default_percentage
          ? parseFloat(formData.default_percentage)
          : undefined,
        color: formData.color,
      });
      toast({ title: 'Caixa de Reserva criada!', description: `"${formData.name}" foi criada com sucesso.` });
      setFormData({ name: '', description: '', default_percentage: '', color: PRESET_COLORS[0] });
      onOpenChange(false);
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nova Caixa de Reserva</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="reserve-name">Nome *</Label>
            <Input
              id="reserve-name"
              placeholder="Ex: Reserva de Manutenção"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="reserve-description">Descrição</Label>
            <Textarea
              id="reserve-description"
              placeholder="Finalidade desta caixa de reserva..."
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="reserve-percentage">Percentual Padrão (%)</Label>
            <Input
              id="reserve-percentage"
              type="number"
              min="0"
              max="100"
              step="0.01"
              placeholder="Ex: 5"
              value={formData.default_percentage}
              onChange={(e) => setFormData(prev => ({ ...prev, default_percentage: e.target.value }))}
            />
            <p className="text-xs text-muted-foreground">
              Percentual sugerido ao usar esta caixa como destino de despesas variáveis.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Cor</Label>
            <div className="flex gap-2 flex-wrap">
              {PRESET_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  className="w-8 h-8 rounded-full border-2 transition-transform hover:scale-110"
                  style={{
                    backgroundColor: color,
                    borderColor: formData.color === color ? '#1F2937' : 'transparent',
                    transform: formData.color === color ? 'scale(1.2)' : undefined,
                  }}
                  onClick={() => setFormData(prev => ({ ...prev, color }))}
                />
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isCreating}>
              {isCreating ? 'Criando...' : 'Criar Caixa'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
