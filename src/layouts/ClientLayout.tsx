import { Suspense } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useDomainRouting } from "@/hooks/useDomainRouting";
import { useMultiTenant } from "@/hooks/useMultiTenant";
import { useStaffAccess } from "@/hooks/useStaffAccess";
import OptimizedSidebar from "@/components/layout/sidebar";
import { CompanySelector } from "@/components/ui/company-selector";
import StaffContextBanner from "@/components/staff/StaffContextBanner";
import FloatingChatAssistant from "@/components/chat/FloatingChatAssistant";
import { useToast } from "@/hooks/use-toast";
import { PlanFeaturesProvider } from "@/contexts/PlanFeaturesContext";

export default function ClientLayout() {
  const { user, loading, signOut } = useAuth();
  const { isClientDomain } = useDomainRouting();
  const { isMaster, isLoading, currentCompany } = useMultiTenant();
  const { staffContext, isBPO, isSupport, isLoading: staffLoading } = useStaffAccess();
  const location = useLocation();
  const { toast } = useToast();

  // Check if staff (BPO/Support) is accessing a client company
  const isStaffAccessing = !!(staffContext && (isBPO || isSupport));

  const handleLogout = async () => {
    await signOut();
    toast({
      title: "Logout realizado",
      description: "Até mais!"
    });
  };

  if (loading || isLoading || staffLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  // Redirect unauthenticated users to auth
  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // BPO sem contexto → redirecionar para seleção de empresa
  if (isBPO && !staffContext) {
    return <Navigate to="/select-company" replace />;
  }

  // Suporte sem contexto → redirecionar para busca de empresa
  if (isSupport && !staffContext) {
    return <Navigate to="/search-company" replace />;
  }

  // Se usuário master estiver no domínio do cliente sem contexto de staff, mostre aviso
  if (isMaster && isClientDomain && !isStaffAccessing) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <p className="text-muted-foreground">Este usuário é Master. Use o painel administrativo.</p>
          <a
            href="https://admin.linkfrota.com.br/home"
            className="inline-flex items-center rounded-md px-4 py-2 border bg-card text-card-foreground shadow-sm hover:bg-accent transition"
          >
            Ir para o painel master
          </a>
        </div>
      </div>
    );
  }

  return (
    <PlanFeaturesProvider>
      <div className="flex h-screen bg-background w-full">
        <OptimizedSidebar
          onLogout={handleLogout}
          companyName={currentCompany?.name || staffContext?.company_name || "Frota Link"}
        />
        <main className="flex-1 overflow-auto">
          <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            {isStaffAccessing && <StaffContextBanner />}
            {isMaster && !isStaffAccessing && <CompanySelector />}
          </div>
          <Suspense fallback={
            <div className="flex items-center justify-center h-full p-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          }>
            <Outlet />
          </Suspense>
        </main>
        <FloatingChatAssistant />
      </div>
    </PlanFeaturesProvider>
  );
}
