import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { Container, Link2 } from 'lucide-react';

interface CouplingBadgesProps {
  couplingId: string | null;
  compact?: boolean;
}

interface TrailerInfo {
  id: string;
  plate: string;
  position: number;
}

export function CouplingBadges({ couplingId, compact = false }: CouplingBadgesProps) {
  const [trailers, setTrailers] = useState<TrailerInfo[]>([]);
  const [couplingType, setCouplingType] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (couplingId) {
      fetchCouplingInfo();
    } else {
      setTrailers([]);
      setCouplingType(null);
    }
  }, [couplingId]);

  const fetchCouplingInfo = async () => {
    if (!couplingId) return;
    
    setLoading(true);
    try {
      // Buscar tipo do coupling
      const { data: couplingData } = await (supabase as any)
        .from('vehicle_couplings')
        .select('coupling_type')
        .eq('id', couplingId)
        .single();

      if (couplingData) {
        setCouplingType(couplingData.coupling_type);
      }

      // Buscar carretas
      const { data: itemsData } = await (supabase as any)
        .from('vehicle_coupling_items')
        .select('trailer_id, position')
        .eq('coupling_id', couplingId);

      if (!itemsData || itemsData.length === 0) {
        setTrailers([]);
        setLoading(false);
        return;
      }

      const trailerIds = itemsData.map((i: any) => i.trailer_id).filter(Boolean);
      
      const { data: vehiclesData } = await (supabase as any)
        .from('vehicles')
        .select('id, plate')
        .in('id', trailerIds);

      const vehiclesMap = new Map((vehiclesData || []).map((v: any) => [v.id, v.plate]));

      const trailersList = itemsData
        .filter((i: any) => i.trailer_id)
        .map((i: any) => ({
          id: i.trailer_id,
          plate: vehiclesMap.get(i.trailer_id) || '-',
          position: i.position || 1,
        }))
        .sort((a: TrailerInfo, b: TrailerInfo) => a.position - b.position);

      setTrailers(trailersList);
    } catch (error) {
      console.error('Error fetching coupling info:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!couplingId || loading || trailers.length === 0) {
    return null;
  }

  const typeLabel = couplingType === 'simple' ? 'Simples' : couplingType === 'bitrem' ? 'Bitrem' : couplingType === 'rodotrem' ? 'Rodotrem' : 'Conjunto';

  if (compact) {
    return (
      <div className="flex items-center gap-1">
        <Link2 className="h-3 w-3 text-primary" />
        <span className="text-xs text-muted-foreground">
          {trailers.map(t => t.plate).join(' + ')}
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 flex-wrap">
      <Badge variant="outline" className="text-xs gap-1 px-1.5 py-0.5 border-primary/30 text-primary">
        <Link2 className="h-3 w-3" />
        {typeLabel}
      </Badge>
      {trailers.map((trailer) => (
        <Badge key={trailer.id} variant="secondary" className="text-xs gap-1 px-1.5 py-0.5">
          <Container className="h-3 w-3" />
          {trailer.plate}
        </Badge>
      ))}
    </div>
  );
}
