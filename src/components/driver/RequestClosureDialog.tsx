import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { CheckCircle, Clock, MapPin, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useGeolocation } from "@/hooks/useGeolocation";
import { useDriverPlanFeatures } from "@/hooks/useDriverPlanFeatures";

interface RequestClosureDialogProps {
  journeyId: string;
  journeyNumber: string;
  closureRequested: boolean;
  companyId: string;
  onSuccess: () => void;
}

export function RequestClosureDialog({ 
  journeyId, 
  journeyNumber,
  closureRequested,
  companyId,
  onSuccess 
}: RequestClosureDialogProps) {
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [locationCaptured, setLocationCaptured] = useState(false);
  const { getCurrentPosition, loading: geoLoading } = useGeolocation();
  const { hasGeolocation } = useDriverPlanFeatures(companyId);

  const handleSubmit = async () => {
    if (!notes.trim()) {
      toast.error("Por favor, adicione uma observação sobre o encerramento");
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Capturar localização de fim da jornada apenas se o plano permitir
      let locationData: { 
        end_location_lat?: number; 
        end_location_lng?: number; 
        end_location_address?: string;
      } = {};
      
      if (hasGeolocation) {
        try {
          const position = await getCurrentPosition();
          locationData = {
            end_location_lat: position.latitude,
            end_location_lng: position.longitude,
            end_location_address: position.address || null,
          };
          setLocationCaptured(true);
        } catch (geoError) {
          console.warn("Não foi possível capturar localização:", geoError);
          // Continua sem localização se falhar
        }
      }
      
      const { error } = await supabase
        .from("journeys")
        .update({
          closure_requested_at: new Date().toISOString(),
          closure_requested_by: user?.id,
          closure_notes: notes,
          ...locationData,
        })
        .eq("id", journeyId);

      if (error) throw error;

      toast.success("Solicitação de encerramento enviada com sucesso!");
      setOpen(false);
      setNotes("");
      setLocationCaptured(false);
      onSuccess();
    } catch (error: any) {
      toast.error("Erro ao solicitar encerramento: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  if (closureRequested) {
    return (
      <Button variant="outline" className="w-full" disabled>
        <Clock className="h-4 w-4 mr-2" />
        Aguardando aprovação de encerramento
      </Button>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="default" className="w-full">
          <CheckCircle className="h-4 w-4 mr-2" />
          Solicitar Encerramento da Jornada
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Solicitar Encerramento</DialogTitle>
          <DialogDescription>
            Você está solicitando o encerramento da jornada #{journeyNumber}. 
            Um administrador precisará aprovar esta solicitação.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="notes">Observações sobre a jornada *</Label>
            <Textarea
              id="notes"
              placeholder="Ex: Todas as entregas foram concluídas, veículo sem pendências..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              Descreva o status da jornada, entregas realizadas, condições do veículo, etc.
            </p>
          </div>
        </div>
        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3" />
            <span>Localização será capturada ao enviar</span>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Capturando...
                </>
              ) : "Enviar Solicitação"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
