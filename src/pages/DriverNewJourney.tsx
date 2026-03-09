import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { JourneyLegsEditor, type LegData } from "@/components/journeys/JourneyLegsEditor";
import { supabase } from "@/integrations/supabase/client";
import { useDriverAuth } from "@/hooks/useDriverAuth";
import { useDriverPlanFeatures } from "@/hooks/useDriverPlanFeatures";
import { useGeolocation } from "@/hooks/useGeolocation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { JourneyChecklist, type ChecklistData } from "@/components/driver/JourneyChecklist";
import { toast } from "sonner";
import { 
  ArrowLeft, MapPin, Navigation, Truck, Play, Camera, Sparkles, 
  Loader2, CheckCircle, Edit3, RotateCcw, FileText
} from "lucide-react";

type Step = "checklist" | "odometer_photo" | "form";
type OdometerStep = "idle" | "camera" | "processing" | "confirm" | "manual";

export default function DriverNewJourney() {
  const navigate = useNavigate();
  const { driver, loading: driverLoading } = useDriverAuth();
  const { hasGeolocation } = useDriverPlanFeatures(driver?.company_id);
  const { getCurrentPosition } = useGeolocation();
  const [step, setStep] = useState<Step>("checklist");
  const [odometerStep, setOdometerStep] = useState<OdometerStep>("idle");
  const [loading, setLoading] = useState(false);
  const [hasActiveJourney, setHasActiveJourney] = useState(false);
  const [checkingJourney, setCheckingJourney] = useState(true);

  // Odometer AI state
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [aiOdometer, setAiOdometer] = useState<number | null>(null);
  const [manualOdometer, setManualOdometer] = useState("");
  const [confirmedOdometer, setConfirmedOdometer] = useState<number | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [checklistData, setChecklistData] = useState<ChecklistData | null>(null);
  const [formData, setFormData] = useState({ origin: "", destination: "", notes: "" });
  const [legs, setLegs] = useState<LegData[]>([{ leg_number: 1, origin: '', destination: '', freight_status: 'pending' }]);
  const [cteReading, setCteReading] = useState(false);
  const cteInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (driver && !driver.can_start_journey) {
      toast.error("Você não tem permissão para iniciar jornadas.");
      navigate("/driver", { replace: true });
    }
  }, [driver]);

  useEffect(() => {
    if (driver?.assignedVehicles?.[0]?.id) checkActiveJourney();
  }, [driver]);

  const checkActiveJourney = async () => {
    if (!driver?.assignedVehicles?.[0]?.id) return;
    setCheckingJourney(true);
    const { data, error } = await supabase
      .from("journeys")
      .select("id")
      .eq("vehicle_id", driver.assignedVehicles[0].id)
      .in("status", ["planned", "in_progress", "pending_approval"])
      .maybeSingle();
    if (data && !error) {
      setHasActiveJourney(true);
      toast.error("Você já possui uma jornada ativa");
      navigate("/driver", { replace: true });
    }
    setCheckingJourney(false);
  };

  const handleChecklistComplete = () => setStep("odometer_photo");
  const handleChecklistData = (data: ChecklistData) => setChecklistData(data);

  // --- Odometer Photo Logic ---
  const handleStartCapture = () => {
    setOdometerStep("camera");
    setTimeout(() => inputRef.current?.click(), 100);
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

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) { setOdometerStep("idle"); return; }

    const base64 = await compressAndConvert(file);
    setCapturedImage(base64);
    setOdometerStep("processing");

    try {
      toast.info("IA analisando o hodômetro...");
      const { data, error } = await supabase.functions.invoke("read-odometer", {
        body: { imageBase64: base64 }
      });
      if (error) throw error;
      if (data.success && data.odometer) {
        setAiOdometer(data.odometer);
        setOdometerStep("confirm");
        toast.success("Hodômetro identificado!");
      } else {
        setAiError(data.reason || "Não foi possível ler o hodômetro");
        setOdometerStep("manual");
        toast.warning("Não foi possível ler automaticamente. Digite manualmente.");
      }
    } catch (err) {
      console.error("AI Error:", err);
      setAiError("Erro ao processar imagem");
      setOdometerStep("manual");
      toast.error("Erro na leitura. Digite o hodômetro manualmente.");
    }
  };

  const handleConfirmAI = () => {
    if (aiOdometer) {
      setConfirmedOdometer(aiOdometer);
      setStep("form");
    }
  };

  const handleManualSubmit = () => {
    const value = parseInt(manualOdometer, 10);
    if (isNaN(value) || value <= 0) {
      toast.error("Digite um valor válido para o hodômetro");
      return;
    }
    setConfirmedOdometer(value);
    setStep("form");
  };

  const handleSwitchToManual = () => {
    setOdometerStep("manual");
    setManualOdometer(aiOdometer?.toString() || "");
  };

  const handleRetakePhoto = () => {
    setCapturedImage(null);
    setAiOdometer(null);
    setAiError(null);
    setOdometerStep("camera");
    setTimeout(() => inputRef.current?.click(), 100);
  };

  // --- CT-e Photo Reading ---
  const handleCteCapture = () => {
    cteInputRef.current?.click();
  };

  const handleCteFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset input so same file can be re-selected
    e.target.value = '';

    setCteReading(true);
    try {
      toast.info("IA analisando o CT-e...");
      const base64 = await compressAndConvert(file);

      const { data, error } = await supabase.functions.invoke("read-cte-photo", {
        body: { imageBase64: base64 }
      });

      if (error) throw error;

      if (data.success && data.origin && data.destination) {
        setFormData(prev => ({
          ...prev,
          origin: data.origin,
          destination: data.destination,
          notes: prev.notes
            ? `${prev.notes}\nCT-e ${data.cte_number || ''}`.trim()
            : data.cte_number ? `CT-e ${data.cte_number}` : prev.notes,
        }));
        toast.success("Origem e destino preenchidos automaticamente!");
      } else {
        toast.warning(data.reason || "Não foi possível ler o CT-e. Preencha manualmente.");
      }
    } catch (err) {
      console.error("CT-e AI Error:", err);
      toast.error("Erro ao processar CT-e. Preencha manualmente.");
    } finally {
      setCteReading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!driver?.assignedVehicles?.length || !confirmedOdometer) return;
    setLoading(true);
    try {
      let location: any = { lat: null, lng: null, address: null };
      
      if (hasGeolocation) {
        try {
          const pos = await getCurrentPosition();
          location = { lat: pos.latitude, lng: pos.longitude, address: pos.address };
        } catch (err) {
          console.log("GPS indisponível", err);
        }
      }

      const { data: lastJourney } = await supabase
        .from("journeys")
        .select("journey_number")
        .eq("company_id", driver.company_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const nextNumber = lastJourney ? String(Number(lastJourney.journey_number) + 1).padStart(6, "0") : "000001";

      const needsApproval = !driver.can_create_journey_without_approval;
      const journeyStatus = needsApproval ? "pending_approval" : "in_progress";

      // Use first leg origin and last leg destination for summary
      const journeyOrigin = legs.length > 1 ? legs[0].origin : formData.origin;
      const journeyDestination = legs.length > 1 ? legs[legs.length - 1].destination : formData.destination;

      const { data: journeyData, error } = await supabase
        .from("journeys")
        .insert({
          company_id: driver.company_id,
          user_id: driver.auth_user_id,
          vehicle_id: driver.assignedVehicles[0].id,
          driver_id: driver.id,
          journey_number: nextNumber,
          origin: journeyOrigin,
          destination: journeyDestination,
          start_km: confirmedOdometer,
          start_date: new Date().toISOString(),
          start_location_lat: location.lat,
          start_location_lng: location.lng,
          start_location_address: location.address,
          status: journeyStatus,
          notes: formData.notes || null,
          created_by_driver: true,
        })
        .select('id')
        .single();

      if (error) throw error;

      // Salvar checklist com o journey_id real
      if (checklistData && journeyData?.id) {
        const { error: checklistError } = await supabase
          .from('journey_checklists')
          .insert({
            journey_id: journeyData.id,
            vehicle_id: driver.assignedVehicles[0].id,
            driver_id: driver.id,
            company_id: driver.company_id,
            checklist_type: 'pre',
            items: checklistData.items as any,
            photos: checklistData.photos as any,
            notes: checklistData.notes,
            location_lat: checklistData.location_lat,
            location_lng: checklistData.location_lng,
            location_address: checklistData.location_address,
          });
        if (checklistError) {
          console.error('Erro ao salvar checklist:', checklistError);
        }
      }

      // Save journey legs
      if (journeyData?.id) {
        const legsToSave = legs.length > 1 ? legs : [{ leg_number: 1, origin: formData.origin, destination: formData.destination }];
        for (const leg of legsToSave) {
          await supabase.from('journey_legs').insert({
            journey_id: journeyData.id,
            leg_number: leg.leg_number,
            origin: leg.origin,
            destination: leg.destination,
            company_id: driver.company_id,
          });
        }
      }
      
      if (needsApproval) {
        toast.success("Jornada enviada para aprovação do gestor!");
      } else {
        toast.success("Boa viagem! Jornada iniciada.");
      }
      navigate("/driver");
    } catch (error: any) {
      toast.error("Erro: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  if (driverLoading || checkingJourney)
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-400">Carregando...</div>;
  if (hasActiveJourney) return null;

  return (
    <div className="min-h-screen bg-gray-50/50 pb-10">
      {/* Hidden file input for CT-e */}
      <input
        ref={cteInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleCteFileChange}
        className="hidden"
      />

      {/* Hidden file input for odometer */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        className="hidden"
      />

      <div className="bg-white border-b sticky top-0 z-20 shadow-sm">
        <div className="container mx-auto px-4 h-16 flex items-center gap-3 max-w-2xl">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/driver")}
            className="h-10 w-10 -ml-2 rounded-full hover:bg-gray-100"
          >
            <ArrowLeft className="h-5 w-5 text-gray-600" />
          </Button>
          <h1 className="text-lg font-bold text-gray-900">Iniciar Nova Viagem</h1>
        </div>
      </div>

      <div className="container mx-auto p-4 max-w-2xl mt-4">
        {step === "checklist" && driver?.assignedVehicles?.length > 0 ? (
          <div className="space-y-4">
            <div className="bg-white p-4 rounded-xl border shadow-sm mb-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600">
                  <Truck className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Veículo Selecionado</p>
                  <p className="font-bold text-gray-900">
                    {driver.assignedVehicles[0].plate} • {driver.assignedVehicles[0].model}
                  </p>
                </div>
              </div>
            </div>
            <JourneyChecklist
              vehicleId={driver.assignedVehicles[0].id}
              driverId={driver.id}
              companyId={driver.company_id}
              type="pre"
              deferSave={true}
              onComplete={handleChecklistComplete}
              onCompleteWithData={handleChecklistData}
            />
          </div>
        ) : step === "odometer_photo" ? (
          <Card className="border-none shadow-md rounded-xl bg-white overflow-hidden">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-4 text-white">
              <h2 className="font-bold text-lg flex items-center gap-2">
                <Camera className="h-5 w-5" /> Registrar Hodômetro
              </h2>
              <p className="text-blue-100 text-sm opacity-90">Tire uma foto do painel para registrar o KM inicial.</p>
            </div>
            <CardContent className="p-6">
              {odometerStep === "idle" && (
                <div className="space-y-4">
                  <Card 
                    className="p-6 cursor-pointer hover:bg-muted/50 transition-colors border-2 border-dashed"
                    onClick={handleStartCapture}
                  >
                    <div className="flex flex-col items-center text-center">
                      <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                        <Camera className="h-8 w-8 text-primary" />
                      </div>
                      <h3 className="font-semibold text-lg mb-1">Fotografar Hodômetro</h3>
                      <p className="text-sm text-muted-foreground">A IA vai ler o km automaticamente</p>
                      <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                        <Sparkles className="h-3 w-3 text-yellow-500" />
                        Leitura inteligente
                      </div>
                    </div>
                  </Card>
                </div>
              )}

              {odometerStep === "camera" && (
                <div className="flex flex-col items-center justify-center py-12">
                  <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
                  <p className="text-muted-foreground">Aguardando câmera...</p>
                </div>
              )}

              {odometerStep === "processing" && (
                <div className="space-y-4">
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
              )}

              {odometerStep === "confirm" && (
                <div className="space-y-4">
                  {capturedImage && (
                    <div className="rounded-lg overflow-hidden border">
                      <img src={capturedImage} alt="Hodômetro" className="w-full h-36 object-cover" />
                    </div>
                  )}
                  <div className="bg-primary/5 rounded-xl p-6 text-center border border-primary/20">
                    <p className="text-sm text-muted-foreground mb-2">KM Inicial Identificado</p>
                    <p className="text-4xl font-bold text-primary">
                      {aiOdometer?.toLocaleString("pt-BR")} km
                    </p>
                  </div>
                  <Button variant="link" className="w-full text-muted-foreground" onClick={handleSwitchToManual}>
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
              )}

              {odometerStep === "manual" && (
                <div className="space-y-4">
                  {capturedImage && (
                    <div className="rounded-lg overflow-hidden border">
                      <img src={capturedImage} alt="Referência" className="w-full h-32 object-cover opacity-75" />
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="manual-km">KM Inicial</Label>
                    <Input
                      id="manual-km"
                      type="number"
                      inputMode="numeric"
                      placeholder="Ex: 125432"
                      value={manualOdometer}
                      onChange={(e) => setManualOdometer(e.target.value)}
                      className="text-lg h-12"
                    />
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
              )}
            </CardContent>
          </Card>
        ) : (
          <Card className="border-none shadow-md rounded-xl bg-white overflow-hidden">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-4 text-white">
              <h2 className="font-bold text-lg flex items-center gap-2">
                <Navigation className="h-5 w-5" /> Rota da Viagem
              </h2>
              <p className="text-blue-100 text-sm opacity-90">
                KM Inicial: <strong>{confirmedOdometer?.toLocaleString("pt-BR")} km</strong>
              </p>
            </div>
            <CardContent className="p-6">
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Botão Ler CT-e com IA */}
                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-12 border-dashed border-2 border-blue-300 text-blue-600 hover:bg-blue-50 flex items-center justify-center gap-2"
                  onClick={handleCteCapture}
                  disabled={cteReading}
                >
                  {cteReading ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Lendo CT-e...
                    </>
                  ) : (
                    <>
                      <FileText className="h-5 w-5" />
                      <Camera className="h-4 w-4" />
                      Ler CT-e com IA
                      <Sparkles className="h-4 w-4 text-yellow-500" />
                    </>
                  )}
                </Button>

                {legs.length <= 1 ? (
                  <div className="grid grid-cols-1 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-gray-500 uppercase">Origem</Label>
                      <div className="relative">
                        <MapPin className="absolute left-3 top-3.5 h-5 w-5 text-gray-400" />
                        <Input
                          placeholder="De onde você está saindo?"
                          value={formData.origin}
                          onChange={(e) => {
                            setFormData({ ...formData, origin: e.target.value });
                            setLegs(prev => {
                              const updated = [...prev];
                              updated[0] = { ...updated[0], origin: e.target.value };
                              return updated;
                            });
                          }}
                          className="pl-10 h-12 bg-gray-50 border-gray-200"
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-gray-500 uppercase">Destino</Label>
                      <div className="relative">
                        <MapPin className="absolute left-3 top-3.5 h-5 w-5 text-blue-500" />
                        <Input
                          placeholder="Para onde você vai?"
                          value={formData.destination}
                          onChange={(e) => {
                            setFormData({ ...formData, destination: e.target.value });
                            setLegs(prev => {
                              const updated = [...prev];
                              updated[0] = { ...updated[0], destination: e.target.value };
                              return updated;
                            });
                          }}
                          className="pl-10 h-12 bg-gray-50 border-gray-200"
                          required
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <JourneyLegsEditor
                    legs={legs}
                    onLegsChange={(newLegs) => {
                      setLegs(newLegs);
                      if (newLegs.length > 0) {
                        setFormData(prev => ({
                          ...prev,
                          origin: newLegs[0].origin,
                          destination: newLegs[newLegs.length - 1].destination,
                        }));
                      }
                    }}
                    isDriverMode={true}
                  />
                )}

                {legs.length <= 1 && (
                  <JourneyLegsEditor
                    legs={legs}
                    onLegsChange={(newLegs) => {
                      setLegs(newLegs);
                      if (newLegs.length > 1) {
                        // Sync first/last leg with formData
                        setFormData(prev => ({
                          ...prev,
                          origin: newLegs[0].origin,
                          destination: newLegs[newLegs.length - 1].destination,
                        }));
                      }
                    }}
                    isDriverMode={true}
                  />
                )}

                <div className="space-y-2">
                  <Label className="text-xs font-bold text-gray-500 uppercase">Observações</Label>
                  <Textarea
                    placeholder="Algo importante sobre a saída?"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={2}
                    className="bg-gray-50 border-gray-200 resize-none"
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full h-14 text-lg font-bold bg-blue-600 hover:bg-blue-700 shadow-lg rounded-xl mt-4"
                  disabled={loading}
                >
                  {loading ? (
                    "Iniciando..."
                  ) : (
                    <>
                      <Play className="mr-2 h-5 w-5" /> 
                      {driver?.can_create_journey_without_approval ? "Iniciar Viagem" : "Enviar para Aprovação"}
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
