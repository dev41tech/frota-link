import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useDriverAuth } from "@/hooks/useDriverAuth";
import { buildRouteString } from "@/components/journeys/JourneyLegsEditor";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Route, 
  Clock,
  AlertTriangle,
  RefreshCw,
  MapPin,
  CheckCircle,
  ArrowRight,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { parseDateString } from "@/lib/utils";
import { SmartClosureDialog } from "@/components/driver/SmartClosureDialog";
import { SmartExpenseCapture } from "@/components/driver/SmartExpenseCapture";
import { toast } from "sonner";

interface CurrentJourney {
  id: string;
  journey_number: string;
  origin: string;
  destination: string;
  start_date: string;
  distance: number | null;
  start_km: number | null;
  end_km: number | null;
  closure_requested_at: string | null;
}

interface AssignedVehicle {
  id: string;
  plate: string;
  model: string | null;
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

export default function DriverDashboard() {
  const navigate = useNavigate();
  const { driver, isDriver, loading: authLoading } = useDriverAuth();
  
  const [currentJourney, setCurrentJourney] = useState<CurrentJourney | null>(null);
  const [loadingJourney, setLoadingJourney] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [journeyLegs, setJourneyLegs] = useState<Array<{ id: string; origin: string; destination: string; leg_number: number; status: string }>>([]);
  const [finishingLeg, setFinishingLeg] = useState(false);
  const [routeDisplay, setRouteDisplay] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !isDriver) navigate("/auth");
  }, [authLoading, isDriver, navigate]);

  // Fetch current journey
  const fetchCurrentJourney = async () => {
    if (!driver?.id) return;
    
    setLoadingJourney(true);
    try {
      if (!navigator.onLine) {
        const cached = localStorage.getItem(`active_journey_${driver.id}`);
        if (cached) {
          setCurrentJourney(JSON.parse(cached));
          setLoadingJourney(false);
          return;
        }
      }

      const { data, error } = await supabase
        .from("journeys")
        .select("id, journey_number, origin, destination, start_date, distance, start_km, end_km, closure_requested_at")
        .eq("driver_id", driver.id)
        .eq("status", "in_progress")
        .order("start_date", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!error) {
        setCurrentJourney(data);
        if (data) {
          localStorage.setItem(`active_journey_${driver.id}`, JSON.stringify(data));
          // Fetch legs for route display and status
          const { data: legs } = await supabase
            .from('journey_legs')
            .select('id, origin, destination, leg_number, status')
            .eq('journey_id', data.id)
            .order('leg_number');
          if (legs && legs.length > 1) {
            setRouteDisplay(buildRouteString(legs));
            setJourneyLegs(legs);
          } else {
            setRouteDisplay(null);
            setJourneyLegs(legs || []);
          }
        } else {
          localStorage.removeItem(`active_journey_${driver.id}`);
          setRouteDisplay(null);
        }
      }
    } catch (err) {
      console.error("Error fetching journey:", err);
    } finally {
      setLoadingJourney(false);
    }
  };

  useEffect(() => {
    fetchCurrentJourney();
  }, [driver?.id]);

  // Check offline pending items
  useEffect(() => {
    const checkPending = () => {
      try {
        const fuel = JSON.parse(localStorage.getItem("offline_fuel_expenses") || "[]");
        const expenses = JSON.parse(localStorage.getItem("offline_expenses") || "[]");
        setPendingCount(fuel.length + expenses.length);
      } catch {
        setPendingCount(0);
      }
    };
    checkPending();
    const interval = setInterval(checkPending, 5000);
    return () => clearInterval(interval);
  }, []);

  // Online/offline monitoring
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (authLoading || !driver) return null;

  const vehicle = driver.assignedVehicles?.[0] as AssignedVehicle | undefined;
  const closureRequested = !!currentJourney?.closure_requested_at;
  const firstName = driver.name.split(" ")[0];

  const currentLeg = journeyLegs.find(l => l.status === 'in_progress');
  const hasMultipleLegs = journeyLegs.length > 1;
  const hasNextLeg = currentLeg && journeyLegs.some(l => l.leg_number > currentLeg.leg_number && l.status === 'pending');

  const handleFinishLeg = async () => {
    if (!currentLeg || !currentJourney) return;
    setFinishingLeg(true);
    try {
      await supabase.from('journey_legs')
        .update({ status: 'completed' })
        .eq('id', currentLeg.id);
      
      const nextLeg = journeyLegs.find(l => l.leg_number === currentLeg.leg_number + 1 && l.status === 'pending');
      if (nextLeg) {
        await supabase.from('journey_legs')
          .update({ status: 'in_progress' })
          .eq('id', nextLeg.id);
      }
      
      toast.success(`Trecho ${currentLeg.leg_number} finalizado!`);
      fetchCurrentJourney();
    } catch (err) {
      console.error(err);
      toast.error("Erro ao finalizar trecho");
    } finally {
      setFinishingLeg(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="p-4 space-y-4">
        {/* Saudação contextual */}
        <div className="pt-2">
          <h2 className="text-xl font-bold text-foreground">
            {getGreeting()}, {firstName}! 👋
          </h2>
          {!isOnline && (
            <Badge variant="secondary" className="mt-1 bg-yellow-500/20 text-yellow-700 border-yellow-500/30 dark:text-yellow-300">
              Sem internet
            </Badge>
          )}
        </div>

        {/* Card de jornada ativa */}
        {!loadingJourney && currentJourney && (
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Route className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold text-primary">
                  Viagem #{currentJourney.journey_number}
                </span>
                {closureRequested && (
                  <Badge variant="secondary" className="text-xs ml-auto">
                    Aguardando aprovação
                  </Badge>
                )}
              </div>
              {routeDisplay ? (
                <div className="flex items-center gap-2 text-sm text-foreground">
                  <Route className="h-3.5 w-3.5 text-primary shrink-0" />
                  <span className="truncate">{routeDisplay}</span>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2 text-sm text-foreground">
                    <MapPin className="h-3.5 w-3.5 text-green-600 shrink-0" />
                    <span className="truncate">{currentJourney.origin}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-foreground mt-1">
                    <MapPin className="h-3.5 w-3.5 text-red-500 shrink-0" />
                    <span className="truncate">{currentJourney.destination}</span>
                  </div>
                </>
              )}
              <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                <span>
                  Saiu {formatDistanceToNow(parseDateString(currentJourney.start_date), { 
                    addSuffix: true, 
                    locale: ptBR 
                  })}
                </span>
              </div>
              {/* Leg status indicator */}
              {hasMultipleLegs && (
                <div className="mt-3 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    {journeyLegs.map((leg) => (
                      <Badge
                        key={leg.id}
                        variant={leg.status === 'in_progress' ? 'default' : leg.status === 'completed' ? 'secondary' : 'outline'}
                        className={`text-xs ${leg.status === 'in_progress' ? 'bg-primary' : leg.status === 'completed' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' : ''}`}
                      >
                        T{leg.leg_number}: {leg.origin}→{leg.destination}
                        {leg.status === 'in_progress' && ' • Ativo'}
                        {leg.status === 'completed' && ' ✓'}
                      </Badge>
                    ))}
                  </div>
                  {currentLeg && hasNextLeg && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full gap-2 border-primary/30 text-primary hover:bg-primary/5"
                      onClick={handleFinishLeg}
                      disabled={finishingLeg}
                    >
                      <CheckCircle className="h-4 w-4" />
                      Finalizar Trecho {currentLeg.leg_number} ({currentLeg.origin}→{currentLeg.destination})
                      <ArrowRight className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Loading state */}
        {loadingJourney && (
          <Card>
            <CardContent className="p-6">
              <div className="animate-pulse space-y-3">
                <div className="h-12 bg-muted rounded w-full"></div>
                <div className="h-12 bg-muted rounded w-full"></div>
              </div>
            </CardContent>
          </Card>
        )}

        {!loadingJourney && (
          <>
            {/* Ação principal: Lançar Despesa */}
            <SmartExpenseCapture
              companyId={driver.company_id}
              driverId={driver.id}
              authUserId={driver.auth_user_id || ""}
              vehicleId={vehicle?.id}
              journeyId={currentJourney?.id}
              onSuccess={() => toast.success("Despesa lançada!")}
            />

            {/* Ação principal: Encerrar Jornada */}
            {currentJourney && (
              <SmartClosureDialog
                journeyId={currentJourney.id}
                journeyNumber={currentJourney.journey_number}
                closureRequested={closureRequested}
                companyId={driver.company_id}
                currentKm={currentJourney.start_km}
                canAutoClose={driver.can_auto_close_journey}
                onSuccess={fetchCurrentJourney}
              />
            )}

            {/* Botão Nova Viagem (não existe na BottomNavigation) */}
            {driver.can_start_journey && !currentJourney && (
              <Button
                className="w-full h-14 text-base font-semibold gap-3"
                variant="outline"
                onClick={() => navigate("/driver/new-journey")}
              >
                <Route className="h-5 w-5" />
                Iniciar Nova Viagem
              </Button>
            )}

            {/* Alerta sem jornada - texto simplificado */}
            {!currentJourney && (
              <Card className="bg-orange-50 border-orange-200 dark:bg-orange-950/20 dark:border-orange-900/30">
                <CardContent className="flex items-start gap-3 p-4">
                  <AlertTriangle className="h-5 w-5 text-orange-500 mt-0.5" />
                  <div>
                    <p className="font-medium text-orange-800 dark:text-orange-200">
                      Você não tem viagem aberta
                    </p>
                    <p className="text-sm text-orange-600 dark:text-orange-400">
                      Suas despesas não vão aparecer em nenhuma viagem
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Offline Sync Status */}
            {pendingCount > 0 && (
              <Card className="bg-yellow-50 border-yellow-200 dark:bg-yellow-950/20 dark:border-yellow-900/30">
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-yellow-100 dark:bg-yellow-900/50 flex items-center justify-center">
                      <RefreshCw className="h-5 w-5 text-yellow-600 dark:text-yellow-500" />
                    </div>
                    <div>
                      <p className="font-medium text-yellow-800 dark:text-yellow-200">
                        {pendingCount} {pendingCount === 1 ? "item" : "itens"} pendente{pendingCount > 1 ? "s" : ""}
                      </p>
                      <p className="text-sm text-yellow-600 dark:text-yellow-400">
                        Será enviado quando tiver internet
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}
