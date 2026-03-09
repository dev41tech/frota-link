import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CreditCard, FileText, QrCode, Edit2, Package, Link2 } from "lucide-react";
import { Separator } from "@/components/ui/separator";

interface Company {
  id: string;
  name: string;
  asaas_customer_id?: string;
  vehicle_count?: number;
  contracted_price_per_vehicle?: number;
  subscription_plan?: {
    name: string;
    monthly_price: number;
    price_per_vehicle?: number;
  };
}

interface CreateSubscriptionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  company: Company | null;
  onSuccess: () => void;
}

const CTE_PACKAGES = [
  { id: 'none', label: 'Nenhum', limit: 0, price: 0 },
  { id: 'p', label: 'Pacote P', limit: 20, price: 69.90 },
  { id: 'm', label: 'Pacote M', limit: 50, price: 99.90 },
  { id: 'g', label: 'Pacote G', limit: 200, price: 249.90 },
  { id: 'custom', label: 'Personalizado', limit: null, price: null },
];

const CARRETA_UNIT_PRICE = 29.90;

export default function CreateSubscriptionDialog({
  open,
  onOpenChange,
  company,
  onSuccess
}: CreateSubscriptionDialogProps) {
  const [loading, setLoading] = useState(false);
  const [billingType, setBillingType] = useState('BOLETO');
  const [dueDate, setDueDate] = useState(() => {
    const today = new Date();
    const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 10);
    return nextMonth.toISOString().split('T')[0];
  });
  const [vehicleCount, setVehicleCount] = useState(1);
  const [customPricePerVehicle, setCustomPricePerVehicle] = useState<number | null>(null);
  
  // New states for add-ons
  const [ctePackage, setCtePackage] = useState('none');
  const [customCtePrice, setCustomCtePrice] = useState<number>(0);
  const [carretaCount, setCarretaCount] = useState(0);
  
  const { toast } = useToast();

  // Get base price - prefer contracted price, then plan price_per_vehicle, then monthly_price
  const basePricePerVehicle = company?.contracted_price_per_vehicle || company?.subscription_plan?.price_per_vehicle || company?.subscription_plan?.monthly_price || 0;
  // Use custom price if set, otherwise use base price
  const effectivePricePerVehicle = customPricePerVehicle ?? basePricePerVehicle;
  
  // Calculate subtotals
  const vehicleSubtotal = effectivePricePerVehicle * vehicleCount;
  const selectedCtePackage = CTE_PACKAGES.find(p => p.id === ctePackage);
  const cteSubtotal = ctePackage === 'custom' ? customCtePrice : (selectedCtePackage?.price || 0);
  const carretaSubtotal = carretaCount * CARRETA_UNIT_PRICE;
  
  // Final value = vehicles + CT-e + carretas
  const finalValue = vehicleSubtotal + cteSubtotal + carretaSubtotal;

  // Update vehicle count and price when company changes
  useEffect(() => {
    if (company) {
      const count = company.vehicle_count || 1;
      setVehicleCount(count);
      // Use contracted price first, then fall back to plan prices
      const price = company.contracted_price_per_vehicle || company.subscription_plan?.price_per_vehicle || company.subscription_plan?.monthly_price || 0;
      setCustomPricePerVehicle(price);
      // Reset add-ons
      setCtePackage('none');
      setCustomCtePrice(0);
      setCarretaCount(0);
    }
  }, [company?.id, company?.vehicle_count, company?.contracted_price_per_vehicle, company?.subscription_plan?.price_per_vehicle, company?.subscription_plan?.monthly_price]);

  const handleCreateCustomer = async () => {
    if (!company) return;
    
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Não autenticado');

      const response = await supabase.functions.invoke('asaas-create-customer', {
        body: { company_id: company.id },
      });

      if (response.error) throw response.error;
      if (!response.data.success) throw new Error(response.data.error);

      toast({
        title: "Cliente criado",
        description: response.data.message,
      });

      return response.data.customer_id;
    } catch (error: any) {
      toast({
        title: "Erro ao criar cliente",
        description: error.message,
        variant: "destructive",
      });
      return null;
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSubscription = async () => {
    if (!company) return;
    
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Não autenticado');

      // First ensure customer exists
      let customerId = company.asaas_customer_id;
      if (!customerId) {
        customerId = await handleCreateCustomer();
        if (!customerId) return;
      }

      const response = await supabase.functions.invoke('asaas-create-subscription', {
        body: { 
          company_id: company.id,
          billing_type: billingType,
          next_due_date: dueDate,
          value: finalValue,
          vehicle_count: vehicleCount
        },
      });

      if (response.error) throw response.error;
      if (!response.data.success) throw new Error(response.data.error);

      toast({
        title: "Assinatura criada",
        description: response.data.message,
      });

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Erro ao criar assinatura",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSinglePayment = async () => {
    if (!company) return;
    
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Não autenticado');

      // First ensure customer exists
      let customerId = company.asaas_customer_id;
      if (!customerId) {
        customerId = await handleCreateCustomer();
        if (!customerId) return;
      }

      // Build description with add-ons
      let description = `Mensalidade ${company.subscription_plan?.name || 'Plano'} - ${vehicleCount} placas`;
      if (cteSubtotal > 0) {
        description += ` + CT-e ${selectedCtePackage?.label || 'Personalizado'}`;
      }
      if (carretaCount > 0) {
        description += ` + ${carretaCount} carreta${carretaCount > 1 ? 's' : ''}`;
      }

      const response = await supabase.functions.invoke('asaas-create-payment', {
        body: { 
          company_id: company.id,
          billing_type: billingType,
          due_date: dueDate,
          value: finalValue,
          description
        },
      });

      if (response.error) throw response.error;
      if (!response.data.success) throw new Error(response.data.error);

      toast({
        title: "Cobrança criada",
        description: `Cobrança de R$ ${finalValue.toFixed(2)} criada com sucesso. Vencimento: ${new Date(dueDate).toLocaleDateString('pt-BR')}`,
      });

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Erro ao criar cobrança",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  if (!company) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader className="pb-2">
          <DialogTitle className="flex items-center justify-between">
            Configurar Cobrança
          </DialogTitle>
          <DialogDescription className="flex items-center gap-2 text-sm">
            <span className="font-medium text-foreground">{company.name}</span>
            <span className="text-muted-foreground">•</span>
            <span>{company.subscription_plan?.name || 'Sem plano'}</span>
            {basePricePerVehicle > 0 && (
              <>
                <span className="text-muted-foreground">•</span>
                <span className="text-primary font-medium">{formatCurrency(basePricePerVehicle)}/placa</span>
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2 max-h-[60vh] overflow-y-auto">
          {/* === SEÇÃO: PLANO BASE (PLACAS) === */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold text-muted-foreground">Plano Base</Label>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Qtd. Placas</Label>
                <Input
                  type="number"
                  value={vehicleCount}
                  onChange={(e) => setVehicleCount(Math.max(1, parseInt(e.target.value) || 1))}
                  min={1}
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1">
                  Valor/Placa
                  <Edit2 className="h-3 w-3 text-muted-foreground" />
                </Label>
                <Input
                  type="number"
                  step="0.01"
                  value={customPricePerVehicle ?? ''}
                  onChange={(e) => setCustomPricePerVehicle(parseFloat(e.target.value) || 0)}
                  min={0}
                  className="h-9"
                  placeholder="R$ 0,00"
                />
              </div>
            </div>

            <div className="p-2.5 bg-muted/50 border rounded-md">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {vehicleCount} placa{vehicleCount !== 1 ? 's' : ''} × {formatCurrency(effectivePricePerVehicle)}
                </span>
                <span className="font-semibold">
                  {formatCurrency(vehicleSubtotal)}
                </span>
              </div>
            </div>
          </div>

          <Separator />

          {/* === SEÇÃO: ADICIONAIS E MÓDULOS === */}
          <div className="space-y-4">
            <Label className="text-sm font-semibold text-muted-foreground">Adicionais e Módulos</Label>
            
            {/* CT-e Package Selection */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-primary" />
                <Label className="text-xs font-medium">Pacote CT-e</Label>
              </div>
              
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {CTE_PACKAGES.map((pkg) => {
                  const isSelected = ctePackage === pkg.id;
                  return (
                    <button
                      key={pkg.id}
                      type="button"
                      onClick={() => setCtePackage(pkg.id)}
                      className={`p-2.5 rounded-lg border-2 text-left transition-all ${
                        isSelected 
                          ? 'border-primary bg-primary/5' 
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <div className="font-medium text-xs">{pkg.label}</div>
                      {pkg.limit !== null && (
                        <div className="text-[10px] text-muted-foreground">
                          {pkg.limit === 0 ? 'Sem módulo' : `Até ${pkg.limit} CT-e/mês`}
                        </div>
                      )}
                      {pkg.limit === null && (
                        <div className="text-[10px] text-muted-foreground">Valor manual</div>
                      )}
                      <div className="text-xs font-semibold text-primary mt-1">
                        {pkg.price !== null ? formatCurrency(pkg.price) : 'Sob consulta'}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Custom CT-e Price Input */}
              {ctePackage === 'custom' && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Valor Personalizado CT-e</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={customCtePrice || ''}
                    onChange={(e) => setCustomCtePrice(parseFloat(e.target.value) || 0)}
                    min={0}
                    className="h-9"
                    placeholder="R$ 0,00"
                  />
                </div>
              )}

              {cteSubtotal > 0 && (
                <div className="p-2 bg-muted/50 border rounded-md">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      CT-e: {selectedCtePackage?.label || 'Personalizado'}
                    </span>
                    <span className="font-semibold">{formatCurrency(cteSubtotal)}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Carretas Section */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Link2 className="h-4 w-4 text-primary" />
                <Label className="text-xs font-medium">Gestão de Engates / Carretas</Label>
              </div>
              <p className="text-[10px] text-muted-foreground">
                Custo base: <span className="font-semibold text-primary">{formatCurrency(CARRETA_UNIT_PRICE)}</span> por carreta cadastrada
              </p>
              
              <div className="grid grid-cols-2 gap-3 items-end">
                <div className="space-y-1.5">
                  <Label className="text-xs">Qtd. Carretas Contratadas</Label>
                  <Input
                    type="number"
                    value={carretaCount}
                    onChange={(e) => setCarretaCount(Math.max(0, parseInt(e.target.value) || 0))}
                    min={0}
                    className="h-9"
                    placeholder="0"
                  />
                </div>
                {carretaCount > 0 && (
                  <div className="p-2 bg-muted/50 border rounded-md h-9 flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      {carretaCount} × {formatCurrency(CARRETA_UNIT_PRICE)}
                    </span>
                    <span className="text-sm font-semibold">{formatCurrency(carretaSubtotal)}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <Separator />

          {/* === VALOR FINAL === */}
          <div className="p-3 bg-green-50 dark:bg-green-900/20 border-2 border-green-300 dark:border-green-700 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-medium text-green-700 dark:text-green-300">
                  Valor Final
                </span>
                {(cteSubtotal > 0 || carretaSubtotal > 0) && (
                  <p className="text-[10px] text-green-600 dark:text-green-400 mt-0.5">
                    Placas {cteSubtotal > 0 ? '+ CT-e' : ''} {carretaSubtotal > 0 ? '+ Carretas' : ''}
                  </p>
                )}
              </div>
              <span className="text-xl font-bold text-green-700 dark:text-green-300">
                {formatCurrency(finalValue)}
              </span>
            </div>
          </div>

          {/* Payment Method & Due Date */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Forma de Pagamento</Label>
              <Select value={billingType} onValueChange={setBillingType}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BOLETO">
                    <div className="flex items-center gap-2">
                      <FileText className="h-3.5 w-3.5" />
                      Boleto
                    </div>
                  </SelectItem>
                  <SelectItem value="PIX">
                    <div className="flex items-center gap-2">
                      <QrCode className="h-3.5 w-3.5" />
                      PIX
                    </div>
                  </SelectItem>
                  <SelectItem value="CREDIT_CARD">
                    <div className="flex items-center gap-2">
                      <CreditCard className="h-3.5 w-3.5" />
                      Cartão
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Vencimento</Label>
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className="h-9"
              />
            </div>
          </div>

          {!company.asaas_customer_id && (
            <div className="p-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded text-xs">
              <strong>Atenção:</strong> Cliente será criado automaticamente no Asaas.
            </div>
          )}
        </div>

        <DialogFooter className="flex-row gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancelar
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleCreateSinglePayment}
            disabled={loading || !company.subscription_plan || finalValue <= 0}
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
            Cobrança Única
          </Button>
          <Button
            size="sm"
            onClick={handleCreateSubscription}
            disabled={loading || !company.subscription_plan || finalValue <= 0}
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
            Assinatura
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
