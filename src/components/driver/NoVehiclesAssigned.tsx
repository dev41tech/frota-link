import { AlertCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

export function NoVehiclesAssigned() {
  const { signOut } = useAuth();

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="mx-auto h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
            <AlertCircle className="h-8 w-8 text-muted-foreground" />
          </div>
          <CardTitle>Sem Veículos Atribuídos</CardTitle>
          <CardDescription>
            Você ainda não tem veículos atribuídos à sua conta.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground text-center">
            Entre em contato com seu gestor para solicitar a atribuição de um veículo.
          </p>
          <Button 
            onClick={signOut} 
            variant="outline" 
            className="w-full"
          >
            Sair
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
