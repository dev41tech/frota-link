import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useDriverAuth } from "@/hooks/useDriverAuth";
import { buildRouteString } from "@/components/journeys/JourneyLegsEditor";
import { useDriverPlanFeatures } from "@/hooks/useDriverPlanFeatures";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ArrowLeft,
  Check,
  MapPin,
  Banknote,
  CreditCard,
  QrCode,
  Camera,
  Loader2,
  ScanLine,
  Sparkles,
  X,
  Fuel,
  Wallet,
  Store,
  AlertTriangle,
} from "lucide-react";
import { CameraCapture } from "@/components/drivers/CameraCapture";
import { saveOfflineExpense } from "@/lib/offlineSync";
import { useExpenseCategories } from "@/hooks/useExpenseCategories";
import { useGeolocation } from "@/hooks/useGeolocation";
import * as LucideIcons from "lucide-react";
import { toast } from "sonner";
import { maybeCreateMaintenanceFromExpense, SERVICE_CATEGORIES } from "@/lib/maintenanceAutoCreate";

// Define os modos de captura da câmera
type PhotoMode = "scan_ai" | "attach_evidence";
type Step = "selection" | "form" | "photo" | "success";
type ExpenseMode = "fuel" | "expense" | "revenue" | null;

interface CurrentJourney {
  id: string;
  journey_number: string;
  origin: string;
  destination: string;
}

interface JourneyLeg {
  id: string;
  origin: string;
  destination: string;
  leg_number: number;
  status: string;
}

const normalizeText = (text: string) => {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
};

// --- NOVA FUNÇÃO DE COMPRESSÃO ---
// Reduz a imagem para max 1200px e qualidade 70%
const compressImage = async (file: File): Promise<File> => {
  const maxWidth = 1200;
  const maxHeight = 1200;
  const quality = 0.7; // 70% de qualidade (ótimo para leitura de texto)

  return new Promise((resolve, reject) => {
    const image = new Image();
    image.src = URL.createObjectURL(file);

    image.onload = () => {
      const canvas = document.createElement("canvas");
      let { width, height } = image;

      // Lógica de redimensionamento mantendo proporção
      if (width > height) {
        if (width > maxWidth) {
          height *= maxWidth / width;
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width *= maxHeight / height;
          height = maxHeight;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");

      if (ctx) {
        ctx.drawImage(image, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (blob) {
              const compressedFile = new File([blob], file.name, {
                type: "image/jpeg",
                lastModified: Date.now(),
              });
              resolve(compressedFile);
            } else {
              reject(new Error("Erro na compressão da imagem"));
            }
          },
          "image/jpeg",
          quality,
        );
      } else {
        reject(new Error("Erro ao criar contexto do canvas"));
      }
    };

    image.onerror = (err) => reject(err);
  });
};

export default function DriverExpenses() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { driver, isDriver, loading: authLoading } = useDriverAuth();
  const { hasGeolocation } = useDriverPlanFeatures(driver?.company_id);
  const { getCurrentPosition } = useGeolocation();

  // Controle de Modo (Combustível ou Despesa)
  const [expenseMode, setExpenseMode] = useState<ExpenseMode>(
    searchParams.get("type") === "fuel" ? "fuel" : searchParams.get("type") === "expense" ? "expense" : null,
  );

  const { data: serverCategories = [] } = useExpenseCategories("direct", true);
  const [categories, setCategories] = useState<any[]>([]);

  useEffect(() => {
    const backupKey = "offline_categories_backup";
    if (serverCategories && serverCategories.length > 0) {
      setCategories(serverCategories);
      localStorage.setItem(backupKey, JSON.stringify(serverCategories));
    } else {
      const saved = localStorage.getItem(backupKey);
      if (saved) setCategories(JSON.parse(saved));
    }
  }, [serverCategories]);

  const [step, setStep] = useState<Step>(expenseMode ? "form" : "selection");
  const [photoMode, setPhotoMode] = useState<PhotoMode>("attach_evidence");
  const [tempPhoto, setTempPhoto] = useState<File | null>(null);

  const [formData, setFormData] = useState({
    category: "",
    categoryId: "",
    amount: "",
    liters: "",
    pricePerLiter: "",
    paymentMethod: "cash",
    vehicle_id: driver?.assignedVehicles[0]?.id || "",
    odometer: "",
    odometer_final: "",
    distance_direct: "",
    description: "",
    maintenance_service_category: "",
    maintenance_provider: "",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [currentJourney, setCurrentJourney] = useState<CurrentJourney | null>(null);
  const [loadingJourney, setLoadingJourney] = useState(true);
  const [routeDisplay, setRouteDisplay] = useState<string | null>(null);
  const [journeyLegs, setJourneyLegs] = useState<JourneyLeg[]>([]);
  const [selectedLegId, setSelectedLegId] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !isDriver) navigate("/auth");
  }, [authLoading, isDriver, navigate]);

  useEffect(() => {
    if (driver?.assignedVehicles?.length && !formData.vehicle_id) {
      setFormData((prev) => ({ ...prev, vehicle_id: driver.assignedVehicles[0].id }));
    }
  }, [driver?.assignedVehicles]);

  useEffect(() => {
    const fetchCurrentJourney = async () => {
      if (!driver?.id) return;
      setLoadingJourney(true);
      try {
        if (!navigator.onLine) {
          const cachedJourney = localStorage.getItem(`active_journey_${driver.id}`);
          if (cachedJourney) {
            setCurrentJourney(JSON.parse(cachedJourney));
            setLoadingJourney(false);
            return;
          }
        }
        const { data, error } = await supabase
          .from("journeys")
          .select("id, journey_number, origin, destination")
          .eq("driver_id", driver.id)
          .eq("status", "in_progress")
          .order("start_date", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!error) {
          setCurrentJourney(data);
          if (data) {
            localStorage.setItem(`active_journey_${driver.id}`, JSON.stringify(data));
            const { data: legs } = await supabase
              .from('journey_legs')
              .select('id, origin, destination, leg_number, status')
              .eq('journey_id', data.id)
              .order('leg_number');
            if (legs && legs.length > 1) {
              setRouteDisplay(buildRouteString(legs));
              setJourneyLegs(legs);
              // Pre-select the active (in_progress) leg
              const activeLeg = legs.find(l => l.status === 'in_progress');
              setSelectedLegId(activeLeg?.id || legs[legs.length - 1].id);
            } else {
              setRouteDisplay(null);
              setJourneyLegs(legs || []);
              setSelectedLegId(legs?.[0]?.id || null);
            }
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingJourney(false);
      }
    };
    fetchCurrentJourney();
  }, [driver?.id]);

  useEffect(() => {
    const handlers = { online: () => setIsOnline(true), offline: () => setIsOnline(false) };
    window.addEventListener("online", handlers.online);
    window.addEventListener("offline", handlers.offline);
    return () => {
      window.removeEventListener("online", handlers.online);
      window.removeEventListener("offline", handlers.offline);
    };
  }, []);

  // Salvar driver_id para uso offline
  useEffect(() => {
    if (driver?.id) {
      localStorage.setItem('current_driver_id', driver.id);
    }
  }, [driver?.id]);

  const handleCategorySelect = (category: any) =>
    setFormData({ ...formData, category: category.name, categoryId: category.id });

  const handleBackToSelection = () => {
    setExpenseMode(null);
    setStep("selection");
    setTempPhoto(null);
    setFormData((prev) => ({ ...prev, amount: "", liters: "", pricePerLiter: "", category: "", description: "", maintenance_service_category: "", maintenance_provider: "" }));
  };

  const handleStartScan = () => {
    if (!isOnline) return toast.error("Recurso disponível apenas online");
    setPhotoMode("scan_ai");
    setStep("photo");
  };

  const handleManualEntry = (mode: "fuel" | "expense") => {
    setExpenseMode(mode);
    setFormData((prev) => ({ ...prev, category: mode === "fuel" ? "Combustível" : "" }));
    setStep("form");
  };

  const handleSaveClick = () => {
    // Bloqueio: só permite salvar se tiver jornada ativa
    if (!currentJourney) {
      toast.error("Você precisa ter uma jornada ativa para fazer lançamentos.");
      return;
    }

    if (!formData.category) return toast.error("Selecione uma categoria");
    if (!formData.amount || parseFloat(formData.amount) <= 0) return toast.error("Informe um valor maior que zero");

    if (expenseMode === "fuel") {
      if (!formData.liters || parseFloat(formData.liters) <= 0) return toast.error("Informe a quantidade de litros");
    }

    setPhotoMode("attach_evidence");
    setStep("photo");
  };

  const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });

  // --- ONDE A MÁGICA ACONTECE ---
  const handlePhotoCaptured = async (originalPhoto: File) => {
    try {
      // 1. Comprime a foto antes de qualquer coisa
      const compressedPhoto = await compressImage(originalPhoto);
      console.log(
        `Foto comprimida: de ${(originalPhoto.size / 1024).toFixed(0)}KB para ${(compressedPhoto.size / 1024).toFixed(0)}KB`,
      );

      if (photoMode === "scan_ai") {
        await processReceiptWithAI(compressedPhoto);
      } else {
        await saveExpenseData(compressedPhoto);
      }
    } catch (error) {
      console.error("Erro na compressão:", error);
      // Se der erro na compressão, usa a original mesmo
      if (photoMode === "scan_ai") {
        await processReceiptWithAI(originalPhoto);
      } else {
        await saveExpenseData(originalPhoto);
      }
    }
  };

  // --- LÓGICA IA (CÉREBRO) ---
  const processReceiptWithAI = async (photoFile: File) => {
    setTempPhoto(photoFile);
    setIsScanning(true);

    try {
      const base64 = await fileToBase64(photoFile);
      toast.info("A IA está lendo a nota...");

      const { data, error } = await supabase.functions.invoke("hyper-api", {
        body: { imageBase64: base64 },
      });

      if (error) throw error;

      if (data) {
        let detectedMode: ExpenseMode = "expense";
        let foundCategoryName = "";
        let foundCategoryId = "";

        if (data.liters || (data.category && normalizeText(data.category).includes("combustivel"))) {
          detectedMode = "fuel";
          foundCategoryName = "Combustível";
        } else {
          detectedMode = "expense";
          if (data.category) {
            const aiCat = normalizeText(data.category);
            const match = categories.find(
              (c) => normalizeText(c.name).includes(aiCat) || aiCat.includes(normalizeText(c.name)),
            );
            if (match) {
              foundCategoryName = match.name;
              foundCategoryId = match.id;
            }
          }
        }

        setExpenseMode(detectedMode);

        setFormData((prev) => ({
          ...prev,
          category: foundCategoryName || prev.category,
          categoryId: foundCategoryId || prev.categoryId,
          amount: data.total_amount ? data.total_amount.toString() : prev.amount,
          liters: data.liters ? data.liters.toString() : prev.liters,
          pricePerLiter: data.price_per_liter ? data.price_per_liter.toString() : prev.pricePerLiter,
          description: data.establishment_name || prev.description,
          paymentMethod: data.payment_method === "card" ? "card" : data.payment_method === "pix" ? "pix" : data.payment_method === "tag" ? "tag" : "cash",
        }));

        toast.success(data.establishment_name ? `Local: ${data.establishment_name}` : "Leitura concluída!");
        setStep("form");
      } else {
        toast.warning("Não foi possível ler os dados. Selecione o tipo manualmente.");
        setStep("selection");
        setTempPhoto(null);
      }
    } catch (error) {
      console.error(error);
      toast.error("Erro na leitura. Tente manualmente.");
      setStep("selection");
      setTempPhoto(null);
    } finally {
      setIsScanning(false);
    }
  };

  // --- SALVAR NO BANCO ---
  const saveExpenseData = async (capturedPhoto: File) => {
    try {
      setIsSubmitting(true);
      let receiptUrl = null;

      let locationData: any = {};
      if (hasGeolocation) {
        try {
          const position = await getCurrentPosition();
          locationData = {
            location_lat: position.latitude,
            location_lng: position.longitude,
            location_address: position.address || null,
          };
        } catch (geoError) {
          console.warn("Sem geolocalização:", geoError);
        }
      }

      if (isOnline && capturedPhoto) {
        const filePath = `${driver?.company_id}/${driver?.id}/${Date.now()}.${capturedPhoto.name.split(".").pop()}`;
        const { error } = await supabase.storage.from("expense-receipts").upload(filePath, capturedPhoto);
        if (!error) {
          // Use signed URL for private bucket access
          const { data: signedData } = await supabase.storage
            .from("expense-receipts")
            .createSignedUrl(filePath, 31536000); // 1 year expiration
          receiptUrl = signedData?.signedUrl || null;
        }
      }

      if (expenseMode === "fuel") {
        const liters = parseFloat(formData.liters);
        let distance_traveled = null;
        let fuel_consumed = null;
        const odo = parseInt(formData.odometer);
        const odoFinal = parseInt(formData.odometer_final);

        if (odo && odoFinal && liters > 0) {
          distance_traveled = odoFinal - odo;
          fuel_consumed = parseFloat((distance_traveled / liters).toFixed(2));
        }

        const data = {
          company_id: driver?.company_id!,
          user_id: driver?.auth_user_id!,
          vehicle_id: formData.vehicle_id,
          journey_id: currentJourney?.id || null,
          journey_leg_id: selectedLegId || null,
          liters,
          price_per_liter: parseFloat(formData.pricePerLiter),
          total_amount: parseFloat(formData.amount),
          date: new Date().toISOString(),
          receipt_url: receiptUrl,
          payment_method: formData.paymentMethod,
          odometer: odo || null,
          odometer_final: odoFinal || null,
          distance_traveled,
          fuel_consumed,
          ...locationData,
        };

        if (isOnline) {
          const { error } = await supabase.from("fuel_expenses").insert([data]);
          if (error) throw error;
          toast.success("Abastecimento registrado!");
        } else {
          await saveOfflineExpense("fuel", data, await fileToBase64(capturedPhoto));
          toast.success("Salvo offline");
        }
      } else if (expenseMode === "revenue") {
        // Save as revenue
        const data = {
          company_id: driver?.company_id!,
          user_id: driver?.auth_user_id!,
          journey_id: currentJourney?.id || null,
          journey_leg_id: selectedLegId || null,
          description: formData.description || "Receita",
          amount: parseFloat(formData.amount),
          date: new Date().toISOString(),
          status: "pending",
        };
        const { error } = await supabase.from("revenue").insert([data]);
        if (error) throw error;
        toast.success("Receita registrada!");
      } else {
        const data = {
          company_id: driver?.company_id!,
          user_id: driver?.auth_user_id!,
          vehicle_id: formData.vehicle_id,
          journey_id: currentJourney?.id || null,
          journey_leg_id: selectedLegId || null,
          category: formData.category,
          category_id: formData.categoryId,
          amount: parseFloat(formData.amount),
          date: new Date().toISOString(),
          description: formData.description || formData.category,
          receipt_url: receiptUrl,
          status: "pending",
          is_direct: true,
          ...locationData,
        };
        if (isOnline) {
          const { data: insertedExpense, error } = await supabase.from("expenses").insert([data]).select().single();
          if (error) throw error;

          // Auto-criar manutenção se categoria for manutenção
          if (insertedExpense) {
            await maybeCreateMaintenanceFromExpense({
              expense_id: insertedExpense.id,
              category_name: formData.category,
              vehicle_id: formData.vehicle_id,
              company_id: driver?.company_id!,
              user_id: driver?.auth_user_id!,
              amount: parseFloat(formData.amount),
              description: formData.description || formData.category,
              date: new Date().toISOString(),
              supplier: null,
              service_category: formData.maintenance_service_category || undefined,
              provider_name: formData.maintenance_provider || undefined,
            });
          }

          toast.success("Despesa registrada!");
        } else {
          await saveOfflineExpense("expense", data, await fileToBase64(capturedPhoto));
          toast.success("Salvo offline");
        }
      }
      setStep("success");
    } catch (error: any) {
      console.error(error);
      toast.error(`Erro ao salvar: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (authLoading || !driver) return null;

  return (
    <div className="min-h-screen bg-gray-50/50 pb-10">
      <div className="bg-white border-b sticky top-0 z-20 shadow-sm">
        <div className="container mx-auto px-4 h-16 flex items-center gap-3 max-w-2xl">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              if (step === "form") handleBackToSelection();
              else navigate("/driver");
            }}
            className="h-10 w-10 -ml-2 rounded-full hover:bg-gray-100"
          >
            <ArrowLeft className="h-5 w-5 text-gray-600" />
          </Button>
          <h1 className="text-lg font-bold text-gray-900">
            {step === "selection" ? "Novo Lançamento" : expenseMode === "fuel" ? "Abastecimento" : expenseMode === "revenue" ? "Receita" : "Despesa"}
          </h1>
        </div>
      </div>

      <div className="container mx-auto p-4 max-w-2xl space-y-6">
        {step === "selection" && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Bloqueio: sem jornada ativa */}
            {!loadingJourney && !currentJourney ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="h-20 w-20 bg-red-50 rounded-full flex items-center justify-center mb-4">
                  <AlertTriangle className="h-10 w-10 text-red-500" />
                </div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">
                  Sem Jornada Ativa
                </h2>
                <p className="text-gray-500 mb-6 max-w-xs">
                  Você precisa ter uma jornada em andamento para fazer lançamentos de despesas.
                </p>
                <Button onClick={() => navigate("/driver")} className="gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  Voltar ao Menu
                </Button>
              </div>
            ) : (
              <>
                <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-3xl p-6 shadow-xl text-white relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-10 -mt-10"></div>
                  <div className="relative z-10">
                    <h2 className="text-2xl font-bold mb-2">Tem a nota fiscal?</h2>
                    <p className="text-blue-100 mb-6">
                      A Inteligência Artificial lê, identifica e preenche tudo para você.
                    </p>

                    <Button
                      onClick={handleStartScan}
                      disabled={!isOnline}
                      className="w-full bg-white text-blue-700 hover:bg-blue-50 h-16 text-lg font-bold rounded-xl shadow-lg flex items-center justify-center gap-3 transition-transform active:scale-[0.98]"
                    >
                      {isScanning ? <Loader2 className="h-6 w-6 animate-spin" /> : <ScanLine className="h-6 w-6" />}
                      Escanear Nota com IA
                      <Sparkles className="h-5 w-5 text-yellow-500" />
                    </Button>
                  </div>
                </div>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-gray-200" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-gray-50 px-2 text-gray-400 font-semibold">Ou selecione manualmente</span>
                  </div>
                </div>

                <div className={`grid gap-4 ${driver?.can_add_revenue ? 'grid-cols-3' : 'grid-cols-2'}`}>
                  <button
                    onClick={() => handleManualEntry("fuel")}
                    className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all flex flex-col items-center gap-3 group"
                  >
                    <div className="h-14 w-14 bg-orange-50 rounded-full flex items-center justify-center group-hover:bg-orange-100 transition-colors">
                      <Fuel className="h-7 w-7 text-orange-500" />
                    </div>
                    <span className="font-bold text-gray-700">Abastecimento</span>
                  </button>

                  <button
                    onClick={() => handleManualEntry("expense")}
                    className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all flex flex-col items-center gap-3 group"
                  >
                    <div className="h-14 w-14 bg-blue-50 rounded-full flex items-center justify-center group-hover:bg-blue-100 transition-colors">
                      <Wallet className="h-7 w-7 text-blue-500" />
                    </div>
                    <span className="font-bold text-gray-700">Outra Despesa</span>
                  </button>

                  {driver?.can_add_revenue && (
                    <button
                      onClick={() => {
                        setExpenseMode("revenue");
                        setFormData(prev => ({ ...prev, category: "Receita" }));
                        setStep("form");
                      }}
                      className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all flex flex-col items-center gap-3 group"
                    >
                      <div className="h-14 w-14 bg-green-50 rounded-full flex items-center justify-center group-hover:bg-green-100 transition-colors">
                        <Banknote className="h-7 w-7 text-green-500" />
                      </div>
                      <span className="font-bold text-gray-700">Receita</span>
                    </button>
                  )}
                </div>

                {currentJourney && (
                  <div className="bg-gray-100 rounded-xl p-3 flex items-center justify-between text-xs text-gray-500">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-3 w-3" />
                      <span>Jornada: #{currentJourney.journey_number}</span>
                    </div>
                    <span className="font-medium text-gray-900">
                      {routeDisplay || `${currentJourney.origin} ➝ ${currentJourney.destination}`}
                    </span>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {step === "form" && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {tempPhoto && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-start gap-3">
                <Sparkles className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-bold text-green-800">Leitura Inteligente Concluída!</p>
                  <p className="text-green-700">Confira os dados abaixo antes de confirmar.</p>
                </div>
              </div>
            )}

            <Card className="border-none shadow-sm rounded-xl overflow-hidden bg-white">
              <CardContent className="p-5 space-y-6">
                <div className="space-y-2">
                  <Label
                    htmlFor="description"
                    className="text-xs font-semibold text-gray-500 uppercase flex items-center gap-2"
                  >
                    <Store className="h-3 w-3" />
                    Local / Estabelecimento
                  </Label>
                  <Input
                    id="description"
                    placeholder="Ex: Posto Ipiranga ou Restaurante X"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="h-12 bg-gray-50 font-medium"
                  />
                </div>

                {expenseMode === "expense" && (
                  <div className="space-y-3">
                    <Label className="text-sm text-gray-500 font-semibold uppercase tracking-wider">
                      Categoria da Despesa
                    </Label>
                    <div className="grid grid-cols-2 gap-3">
                      {categories.filter((cat) => !normalizeText(cat.name).includes("combustivel") && !normalizeText(cat.name).includes("abastecimento")).map((cat) => {
                        const Icon = (LucideIcons as any)[cat.icon || "Package"];
                        const isSelected = formData.category === cat.name;
                        return (
                          <button
                            key={cat.id}
                            type="button"
                            className={`relative p-4 rounded-xl border-2 transition-all flex flex-col items-center justify-center gap-2 h-24 ${isSelected ? "border-blue-500 bg-blue-50/50 ring-2 ring-blue-500/20 ring-offset-0" : "border-gray-100 bg-gray-50/50 hover:bg-gray-100 hover:border-gray-200"}`}
                            onClick={() => handleCategorySelect(cat)}
                          >
                            <div
                              className={`h-10 w-10 rounded-full flex items-center justify-center transition-colors ${isSelected ? "bg-blue-100 text-blue-600" : "bg-white text-gray-500 shadow-sm"}`}
                            >
                              {Icon && (
                                <Icon className="h-5 w-5" style={{ color: isSelected ? undefined : cat.color }} />
                              )}
                            </div>
                            <span className={`text-sm font-semibold ${isSelected ? "text-blue-700" : "text-gray-600"}`}>
                              {cat.name}
                            </span>
                            {isSelected && <div className="absolute top-2 right-2 h-2 w-2 rounded-full bg-blue-500" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Campos extras simplificados para Manutenção (PWA) */}
                {expenseMode === "expense" && normalizeText(formData.category).includes("manutencao") && (
                  <div className="space-y-4 p-4 bg-gray-50 rounded-xl border border-gray-200 animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase">
                      🔧 Detalhes da Manutenção
                    </div>
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold text-gray-500 uppercase">Tipo de Serviço</Label>
                        <div className="grid grid-cols-2 gap-2">
                          {SERVICE_CATEGORIES.map((sc) => {
                            const isSelected = formData.maintenance_service_category === sc.value;
                            return (
                              <button
                                key={sc.value}
                                type="button"
                                onClick={() => setFormData({ ...formData, maintenance_service_category: sc.value })}
                                className={`p-3 rounded-xl border-2 text-sm font-semibold transition-all ${
                                  isSelected
                                    ? "border-blue-500 bg-blue-50 text-blue-700"
                                    : "border-gray-100 bg-white text-gray-600 hover:border-gray-200"
                                }`}
                              >
                                {sc.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold text-gray-500 uppercase">Oficina</Label>
                        <Input
                          placeholder="Nome da oficina (opcional)"
                          value={formData.maintenance_provider}
                          onChange={(e) => setFormData({ ...formData, maintenance_provider: e.target.value })}
                          className="h-12 bg-white font-medium"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {expenseMode === "fuel" && (
                  <div className="space-y-6">
                    <div className="space-y-3">
                      <Label className="text-sm text-gray-500 font-semibold uppercase tracking-wider">
                        Pagamento via
                      </Label>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { label: "Dinheiro", value: "cash", icon: Banknote },
                          { label: "Cartão", value: "card", icon: CreditCard },
                          { label: "Pix", value: "pix", icon: QrCode },
                        ].map((item) => {
                          const isSelected = formData.paymentMethod === item.value;
                          return (
                            <button
                              key={item.value}
                              type="button"
                              onClick={() => setFormData({ ...formData, paymentMethod: item.value })}
                              className={`h-14 rounded-xl border-2 font-semibold text-sm flex items-center justify-center gap-2 transition-all ${
                                isSelected
                                  ? "border-orange-500 bg-orange-50 text-orange-700"
                                  : "border-gray-100 bg-white text-gray-600"
                              }`}
                            >
                              <item.icon className="h-4 w-4" />
                              {item.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="liters" className="text-xs font-semibold text-gray-500 uppercase">
                          Litros
                        </Label>
                        <Input
                          id="liters"
                          type="number"
                          inputMode="decimal"
                          placeholder="0.00"
                          value={formData.liters}
                          onChange={(e) => {
                            const liters = e.target.value;
                            const pricePerLiter = formData.pricePerLiter;
                            const amount =
                              liters && pricePerLiter
                                ? (parseFloat(liters) * parseFloat(pricePerLiter)).toFixed(2)
                                : formData.amount;
                            setFormData({ ...formData, liters, amount });
                          }}
                          className="h-14 text-xl font-semibold bg-gray-50 border-gray-200 focus:border-orange-500 focus:ring-orange-500/20"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="price" className="text-xs font-semibold text-gray-500 uppercase">
                          Preço/Litro
                        </Label>
                        <Input
                          id="price"
                          type="number"
                          inputMode="decimal"
                          placeholder="R$ 0.00"
                          value={formData.pricePerLiter}
                          onChange={(e) => {
                            const pricePerLiter = e.target.value;
                            const liters = formData.liters;
                            const amount =
                              liters && pricePerLiter
                                ? (parseFloat(liters) * parseFloat(pricePerLiter)).toFixed(2)
                                : formData.amount;
                            setFormData({ ...formData, pricePerLiter, amount });
                          }}
                          className="h-14 text-xl font-semibold bg-gray-50 border-gray-200 focus:border-orange-500 focus:ring-orange-500/20"
                        />
                      </div>
                    </div>

                    <div className="bg-gray-50 rounded-xl p-4 border border-dashed border-gray-200">
                      <div className="flex items-center gap-2 mb-3">
                        <MapPin className="h-4 w-4 text-gray-400" />
                        <span className="text-xs font-bold text-gray-500 uppercase">Controle de KM (Opcional)</span>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <Input
                          placeholder="KM Inicial"
                          type="number"
                          className="h-10 text-sm bg-white"
                          value={formData.odometer}
                          onChange={(e) => setFormData({ ...formData, odometer: e.target.value })}
                        />
                        <Input
                          placeholder="KM Final"
                          type="number"
                          className="h-10 text-sm bg-white"
                          value={formData.odometer_final}
                          onChange={(e) => setFormData({ ...formData, odometer_final: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Seletor de Trecho - só aparece se há mais de 1 trecho */}
                {journeyLegs.length > 1 && (
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold text-gray-500 uppercase">
                      Trecho
                    </Label>
                    <div className="grid grid-cols-1 gap-2">
                      {journeyLegs.map((leg) => {
                        const isSelected = selectedLegId === leg.id;
                        return (
                          <button
                            key={leg.id}
                            type="button"
                            onClick={() => setSelectedLegId(leg.id)}
                            className={`p-3 rounded-xl border-2 text-sm font-semibold transition-all text-left ${
                              isSelected
                                ? "border-blue-500 bg-blue-50 text-blue-700"
                                : "border-gray-100 bg-white text-gray-600 hover:border-gray-200"
                            }`}
                          >
                            <span className="text-xs text-gray-400">Trecho {leg.leg_number}:</span>{" "}
                            {leg.origin} ➝ {leg.destination}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="pt-2">
                  <Label htmlFor="amount" className="text-xs font-bold text-gray-500 uppercase block text-center mb-2">
                    Valor Total do Pagamento
                  </Label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-medium text-lg">
                      R$
                    </span>
                    <Input
                      id="amount"
                      type="number"
                      inputMode="decimal"
                      placeholder="0,00"
                      value={formData.amount}
                      onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                      className={`h-20 text-center text-4xl font-bold rounded-2xl border-2 ${expenseMode === "fuel" ? "focus:border-orange-500 text-orange-600 bg-orange-50/30" : "focus:border-blue-500 text-blue-600 bg-blue-50/30"} focus:ring-0`}
                    />
                  </div>
                </div>

                <div className="pt-4 space-y-3">
                  {tempPhoto && (
                    <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-xl animate-in fade-in slide-in-from-top-2">
                      <div className="h-10 w-10 bg-green-100 rounded-full flex items-center justify-center text-green-600 shrink-0">
                        <Check className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-green-800">Comprovante Anexado</p>
                        <p className="text-xs text-green-600 truncate">Pronto para salvar</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-500 hover:text-red-600 hover:bg-red-50 h-8 px-2"
                        onClick={() => setTempPhoto(null)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  )}

                  <Button
                    size="lg"
                    className={`w-full h-14 text-lg font-bold rounded-xl shadow-lg transition-transform active:scale-95 
                      ${
                        tempPhoto
                          ? "bg-green-600 hover:bg-green-700 text-white"
                          : expenseMode === "fuel"
                            ? "bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white"
                            : "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white"
                      }`}
                    onClick={() => {
                      if (tempPhoto) saveExpenseData(tempPhoto);
                      else handleSaveClick();
                    }}
                    disabled={isSubmitting || isScanning}
                  >
                    {isSubmitting ? (
                      <Loader2 className="h-5 w-5 animate-spin mr-2" />
                    ) : tempPhoto ? (
                      <Check className="h-5 w-5 mr-2" />
                    ) : (
                      <Camera className="h-5 w-5 mr-2" />
                    )}
                    {tempPhoto ? "Confirmar Lançamento" : "Tirar Foto e Salvar"}
                  </Button>

                  <Button variant="ghost" className="w-full text-gray-400 font-normal" onClick={handleBackToSelection}>
                    Cancelar
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {step === "photo" && (
          <div className="fixed inset-0 bg-black z-50 flex flex-col">
            <div className="p-4 flex justify-between items-center bg-black/50 backdrop-blur-sm absolute top-0 w-full z-10">
              <span className="text-white font-medium">
                {photoMode === "scan_ai" ? "Centralize a nota para leitura" : "Foto do comprovante"}
              </span>
              <Button
                variant="ghost"
                className="text-white hover:bg-white/20"
                onClick={() => setStep(expenseMode ? "form" : "selection")}
              >
                Cancelar
              </Button>
            </div>
            <div className="flex-1 bg-black flex items-center justify-center">
              <CameraCapture
                onCapture={handlePhotoCaptured}
                onCancel={() => setStep(expenseMode ? "form" : "selection")}
                maxSizeKB={800}
              />
            </div>
          </div>
        )}

        {step === "success" && (
          <div className="flex flex-col items-center justify-center py-10 space-y-6 animate-in zoom-in duration-300">
            <div className="h-24 w-24 rounded-full bg-green-100 flex items-center justify-center shadow-sm">
              <Check className="h-12 w-12 text-green-600" />
            </div>
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold text-gray-900">Sucesso!</h2>
              <p className="text-gray-500">O lançamento foi registrado.</p>
            </div>
            <div className="w-full max-w-xs space-y-3 pt-4">
              <Button size="lg" className="w-full h-12 rounded-xl font-semibold" onClick={handleBackToSelection}>
                Fazer Novo Lançamento
              </Button>
              <Button variant="outline" className="w-full h-12 rounded-xl" onClick={() => navigate("/driver")}>
                Voltar ao Menu
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
