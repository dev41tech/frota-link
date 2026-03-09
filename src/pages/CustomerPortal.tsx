import { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FreightQuoteDisplay } from "@/components/freight/FreightQuoteDisplay";
import { Upload, FileText, History, Truck, AlertTriangle, CheckCircle, Clock, Loader2, Weight, MapPin, StickyNote } from "lucide-react";
import { toast } from "sonner";

const SUPABASE_URL = "https://hxfhubhijampubrsqfhg.supabase.co";

interface PortalInfo {
  token_id: string;
  company_id: string;
  party: { id: string; name: string; document: string };
  company: { name: string; cnpj: string };
}

interface QuoteResult {
  parsed_data: any;
  freight_value: number;
  has_rate: boolean;
  freight_rate_id?: string | null;
  vehicle_type_requested?: string | null;
  customer_notes?: string | null;
  estimation_source?: string;
  estimation_details?: {
    distance_km: number;
    avg_consumption_kml: number;
    avg_diesel_price: number;
    fuel_cost: number;
    estimated_toll: number;
    margin_applied: number;
  };
}

interface HistoryItem {
  id: string;
  request_number: string;
  status: string;
  origin_city: string;
  origin_state: string;
  destination_city: string;
  destination_state: string;
  cargo_weight_kg: number;
  freight_value: number;
  nfe_number: string;
  created_at: string;
  approved_by_operator_at?: string | null;
  collection_date?: string | null;
  collection_address?: string | null;
  collection_notes?: string | null;
  driver_name?: string | null;
}

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: any }> = {
  quoted: { label: "Cotado", variant: "outline", icon: Clock },
  approved: { label: "Aprovado", variant: "default", icon: CheckCircle },
  rejected: { label: "Rejeitado", variant: "destructive", icon: AlertTriangle },
  in_operation: { label: "Em Operação", variant: "secondary", icon: Truck },
  completed: { label: "Concluído", variant: "default", icon: CheckCircle },
  pending: { label: "Pendente", variant: "outline", icon: Clock },
};

// Detect URL format: friendly (/portal/:slug/:code) vs legacy (/portal/:token)
function usePortalParams() {
  const { token, companySlug, shortCode } = useParams<{ token?: string; companySlug?: string; shortCode?: string }>();
  
  if (companySlug && shortCode) {
    return { mode: 'friendly' as const, companySlug, shortCode };
  }
  // Legacy: single param is a UUID token
  return { mode: 'legacy' as const, token: token || '' };
}

export default function CustomerPortal() {
  const params = usePortalParams();
  const [portalInfo, setPortalInfo] = useState<PortalInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("upload");

  // Upload state
  const [xmlFile, setXmlFile] = useState<File | null>(null);
  const [xmlContent, setXmlContent] = useState<string>("");
  const [vehicleType, setVehicleType] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  // Manual weight state (when XML has no weight)
  const [needsManualWeight, setNeedsManualWeight] = useState(false);
  const [manualWeight, setManualWeight] = useState("");
  const [parsedPreview, setParsedPreview] = useState<any>(null);

  // Quote state
  const [quoteResult, setQuoteResult] = useState<QuoteResult | null>(null);
  const [usedManualWeight, setUsedManualWeight] = useState(false);
  const [isApproving, setIsApproving] = useState(false);

  // History state
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Build query string for API calls based on URL mode
  const getAuthParams = useCallback(() => {
    if (params.mode === 'friendly') {
      return `company_slug=${encodeURIComponent(params.companySlug)}&short_code=${encodeURIComponent(params.shortCode)}`;
    }
    return `token=${encodeURIComponent(params.token)}`;
  }, [params]);

  const getAuthBody = useCallback(() => {
    if (params.mode === 'friendly') {
      return { company_slug: params.companySlug, short_code: params.shortCode };
    }
    return { token: params.token };
  }, [params]);

  useEffect(() => {
    validateToken();
  }, []);

  const validateToken = async () => {
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/customer-portal-validate?${getAuthParams()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setPortalInfo(data);
    } catch (err: any) {
      setError(err.message || "Token inválido");
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (file: File) => {
    if (!file.name.endsWith(".xml")) {
      toast.error("Apenas arquivos .xml são aceitos");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Arquivo excede o limite de 2MB");
      return;
    }
    setXmlFile(file);
    const reader = new FileReader();
    reader.onload = (e) => setXmlContent(e.target?.result as string);
    reader.readAsText(file);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileChange(file);
  }, []);

  const submitXml = async (extraBody: Record<string, any> = {}) => {
    if (!xmlContent) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/customer-portal-submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...getAuthBody(),
          xml_content: xmlContent,
          vehicle_type_requested: vehicleType || null,
          customer_notes: notes || null,
          ...extraBody,
        }),
      });
      const data = await res.json();

      // Handle weight_required response
      if (res.status === 422 && data.error === "weight_required") {
        setParsedPreview(data.parsed_data);
        setNeedsManualWeight(true);
        toast.info("O XML não contém peso. Informe o peso da carga manualmente.");
        return;
      }

      if (!res.ok) throw new Error(data.error);
      setQuoteResult(data);
      setNeedsManualWeight(false);
      setParsedPreview(null);
      setManualWeight("");
      setActiveTab("quote");
      toast.success("XML processado com sucesso!");
    } catch (err: any) {
      toast.error(err.message || "Erro ao enviar XML");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = () => {
    setUsedManualWeight(false);
    submitXml();
  };

  const handleSubmitWithWeight = () => {
    const weight = parseFloat(manualWeight);
    if (!weight || weight <= 0) {
      toast.error("Informe um peso válido");
      return;
    }
    setUsedManualWeight(true);
    submitXml({ manual_weight: weight });
  };

  const handleApprove = async () => {
    if (!quoteResult) return;
    setIsApproving(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/customer-portal-approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...getAuthBody(),
          parsed_data: quoteResult.parsed_data,
          freight_value: quoteResult.freight_value,
          freight_rate_id: quoteResult.freight_rate_id,
          vehicle_type_requested: quoteResult.vehicle_type_requested,
          customer_notes: quoteResult.customer_notes,
          estimation_source: quoteResult.estimation_source,
          estimation_details: quoteResult.estimation_details,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("Frete aprovado com sucesso!");
      setQuoteResult(null);
      setXmlFile(null);
      setXmlContent("");
      setActiveTab("history");
      loadHistory();
    } catch (err: any) {
      toast.error(err.message || "Erro ao aprovar");
    } finally {
      setIsApproving(false);
    }
  };

  const loadHistory = async () => {
    setLoadingHistory(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/customer-portal-history?${getAuthParams()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setHistory(data.requests || []);
    } catch {
      toast.error("Erro ao carregar histórico");
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (activeTab === "history" && portalInfo) loadHistory();
  }, [activeTab, portalInfo]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Validando acesso...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Acesso Negado</h2>
            <p className="text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold">{portalInfo?.company.name}</h1>
              <p className="text-sm text-muted-foreground">Portal do Cliente</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-medium">{portalInfo?.party.name}</p>
              <p className="text-xs text-muted-foreground">{portalInfo?.party.document}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="upload" className="flex items-center gap-1.5">
              <Upload className="h-4 w-4" /> Solicitar
            </TabsTrigger>
            <TabsTrigger value="quote" disabled={!quoteResult} className="flex items-center gap-1.5">
              <FileText className="h-4 w-4" /> Cotação
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-1.5">
              <History className="h-4 w-4" /> Histórico
            </TabsTrigger>
          </TabsList>

          <TabsContent value="upload">
            <div className="space-y-6">
              <div className="text-center mb-4">
                <h2 className="text-xl font-semibold">Nova Solicitação de Frete</h2>
                <p className="text-sm text-muted-foreground">Faça upload do XML da NF-e para receber uma cotação</p>
              </div>

              <div
                onDrop={handleDrop}
                onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                onDragLeave={() => setIsDragOver(false)}
                className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                  isDragOver ? "border-primary bg-primary/5" : xmlFile ? "border-green-500 bg-green-50 dark:bg-green-950/20" : "border-muted-foreground/25 hover:border-primary/50"
                }`}
                onClick={() => document.getElementById("xml-input")?.click()}
              >
                {xmlFile ? (
                  <div className="flex items-center justify-center gap-3">
                    <FileText className="h-8 w-8 text-primary" />
                    <div className="text-left">
                      <p className="font-medium">{xmlFile.name}</p>
                      <p className="text-sm text-muted-foreground">{(xmlFile.size / 1024).toFixed(1)} KB</p>
                    </div>
                  </div>
                ) : (
                  <>
                    <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
                    <p className="font-medium">Arraste o XML da NF-e aqui</p>
                    <p className="text-sm text-muted-foreground mt-1">ou clique para selecionar (máx. 2MB)</p>
                  </>
                )}
                <Input
                  id="xml-input"
                  type="file"
                  accept=".xml"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleFileChange(e.target.files[0])}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tipo de Veículo (opcional)</Label>
                  <Select value={vehicleType} onValueChange={setVehicleType}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="utilitario">Utilitário</SelectItem>
                      <SelectItem value="truck">Truck</SelectItem>
                      <SelectItem value="carreta">Carreta</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Observações (opcional)</Label>
                  <Textarea
                    placeholder="Informações adicionais..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    maxLength={500}
                  />
                </div>
              </div>

              <Button
                className="w-full"
                size="lg"
                onClick={handleSubmit}
                disabled={!xmlContent || submitting || needsManualWeight}
              >
                {submitting && !needsManualWeight ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Processando...</>
                ) : (
                  <><Upload className="h-4 w-4 mr-2" /> Enviar Solicitação</>
                )}
              </Button>

              {/* Manual weight input when XML has no weight */}
              {needsManualWeight && parsedPreview && (
                <Card className="border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/20">
                  <CardContent className="pt-6 space-y-4">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium text-amber-800 dark:text-amber-200">Peso não encontrado no XML</p>
                        <p className="text-sm text-amber-600 dark:text-amber-400">
                          NF-e {parsedPreview.nfeNumber} • {parsedPreview.emitter?.name} → {parsedPreview.recipient?.name}
                        </p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="manual-weight">Peso da carga (kg) *</Label>
                      <Input
                        id="manual-weight"
                        type="number"
                        step="0.01"
                        min="0.01"
                        placeholder="Ex: 15000"
                        value={manualWeight}
                        onChange={(e) => setManualWeight(e.target.value)}
                      />
                    </div>
                    <Button
                      className="w-full"
                      onClick={handleSubmitWithWeight}
                      disabled={submitting || !manualWeight}
                    >
                      {submitting ? (
                        <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Processando...</>
                      ) : (
                        <><Weight className="h-4 w-4 mr-2" /> Reenviar com Peso</>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          <TabsContent value="quote">
            {quoteResult && (
              <FreightQuoteDisplay
                parsedData={quoteResult.parsed_data}
                freightValue={quoteResult.freight_value}
                hasRate={quoteResult.has_rate}
                onApprove={handleApprove}
                onCancel={() => {
                  setQuoteResult(null);
                  setActiveTab("upload");
                }}
                isApproving={isApproving}
                estimationSource={quoteResult.estimation_source}
                estimationDetails={quoteResult.estimation_details}
                weightSource={usedManualWeight ? "manual" : "xml"}
              />
            )}
          </TabsContent>

          <TabsContent value="history">
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Histórico de Solicitações</h2>
              {loadingHistory ? (
                <div className="text-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                </div>
              ) : history.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    Nenhuma solicitação encontrada
                  </CardContent>
                </Card>
              ) : (
                history.map((item) => {
                  const config = statusConfig[item.status] || statusConfig.pending;
                  const StatusIcon = config.icon;
                  return (
                    <Card key={item.id}>
                      <CardContent className="py-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-sm font-medium">{item.request_number}</span>
                              <Badge variant={config.variant}>
                                <StatusIcon className="h-3 w-3 mr-1" />
                                {config.label}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              NF-e {item.nfe_number} • {item.origin_city}/{item.origin_state} → {item.destination_city}/{item.destination_state}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(item.created_at).toLocaleDateString("pt-BR")} • {item.cargo_weight_kg?.toFixed(2)} kg
                            </p>
                            {item.approved_by_operator_at && (
                              <div className="space-y-0.5 mt-1">
                                <p className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                                  <CheckCircle className="h-3 w-3" />
                                  Aprovado pela transportadora
                                </p>
                                {item.collection_address && (
                                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                                    <MapPin className="h-3 w-3 shrink-0" />
                                    Coleta: {item.collection_address}
                                  </p>
                                )}
                                {item.collection_date && (
                                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                                    <Clock className="h-3 w-3 shrink-0" />
                                    Prevista: {new Date(item.collection_date).toLocaleDateString("pt-BR")}
                                  </p>
                                )}
                                {item.collection_notes && (
                                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                                    <StickyNote className="h-3 w-3 shrink-0" />
                                    {item.collection_notes}
                                  </p>
                                )}
                                {item.driver_name && (
                                  <p className="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1 font-medium">
                                    <Truck className="h-3 w-3 shrink-0" />
                                    Motorista: {item.driver_name}
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-primary">
                              {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(item.freight_value || 0)}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
