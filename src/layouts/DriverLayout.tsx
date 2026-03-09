import { Outlet } from "react-router-dom";
import { Suspense, useEffect, useState } from "react";
import { DriverHeader } from "@/components/driver/DriverHeader";
import { BottomNavigation } from "@/components/driver/BottomNavigation";
import { useDriverAuth } from "@/hooks/useDriverAuth";
import { NoVehiclesAssigned } from "@/components/driver/NoVehiclesAssigned";
import { Skeleton } from "@/components/ui/skeleton";
import { setupAutoSync, getPendingCount, syncPendingExpenses } from "@/lib/offlineSync";
import { useToast } from "@/hooks/use-toast";

export function DriverLayout() {
  const { driver, loading } = useDriverAuth();
  const { toast } = useToast();
  const [pendingCount, setPendingCount] = useState(0);

  // Ativar auto-sync e gerenciar contagem de pendentes
  useEffect(() => {
    // Ativa o listener de reconexão
    const cleanup = setupAutoSync();
    
    // Carrega contagem inicial
    getPendingCount().then(setPendingCount);
    
    // Atualiza contagem periodicamente
    const interval = setInterval(async () => {
      const count = await getPendingCount();
      setPendingCount(count);
    }, 5000);
    
    // Listener para evento de sync completo
    const handleSyncComplete = (event: CustomEvent<{ success: number; failed: number }>) => {
      const { success, failed } = event.detail;
      
      if (success > 0) {
        toast({
          title: "Sincronização concluída",
          description: `${success} lançamento(s) enviado(s) com sucesso!`,
        });
      }
      
      if (failed > 0) {
        toast({
          title: "Alguns itens não foram sincronizados",
          description: `${failed} lançamento(s) serão reenviados automaticamente.`,
          variant: "destructive",
        });
      }
      
      // Atualiza contagem
      getPendingCount().then(setPendingCount);
    };
    
    window.addEventListener('offline-sync-complete', handleSyncComplete as EventListener);
    
    return () => {
      cleanup();
      clearInterval(interval);
      window.removeEventListener('offline-sync-complete', handleSyncComplete as EventListener);
    };
  }, [toast]);

  // Salvar driver_id para uso offline
  useEffect(() => {
    if (driver?.id) {
      localStorage.setItem('current_driver_id', driver.id);
    }
  }, [driver?.id]);

  // Tentar sincronizar ao montar (caso tenha pendentes)
  useEffect(() => {
    if (navigator.onLine) {
      syncPendingExpenses().then(({ success }) => {
        if (success > 0) {
          toast({
            title: "Sincronização automática",
            description: `${success} lançamento(s) pendente(s) enviado(s)!`,
          });
          getPendingCount().then(setPendingCount);
        }
      });
    }
  }, [toast]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <div className="p-4 border-b">
          <Skeleton className="h-12 w-full" />
        </div>
        <div className="flex-1 p-4">
          <Skeleton className="h-32 w-full mb-4" />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    );
  }

  if (!driver?.assignedVehicles?.length) {
    return <NoVehiclesAssigned />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-background pb-20">
      <DriverHeader driver={driver} pendingCount={pendingCount} />
      
      <main className="flex-1 overflow-auto">
        <Suspense fallback={
          <div className="flex items-center justify-center h-full p-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        }>
          <Outlet context={{ driver, pendingCount }} />
        </Suspense>
      </main>

      <BottomNavigation />
    </div>
  );
}
