import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LocationDisplay } from '@/components/ui/location-display';
import { Skeleton } from '@/components/ui/skeleton';
import { CheckCircle, XCircle, AlertTriangle, ClipboardCheck, Camera, Clock, MessageSquare } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';

interface ChecklistItem {
  label: string;
  checked: boolean;
}

interface JourneyChecklist {
  id: string;
  checklist_type: string;
  items: ChecklistItem[];
  photos: string[];
  notes: string | null;
  location_lat: number | null;
  location_lng: number | null;
  location_address: string | null;
  completed_at: string | null;
  created_at: string;
}

interface JourneyChecklistViewProps {
  journeyId: string;
}

export function JourneyChecklistView({ journeyId }: JourneyChecklistViewProps) {
  const [checklists, setChecklists] = useState<JourneyChecklist[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedPhoto, setExpandedPhoto] = useState<string | null>(null);

  useEffect(() => {
    fetchChecklists();
  }, [journeyId]);

  const fetchChecklists = async () => {
    try {
      const { data, error } = await supabase
        .from('journey_checklists')
        .select('*')
        .eq('journey_id', journeyId)
        .order('checklist_type', { ascending: true });

      if (error) throw error;

      const parsed = (data || []).map((row: any) => ({
        ...row,
        items: Array.isArray(row.items) ? row.items : [],
        photos: Array.isArray(row.photos) ? row.photos : [],
      }));

      setChecklists(parsed);
    } catch (error) {
      console.error('Erro ao buscar checklists:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (checklists.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <ClipboardCheck className="h-12 w-12 mx-auto mb-3 opacity-40" />
        <p className="text-sm font-medium">Nenhum checklist registrado</p>
        <p className="text-xs mt-1">O motorista ainda não preencheu checklists para esta jornada.</p>
      </div>
    );
  }

  const getTypeLabel = (type: string) => type === 'pre' ? 'Pré-Viagem' : 'Pós-Viagem';
  const getTypeIcon = (type: string) => type === 'pre' ? '🟢' : '🔵';

  return (
    <div className="space-y-4">
      {checklists.map((checklist) => {
        const uncheckedCount = checklist.items.filter(i => !i.checked).length;
        const hasAlert = uncheckedCount > 0;

        return (
          <Card key={checklist.id} className={hasAlert ? 'border-destructive/50' : ''}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <span>{getTypeIcon(checklist.checklist_type)}</span>
                  Checklist {getTypeLabel(checklist.checklist_type)}
                </CardTitle>
                <div className="flex items-center gap-2">
                  {hasAlert && (
                    <Badge variant="destructive" className="text-xs flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      {uncheckedCount} pendente{uncheckedCount > 1 ? 's' : ''}
                    </Badge>
                  )}
                  {!hasAlert && (
                    <Badge className="bg-green-100 text-green-800 text-xs">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Completo
                    </Badge>
                  )}
                </div>
              </div>
              {checklist.completed_at && (
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                  <Clock className="h-3 w-3" />
                  {new Date(checklist.completed_at).toLocaleString('pt-BR')}
                </p>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Items list */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {checklist.items.map((item, idx) => (
                  <div
                    key={idx}
                    className={`flex items-center gap-2 text-sm px-2 py-1.5 rounded ${
                      item.checked
                        ? 'text-foreground'
                        : 'text-destructive bg-destructive/5'
                    }`}
                  >
                    {item.checked ? (
                      <CheckCircle className="h-4 w-4 text-green-600 shrink-0" />
                    ) : (
                      <XCircle className="h-4 w-4 text-destructive shrink-0" />
                    )}
                    <span>{item.label}</span>
                  </div>
                ))}
              </div>

              {/* Notes */}
              {checklist.notes && (
                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="text-xs font-medium text-muted-foreground flex items-center gap-1 mb-1">
                    <MessageSquare className="h-3 w-3" />
                    Observações do Motorista
                  </p>
                  <p className="text-sm">{checklist.notes}</p>
                </div>
              )}

              {/* Photos */}
              {checklist.photos.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground flex items-center gap-1 mb-2">
                    <Camera className="h-3 w-3" />
                    Fotos ({checklist.photos.length})
                  </p>
                  <div className="grid grid-cols-4 gap-2">
                    {checklist.photos.map((url, idx) => (
                      <img
                        key={idx}
                        src={url as string}
                        alt={`Foto ${idx + 1}`}
                        className="rounded-md object-cover aspect-square cursor-pointer hover:opacity-80 transition-opacity border"
                        onClick={() => setExpandedPhoto(url as string)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Location */}
              {(checklist.location_lat || checklist.location_address) && (
                <div className="pt-2 border-t">
                  <LocationDisplay
                    lat={checklist.location_lat}
                    lng={checklist.location_lng}
                    address={checklist.location_address}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}

      {/* Photo expand dialog */}
      <Dialog open={!!expandedPhoto} onOpenChange={() => setExpandedPhoto(null)}>
        <DialogContent className="max-w-3xl p-2">
          {expandedPhoto && (
            <img src={expandedPhoto} alt="Foto ampliada" className="w-full rounded-lg" />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
