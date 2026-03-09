import { useState } from "react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { generateSecurePassword } from "@/lib/userManagement";
import { Loader2 } from "lucide-react";

interface ResetPasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string | null;
  userEmail: string;
  userName: string;
}

export function ResetPasswordDialog({
  open,
  onOpenChange,
  userId,
  userEmail,
  userName,
}: ResetPasswordDialogProps) {
  const [loading, setLoading] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const { toast } = useToast();

  const handleGeneratePassword = () => {
    setNewPassword(generateSecurePassword());
  };

  const handleResetPassword = async () => {
    if (!userId || !newPassword) return;

    setLoading(true);

    try {
      const { error } = await supabase.functions.invoke("reset-user-password", {
        body: {
          user_id: userId,
          email: userEmail,
          new_password: newPassword,
        },
      });

      if (error) throw error;

      toast({
        title: "Senha redefinida",
        description: "Nova senha enviada por e-mail",
      });
      
      onOpenChange(false);
      setNewPassword("");
    } catch (error: any) {
      toast({
        title: "Erro ao redefinir senha",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Redefinir Senha</AlertDialogTitle>
          <AlertDialogDescription>
            Redefinir senha para <strong>{userName}</strong> ({userEmail})
          </AlertDialogDescription>
        </AlertDialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="new_password">Nova Senha</Label>
            <div className="flex gap-2">
              <Input
                id="new_password"
                type="text"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Digite ou gere uma senha"
              />
              <Button type="button" variant="outline" onClick={handleGeneratePassword}>
                Gerar
              </Button>
            </div>
          </div>
        </div>

        <AlertDialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleResetPassword} disabled={loading || !newPassword}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Redefinir Senha
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
