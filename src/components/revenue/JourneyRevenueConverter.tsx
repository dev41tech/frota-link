import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useMultiTenant } from '@/hooks/useMultiTenant';
import { useStaffAccess } from '@/hooks/useStaffAccess';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle, DollarSign, Truck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface UnconvertedJourney {
  id: string;
  journey_number: string;
  freight_value: number;
  origin: string;
  destination: string;
  created_at: string;
}

interface JourneyRevenueConverterProps {
  onConversionComplete: () => void;
}

export default function JourneyRevenueConverter({ onConversionComplete }: JourneyRevenueConverterProps) {
  const { user } = useAuth();
  const { currentCompany } = useMultiTenant();
  const { staffContext } = useStaffAccess();
  const { toast } = useToast();
  const [unconvertedJourneys, setUnconvertedJourneys] = useState<UnconvertedJourney[]>([]);
  const [loading, setLoading] = useState(false);
  const [converting, setConverting] = useState<string[]>([]);

  const effectiveCompanyId = staffContext?.company_id || currentCompany?.id;

  const fetchUnconvertedJourneys = async () => {
    if (!effectiveCompanyId) return;

    try {
      setLoading(true);
      
      // Get all completed journeys with freight value for this company
      const { data: journeys, error: journeysError } = await supabase
        .from('journeys')
        .select('id, journey_number, freight_value, origin, destination, created_at')
        .eq('company_id', effectiveCompanyId)
        .eq('status', 'completed')
        .not('freight_value', 'is', null)
        .gt('freight_value', 0);

      if (journeysError) throw journeysError;

      // Get all revenue entries linked to journeys for this company
      const { data: revenues, error: revenueError } = await supabase
        .from('revenue')
        .select('journey_id')
        .eq('company_id', effectiveCompanyId)
        .not('journey_id', 'is', null);

      if (revenueError) throw revenueError;

      const linkedJourneyIds = new Set(revenues?.map(r => r.journey_id) || []);
      
      const unlinkedJourneys = journeys?.filter(j => !linkedJourneyIds.has(j.id)) || [];
      
      setUnconvertedJourneys(unlinkedJourneys);
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const convertJourneyToRevenue = async (journey: UnconvertedJourney) => {
    if (!effectiveCompanyId) return;

    try {
      setConverting(prev => [...prev, journey.id]);
      
      const { error } = await supabase
        .from('revenue')
        .insert({
          user_id: user?.id,
          company_id: effectiveCompanyId,
          journey_id: journey.id,
          amount: journey.freight_value,
          description: `Frete - ${journey.journey_number}`,
          client: `Rota: ${journey.origin} → ${journey.destination}`,
          date: journey.created_at,
          status: 'received',
          payment_method: 'bank_transfer',
          notes: 'Convertido automaticamente do frete da jornada'
        });

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: `Receita criada para jornada ${journey.journey_number}`,
      });

      // Remove from unconverted list
      setUnconvertedJourneys(prev => prev.filter(j => j.id !== journey.id));
      onConversionComplete();
      
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setConverting(prev => prev.filter(id => id !== journey.id));
    }
  };

  const convertAllJourneys = async () => {
    for (const journey of unconvertedJourneys) {
      await convertJourneyToRevenue(journey);
    }
  };

  if (unconvertedJourneys.length === 0) {
    return null;
  }

  return (
    <Card className="shadow-card border-amber-200 bg-amber-50">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2 text-amber-800">
          <AlertCircle className="h-5 w-5" />
          <span>Jornadas com Frete Não Convertidas</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-amber-700 mb-4">
          Encontramos {unconvertedJourneys.length} jornada(s) concluída(s) com valores de frete que ainda não foram convertidas em receitas.
        </p>
        
        <div className="space-y-3 mb-4">
          {unconvertedJourneys.slice(0, 3).map((journey) => (
            <div key={journey.id} className="flex items-center justify-between bg-white p-3 rounded-lg border">
              <div className="flex items-center space-x-3">
                <Truck className="h-4 w-4 text-blue-600" />
                <div>
                  <p className="font-medium text-sm">{journey.journey_number}</p>
                  <p className="text-xs text-muted-foreground">{journey.origin} → {journey.destination}</p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <Badge variant="secondary" className="bg-green-100 text-green-800">
                  <DollarSign className="h-3 w-3 mr-1" />
                  R$ {journey.freight_value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </Badge>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => convertJourneyToRevenue(journey)}
                  disabled={converting.includes(journey.id)}
                  className="text-xs"
                >
                  {converting.includes(journey.id) ? 'Convertendo...' : 'Converter'}
                </Button>
              </div>
            </div>
          ))}
          
          {unconvertedJourneys.length > 3 && (
            <p className="text-xs text-muted-foreground text-center">
              ... e mais {unconvertedJourneys.length - 3} jornada(s)
            </p>
          )}
        </div>

        <div className="flex space-x-2">
          <Button
            onClick={convertAllJourneys}
            disabled={converting.length > 0}
            className="bg-amber-600 hover:bg-amber-700"
          >
            <CheckCircle className="h-4 w-4 mr-2" />
            Converter Todas ({unconvertedJourneys.length})
          </Button>
          <Button
            variant="outline"
            onClick={fetchUnconvertedJourneys}
            disabled={loading}
          >
            Atualizar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}