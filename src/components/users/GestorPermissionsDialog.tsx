import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, Shield } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useGestorPermissions } from '@/hooks/useGestorPermissions';
import { SIDEBAR_MODULES } from '@/components/layout/Sidebar';

interface GestorPermissionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  userName: string;
  companyId: string;
}

export function GestorPermissionsDialog({
  open,
  onOpenChange,
  userId,
  userName,
  companyId,
}: GestorPermissionsDialogProps) {
  const { toast } = useToast();
  const { permissions, isLoading, savePermissions } = useGestorPermissions(userId, companyId);
  const [localPerms, setLocalPerms] = useState<Record<string, boolean>>({});
  const [isSaving, setIsSaving] = useState(false);

  // Sync local state when permissions are loaded
  useEffect(() => {
    if (!isLoading) {
      // Default: all enabled if not set
      const defaults: Record<string, boolean> = {};
      SIDEBAR_MODULES.forEach(m => {
        defaults[m.key] = permissions[m.key] !== undefined ? permissions[m.key] : true;
      });
      setLocalPerms(defaults);
    }
  }, [permissions, isLoading]);

  const togglePerm = (key: string) => {
    setLocalPerms(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const permsArray = SIDEBAR_MODULES.map(m => ({
        module_key: m.key,
        enabled: localPerms[m.key] ?? true,
      }));
      await savePermissions(permsArray);
      toast({ title: 'Permissoes salvas!', description: `Permissoes de "${userName}" atualizadas.` });
      onOpenChange(false);
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const enabledCount = Object.values(localPerms).filter(Boolean).length;
  const totalCount = SIDEBAR_MODULES.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-blue-600" />
            Permissoes do Gestor
          </DialogTitle>
          <DialogDescription>
            Controlando acesso de <strong>{userName}</strong>
            <Badge variant="secondary" className="ml-2 text-xs">
              {enabledCount}/{totalCount} modulos habilitados
            </Badge>
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-2">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : (
            <div className="space-y-1">
              {/* Select All / Deselect All */}
              <div className="flex justify-end gap-2 pb-3 border-b">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-xs"
                  onClick={() => {
                    const all: Record<string, boolean> = {};
                    SIDEBAR_MODULES.forEach(m => { all[m.key] = true; });
                    setLocalPerms(all);
                  }}
                >
                  Habilitar Todos
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-xs text-red-600 hover:text-red-700"
                  onClick={() => {
                    const none: Record<string, boolean> = {};
                    SIDEBAR_MODULES.forEach(m => { none[m.key] = false; });
                    setLocalPerms(none);
                  }}
                >
                  Desabilitar Todos
                </Button>
              </div>

              {SIDEBAR_MODULES.map((module) => (
                <div
                  key={module.key}
                  className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <Label
                    htmlFor={`perm-${module.key}`}
                    className="cursor-pointer text-sm font-normal flex-1"
                  >
                    {module.label}
                  </Label>
                  <Switch
                    id={`perm-${module.key}`}
                    checked={localPerms[module.key] ?? true}
                    onCheckedChange={() => togglePerm(module.key)}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter className="border-t pt-4">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={isSaving || isLoading}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              'Salvar Permissoes'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
