import { ReactNode, useRef, useEffect, Suspense } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import { useMultiTenant } from "@/hooks/useMultiTenant";
import { useDomainRouting } from "@/hooks/useDomainRouting";
import MasterSidebar from "@/components/master/MasterSidebar";

interface AdminLayoutProps {
  children: ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const { user, signOut, loading } = useAuth();
  const { isMaster, isLoading } = useMultiTenant();
  const { isClientDomain, redirectTo } = useDomainRouting();
  const hasRedirected = useRef(false);

  // Evita redirecionamentos cross-domain automáticos para não perder a sessão entre subdomínios
  useEffect(() => {
    hasRedirected.current = false;
  }, []);

  if (loading || isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  // Redirect if not authenticated
  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Bloqueia acesso de não-master no domínio admin sem redirecionar automaticamente
  if (!isMaster) {
    if (isClientDomain) {
      return <Navigate to="/home" replace />;
    } else {
      return (
        <div className="flex min-h-screen items-center justify-center bg-background">
          <div className="text-center space-y-4">
            <p className="text-muted-foreground">Acesso restrito ao domínio administrativo.</p>
            <a
              href="https://app.linkfrota.com.br/auth"
              className="inline-flex items-center rounded-md px-4 py-2 border bg-card text-card-foreground shadow-sm hover:bg-accent transition"
            >
              Ir para o app
            </a>
          </div>
        </div>
      );
    }
  }

  const handleLogout = () => {
    signOut();
  };

  return (
    <div className="min-h-screen flex w-full bg-background">
      <MasterSidebar onLogout={handleLogout} />
      <div className="flex-1 flex flex-col">
        <main className="flex-1 p-6 overflow-auto">
          <Suspense fallback={
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          }>
            {children}
          </Suspense>
        </main>
      </div>
    </div>
  );
}