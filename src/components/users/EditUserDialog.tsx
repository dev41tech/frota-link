import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useMultiTenant } from "@/hooks/useMultiTenant";
import { Loader2, Shield } from "lucide-react";

interface EditUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string | null;
  onSuccess: () => void;
}

export function EditUserDialog({ open, onOpenChange, userId, onSuccess }: EditUserDialogProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    phone: "",
    role: "admin" as "master" | "admin" | "gestor" | "motorista" | "driver" | "bpo" | "suporte",
    company_id: "",
  });
  const [driverPermissions, setDriverPermissions] = useState({
    can_start_journey: true,
    can_create_journey_without_approval: false,
    can_auto_close_journey: false,
    can_add_revenue: false,
  });
  const { toast } = useToast();
  const { availableCompanies, userProfile } = useMultiTenant();

  useEffect(() => {
    if (userId && open) {
      fetchUserData();
    }
  }, [userId, open]);

  const fetchUserData = async () => {
    if (!userId) return;

    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", userId)
        .single();

      if (error) throw error;

      setFormData({
        full_name: data.full_name || "",
        email: data.email || "",
        phone: data.phone || "",
        role: data.role || "admin",
        company_id: data.company_id || "",
      });

      // Load driver permissions if motorista
      if (data.role === 'motorista' || data.role === 'driver') {
        const { data: driverData } = await supabase
          .from('drivers')
          .select('can_start_journey, can_create_journey_without_approval, can_auto_close_journey, can_add_revenue')
          .eq('auth_user_id', userId)
          .maybeSingle();

        if (driverData) {
          setDriverPermissions({
            can_start_journey: driverData.can_start_journey ?? true,
            can_create_journey_without_approval: driverData.can_create_journey_without_approval ?? false,
            can_auto_close_journey: driverData.can_auto_close_journey ?? false,
            can_add_revenue: driverData.can_add_revenue ?? false,
          });
        }
      }
    } catch (error: any) {
      toast({
        title: "Erro ao carregar dados",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;

    setLoading(true);

    try {
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          full_name: formData.full_name,
          phone: formData.phone,
          company_id: formData.role === 'master' ? null : formData.company_id,
          role: formData.role,
        })
        .eq("user_id", userId);

      if (profileError) throw profileError;

      // Update driver permissions if motorista
      if (formData.role === 'motorista' || formData.role === 'driver') {
        await supabase
          .from('drivers')
          .update({
            can_start_journey: driverPermissions.can_start_journey,
            can_create_journey_without_approval: driverPermissions.can_create_journey_without_approval,
            can_auto_close_journey: driverPermissions.can_auto_close_journey,
            can_add_revenue: driverPermissions.can_add_revenue,
          })
          .eq('auth_user_id', userId);
      }

      // DELETE all existing roles for this user, then INSERT the new one
      const { error: deleteError } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", userId);

      if (deleteError) throw deleteError;

      const { error: insertError } = await supabase
        .from("user_roles")
        .insert({
          user_id: userId,
          company_id: formData.role === 'master' ? null : formData.company_id,
          role: formData.role,
        });

      if (insertError) throw insertError;

      toast({
        title: "Usuário atualizado",
        description: "Dados alterados com sucesso",
      });
      
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Erro ao atualizar usuário",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const isDriver = formData.role === 'motorista' || formData.role === 'driver';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Editar Usuário</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="full_name">Nome Completo</Label>
            <Input
              id="full_name"
              value={formData.full_name}
              onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              disabled
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Telefone</Label>
            <Input
              id="phone"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="company">Empresa</Label>
            <Select
              value={formData.company_id}
              onValueChange={(value) => setFormData({ ...formData, company_id: value })}
              disabled={formData.role === 'master'}
              required={formData.role !== 'master'}
            >
              <SelectTrigger>
                <SelectValue placeholder={formData.role === 'master' ? "Master não precisa de empresa" : "Selecione uma empresa"} />
              </SelectTrigger>
              <SelectContent>
                {availableCompanies.map((company) => (
                  <SelectItem key={company.id} value={company.id}>
                    {company.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">Função</Label>
            <Select
              value={formData.role}
              onValueChange={(value: any) => setFormData({ ...formData, role: value, company_id: value === 'master' ? '' : formData.company_id })}
              required
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {userProfile?.role === 'master' && (
                  <SelectItem value="master">Master</SelectItem>
                )}
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="gestor">Gestor</SelectItem>
                <SelectItem value="motorista">Motorista</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Driver Permissions Section */}
          {isDriver && (
            <div className="space-y-3 border rounded-lg p-4 bg-muted/30">
              <Label className="text-sm font-semibold flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Permissões do App do Motorista
              </Label>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Iniciar Jornada</p>
                    <p className="text-xs text-muted-foreground">Permite iniciar jornadas pelo app</p>
                  </div>
                  <Switch
                    checked={driverPermissions.can_start_journey}
                    onCheckedChange={(checked) => setDriverPermissions(prev => ({
                      ...prev,
                      can_start_journey: checked,
                      ...(checked ? {} : { can_create_journey_without_approval: false })
                    }))}
                  />
                </div>

                {driverPermissions.can_start_journey && (
                  <div className="flex items-center justify-between ml-4">
                    <div>
                      <p className="text-sm font-medium">Criar Jornadas sem Aprovação</p>
                      <p className="text-xs text-muted-foreground">Jornada inicia direto sem aprovação</p>
                    </div>
                    <Switch
                      checked={driverPermissions.can_create_journey_without_approval}
                      onCheckedChange={(checked) => setDriverPermissions(prev => ({ ...prev, can_create_journey_without_approval: checked }))}
                    />
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Encerrar Jornada sem Aprovação</p>
                    <p className="text-xs text-muted-foreground">Encerra direto sem solicitar aprovação</p>
                  </div>
                  <Switch
                    checked={driverPermissions.can_auto_close_journey}
                    onCheckedChange={(checked) => setDriverPermissions(prev => ({ ...prev, can_auto_close_journey: checked }))}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Lançar Receitas</p>
                    <p className="text-xs text-muted-foreground">Permite registrar receitas pelo app</p>
                  </div>
                  <Switch
                    checked={driverPermissions.can_add_revenue}
                    onCheckedChange={(checked) => setDriverPermissions(prev => ({ ...prev, can_add_revenue: checked }))}
                  />
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar Alterações
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
