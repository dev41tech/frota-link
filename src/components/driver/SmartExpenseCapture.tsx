import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { 
  Camera, 
  Loader2, 
  Check, 
  X, 
  Edit3,
  AlertTriangle,
  Fuel,
  Receipt
} from "lucide-react";

interface SmartExpenseCaptureProps {
  companyId: string;
  driverId: string;
  authUserId: string;
  vehicleId?: string;
  journeyId?: string | null;
  onSuccess: () => void;
}

interface AIResult {
  success: boolean;
  type: "fuel" | "expense";
  establishment_name: string | null;
  total_amount: number | null;
  liters: number | null;
  price_per_liter: number | null;
  payment_method: "cash" | "card" | "pix" | "tag" | null;
  category: string | null;
  confidence: number;
  reason?: string;
}

type CaptureStep = "idle" | "processing" | "confirm" | "edit" | "saving";

export function SmartExpenseCapture({
  companyId,
  driverId,
  authUserId,
  vehicleId,
  journeyId,
  onSuccess,
}: SmartExpenseCaptureProps) {
  const [step, setStep] = useState<CaptureStep>("idle");
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [aiResult, setAiResult] = useState<AIResult | null>(null);
  const [editData, setEditData] = useState<Partial<AIResult> & { odometer?: number }>({});
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetState = () => {
    setStep("idle");
    setCapturedImage(null);
    setAiResult(null);
    setEditData({});
    setError(null);
  };

  const handleCapture = () => {
    fileInputRef.current?.click();
  };

  const compressImage = (dataUrl: string, maxWidth = 1200): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ratio = Math.min(maxWidth / img.width, 1);
        canvas.width = img.width * ratio;
        canvas.height = img.height * ratio;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.8));
      };
      img.src = dataUrl;
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setStep("processing");
    setError(null);

    try {
      // Read and compress image
      const reader = new FileReader();
      reader.onload = async (event) => {
        const dataUrl = event.target?.result as string;
        const compressed = await compressImage(dataUrl);
        setCapturedImage(compressed);

        // Call AI to read receipt
        try {
          const { data, error: fnError } = await supabase.functions.invoke("read-receipt", {
            body: { imageBase64: compressed },
          });

          if (fnError) {
            console.error("Edge function error:", fnError);
            setError("Erro ao processar imagem. Tente novamente.");
            setStep("edit");
            setEditData({ type: "expense", payment_method: "card" });
            return;
          }

          if (!data.success) {
            console.log("AI could not read receipt:", data.reason);
            setError(data.reason || "Não foi possível ler a nota");
            setStep("edit");
            setEditData({ type: "expense", payment_method: "card" });
            return;
          }

          setAiResult(data);
          setEditData(data);
          setStep("confirm");
        } catch (err) {
          console.error("Error calling AI:", err);
          setError("Falha na conexão. Preencha manualmente.");
          setStep("edit");
          setEditData({ type: "expense", payment_method: "card" });
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error("Error reading file:", err);
      setError("Erro ao ler imagem");
      setStep("idle");
    }

    // Reset input for next capture
    e.target.value = "";
  };

  const handleConfirm = async () => {
    if (!editData.total_amount || editData.total_amount <= 0) {
      toast.error("Valor total é obrigatório");
      return;
    }

    if (editData.type === "fuel" && !editData.odometer) {
      toast.error("Hodômetro é obrigatório para abastecimento");
      return;
    }

    setStep("saving");

    try {
      const now = new Date().toISOString();
      const today = now.split("T")[0];

      if (editData.type === "fuel" && vehicleId) {
        // Save as fuel expense
        const { error: insertError } = await supabase.from("fuel_expenses").insert({
          company_id: companyId,
          user_id: authUserId,
          vehicle_id: vehicleId,
          journey_id: journeyId || null,
          date: today,
          liters: editData.liters || 0,
          price_per_liter: editData.price_per_liter || 0,
          total_amount: editData.total_amount,
          payment_method: editData.payment_method || "card",
          odometer: editData.odometer || null,
          notes: editData.establishment_name ? `Posto: ${editData.establishment_name}` : null,
          receipt_url: capturedImage,
        });

        if (insertError) {
          console.error("Error saving fuel expense:", insertError);
          throw insertError;
        }
      } else {
        // Save as general expense
        const { error: insertError } = await supabase.from("expenses").insert({
          company_id: companyId,
          user_id: authUserId,
          vehicle_id: vehicleId || null,
          journey_id: journeyId || null,
          date: today,
          amount: editData.total_amount,
          category: editData.category || "Outros",
          description: editData.establishment_name || editData.category || "Despesa",
          payment_method: editData.payment_method || "card",
          supplier: editData.establishment_name || null,
          receipt_url: capturedImage,
        });

        if (insertError) {
          console.error("Error saving expense:", insertError);
          throw insertError;
        }
      }

      toast.success("Despesa lançada com sucesso!");
      resetState();
      onSuccess();
    } catch (err) {
      console.error("Error saving:", err);
      toast.error("Erro ao salvar. Tente novamente.");
      setStep("confirm");
    }
  };

  const formatCurrency = (value: number | null | undefined) => {
    if (!value) return "R$ 0,00";
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  // Idle state - Main capture button
  if (step === "idle") {
    return (
      <>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileChange}
          className="hidden"
        />
        <Card 
          className="cursor-pointer hover:shadow-lg transition-all bg-primary/5 border-primary/30 hover:border-primary active:scale-[0.98]"
          onClick={handleCapture}
        >
          <CardContent className="flex items-center gap-4 p-5">
            <div className="h-14 w-14 rounded-2xl bg-primary/15 flex items-center justify-center shrink-0">
              <Camera className="h-7 w-7 text-primary" />
            </div>
            <div className="text-left">
              <h3 className="text-base font-bold text-foreground">📸 Lançar Despesa</h3>
              <p className="text-sm text-muted-foreground">
                Tire foto da nota — a gente preenche pra você
              </p>
            </div>
          </CardContent>
        </Card>
      </>
    );
  }

  // Processing state
  if (step === "processing") {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center p-8 text-center">
          <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
          <h3 className="text-lg font-semibold">Analisando nota...</h3>
          <p className="text-sm text-muted-foreground mt-1">
            A IA está lendo sua nota fiscal
          </p>
        </CardContent>
      </Card>
    );
  }

  // Confirm state - Show AI results
  if (step === "confirm" && aiResult) {
    return (
      <Card className="border-primary/20">
        <CardContent className="p-4 space-y-4">
          {/* Header with result type */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {aiResult.type === "fuel" ? (
                <Fuel className="h-5 w-5 text-orange-500" />
              ) : (
                <Receipt className="h-5 w-5 text-blue-500" />
              )}
              <span className="font-medium">
                {aiResult.type === "fuel" ? "Abastecimento" : "Despesa"}
              </span>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setStep("edit")}>
              <Edit3 className="h-4 w-4 mr-1" /> Editar
            </Button>
          </div>

          {/* Thumbnail */}
          {capturedImage && (
            <div className="rounded-lg overflow-hidden bg-muted h-24 flex items-center justify-center">
              <img 
                src={capturedImage} 
                alt="Nota fiscal" 
                className="h-full w-auto object-contain"
              />
            </div>
          )}

          {/* Data preview */}
          <div className="space-y-2 text-sm">
            {editData.establishment_name && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Local:</span>
                <span className="font-medium">{editData.establishment_name}</span>
              </div>
            )}
            
            {editData.type === "fuel" && editData.liters && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Litros:</span>
                <span className="font-medium">{editData.liters.toFixed(2)} L</span>
              </div>
            )}
            
            {editData.type === "fuel" && editData.price_per_liter && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Preço/L:</span>
                <span className="font-medium">{formatCurrency(editData.price_per_liter)}</span>
              </div>
            )}

            {editData.type === "expense" && editData.category && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Categoria:</span>
                <span className="font-medium">{editData.category}</span>
              </div>
            )}
            
            <div className="flex justify-between border-t pt-2">
              <span className="text-muted-foreground">Total:</span>
              <span className="font-bold text-lg">{formatCurrency(editData.total_amount)}</span>
            </div>
          </div>

          {/* Odometer field for fuel */}
          {editData.type === "fuel" && (
            <div className="space-y-2">
              <Label>Hodômetro (km) *</Label>
              <Input
                type="number"
                inputMode="numeric"
                placeholder="Ex: 268174"
                value={editData.odometer || ""}
                onChange={(e) => setEditData({ ...editData, odometer: parseInt(e.target.value) || 0 })}
              />
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button 
              variant="outline" 
              className="flex-1"
              onClick={resetState}
            >
              <X className="h-4 w-4 mr-1" /> Cancelar
            </Button>
            <Button 
              className="flex-1"
              onClick={handleConfirm}
            >
              <Check className="h-4 w-4 mr-1" /> Confirmar
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Edit state - Manual form
  if (step === "edit") {
    return (
      <Card>
        <CardContent className="p-4 space-y-4">
          {/* Error message */}
          {error && (
            <div className="flex items-start gap-2 p-3 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-900/30 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
              <div className="text-sm text-yellow-800 dark:text-yellow-200">
                {error}
                <p className="text-yellow-600 dark:text-yellow-400 mt-1">
                  Preencha os dados manualmente abaixo.
                </p>
              </div>
            </div>
          )}

          {/* Thumbnail */}
          {capturedImage && (
            <div className="rounded-lg overflow-hidden bg-muted h-20 flex items-center justify-center">
              <img 
                src={capturedImage} 
                alt="Nota fiscal" 
                className="h-full w-auto object-contain"
              />
            </div>
          )}

          {/* Type selector */}
          <div className="space-y-2">
            <Label>Tipo</Label>
            <Select
              value={editData.type || "expense"}
              onValueChange={(v) => setEditData({ ...editData, type: v as "fuel" | "expense" })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fuel">
                  <div className="flex items-center gap-2">
                    <Fuel className="h-4 w-4" /> Abastecimento
                  </div>
                </SelectItem>
                <SelectItem value="expense">
                  <div className="flex items-center gap-2">
                    <Receipt className="h-4 w-4" /> Outra Despesa
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Total amount */}
          <div className="space-y-2">
            <Label>Valor Total *</Label>
            <Input
              type="number"
              step="0.01"
              placeholder="0.00"
              value={editData.total_amount || ""}
              onChange={(e) => setEditData({ ...editData, total_amount: parseFloat(e.target.value) || 0 })}
            />
          </div>

          {/* Fuel specific fields */}
          {editData.type === "fuel" && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Litros</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={editData.liters || ""}
                    onChange={(e) => setEditData({ ...editData, liters: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Preço/L</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={editData.price_per_liter || ""}
                    onChange={(e) => setEditData({ ...editData, price_per_liter: parseFloat(e.target.value) || 0 })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Hodômetro (km) *</Label>
                <Input
                  type="number"
                  inputMode="numeric"
                  placeholder="Ex: 268174"
                  value={editData.odometer || ""}
                  onChange={(e) => setEditData({ ...editData, odometer: parseInt(e.target.value) || 0 })}
                />
              </div>
            </>
          )}

          {/* Category for expenses */}
          {editData.type === "expense" && (
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select
                value={editData.category || "Outros"}
                onValueChange={(v) => setEditData({ ...editData, category: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Alimentação">Alimentação</SelectItem>
                  <SelectItem value="Pedágio">Pedágio</SelectItem>
                  <SelectItem value="Hospedagem">Hospedagem</SelectItem>
                  <SelectItem value="Manutenção">Manutenção</SelectItem>
                  <SelectItem value="Borracharia">Borracharia</SelectItem>
                  <SelectItem value="Estacionamento">Estacionamento</SelectItem>
                  <SelectItem value="Outros">Outros</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Payment method */}
          <div className="space-y-2">
            <Label>Pagamento</Label>
            <Select
              value={editData.payment_method || "card"}
              onValueChange={(v) => setEditData({ ...editData, payment_method: v as "cash" | "card" | "pix" | "tag" })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="card">Cartão</SelectItem>
                <SelectItem value="cash">Dinheiro</SelectItem>
                <SelectItem value="pix">PIX</SelectItem>
                <SelectItem value="tag">Tag</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Establishment */}
          <div className="space-y-2">
            <Label>Estabelecimento</Label>
            <Input
              placeholder="Nome do estabelecimento"
              value={editData.establishment_name || ""}
              onChange={(e) => setEditData({ ...editData, establishment_name: e.target.value })}
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button 
              variant="outline" 
              className="flex-1"
              onClick={resetState}
            >
              <X className="h-4 w-4 mr-1" /> Cancelar
            </Button>
            <Button 
              className="flex-1"
              onClick={handleConfirm}
              disabled={!editData.total_amount || editData.total_amount <= 0}
            >
              <Check className="h-4 w-4 mr-1" /> Salvar
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Saving state
  if (step === "saving") {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center p-8 text-center">
          <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
          <h3 className="text-lg font-semibold">Salvando...</h3>
        </CardContent>
      </Card>
    );
  }

  return null;
}
