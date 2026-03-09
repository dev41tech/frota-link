import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { usePasswordChangeRequired } from '@/hooks/usePasswordChangeRequired';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Eye, EyeOff, Lock, AlertTriangle, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export function ForcePasswordChange() {
  const { user } = useAuth();
  const { markPasswordChanged } = usePasswordChangeRequired();
  const { toast } = useToast();
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false
  });
  const [isChanging, setIsChanging] = useState(false);

  const validatePassword = (password: string) => {
    const minLength = password.length >= 8;
    const hasUpper = /[A-Z]/.test(password);
    const hasLower = /[a-z]/.test(password);
    const hasNumber = /\d/.test(password);
    const hasSymbol = /[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(password);
    
    return {
      minLength,
      hasUpper,
      hasLower,
      hasNumber,
      hasSymbol,
      isValid: minLength && hasUpper && hasLower && hasNumber && hasSymbol
    };
  };

  const passwordValidation = validatePassword(passwordData.newPassword);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast({
        title: "Erro",
        description: "As senhas não coincidem.",
        variant: "destructive"
      });
      return;
    }

    if (!passwordValidation.isValid) {
      toast({
        title: "Erro",
        description: "A nova senha não atende aos critérios de segurança.",
        variant: "destructive"
      });
      return;
    }

    setIsChanging(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: passwordData.newPassword
      });

      if (error) throw error;

      await markPasswordChanged();

      toast({
        title: "Sucesso",
        description: "Senha alterada com sucesso! Você pode agora usar o sistema.",
      });

    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Erro ao alterar senha.",
        variant: "destructive"
      });
    } finally {
      setIsChanging(false);
    }
  };

  const ValidationItem = ({ isValid, text }: { isValid: boolean; text: string }) => (
    <div className={`flex items-center space-x-2 text-sm ${isValid ? 'text-green-600' : 'text-red-600'}`}>
      {isValid ? <CheckCircle className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
      <span>{text}</span>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-hero flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 p-3 bg-orange-100 rounded-full w-fit">
            <AlertTriangle className="h-8 w-8 text-orange-600" />
          </div>
          <CardTitle className="text-2xl">Alteração de Senha Obrigatória</CardTitle>
          <CardDescription>
            Por segurança, você deve alterar sua senha temporária antes de acessar o sistema.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert className="mb-6 border-orange-200 bg-orange-50">
            <AlertTriangle className="h-4 w-4 text-orange-600" />
            <AlertDescription className="text-orange-800">
              <strong>Primeiro acesso detectado!</strong><br />
              Sua senha atual é temporária e deve ser alterada por motivos de segurança.
            </AlertDescription>
          </Alert>

          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="current">Senha Atual (Temporária)</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="current"
                  type={showPasswords.current ? "text" : "password"}
                  value={passwordData.currentPassword}
                  onChange={(e) => setPasswordData(prev => ({ ...prev, currentPassword: e.target.value }))}
                  className="pl-10 pr-10"
                  placeholder="Digite sua senha temporária"
                  required
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowPasswords(prev => ({ ...prev, current: !prev.current }))}
                >
                  {showPasswords.current ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="new">Nova Senha</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="new"
                  type={showPasswords.new ? "text" : "password"}
                  value={passwordData.newPassword}
                  onChange={(e) => setPasswordData(prev => ({ ...prev, newPassword: e.target.value }))}
                  className="pl-10 pr-10"
                  placeholder="Digite sua nova senha segura"
                  required
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowPasswords(prev => ({ ...prev, new: !prev.new }))}
                >
                  {showPasswords.new ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              
              {passwordData.newPassword && (
                <div className="mt-3 p-3 bg-gray-50 rounded-lg space-y-2">
                  <p className="text-sm font-medium text-gray-700">Critérios de segurança:</p>
                  <ValidationItem isValid={passwordValidation.minLength} text="Mínimo 8 caracteres" />
                  <ValidationItem isValid={passwordValidation.hasUpper} text="Pelo menos 1 letra maiúscula" />
                  <ValidationItem isValid={passwordValidation.hasLower} text="Pelo menos 1 letra minúscula" />
                  <ValidationItem isValid={passwordValidation.hasNumber} text="Pelo menos 1 número" />
                  <ValidationItem isValid={passwordValidation.hasSymbol} text="Pelo menos 1 símbolo (!@#$%...)" />
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm">Confirmar Nova Senha</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="confirm"
                  type={showPasswords.confirm ? "text" : "password"}
                  value={passwordData.confirmPassword}
                  onChange={(e) => setPasswordData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                  className="pl-10 pr-10"
                  placeholder="Digite novamente sua nova senha"
                  required
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowPasswords(prev => ({ ...prev, confirm: !prev.confirm }))}
                >
                  {showPasswords.confirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              
              {passwordData.confirmPassword && passwordData.newPassword !== passwordData.confirmPassword && (
                <p className="text-sm text-red-600 flex items-center space-x-1">
                  <AlertTriangle className="h-4 w-4" />
                  <span>As senhas não coincidem</span>
                </p>
              )}
            </div>

            <Button 
              type="submit" 
              className="w-full"
              disabled={
                isChanging || 
                !passwordValidation.isValid || 
                passwordData.newPassword !== passwordData.confirmPassword ||
                !passwordData.currentPassword
              }
            >
              {isChanging ? "Alterando..." : "Alterar Senha e Continuar"}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-muted-foreground">
            <p>Após alterar sua senha, você poderá acessar todas as funcionalidades do sistema.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}