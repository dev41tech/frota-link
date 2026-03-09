import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Calendar, Route, Clock } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { parseDateString } from "@/lib/utils";
import { buildRouteString } from "@/components/journeys/JourneyLegsEditor";

interface Journey {
  journey_number: string;
  origin: string;
  destination: string;
  start_date: string;
  distance: number | null;
  start_km: number | null;
  end_km: number | null;
  closure_requested_at?: string | null;
}

interface JourneyLeg {
  origin: string;
  destination: string;
}

interface CurrentJourneyCardProps {
  journey: Journey | null;
  loading: boolean;
  legs?: JourneyLeg[];
}

export function CurrentJourneyCard({ journey, loading, legs }: CurrentJourneyCardProps) {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Jornada Atual
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-muted rounded w-3/4"></div>
            <div className="h-4 bg-muted rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!journey) {
    return (
      <Card className="border-dashed">
        <CardContent className="text-center py-8">
          <MapPin className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
          <p className="text-muted-foreground font-medium">Nenhuma jornada em andamento</p>
          <p className="text-sm text-muted-foreground mt-1">Você será notificado assim que iniciar uma nova jornada</p>
        </CardContent>
      </Card>
    );
  }

  const kmPercorridos = journey.end_km && journey.start_km ? journey.end_km - journey.start_km : 0;

  const kmRestantes = journey.distance ? journey.distance - kmPercorridos : null;

  return (
    <Card className="border-l-4 border-l-primary">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-base font-semibold">Jornada em Andamento</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">#{journey.journey_number}</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <Badge variant="default" className="bg-primary/10 text-primary hover:bg-primary/20">
              Em Progresso
            </Badge>
            {journey.closure_requested_at && (
              <Badge variant="secondary" className="text-xs gap-1">
                <Clock className="h-3 w-3" />
                Fechamento solicitado
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2 text-sm">
          <Route className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">
            {legs && legs.length > 1 ? buildRouteString(legs) : `${journey.origin} → ${journey.destination}`}
          </span>
        </div>

        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Calendar className="h-4 w-4" />
          <span>Iniciada em {format(parseDateString(journey.start_date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
        </div>

        {kmRestantes !== null && kmRestantes > 0 && (
          <div className="pt-2 border-t">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Distância restante</span>
              <span className="font-bold text-primary">{kmRestantes.toLocaleString("pt-BR")} km</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
