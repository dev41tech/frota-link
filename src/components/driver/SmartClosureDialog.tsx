import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { 
  CheckCircle, 
  Clock, 
  MapPin, 
  Loader2, 
  Camera, 
  Sparkles,
  AlertTriangle,
  Edit3,
  RotateCcw,
  X
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useGeolocation } from "@/hooks/useGeolocation";
import { useDriverPlanFeatures } from "@/hooks/useDriverPlanFeatures";
import { Card } from "@/components/ui/card";

type ClosureStep = "idle" | "camera" | "processing" | "confirm" | "manual" | "notes" | "submitting";

interface SmartClosureDialogProps {
  journeyId: string;
  journeyNumber: string;
  closureRequested: boolean;
  companyId: string;
  currentKm: number | null;
  canAutoClose?: boolean;
  onSuccess: () => void;
}

export function SmartClosureDialog({ 
  journeyId, 
  journeyNumber,
  closureRequested,
  companyId,
  currentKm,
  canAutoClose = false,
  onSuccess 
}: SmartClosureDialogProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<ClosureStep>("idle");
  const [notes, setNotes] = useState("");
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [aiOdometer, setAiOdometer] = useState<number | null>(null);
  const [manualOdometer, setManualOdometer] = useState("");
  const [confirmedOdometer, setConfirmedOdometer] = useState<number | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const { getCurrentPosition } = useGeolocation();
  const { hasGeolocation } = useDriverPlanFeatures(companyId);

  const resetState = () => {
    setStep("idle");
    setNotes("");
    setCapturedImage(null);
    setAiOdometer(null);
    setManualOdometer("");
    setConfirmedOdometer(null);
    setAiError(null);
  };

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      resetState();
    }
  };

  const handleStartCapture = () => {
    setStep("camera");
    // Trigger file input
    setTimeout(() => inputRef.current?.click(), 100);
  };

  const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      setStep("idle");
      return;
    }

    // Compress and create preview
    const base64 = await compressAndConvert(file);
    setCapturedImage(base64);
    setStep("processing");

    // Send to AI
    try {
      toast.info("IA analisando o hodômetro...");
      
      const { data, error } = await supabase.functions.invoke("read-odometer", {
        body: { imageBase64: base64 }
      });

      if (error) throw error;

      console.log("AI Response:", data);

      if (data.success && data.odometer) {
        setAiOdometer(data.odometer);
        setStep("confirm");
        toast.success("Hodômetro identificado!");
      } else {
        setAiError(data.reason || "Não foi possível ler o hodômetro");
        setStep("manual");
        toast.warning("Não foi possível ler automaticamente. Digite manualmente.");
      }
    } catch (err) {
      console.error("AI Error:", err);
      setAiError("Erro ao processar imagem");
      setStep("manual");
      toast.error("Erro na leitura. Digite o hodômetro manualmente.");
    }
  };

  const compressAndConvert = async (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          
          // Resize if too large
          const maxDimension = 1280;
          if (width > maxDimension || height > maxDimension) {
            if (width > height) {
              height = (height / width) * maxDimension;
              width = maxDimension;
            } else {
              width = (width / height) * maxDimension;
              height = maxDimension;
            }
          }
          
          canvas.width = width;
          canvas.height = height;
          
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          
          resolve(canvas.toDataURL('image/jpeg', 0.8));
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

  const handleConfirmAI = () => {
    if (aiOdometer) {
      setConfirmedOdometer(aiOdometer);
      setStep("notes");
    }
  };

  const handleManualSubmit = () => {
    const value = parseInt(manualOdometer, 10);
    if (isNaN(value) || value <= 0) {
      toast.error("Digite um valor válido para o hodômetro");
      return;
    }
    setConfirmedOdometer(value);
    setStep("notes");
  };

  const handleSwitchToManual = () => {
    setStep("manual");
    setManualOdometer(aiOdometer?.toString() || "");
  };

  const handleRetakePhoto = () => {
    setCapturedImage(null);
    setAiOdometer(null);
    setAiError(null);
    setStep("camera");
    setTimeout(() => inputRef.current?.click(), 100);
  };

  const handleFinalSubmit = async () => {
    if (!notes.trim()) {
      toast.error("Por favor, adicione uma observação sobre o encerramento");
      return;
    }

    if (!confirmedOdometer) {
      toast.error("O hodômetro não foi confirmado");
      return;
    }

    setStep("submitting");
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Capture end location if plan allows
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
        } catch (geoError) {
          console.warn("Não foi possível capturar localização:", geoError);
        }
      }

      if (canAutoClose) {
        // Encerramento direto - sem aprovação
        const { error } = await supabase
          .from("journeys")
          .update({
            status: "completed",
            end_km: confirmedOdometer,
            end_date: new Date().toISOString(),
            closed_at: new Date().toISOString(),
            closed_by: user?.id,
            notes: notes,
            ...locationData,
          })
          .eq("id", journeyId);

        if (error) throw error;
        toast.success("Jornada encerrada com sucesso!");
      } else {
        // Solicitar aprovação do gestor
        const { error } = await supabase
          .from("journeys")
          .update({
            closure_requested_at: new Date().toISOString(),
            closure_requested_by: user?.id,
            closure_notes: notes,
            end_km: confirmedOdometer,
            ...locationData,
          })
          .eq("id", journeyId);

        if (error) throw error;
        toast.success("Solicitação de encerramento enviada!");
      }

      handleOpenChange(false);
      onSuccess();
    } catch (error: any) {
      console.error("Submit error:", error);
      toast.error("Erro ao solicitar encerramento: " + error.message);
      setStep("notes");
    }
  };

  if (closureRequested) {
    return (
      <Button variant="outline" className="w-full h-14" disabled>
        <Clock className="h-5 w-5 mr-2" />
        Aguardando aprovação de encerramento
      </Button>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button 
          variant="default" 
          className="w-full h-16 text-lg font-bold bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 shadow-lg"
        >
          <CheckCircle className="h-6 w-6 mr-3" />
          Encerrar Jornada
        </Button>
      </DialogTrigger>
      
      <DialogContent className="sm:max-w-md">
        {/* Hidden file input */}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileChange}
          className="hidden"
        />

        {/* STEP: IDLE - Initial state */}
        {step === "idle" && (
          <>
            <DialogHeader>
              <DialogTitle className="text-xl">Encerrar Jornada</DialogTitle>
              <DialogDescription>
                Jornada #{journeyNumber} - Tire uma foto do hodômetro para registrar o km final
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <Card 
                className="p-6 cursor-pointer hover:bg-muted/50 transition-colors border-2 border-dashed"
                onClick={handleStartCapture}
              >
                <div className="flex flex-col items-center text-center">
                  <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                    <Camera className="h-8 w-8 text-primary" />
                  </div>
                  <h3 className="font-semibold text-lg mb-1">Fotografar Hodômetro</h3>
                  <p className="text-sm text-muted-foreground">
                    A IA vai ler o km automaticamente
                  </p>
                  <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                    <Sparkles className="h-3 w-3 text-yellow-500" />
                    Leitura inteligente
                  </div>
                </div>
              </Card>

              {currentKm && (
                <p className="text-sm text-center text-muted-foreground">
                  KM inicial da jornada: <strong>{currentKm.toLocaleString("pt-BR")}</strong>
                </p>
              )}
            </div>
          </>
        )}

        {/* STEP: CAMERA - Waiting for capture */}
        {step === "camera" && (
          <>
            <DialogHeader>
              <DialogTitle>Capturando Foto</DialogTitle>
              <DialogDescription>
                Aponte a câmera para o hodômetro do veículo
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
              <p className="text-muted-foreground">Aguardando câmera...</p>
            </div>
          </>
        )}

        {/* STEP: PROCESSING - AI analyzing */}
        {step === "processing" && (
          <>
            <DialogHeader>
              <DialogTitle>Analisando Imagem</DialogTitle>
              <DialogDescription>
                A IA está lendo o hodômetro...
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {capturedImage && (
                <div className="rounded-lg overflow-hidden border">
                  <img src={capturedImage} alt="Hodômetro" className="w-full h-48 object-cover" />
                </div>
              )}
              <div className="flex flex-col items-center py-4">
                <div className="relative">
                  <Loader2 className="h-10 w-10 animate-spin text-primary" />
                  <Sparkles className="h-4 w-4 text-yellow-500 absolute -top-1 -right-1" />
                </div>
                <p className="text-sm text-muted-foreground mt-3">Processando...</p>
              </div>
            </div>
          </>
        )}

        {/* STEP: CONFIRM - AI found value */}
        {step === "confirm" && (
          <>
            <DialogHeader>
              <DialogTitle>Confirmar Leitura</DialogTitle>
              <DialogDescription>
                A IA identificou o valor do hodômetro
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {capturedImage && (
                <div className="rounded-lg overflow-hidden border">
                  <img src={capturedImage} alt="Hodômetro" className="w-full h-36 object-cover" />
                </div>
              )}
              
              <div className="bg-primary/5 rounded-xl p-6 text-center border border-primary/20">
                <p className="text-sm text-muted-foreground mb-2">KM Final Identificado</p>
                <p className="text-4xl font-bold text-primary">
                  {aiOdometer?.toLocaleString("pt-BR")} km
                </p>
              </div>

              <Button
                variant="link"
                className="w-full text-muted-foreground"
                onClick={handleSwitchToManual}
              >
                <Edit3 className="h-4 w-4 mr-2" />
                Valor incorreto? Digitar manualmente
              </Button>

              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={handleRetakePhoto}>
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Refazer
                </Button>
                <Button className="flex-1" onClick={handleConfirmAI}>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Confirmar
                </Button>
              </div>
            </div>
          </>
        )}

        {/* STEP: MANUAL - Manual input */}
        {step === "manual" && (
          <>
            <DialogHeader>
              <DialogTitle>Digitar Hodômetro</DialogTitle>
              <DialogDescription>
                {aiError || "Digite o valor do hodômetro manualmente"}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {capturedImage && (
                <div className="rounded-lg overflow-hidden border">
                  <img src={capturedImage} alt="Referência" className="w-full h-32 object-cover opacity-75" />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="manual-km">KM Final</Label>
                <Input
                  id="manual-km"
                  type="number"
                  inputMode="numeric"
                  placeholder="Ex: 125432"
                  value={manualOdometer}
                  onChange={(e) => setManualOdometer(e.target.value)}
                  className="text-lg h-12"
                />
                {currentKm && (
                  <p className="text-xs text-muted-foreground">
                    KM inicial: {currentKm.toLocaleString("pt-BR")} km
                  </p>
                )}
              </div>

              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={handleRetakePhoto}>
                  <Camera className="h-4 w-4 mr-2" />
                  Nova Foto
                </Button>
                <Button className="flex-1" onClick={handleManualSubmit}>
                  Continuar
                </Button>
              </div>
            </div>
          </>
        )}

        {/* STEP: NOTES - Add notes before submitting */}
        {step === "notes" && (
          <>
            <DialogHeader>
              <DialogTitle>Observações do Encerramento</DialogTitle>
              <DialogDescription>
                KM Final: <strong>{confirmedOdometer?.toLocaleString("pt-BR")} km</strong>
                {currentKm && confirmedOdometer && (
                  <span className="ml-2">
                    (Percorridos: {(confirmedOdometer - currentKm).toLocaleString("pt-BR")} km)
                  </span>
                )}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="notes">Observações *</Label>
                <Textarea
                  id="notes"
                  placeholder="Ex: Todas as entregas concluídas, veículo sem pendências..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={4}
                  className="resize-none"
                />
                <p className="text-xs text-muted-foreground">
                  Descreva o status da jornada, entregas realizadas, condições do veículo, etc.
                </p>
              </div>

              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <MapPin className="h-3 w-3" />
                <span>Localização será capturada ao enviar</span>
              </div>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep("confirm")}>
                Voltar
              </Button>
              <Button className="flex-1" onClick={handleFinalSubmit}>
                {canAutoClose ? "Encerrar Jornada" : "Enviar Solicitação"}
              </Button>
            </div>
          </>
        )}

        {/* STEP: SUBMITTING */}
        {step === "submitting" && (
          <>
            <DialogHeader>
              <DialogTitle>Enviando...</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
              <p className="text-muted-foreground">Registrando encerramento...</p>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
