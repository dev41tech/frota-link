import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Settings2, ChevronDown, ChevronUp, Save, RefreshCw, Fuel, Gauge, Percent, CircleDollarSign } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMultiTenant } from "@/hooks/useMultiTenant";
import { toast } from "sonner";

interface PricingSettings {
  avg_consumption_kml: number | null;
  avg_diesel_price: number | null;
  driver_commission: number;
  profit_margin: number;
  default_axles: number;
  toll_cost_per_axle_km: number;
}

const DEFAULTS: PricingSettings = {
  avg_consumption_kml: null,
  avg_diesel_price: null,
  driver_commission: 12,
  profit_margin: 30,
  default_axles: 7,
  toll_cost_per_axle_km: 0.11,
};

export function PricingSettingsCard() {
  const { currentCompany: company } = useMultiTenant();
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState<PricingSettings>(DEFAULTS);
  const [autoConsumption, setAutoConsumption] = useState<number | null>(null);
  const [autoDieselPrice, setAutoDieselPrice] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [loadingAuto, setLoadingAuto] = useState(false);

  // Load saved settings
  useEffect(() => {
    if (!company?.id || !open) return;
    (async () => {
      const { data } = await supabase
        .from("freight_pricing_settings" as any)
        .select("*")
        .eq("company_id", company.id)
        .maybeSingle();
      if (data) {
        const d = data as any;
        setSettings({
          avg_consumption_kml: d.avg_consumption_kml,
          avg_diesel_price: d.avg_diesel_price,
          driver_commission: d.driver_commission ?? 12,
          profit_margin: d.profit_margin ?? 30,
          default_axles: d.default_axles ?? 7,
          toll_cost_per_axle_km: d.toll_cost_per_axle_km ?? 0.11,
        });
      }
    })();
  }, [company?.id, open]);

  // Load auto values when opened
  useEffect(() => {
    if (!company?.id || !open) return;
    loadAutoValues();
  }, [company?.id, open]);

  const loadAutoValues = async () => {
    if (!company?.id) return;
    setLoadingAuto(true);
    try {
      // Fleet avg consumption (filter outliers > 0 and < 15)
      const { data: vehicles } = await supabase
        .from("vehicles")
        .select("actual_consumption")
        .eq("company_id", company.id)
        .gt("actual_consumption", 0)
        .lt("actual_consumption", 15);

      if (vehicles && vehicles.length > 0) {
        const avg = vehicles.reduce((s, v) => s + (v.actual_consumption || 0), 0) / vehicles.length;
        setAutoConsumption(Math.round(avg * 100) / 100);
      }

      // Avg diesel price last 30 days
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const { data: fuelData } = await supabase
        .from("fuel_expenses" as any)
        .select("price_per_liter")
        .eq("company_id", company.id)
        .gt("price_per_liter", 0)
        .gte("date", thirtyDaysAgo);

      if (fuelData && fuelData.length > 0) {
        const avg = (fuelData as any[]).reduce((s, f) => s + f.price_per_liter, 0) / fuelData.length;
        setAutoDieselPrice(Math.round(avg * 100) / 100);
      }
    } catch (err) {
      console.error("Error loading auto values:", err);
    } finally {
      setLoadingAuto(false);
    }
  };

  const handleSave = async () => {
    if (!company?.id) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("freight_pricing_settings" as any)
        .upsert({
          company_id: company.id,
          avg_consumption_kml: settings.avg_consumption_kml,
          avg_diesel_price: settings.avg_diesel_price,
          driver_commission: settings.driver_commission,
          profit_margin: settings.profit_margin,
          default_axles: settings.default_axles,
          toll_cost_per_axle_km: settings.toll_cost_per_axle_km,
          updated_at: new Date().toISOString(),
        } as any, { onConflict: "company_id" } as any);

      if (error) throw error;
      toast.success("Configurações de precificação salvas com sucesso!");
    } catch (err: any) {
      console.error("Save error:", err);
      toast.error("Erro ao salvar configurações: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const useAutoValue = (field: "avg_consumption_kml" | "avg_diesel_price", value: number | null) => {
    if (value) setSettings((s) => ({ ...s, [field]: value }));
  };

  // Preview calculation for 100km
  const consumption = settings.avg_consumption_kml || autoConsumption || 2.5;
  const diesel = settings.avg_diesel_price || autoDieselPrice || 6.29;
  const fuelCost100 = (100 / consumption) * diesel;
  const tollCost100 = 100 * settings.default_axles * settings.toll_cost_per_axle_km;
  const opCost100 = fuelCost100 + tollCost100;
  const totalDeductions = (settings.profit_margin + settings.driver_commission) / 100;
  const freight100 = totalDeductions >= 1 ? opCost100 * 2 : opCost100 / (1 - totalDeductions);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Settings2 className="h-5 w-5 text-muted-foreground" />
                <CardTitle className="text-base">Configurações de Precificação do Portal</CardTitle>
              </div>
              {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
            </div>
            {!open && (
              <p className="text-sm text-muted-foreground mt-1">
                Define os parâmetros de custo usados na cotação automática quando não há tabela de frete cadastrada
              </p>
            )}
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="space-y-6 pt-0">
            <p className="text-sm text-muted-foreground">
              Esses valores são usados no cálculo automático de frete no portal do cliente (fallback do simulador).
              Campos em branco usam os valores automáticos do sistema.
            </p>

            {/* Custos Operacionais */}
            <div className="space-y-4">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <Fuel className="h-4 w-4" /> Custos Operacionais
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Consumo médio (km/l)</Label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      min={0.1}
                      step={0.1}
                      value={settings.avg_consumption_kml ?? ""}
                      onChange={(e) => setSettings({ ...settings, avg_consumption_kml: e.target.value ? Number(e.target.value) : null })}
                      placeholder={autoConsumption ? `Auto: ${autoConsumption}` : "2.5"}
                    />
                    {autoConsumption && (
                      <Button
                        variant="outline"
                        size="icon"
                        title="Usar valor automático da frota"
                        onClick={() => useAutoValue("avg_consumption_kml", autoConsumption)}
                      >
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {autoConsumption ? `Média da frota: ${autoConsumption} km/l` : "Sem dados da frota"}
                    {loadingAuto && " (carregando...)"}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Preço médio diesel (R$/l)</Label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      min={0.01}
                      step={0.01}
                      value={settings.avg_diesel_price ?? ""}
                      onChange={(e) => setSettings({ ...settings, avg_diesel_price: e.target.value ? Number(e.target.value) : null })}
                      placeholder={autoDieselPrice ? `Auto: ${autoDieselPrice}` : "6.29"}
                    />
                    {autoDieselPrice && (
                      <Button
                        variant="outline"
                        size="icon"
                        title="Usar valor automático dos abastecimentos"
                        onClick={() => useAutoValue("avg_diesel_price", autoDieselPrice)}
                      >
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {autoDieselPrice ? `Média últimos 30 dias: R$ ${autoDieselPrice}` : "Sem dados de abastecimento"}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Eixos padrão</Label>
                  <Input
                    type="number"
                    min={2}
                    max={13}
                    value={settings.default_axles}
                    onChange={(e) => setSettings({ ...settings, default_axles: Number(e.target.value) || 7 })}
                  />
                  <p className="text-xs text-muted-foreground">Nº de eixos para cálculo de pedágio</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Custo pedágio por eixo/km (R$)</Label>
                  <Input
                    type="number"
                    min={0}
                    step={0.01}
                    value={settings.toll_cost_per_axle_km}
                    onChange={(e) => setSettings({ ...settings, toll_cost_per_axle_km: Number(e.target.value) || 0.11 })}
                  />
                  <p className="text-xs text-muted-foreground">Média nacional: R$ 0,11</p>
                </div>
              </div>
            </div>

            {/* Margens */}
            <div className="space-y-4">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <Percent className="h-4 w-4" /> Margens e Comissões
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Margem de lucro (%)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={99}
                    step={1}
                    value={settings.profit_margin}
                    onChange={(e) => setSettings({ ...settings, profit_margin: Number(e.target.value) || 30 })}
                  />
                  <p className="text-xs text-muted-foreground">Margem sobre o custo operacional</p>
                </div>

                <div className="space-y-2">
                  <Label>Comissão do motorista (%)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={99}
                    step={1}
                    value={settings.driver_commission}
                    onChange={(e) => setSettings({ ...settings, driver_commission: Number(e.target.value) || 12 })}
                  />
                  <p className="text-xs text-muted-foreground">Percentual estimado de comissão</p>
                </div>
              </div>
            </div>

            {/* Preview */}
            <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <CircleDollarSign className="h-4 w-4" /> Prévia do cálculo (viagem de 100 km)
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Combustível:</span>
                  <div className="font-medium">R$ {fuelCost100.toFixed(2)}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Pedágio est.:</span>
                  <div className="font-medium">R$ {tollCost100.toFixed(2)}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Custo oper.:</span>
                  <div className="font-medium">R$ {opCost100.toFixed(2)}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Frete sugerido:</span>
                  <div className="font-bold text-primary">R$ {freight100.toFixed(2)}</div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Deduções: {settings.profit_margin}% margem + {settings.driver_commission}% comissão = {settings.profit_margin + settings.driver_commission}%
              </p>
            </div>

            <div className="flex justify-end">
              <Button onClick={handleSave} disabled={saving}>
                <Save className="h-4 w-4 mr-2" />
                {saving ? "Salvando..." : "Salvar Configurações"}
              </Button>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
