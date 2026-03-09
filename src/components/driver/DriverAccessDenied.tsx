import { Lock, LogOut, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";

export function DriverAccessDenied() {
  const { signOut } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut();
    navigate('/auth');
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center space-y-6">
        {/* Icon */}
        <div className="mx-auto w-20 h-20 bg-destructive/10 rounded-full flex items-center justify-center">
          <Lock className="h-10 w-10 text-destructive" />
        </div>

        {/* Title */}
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-foreground">
            Acesso ao App não Disponível
          </h1>
          <p className="text-muted-foreground">
            O plano da sua empresa não inclui acesso ao aplicativo do motorista.
          </p>
        </div>

        {/* Info Card */}
        <div className="bg-muted/50 border rounded-xl p-4 text-left">
          <h3 className="font-semibold text-foreground mb-2">O que fazer?</h3>
          <ul className="text-sm text-muted-foreground space-y-2">
            <li className="flex items-start gap-2">
              <span className="text-primary">•</span>
              <span>Entre em contato com o administrador da sua empresa</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary">•</span>
              <span>Solicite a liberação do acesso ao app do motorista</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary">•</span>
              <span>O plano Enterprise inclui acesso ao app do motorista</span>
            </li>
          </ul>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-3">
          <Button 
            variant="default" 
            onClick={handleLogout}
            className="w-full"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Voltar para Login
          </Button>
        </div>

        {/* Footer */}
        <p className="text-xs text-muted-foreground">
          Se você acredita que isso é um erro, entre em contato com o suporte.
        </p>
      </div>
    </div>
  );
}
