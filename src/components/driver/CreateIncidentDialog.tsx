import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useDriverAuth } from "@/hooks/useDriverAuth";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Camera, Loader2, X } from "lucide-react";
import { toast } from "sonner";

const INCIDENT_TYPES = [
  { value: "pneu_furado", label: "Pneu Furado" },
  { value: "acidente", label: "Acidente" },
  { value: "cartao_recusado", label: "Cartão Recusado" },
  { value: "avaria", label: "Avaria" },
  { value: "mecanica", label: "Problema Mecânico" },
  { value: "outro", label: "Outro" },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

export function CreateIncidentDialog({ open, onOpenChange, onCreated }: Props) {
  const { driver } = useDriverAuth();
  const [incidentType, setIncidentType] = useState("");
  const [description, setDescription] = useState("");
  const [vehicleId, setVehicleId] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhoto(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  const removePhoto = () => {
    setPhoto(null);
    setPhotoPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = async () => {
    if (!driver || !incidentType || !description.trim()) return;

    setSending(true);
    try {
      let photoUrl: string | null = null;

      if (photo) {
        const ext = photo.name.split(".").pop();
        const path = `incidents/${driver.id}/${Date.now()}.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from("expense-receipts")
          .upload(path, photo);

        if (uploadErr) throw uploadErr;

        const { data: urlData } = supabase.storage
          .from("expense-receipts")
          .getPublicUrl(path);
        photoUrl = urlData.publicUrl;
      }

      const { error } = await supabase.from("incidents").insert({
        company_id: driver.company_id,
        driver_id: driver.id,
        vehicle_id: vehicleId || null,
        incident_type: incidentType,
        description: description.trim(),
        photo_url: photoUrl,
      });

      if (error) throw error;

      // Reset
      setIncidentType("");
      setDescription("");
      setVehicleId("");
      removePhoto();
      toast.success("Ocorrência registrada!");
      onCreated();
    } catch (err: any) {
      toast.error("Erro: " + err.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nova Ocorrência</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Tipo</Label>
            <Select value={incidentType} onValueChange={setIncidentType}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Selecione o tipo" />
              </SelectTrigger>
              <SelectContent>
                {INCIDENT_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {driver?.assignedVehicles && driver.assignedVehicles.length > 0 && (
            <div>
              <Label>Veículo</Label>
              <Select value={vehicleId} onValueChange={setVehicleId}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Selecione (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  {driver.assignedVehicles.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.plate} - {v.model}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div>
            <Label>Descrição</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descreva o que aconteceu..."
              rows={3}
              className="resize-none mt-1"
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground mt-1 text-right">
              {description.length}/500
            </p>
          </div>

          <div>
            <Label>Foto (opcional)</Label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handlePhotoChange}
              className="hidden"
            />
            {photoPreview ? (
              <div className="relative mt-1">
                <img
                  src={photoPreview}
                  alt="Preview"
                  className="rounded-md max-h-40 object-cover w-full"
                />
                <Button
                  variant="destructive"
                  size="icon"
                  className="absolute top-1 right-1 h-6 w-6"
                  onClick={removePhoto}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                className="w-full mt-1"
                onClick={() => fileInputRef.current?.click()}
              >
                <Camera className="h-4 w-4 mr-2" />
                Tirar Foto / Galeria
              </Button>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={sending || !incidentType || !description.trim()}
          >
            {sending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            Registrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
