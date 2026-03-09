import { ReactNode, Suspense } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import { useMultiTenant } from "@/hooks/useMultiTenant";
import MasterSidebar from "@/components/master/MasterSidebar";

interface MasterLayoutProps {
  children: ReactNode;
}

export default function MasterLayout({ children }: MasterLayoutProps) {
  const { user, signOut, loading } = useAuth();
  const { isMaster, isLoading } = useMultiTenant();

  // Show loading state while checking authentication and roles
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

  // Redirect if not authenticated or not master
  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (!isMaster) {
    return <Navigate to="/home" replace />;
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