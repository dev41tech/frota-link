import { ReactNode, useState, useEffect } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useDriverAuth } from "@/hooks/useDriverAuth";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { DriverAccessDenied } from "./DriverAccessDenied";

interface RequireDriverProps {
  children: ReactNode;
}

export function RequireDriver({ children }: RequireDriverProps) {
  const { isDriver, loading, driver } = useDriverAuth();
  const location = useLocation();
  const [checkingPlan, setCheckingPlan] = useState(true);
  const [hasPWAAccess, setHasPWAAccess] = useState(false);

  useEffect(() => {
    const checkPlanAccess = async () => {
      if (!driver?.company_id) {
        setCheckingPlan(false);
        return;
      }

      try {
        // Check if company plan includes PWA driver access
        const { data: companyData, error } = await supabase
          .from('companies')
          .select(`
            subscription_plan_id,
            subscription_plans (
              has_pwa_driver
            )
          `)
          .eq('id', driver.company_id)
          .single();

        if (error) throw error;

        const planData = companyData?.subscription_plans as { has_pwa_driver: boolean } | null;
        setHasPWAAccess(planData?.has_pwa_driver ?? false);
      } catch (error) {
        console.error('Error checking plan access:', error);
        setHasPWAAccess(false);
      } finally {
        setCheckingPlan(false);
      }
    };

    if (!loading && isDriver && driver) {
      checkPlanAccess();
    } else if (!loading) {
      setCheckingPlan(false);
    }
  }, [driver, isDriver, loading]);

  if (loading || checkingPlan) {
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

  if (!isDriver) {
    return <Navigate to="/home" state={{ from: location }} replace />;
  }

  // Check if company plan allows PWA driver access
  if (!hasPWAAccess) {
    return <DriverAccessDenied />;
  }

  return <>{children}</>;
}
