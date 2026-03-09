import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useDriverAuth } from "@/hooks/useDriverAuth";
import { Skeleton } from "@/components/ui/skeleton";

interface RequireNonDriverProps {
  children: ReactNode;
}

export function RequireNonDriver({ children }: RequireNonDriverProps) {
  const { isDriver, loading } = useDriverAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="space-y-4 w-full max-w-md p-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    );
  }

  // Se é motorista, redireciona para área de motorista
  if (isDriver) {
    return <Navigate to="/driver" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}
