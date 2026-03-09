import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDriverAuth } from '@/hooks/useDriverAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Fuel, MapPin, Clock, CheckCircle, Truck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface JourneyData {
  id: string;
  journey_number: string;
  origin: string;
  destination: string;
  distance: number | null;
  start_date: string;
  end_date: string | null;
  status: string;
}

export default function DriverReports() {
  const navigate = useNavigate();
  const { driver, isDriver, loading: authLoading } = useDriverAuth();
  const [completedJourneys, setCompletedJourneys] = useState<JourneyData[]>([]);
  const [inProgressJourneys, setInProgressJourneys] = useState<JourneyData[]>([]);
  const [avgConsumption, setAvgConsumption] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !isDriver) {
      navigate('/auth');
    }
  }, [authLoading, isDriver, navigate]);

  useEffect(() => {
    if (driver) {
      fetchJourneys();
      fetchAvgConsumption();
    }
  }, [driver]);

  const fetchJourneys = async () => {
    if (!driver) return;

    try {
      setLoading(true);

      // Buscar viagens concluídas dos últimos 90 dias
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

      const { data: completedData, error: completedError } = await supabase
        .from('journeys')
        .select('id, journey_number, origin, destination, distance, start_date, end_date, status')
        .eq('driver_id', driver.id)
        .eq('status', 'completed')
        .gte('end_date', ninetyDaysAgo.toISOString())
        .order('end_date', { ascending: false });

      if (completedError) throw completedError;

      // Buscar viagens em andamento
      const { data: inProgressData, error: inProgressError } = await supabase
        .from('journeys')
        .select('id, journey_number, origin, destination, distance, start_date, end_date, status')
        .eq('driver_id', driver.id)
        .eq('status', 'in_progress')
        .order('start_date', { ascending: false });

      if (inProgressError) throw inProgressError;

      setCompletedJourneys(completedData || []);
      setInProgressJourneys(inProgressData || []);
    } catch (error) {
      console.error('Erro ao buscar jornadas:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAvgConsumption = async () => {
    if (!driver) return;

    try {
      // Buscar veículos atribuídos ao motorista
      const { data: vehicleAssignments } = await supabase
        .from('driver_vehicles')
        .select('vehicle_id')
        .eq('driver_id', driver.id)
        .eq('status', 'active');

      if (!vehicleAssignments || vehicleAssignments.length === 0) {
        setAvgConsumption(null);
        return;
      }

      const vehicleIds = vehicleAssignments.map(v => v.vehicle_id);

      // Buscar abastecimentos dos últimos 30 dias
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: fuelData } = await supabase
        .from('fuel_expenses')
        .select('liters, distance_traveled, odometer, odometer_final, journey_id')
        .in('vehicle_id', vehicleIds)
        .gte('date', thirtyDaysAgo.toISOString())
        .is('deleted_at', null);

      if (!fuelData || fuelData.length === 0) {
        setAvgConsumption(null);
        return;
      }

      // Buscar jornadas vinculadas para fallback de distância
      const journeyIds = fuelData.map(f => f.journey_id).filter(Boolean) as string[];
      let journeyDistanceMap = new Map<string, number>();
      
      if (journeyIds.length > 0) {
        const { data: journeys } = await supabase
          .from('journeys')
          .select('id, distance, start_km, end_km')
          .in('id', journeyIds);
        
        journeys?.forEach(j => {
          // Prioridade: hodômetro real > distância manual
          const dist = (j.end_km && j.start_km && j.end_km > j.start_km ? j.end_km - j.start_km : 0) || j.distance || 0;
          if (dist > 0) journeyDistanceMap.set(j.id, dist);
        });
      }

      // Calcular média de consumo
      // Prioridade: distance_traveled > odometer diff > journey distance
      let totalDistance = 0;
      let totalLiters = 0;

      fuelData.forEach(fuel => {
        let distance = 0;
        if (fuel.distance_traveled && fuel.distance_traveled > 0) {
          distance = fuel.distance_traveled;
        } else if (fuel.odometer_final && fuel.odometer && fuel.odometer_final > fuel.odometer) {
          distance = fuel.odometer_final - fuel.odometer;
        } else if (fuel.journey_id && journeyDistanceMap.has(fuel.journey_id)) {
          distance = journeyDistanceMap.get(fuel.journey_id)!;
        }
        
        if (distance > 0 && fuel.liters > 0) {
          totalDistance += distance;
          totalLiters += fuel.liters;
        }
      });

      if (totalLiters > 0 && totalDistance > 0) {
        const consumption = totalDistance / totalLiters;
        // Filtrar consumos irreais (> 15 km/l)
        if (consumption <= 15) {
          setAvgConsumption(consumption);
        } else {
          setAvgConsumption(null);
        }
      } else {
        setAvgConsumption(null);
      }
    } catch (error) {
      console.error('Erro ao calcular consumo:', error);
      setAvgConsumption(null);
    }
  };

  const getConsumptionColor = (consumption: number) => {
    if (consumption >= 3.5) return 'text-success';
    if (consumption >= 2.5) return 'text-warning';
    return 'text-destructive';
  };

  if (authLoading || !driver) return null;

  const renderJourneyCard = (journey: JourneyData) => (
    <div
      key={journey.id}
      className="p-4 rounded-lg border hover:bg-accent/50 transition-colors cursor-pointer"
      onClick={() => navigate(`/driver/history?journey=${journey.id}`)}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1">
          <p className="font-bold text-sm text-muted-foreground">#{journey.journey_number}</p>
          <p className="font-semibold">{journey.origin} → {journey.destination}</p>
        </div>
        <Badge variant={journey.status === 'completed' ? 'default' : 'secondary'}>
          {journey.status === 'completed' ? (
            <><CheckCircle className="h-3 w-3 mr-1" /> Concluída</>
          ) : (
            <><Clock className="h-3 w-3 mr-1" /> Em andamento</>
          )}
        </Badge>
      </div>

      <div className="mt-2 pt-2 border-t flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {journey.status === 'completed' && journey.end_date 
            ? format(new Date(journey.end_date), "dd/MM/yyyy", { locale: ptBR })
            : journey.start_date 
              ? `Início: ${format(new Date(journey.start_date), "dd/MM/yyyy", { locale: ptBR })}`
              : '-'
          }
        </span>
        {journey.distance && (
          <span className="flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            {journey.distance.toLocaleString('pt-BR')} km
          </span>
        )}
      </div>
    </div>
  );

  return (
    <div className="container mx-auto p-4 max-w-4xl space-y-4">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/driver')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-2xl font-bold">Minhas Jornadas</h1>
      </div>

      {/* Card de Média de Consumo */}
      <Card className="bg-muted/30">
        <CardContent className="py-3 px-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Fuel className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Média de Consumo (30 dias)</span>
            </div>
            {avgConsumption !== null ? (
              <span className={`text-lg font-bold ${getConsumptionColor(avgConsumption)}`}>
                {avgConsumption.toFixed(2)} km/L
              </span>
            ) : (
              <span className="text-sm text-muted-foreground">Sem dados suficientes</span>
            )}
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-3"></div>
          <p className="text-muted-foreground">Carregando jornadas...</p>
        </div>
      ) : (
        <Tabs defaultValue="in_progress" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="in_progress" className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Em Andamento ({inProgressJourneys.length})
            </TabsTrigger>
            <TabsTrigger value="completed" className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              Concluídas ({completedJourneys.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="in_progress" className="mt-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Jornadas em Andamento</CardTitle>
              </CardHeader>
              <CardContent>
                {inProgressJourneys.length === 0 ? (
                  <div className="text-center py-8">
                    <Truck className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
                    <p className="text-muted-foreground font-medium">Nenhuma jornada em andamento</p>
                    <p className="text-sm text-muted-foreground mt-1">Inicie uma nova jornada para vê-la aqui</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {inProgressJourneys.map(renderJourneyCard)}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="completed" className="mt-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Jornadas Concluídas (últimos 90 dias)</CardTitle>
              </CardHeader>
              <CardContent>
                {completedJourneys.length === 0 ? (
                  <div className="text-center py-8">
                    <MapPin className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
                    <p className="text-muted-foreground font-medium">Nenhuma jornada concluída</p>
                    <p className="text-sm text-muted-foreground mt-1">Complete jornadas para vê-las aqui</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {completedJourneys.map(renderJourneyCard)}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
