import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useMultiTenant } from "@/hooks/useMultiTenant";
import { useFreightRates } from "@/hooks/useFreightRates";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Loader2, Sparkles, TrendingUp, Weight, Truck, HelpCircle, ArrowRight,
} from "lucide-react";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";

interface RouteData {
  origin_state: string;
  destination_state: string;
  trip_count: number;
  median_distance: number;
  median_weight: number;
  weight_source: string;
  median_freight_practiced: number;
  suggested_rate_per_kg: number;
  suggested_minimum_freight: number;
  confidence: string;
  selected?: boolean;
}

interface AnalysisResult {
  cpk: number;
  total_kms: number;
  total_costs: number;
  routes: RouteData[];
  message?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const formatCurrency = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const formatNumber = (v: number) =>
  new Intl.NumberFormat("pt-BR").format(v);

const weightSourceLabel: Record<string, { label: string; icon: typeof Weight }> = {
  real_weight: { label: "Peso real da solicitação", icon: Weight },
  vehicle_capacity: { label: "Capacidade do veículo", icon: Truck },
  type_default: { label: "Padrão por tipo", icon: HelpCircle },
};

export function SmartFreightTableDialog({ open, onOpenChange }: Props) {
  const { currentCompany } = useMultiTenant();
  const { createRate, refetch } = useFreightRates();
  const [periodMonths, setPeriodMonths] = useState(6);
  const [targetMargin, setTargetMargin] = useState(20);
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [selectedRoutes, setSelectedRoutes] = useState<Set<string>>(new Set());

  const handleAnalyze = async () => {
    if (!currentCompany?.id) return;
    setAnalyzing(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("generate-freight-table", {
        body: {
          company_id: currentCompany.id,
          period_months: periodMonths,
          target_margin: targetMargin / 100,
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      setResult(data);
      // Select all routes by default
      const keys = new Set<string>(
        (data.routes || []).map((r: RouteData) => `${r.origin_state}->${r.destination_state}`)
      );
      setSelectedRoutes(keys);
    } catch (err: any) {
      console.error("Error analyzing:", err);
      toast.error("Erro ao analisar histórico: " + (err.message || "Erro desconhecido"));
    } finally {
      setAnalyzing(false);
    }
  };

  const toggleRoute = (key: string) => {
    setSelectedRoutes((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleAll = () => {
    if (!result) return;
    const allKeys = result.routes.map((r) => `${r.origin_state}->${r.destination_state}`);
    if (selectedRoutes.size === allKeys.length) {
      setSelectedRoutes(new Set());
    } else {
      setSelectedRoutes(new Set(allKeys));
    }
  };

  const handleSave = async () => {
    if (!result || selectedRoutes.size === 0) return;
    setSaving(true);
    let saved = 0;
    try {
      for (const route of result.routes) {
        const key = `${route.origin_state}->${route.destination_state}`;
        if (!selectedRoutes.has(key)) continue;
        const success = await createRate({
          origin_state: route.origin_state,
          destination_state: route.destination_state,
          min_weight_kg: 0,
          max_weight_kg: 999999,
          rate_per_kg: route.suggested_rate_per_kg,
          minimum_freight: route.suggested_minimum_freight,
          cubage_factor: 300,
          volume_rate: null,
        });
        if (success) saved++;
      }
      toast.success(`${saved} regra(s) criada(s) com sucesso!`);
      await refetch();
      onOpenChange(false);
      setResult(null);
    } catch (err: any) {
      toast.error("Erro ao salvar regras: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const confidenceBadge = (c: string) => {
    switch (c) {
      case "high":
        return <Badge className="bg-primary/10 text-primary hover:bg-primary/10">Alta</Badge>;
      case "medium":
        return <Badge className="bg-accent text-accent-foreground hover:bg-accent">Média</Badge>;
      default:
        return <Badge variant="secondary">Baixa</Badge>;
    }
  };

  const WeightSourceIcon = ({ source }: { source: string }) => {
    const info = weightSourceLabel[source] || weightSourceLabel.type_default;
    const Icon = info.icon;
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger>
            <Icon className="h-3.5 w-3.5 text-muted-foreground ml-1 inline" />
          </TooltipTrigger>
          <TooltipContent>
            <p>{info.label}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Gerar Tabela Inteligente
          </DialogTitle>
          <DialogDescription>
            Analisa o histórico de viagens e custos operacionais para sugerir preços por rota usando o algoritmo Cost-Plus.
          </DialogDescription>
        </DialogHeader>

        {/* Parameters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 py-4">
          <div className="space-y-2">
            <Label>Período de Análise</Label>
            <Select
              value={String(periodMonths)}
              onValueChange={(v) => setPeriodMonths(Number(v))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="3">Últimos 3 meses</SelectItem>
                <SelectItem value="6">Últimos 6 meses</SelectItem>
                <SelectItem value="12">Últimos 12 meses</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Margem de Lucro Desejada: {targetMargin}%</Label>
            <Slider
              min={10}
              max={50}
              step={1}
              value={[targetMargin]}
              onValueChange={([v]) => setTargetMargin(v)}
              className="mt-3"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>10%</span>
              <span>50%</span>
            </div>
          </div>
        </div>

        {!result && (
          <div className="flex justify-center py-4">
            <Button onClick={handleAnalyze} disabled={analyzing} size="lg">
              {analyzing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Analisando...
                </>
              ) : (
                <>
                  <TrendingUp className="mr-2 h-4 w-4" />
                  Analisar Histórico
                </>
              )}
            </Button>
          </div>
        )}

        {/* Results */}
        {result && (
          <div className="space-y-4">
            {/* Summary Cards */}
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg border bg-card p-3 text-center">
                <p className="text-xs text-muted-foreground">CPK</p>
                <p className="text-lg font-bold">{formatCurrency(result.cpk)}</p>
              </div>
              <div className="rounded-lg border bg-card p-3 text-center">
                <p className="text-xs text-muted-foreground">KMs Rodados</p>
                <p className="text-lg font-bold">{formatNumber(result.total_kms)}</p>
              </div>
              <div className="rounded-lg border bg-card p-3 text-center">
                <p className="text-xs text-muted-foreground">Custos Totais</p>
                <p className="text-lg font-bold">{formatCurrency(result.total_costs)}</p>
              </div>
            </div>

            {result.routes.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>Nenhuma rota identificada no período.</p>
                <p className="text-sm mt-1">
                  Verifique se as jornadas possuem UF no campo de origem/destino (ex: "São Paulo - SP").
                </p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    {result.routes.length} rota(s) encontrada(s) • {selectedRoutes.size} selecionada(s)
                  </p>
                  <Button variant="ghost" size="sm" onClick={toggleAll}>
                    {selectedRoutes.size === result.routes.length ? "Desmarcar Todas" : "Selecionar Todas"}
                  </Button>
                </div>

                <div className="border rounded-lg overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[40px]" />
                        <TableHead>Rota</TableHead>
                        <TableHead className="text-center">Viagens</TableHead>
                        <TableHead className="text-right">Distância</TableHead>
                        <TableHead className="text-right">Peso</TableHead>
                        <TableHead className="text-right">Frete Praticado</TableHead>
                        <TableHead className="text-right">R$/kg Sugerido</TableHead>
                        <TableHead className="text-right">Mínimo Sugerido</TableHead>
                        <TableHead className="text-center">Confiança</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {result.routes.map((route) => {
                        const key = `${route.origin_state}->${route.destination_state}`;
                        return (
                          <TableRow key={key} className={selectedRoutes.has(key) ? "" : "opacity-50"}>
                            <TableCell>
                              <Checkbox
                                checked={selectedRoutes.has(key)}
                                onCheckedChange={() => toggleRoute(key)}
                              />
                            </TableCell>
                            <TableCell className="font-medium whitespace-nowrap">
                              {route.origin_state}
                              <ArrowRight className="inline h-3 w-3 mx-1 text-muted-foreground" />
                              {route.destination_state}
                            </TableCell>
                            <TableCell className="text-center">{route.trip_count}</TableCell>
                            <TableCell className="text-right">{formatNumber(route.median_distance)} km</TableCell>
                            <TableCell className="text-right whitespace-nowrap">
                              {formatNumber(route.median_weight)} kg
                              <WeightSourceIcon source={route.weight_source} />
                            </TableCell>
                            <TableCell className="text-right">{formatCurrency(route.median_freight_practiced)}</TableCell>
                            <TableCell className="text-right font-medium">{formatCurrency(route.suggested_rate_per_kg)}</TableCell>
                            <TableCell className="text-right font-medium">{formatCurrency(route.suggested_minimum_freight)}</TableCell>
                            <TableCell className="text-center">{confidenceBadge(route.confidence)}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </div>
        )}

        {result && result.routes.length > 0 && (
          <DialogFooter>
            <Button variant="outline" onClick={() => { setResult(null); }}>
              Recalcular
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || selectedRoutes.size === 0}
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                `Salvar ${selectedRoutes.size} Regra(s)`
              )}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
