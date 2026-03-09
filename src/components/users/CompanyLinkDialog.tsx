import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useMultiTenant } from '@/hooks/useMultiTenant';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Building2, Link } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Company {
  id: string;
  name: string;
  cnpj: string;
}

interface CompanyLinkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  userName: string;
  currentCompanyId?: string;
  onSuccess: () => void;
}

export default function CompanyLinkDialog({ 
  open, 
  onOpenChange, 
  userId, 
  userName, 
  currentCompanyId,
  onSuccess 
}: CompanyLinkDialogProps) {
  const { availableCompanies } = useMultiTenant();
  const { toast } = useToast();
  const [selectedCompanyId, setSelectedCompanyId] = useState(currentCompanyId || '');
  const [loading, setLoading] = useState(false);

  const handleLinkCompany = async () => {
    if (!selectedCompanyId) {
      toast({
        title: "Erro",
        description: "Selecione uma empresa",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      // Atualizar o perfil do usuário com a empresa
      const { error } = await supabase
        .from('profiles')
        .update({ 
          company_id: selectedCompanyId,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: `Usuário ${userName} vinculado à empresa com sucesso!`,
      });

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link className="w-5 h-5" />
            Vincular Usuário à Empresa
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Building2 className="w-4 h-4" />
                Usuário
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-medium">{userName}</p>
            </CardContent>
          </Card>

          <div className="space-y-2">
            <label className="text-sm font-medium">Empresa</label>
            <Select value={selectedCompanyId} onValueChange={setSelectedCompanyId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma empresa" />
              </SelectTrigger>
              <SelectContent>
                {availableCompanies.map((company) => (
                  <SelectItem key={company.id} value={company.id}>
                    <div className="flex flex-col items-start">
                      <span className="font-medium">{company.name}</span>
                      <span className="text-xs text-muted-foreground">{company.cnpj}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleLinkCompany}
              disabled={loading || !selectedCompanyId}
            >
              {loading ? "Vinculando..." : "Vincular"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}