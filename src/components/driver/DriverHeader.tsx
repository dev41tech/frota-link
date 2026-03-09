import { LogOut, Truck, CloudOff, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { syncPendingExpenses, isSyncInProgress } from "@/lib/offlineSync";

interface DriverHeaderProps {
  driver: {
    name: string;
    assignedVehicles: Array<{
      plate: string;
      model: string;
      brand: string;
    }>;
  };
  pendingCount?: number;
}

export function DriverHeader({ driver, pendingCount = 0 }: DriverHeaderProps) {
  const { signOut } = useAuth();
  const { toast } = useToast();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Verificar status de sync periodicamente
  useEffect(() => {
    const interval = setInterval(() => {
      setIsSyncing(isSyncInProgress());
    }, 1000);
    
    return () => clearInterval(interval);
  }, []);

  const handleSignOut = async () => {
    await signOut();
    toast({
      title: "Saiu com sucesso",
      description: "Até logo!",
    });
  };

  const handleManualSync = async () => {
    if (!isOnline || isSyncing || pendingCount === 0) return;
    
    setIsSyncing(true);
    const { success, failed } = await syncPendingExpenses();
    setIsSyncing(false);
    
    if (success > 0) {
      toast({
        title: "Sincronização concluída",
        description: `${success} lançamento(s) enviado(s)!`,
      });
    }
    
    if (failed > 0) {
      toast({
        title: "Alguns itens falharam",
        description: `${failed} será(ão) reenviado(s) automaticamente.`,
        variant: "destructive",
      });
    }
  };

  const primaryVehicle = driver.assignedVehicles[0];

  return (
    <header className="sticky top-0 z-10 bg-background border-b backdrop-blur-sm bg-background/95">
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Truck className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="font-semibold text-foreground">{driver.name}</p>
            {primaryVehicle && (
              <p className="text-xs text-muted-foreground">
                {primaryVehicle.plate} • {primaryVehicle.brand} {primaryVehicle.model}
              </p>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Indicador de status offline/pendentes */}
          {!isOnline && (
            <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-700">
              <CloudOff className="h-3 w-3 mr-1" />
              Offline
            </Badge>
          )}
          
          {/* Badge de pendentes com ação de sync manual */}
          {pendingCount > 0 && isOnline && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleManualSync}
              disabled={isSyncing}
              className="h-7 px-2 bg-orange-100 hover:bg-orange-200 text-orange-800 dark:bg-orange-900/30 dark:hover:bg-orange-900/50 dark:text-orange-400"
            >
              {isSyncing ? (
                <>
                  <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                  Sincronizando...
                </>
              ) : (
                <>
                  <CloudOff className="h-3 w-3 mr-1" />
                  {pendingCount} pendente{pendingCount > 1 ? 's' : ''}
                </>
              )}
            </Button>
          )}
          
          {/* Indicador de sincronização quando não há pendentes */}
          {isSyncing && pendingCount === 0 && (
            <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-300 animate-pulse dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-700">
              <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
              Sincronizando
            </Badge>
          )}
          
          <Button
            variant="ghost"
            size="icon"
            onClick={handleSignOut}
            className="h-9 w-9"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </header>
  );
}
