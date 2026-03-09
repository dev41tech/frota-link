import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { IconPicker } from "./IconPicker";
import { ColorPicker } from "./ColorPicker";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMultiTenant } from "@/hooks/useMultiTenant";
import { useAuth } from "@/hooks/useAuth";

interface CategoryFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: 'expense' | 'revenue';
  category?: any;
  onSuccess: () => void;
}

export const CategoryForm = ({ open, onOpenChange, type, category, onSuccess }: CategoryFormProps) => {
  const { currentCompany } = useMultiTenant();
  const companyId = currentCompany?.id;
  const { session } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: category?.name || '',
    classification: category?.classification || 'direct',
    icon: category?.icon || (type === 'expense' ? 'Package' : 'DollarSign'),
    color: category?.color || (type === 'expense' ? '#6B7280' : '#10B981'),
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId || !session?.user?.id) return;

    setLoading(true);
    try {
      const table = type === 'expense' ? 'expense_categories' : 'revenue_categories';
      
      // revenue_categories não possui coluna 'classification', então removemos
      const { classification, ...restFormData } = formData;
      const data = type === 'expense' 
        ? { ...formData, company_id: companyId, user_id: session.user.id }
        : { ...restFormData, company_id: companyId, user_id: session.user.id };

      if (category) {
        const { error } = await supabase
          .from(table)
          .update(data)
          .eq('id', category.id);
        if (error) throw error;
        toast.success('Categoria atualizada com sucesso');
      } else {
        const { error } = await supabase
          .from(table)
          .insert([data]);
        if (error) throw error;
        toast.success('Categoria criada com sucesso');
      }

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {category ? 'Editar' : 'Nova'} Categoria de {type === 'expense' ? 'Despesa' : 'Receita'}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>

          {type === 'expense' && (
            <div className="space-y-2">
              <Label htmlFor="classification">Tipo *</Label>
              <Select
                value={formData.classification}
                onValueChange={(value) => setFormData({ ...formData, classification: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="direct">Despesa Direta (vinculada a viagens)</SelectItem>
                  <SelectItem value="indirect">Despesa Indireta (administrativa/fixa)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label>Ícone</Label>
            <IconPicker
              value={formData.icon}
              onChange={(icon) => setFormData({ ...formData, icon })}
            />
          </div>

          <div className="space-y-2">
            <Label>Cor</Label>
            <ColorPicker
              value={formData.color}
              onChange={(color) => setFormData({ ...formData, color })}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
