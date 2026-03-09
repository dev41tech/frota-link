import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Camera, MapPin, Loader2 } from 'lucide-react';
import { CameraCapture } from '@/components/drivers/CameraCapture';
import { useGeolocation } from '@/hooks/useGeolocation';
import { useDriverPlanFeatures } from '@/hooks/useDriverPlanFeatures';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ChecklistItem {
  id: string;
  label: string;
  checked: boolean;
}

export interface ChecklistData {
  items: ChecklistItem[];
  photos: string[];
  notes: string | null;
  location_lat: number | null;
  location_lng: number | null;
  location_address: string | null;
}

interface JourneyChecklistProps {
  journeyId?: string;
  vehicleId: string;
  driverId: string;
  companyId: string;
  type: 'pre' | 'post';
  onComplete: () => void;
  deferSave?: boolean;
  onCompleteWithData?: (data: ChecklistData) => void;
}

const PRE_CHECKLIST_ITEMS = [
  { id: 'docs', label: 'Documentos do veículo' },
  { id: 'fuel', label: 'Nível de combustível adequado' },
  { id: 'tires', label: 'Estado dos pneus' },
  { id: 'lights', label: 'Luzes e sinalização' },
  { id: 'brakes', label: 'Freios funcionando' },
  { id: 'fluid', label: 'Níveis de óleo e água' },
  { id: 'mirrors', label: 'Espelhos ajustados' },
  { id: 'safety', label: 'Equipamentos de segurança' },
  { id: 'cargo', label: 'Carga fixada corretamente' },
];

const POST_CHECKLIST_ITEMS = [
  { id: 'damage', label: 'Verificar avarias no veículo' },
  { id: 'cargo_delivered', label: 'Carga entregue completa' },
  { id: 'clean', label: 'Limpeza básica realizada' },
  { id: 'fuel_level', label: 'Registrar nível de combustível' },
  { id: 'km', label: 'Registrar quilometragem final' },
  { id: 'incidents', label: 'Relatar incidentes (se houver)' },
];

export function JourneyChecklist({ journeyId, vehicleId, driverId, companyId, type, onComplete, deferSave = false, onCompleteWithData }: JourneyChecklistProps) {
  const defaultItems = type === 'pre' ? PRE_CHECKLIST_ITEMS : POST_CHECKLIST_ITEMS;
  const [items, setItems] = useState<ChecklistItem[]>(
    defaultItems.map(item => ({ ...item, checked: false }))
  );
  const [notes, setNotes] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [showCamera, setShowCamera] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { getCurrentPosition, loading: geoLoading } = useGeolocation();
  const { hasGeolocation } = useDriverPlanFeatures(companyId);

  const handleToggle = (id: string) => {
    setItems(items.map(item => 
      item.id === id ? { ...item, checked: !item.checked } : item
    ));
  };

  const handlePhotoCapture = async (file: File) => {
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
      });

      const filePath = `${companyId}/checklist/${journeyId || 'pending'}/${Date.now()}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from('expense-receipts')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Use signed URL for private bucket access
      const { data: signedData } = await supabase.storage
        .from('expense-receipts')
        .createSignedUrl(filePath, 31536000); // 1 year expiration

      if (signedData?.signedUrl) {
        setPhotos([...photos, signedData.signedUrl]);
      }
      setShowCamera(false);
      toast.success('Foto adicionada!');
    } catch (error) {
      toast.error('Erro ao salvar foto');
      console.error(error);
    }
  };

  const handleSubmit = async () => {
    const uncheckedCount = items.filter(i => !i.checked).length;
    if (uncheckedCount > 0) {
      toast.error(`Complete todos os ${uncheckedCount} item(ns) pendente(s)`);
      return;
    }

    setIsSubmitting(true);
    try {
      let location: any = { lat: null, lng: null, address: null };
      
      // Capturar localização apenas se o plano permitir
      if (hasGeolocation) {
        try {
          const pos = await getCurrentPosition();
          location = {
            lat: pos.latitude,
            lng: pos.longitude,
            address: pos.address
          };
        } catch (err) {
          console.log('Geolocalização não disponível:', err);
        }
      }

      // Se deferSave, retorna dados sem salvar no banco
      if (deferSave) {
        const data: ChecklistData = {
          items,
          photos,
          notes: notes || null,
          location_lat: location.lat,
          location_lng: location.lng,
          location_address: location.address,
        };
        onCompleteWithData?.(data);
        toast.success(`Checklist ${type === 'pre' ? 'pré-viagem' : 'pós-viagem'} concluído!`);
        onComplete();
        return;
      }

      const { error } = await supabase
        .from('journey_checklists')
        .insert([{
          journey_id: journeyId,
          vehicle_id: vehicleId,
          driver_id: driverId,
          company_id: companyId,
          checklist_type: type,
          items: items as any,
          photos: photos as any,
          notes: notes || null,
          location_lat: location.lat,
          location_lng: location.lng,
          location_address: location.address
        }]);

      if (error) throw error;

      toast.success(`Checklist ${type === 'pre' ? 'pré-viagem' : 'pós-viagem'} concluído!`);
      onComplete();
    } catch (error: any) {
      toast.error('Erro ao salvar checklist: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (showCamera) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Adicionar Foto</CardTitle>
        </CardHeader>
        <CardContent>
          <CameraCapture
            onCapture={handlePhotoCapture}
            onCancel={() => setShowCamera(false)}
            maxSizeKB={800}
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {type === 'pre' ? '✅ Checklist Pré-Viagem' : '🏁 Checklist Pós-Viagem'}
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Complete todos os itens antes de {type === 'pre' ? 'iniciar' : 'finalizar'} a viagem
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.id} className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-accent/50">
              <Checkbox
                id={item.id}
                checked={item.checked}
                onCheckedChange={() => handleToggle(item.id)}
              />
              <Label
                htmlFor={item.id}
                className={`flex-1 cursor-pointer ${item.checked ? 'line-through text-muted-foreground' : ''}`}
              >
                {item.label}
              </Label>
            </div>
          ))}
        </div>

        <div className="space-y-2">
          <Label>Observações</Label>
          <Textarea
            placeholder="Adicione observações relevantes..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
          />
        </div>

        <div className="space-y-2">
          <Label>Fotos ({photos.length})</Label>
          <div className="grid grid-cols-3 gap-2">
            {photos.map((photo, idx) => (
              <img key={idx} src={photo} alt={`Foto ${idx + 1}`} className="rounded-lg border aspect-square object-cover" />
            ))}
            <button
              onClick={() => setShowCamera(true)}
              className="border-2 border-dashed rounded-lg aspect-square flex items-center justify-center hover:bg-accent/50 transition-colors"
            >
              <Camera className="h-6 w-6 text-muted-foreground" />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {geoLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Obtendo localização...</span>
            </>
          ) : (
            <>
              <MapPin className="h-4 w-4" />
              <span>Localização será capturada ao concluir</span>
            </>
          )}
        </div>

        <Button
          onClick={handleSubmit}
          disabled={isSubmitting || items.some(i => !i.checked)}
          className="w-full"
          size="lg"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Salvando...
            </>
          ) : (
            `Concluir Checklist ${type === 'pre' ? 'Pré-Viagem' : 'Pós-Viagem'}`
          )}
        </Button>

        {items.some(i => !i.checked) && (
          <p className="text-sm text-center text-muted-foreground">
            {items.filter(i => !i.checked).length} item(ns) pendente(s)
          </p>
        )}
      </CardContent>
    </Card>
  );
}
