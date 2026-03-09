import { useTrailerUtilization } from '@/hooks/useTrailerUtilization';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Container, TrendingDown, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface IdleTrailersAlertProps {
  threshold?: number; // Percentual mínimo de ocupação (default 20%)
  startDate?: Date;
  endDate?: Date;
  showDetails?: boolean;
}

export function IdleTrailersAlert({ 
  threshold = 20, 
  startDate, 
  endDate,
  showDetails = true 
}: IdleTrailersAlertProps) {
  const navigate = useNavigate();
  const { data, loading } = useTrailerUtilization(startDate, endDate);

  if (loading) return null;

  const idleTrailers = data.filter(t => t.occupancyRate < threshold);

  if (idleTrailers.length === 0) return null;

  const avgOccupancy = idleTrailers.length > 0 
    ? idleTrailers.reduce((sum, t) => sum + t.occupancyRate, 0) / idleTrailers.length 
    : 0;

  return (
    <Alert variant="destructive" className="border-yellow-500/50 bg-yellow-500/10 text-yellow-800 dark:text-yellow-200">
      <AlertTriangle className="h-4 w-4 text-yellow-600" />
      <AlertTitle className="flex items-center gap-2">
        Carretas com Baixa Utilização
        <Badge variant="outline" className="border-yellow-500/50 text-yellow-700 dark:text-yellow-300">
          {idleTrailers.length} {idleTrailers.length === 1 ? 'carreta' : 'carretas'}
        </Badge>
      </AlertTitle>
      <AlertDescription className="mt-2">
        <p className="text-sm mb-2">
          {idleTrailers.length === 1 
            ? 'Uma carreta está com ocupação abaixo de ' + threshold + '% no período.'
            : `${idleTrailers.length} carretas estão com ocupação abaixo de ${threshold}% no período.`
          }
          {' '}Considere otimizar a alocação ou renegociar contratos.
        </p>
        
        {showDetails && (
          <div className="flex flex-wrap gap-2 mt-3">
            {idleTrailers.slice(0, 5).map((trailer) => (
              <div 
                key={trailer.trailerId}
                className="flex items-center gap-2 px-2 py-1 rounded bg-yellow-500/20 text-yellow-800 dark:text-yellow-200"
              >
                <Container className="h-3 w-3" />
                <span className="text-xs font-medium">{trailer.plate}</span>
                <span className="text-xs flex items-center gap-0.5">
                  <TrendingDown className="h-3 w-3" />
                  {trailer.occupancyRate.toFixed(0)}%
                </span>
              </div>
            ))}
            {idleTrailers.length > 5 && (
              <span className="text-xs text-yellow-700 dark:text-yellow-300 self-center">
                +{idleTrailers.length - 5} mais
              </span>
            )}
          </div>
        )}

        <div className="mt-3">
          <Button 
            variant="outline" 
            size="sm"
            className="border-yellow-500/50 text-yellow-700 hover:bg-yellow-500/20"
            onClick={() => navigate('/reports/trailer-utilization')}
          >
            <ExternalLink className="h-3 w-3 mr-1" />
            Ver Relatório Completo
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}
