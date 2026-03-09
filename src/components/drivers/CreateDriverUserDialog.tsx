import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, UserPlus } from 'lucide-react';
import { generateSecurePassword, createUserWithEmailNotification } from '@/lib/userManagement';
import { useMultiTenant } from '@/hooks/useMultiTenant';
import { useAuth } from '@/hooks/useAuth';
import { usePlanFeatures } from '@/hooks/usePlanFeatures';
import { UpgradePrompt } from '@/components/subscription/UpgradePrompt';

interface CreateDriverUserDialogProps {
  driverId: string;
  driverName: string;
  driverEmail?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function CreateDriverUserDialog({
  driverId,
  driverName,
  driverEmail,
  open,
  onOpenChange,
  onSuccess
}: CreateDriverUserDialogProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const { currentCompany } = useMultiTenant();
  const { hasPWADriver, planName, isLoading: planLoading } = usePlanFeatures();
  const [email, setEmail] = useState(driverEmail || '');
  const [creating, setCreating] = useState(false);

  // Check if plan includes PWA Driver feature
  if (!planLoading && !hasPWADriver) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg p-0 overflow-hidden">
          <UpgradePrompt
            featureName="App Motorista (PWA)"
            requiredPlan="Enterprise"
            currentPlan={planName}
            onClose={() => onOpenChange(false)}
          />
        </DialogContent>
      </Dialog>
    );
  }

  const handleCreateUser = async () => {
    if (!email || !currentCompany) return;

    setCreating(true);
    try {
      // Gerar senha temporária
      const tempPassword = generateSecurePassword();

      // Criar usuário e enviar email
      const result = await createUserWithEmailNotification({
        email,
        full_name: driverName,
        company_id: currentCompany.id,
        role: 'driver',
        created_by_name: user?.email || 'Admin',
        temporary_password: tempPassword
      });

      if (!result.success || !result.user_id) {
        throw new Error(result.error || 'Erro ao criar usuário');
      }

      // Vincular auth_user_id ao motorista
      const { error: updateError } = await supabase
        .from('drivers')
        .update({ auth_user_id: result.user_id })
        .eq('id', driverId);

      if (updateError) throw updateError;

      toast({
        title: 'Sucesso',
        description: `Usuário criado! Credenciais enviadas para ${email}`
      });

      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Criar Acesso ao App para {driverName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-primary/10 p-4 rounded-lg text-sm">
            <p className="font-medium mb-2">ℹ️ Isso irá:</p>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              <li>Criar uma conta de usuário com role "Motorista"</li>
              <li>Gerar senha temporária segura</li>
              <li>Enviar email com credenciais de acesso</li>
              <li>Vincular o usuário a este motorista</li>
            </ul>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email do Motorista *</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="motorista@exemplo.com"
              required
            />
            <p className="text-xs text-muted-foreground">
              O motorista receberá as credenciais neste email
            </p>
          </div>

          <div className="flex gap-3 justify-end">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={creating}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleCreateUser}
              disabled={!email || creating}
              className="bg-gradient-primary"
            >
              {creating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Criando...
                </>
              ) : (
                <>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Criar Acesso
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
