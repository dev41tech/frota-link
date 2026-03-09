import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useMultiTenant } from "@/hooks/useMultiTenant";
import { toast } from "sonner";
import { Loader2, Info, Package, Check, Trash2, Wallet, AlertTriangle } from "lucide-react";
import { MaintenancePartsSelector, SelectedPart } from "./MaintenancePartsSelector";
import { Badge } from "@/components/ui/badge";

interface MaintenanceFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  maintenance?: any;
  onSuccess: () => void;
}

const SERVICE_CATEGORIES = [
  { value: "oil_change", label: "Troca de óleo" },
  { value: "general_revision", label: "Revisão geral" },
  { value: "tires", label: "Pneus" },
  { value: "brakes", label: "Freios" },
  { value: "mechanical", label: "Mecânica Geral" },
  { value: "electrical", label: "Elétrica" },
  { value: "bodywork", label: "Funilaria" },
  { value: "other", label: "Outros" },
];

export function MaintenanceForm({ open, onOpenChange, maintenance, onSuccess }: MaintenanceFormProps) {
  const { user } = useAuth();
  const { currentCompany } = useMultiTenant();
  const [loading, setLoading] = useState(false);
  const [vehicles, setVehicles] = useState<any[]>([]);

  // -- ESTADOS DE PEÇAS --
  const [existingParts, setExistingParts] = useState<any[]>([]);
  const [newParts, setNewParts] = useState<SelectedPart[]>([]);
  const [newPartsCost, setNewPartsCost] = useState(0);

  const [vehicleTires, setVehicleTires] = useState<any[]>([]);

  const form = useForm({
    defaultValues: {
      vehicle_id: "",
      maintenance_type: "preventive",
      service_category: "",
      description: "",
      provider_name: "",
      labor_cost: "0",
      parts_cost: "0",
      service_date: new Date().toISOString().split("T")[0],
      odometer_at_service: "",
      next_due_date: "",
      next_due_km: "",
      status: "scheduled",
      notes: "",
      generate_payable: true,
      payable_due_date: new Date().toISOString().split("T")[0],
    },
  });

  // Carregar Veículos
  useEffect(() => {
    const fetchVehicles = async () => {
      if (!currentCompany?.id) return;
      const { data } = await supabase
        .from("vehicles")
        .select("id, plate, model")
        .eq("company_id", currentCompany.id)
        .order("plate");
      if (data) setVehicles(data);
    };
    fetchVehicles();
  }, [currentCompany]);

  // Carregar Peças JÁ USADAS
  useEffect(() => {
    const fetchLinkedParts = async () => {
      if (maintenance?.id && open) {
        const { data } = await supabase
          .from("maintenance_parts" as any)
          .select(`id, quantity, cost_at_time, inventory_items (name)`)
          .eq("maintenance_id", maintenance.id);

        if (data) {
          const formatted = data.map((p: any) => ({
            id: p.id,
            name: p.inventory_items?.name || "Item antigo",
            quantity: p.quantity,
            cost: p.cost_at_time,
          }));
          setExistingParts(formatted);
        }
      } else {
        setExistingParts([]);
      }
    };
    fetchLinkedParts();
  }, [maintenance, open]);

  // Monitora pneus
  const watchVehicleId = form.watch("vehicle_id");
  useEffect(() => {
    const checkTires = async () => {
      if (!watchVehicleId || !currentCompany) return;
      const selectedVehicle = vehicles.find((v) => v.id === watchVehicleId);
      if (!selectedVehicle) {
        setVehicleTires([]);
        return;
      }

      const { data } = await supabase
        .from("tire_assets" as any)
        .select("*")
        .eq("company_id", currentCompany.id)
        .eq("location", selectedVehicle.plate)
        .eq("status", "installed");
      setVehicleTires(data || []);
    };
    checkTires();
  }, [watchVehicleId, vehicles, currentCompany]);

  // Reset do Formulário
  useEffect(() => {
    if (open) {
      setNewParts([]);
      setNewPartsCost(0);

      if (maintenance) {
        form.reset({
          ...maintenance,
          labor_cost: maintenance.labor_cost?.toString() || "0",
          parts_cost: maintenance.parts_cost?.toString() || "0",
          service_date: maintenance.service_date?.split("T")[0],
          odometer_at_service: maintenance.odometer_at_service?.toString() || "",
          next_due_date: maintenance.next_due_date?.split("T")[0] || "",
          next_due_km: maintenance.next_due_km?.toString() || "",
          generate_payable: true,
          payable_due_date: maintenance.service_date?.split("T")[0] || new Date().toISOString().split("T")[0],
        });
      } else {
        form.reset({
          vehicle_id: "",
          maintenance_type: "preventive",
          service_category: "",
          description: "",
          provider_name: "",
          labor_cost: "0",
          parts_cost: "0",
          service_date: new Date().toISOString().split("T")[0],
          odometer_at_service: "",
          next_due_date: "",
          next_due_km: "",
          status: "scheduled",
          notes: "",
          generate_payable: true,
          payable_due_date: new Date().toISOString().split("T")[0],
        });
      }
    }
  }, [maintenance, open, form]);

  const onSubmit = async (values: any) => {
    if (!user || !currentCompany) return;
    setLoading(true);

    try {
      const labor = parseFloat(values.labor_cost) || 0;
      const externalParts = parseFloat(values.parts_cost) || 0;

      const previousPartsCost = maintenance ? maintenance.parts_cost || 0 : 0;
      const finalPartsCost = previousPartsCost + (maintenance ? newPartsCost : externalParts + newPartsCost);
      const totalCost = labor + finalPartsCost;

      const payload = {
        company_id: currentCompany.id,
        user_id: user.id,
        vehicle_id: values.vehicle_id,
        maintenance_type: values.maintenance_type,
        service_category: values.service_category,
        description: values.description,
        provider_name: values.provider_name,
        labor_cost: labor,
        parts_cost: finalPartsCost,
        total_cost: totalCost,
        service_date: values.service_date,
        odometer_at_service: values.odometer_at_service ? parseInt(values.odometer_at_service) : null,
        next_due_date: values.next_due_date || null,
        next_due_km: values.next_due_km ? parseInt(values.next_due_km) : null,
        status: values.status,
        notes: values.notes,
      };

      let maintenanceId = maintenance?.id;

      // 1. Salva Manutenção
      if (maintenance) {
        const { error } = await supabase.from("vehicle_maintenances").update(payload).eq("id", maintenance.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("vehicle_maintenances").insert([payload]).select().single();
        if (error) throw error;
        maintenanceId = data.id;
      }

      const vehicleInfo = vehicles.find((v) => v.id === values.vehicle_id);
      const vehiclePlate = vehicleInfo?.plate || "Veículo";

      // 2. Processa Peças (Estoque)
      if (newParts.length > 0 && maintenanceId) {
        const partsPayload = newParts.map((p) => ({
          company_id: currentCompany.id,
          maintenance_id: maintenanceId,
          item_id: p.item_id,
          quantity: p.quantity,
          cost_at_time: p.unit_price,
        }));

        await supabase.from("maintenance_parts" as any).insert(partsPayload);

        for (const part of newParts) {
          const { data: itemData } = await supabase
            .from("inventory_items" as any)
            .select("quantity")
            .eq("id", part.item_id)
            .single();
          const currentQty = (itemData as any)?.quantity || 0;
          await supabase
            .from("inventory_items" as any)
            .update({ quantity: currentQty - part.quantity })
            .eq("id", part.item_id);

          await supabase.from("stock_movements" as any).insert([
            {
              company_id: currentCompany.id,
              item_id: part.item_id,
              item_name: part.name,
              type: "OUT",
              quantity: part.quantity,
              vehicle_id: values.vehicle_id,
              vehicle_plate: vehiclePlate,
              notes: `Usado na Manutenção: ${values.service_category}`,
            },
          ]);
        }
      }

      // 3. INTEGRAÇÃO FINANCEIRA (MELHORADA)
      // Gera conta a pagar automaticamente se status=completed OU checkbox marcado, desde que tenha custo
      if (totalCost > 0 && (values.generate_payable || values.status === 'completed')) {
        // Verifica duplicidade
        const { data: existingBill } = await supabase
          .from("accounts_payable" as any)
          .select("id")
          .eq("maintenance_id", maintenanceId)
          .maybeSingle();

        if (!existingBill) {
          const categoryName =
            SERVICE_CATEGORIES.find((c) => c.value === values.service_category)?.label || values.service_category;

          const statusLabel = values.status === "completed" ? "" : values.status === "in_progress" ? " (Em Andamento)" : " (Agendada)";

          const { error: billError } = await supabase.from("accounts_payable" as any).insert([
            {
              company_id: currentCompany.id,
              user_id: user.id,
              description: `Manutenção ${vehiclePlate} - ${categoryName}${statusLabel}`,
              amount: totalCost,
              due_date: values.payable_due_date || values.service_date,
              status: values.status === "completed" ? "pending" : "scheduled",
              category: "Manutenção",
              maintenance_id: maintenanceId,
              supplier: values.provider_name || null,
            },
          ]);

          if (!billError) {
            toast.success("Conta a Pagar gerada no Financeiro!");
          } else {
            console.error("Erro ao gerar conta:", billError);
          }
        } else {
          // Atualiza a conta existente
          await supabase
            .from("accounts_payable" as any)
            .update({
              amount: totalCost,
              due_date: values.payable_due_date || values.service_date,
              status: values.status === "completed" ? "pending" : "scheduled",
            })
            .eq("maintenance_id", maintenanceId);
        }
      }

      toast.success("Manutenção salva com sucesso!");
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error(error);
      toast.error("Erro: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const displayTotal =
    parseFloat(form.watch("labor_cost") || "0") + parseFloat(form.watch("parts_cost") || "0") + newPartsCost;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{maintenance ? "Editar Manutenção" : "Nova Manutenção"}</DialogTitle>
          <DialogDescription>Gerencie custos, peças e financeiro.</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="vehicle_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Veículo</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {vehicles.map((v) => (
                          <SelectItem key={v.id} value={v.id}>
                            {v.plate} - {v.model}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="service_category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Categoria</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {SERVICE_CATEGORIES.map((c) => (
                          <SelectItem key={c.value} value={c.value}>
                            {c.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                    {form.watch('service_category') === 'tires' && (
                      <div className="flex items-center gap-2 p-3 mt-2 bg-amber-50 border border-amber-200 rounded-md">
                        <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                        <span className="text-sm text-amber-700">
                          Para troca de pneus, use o gerenciador na aba "Estoque → Pneus"
                        </span>
                      </div>
                    )}
                  </FormItem>
                )}
              />
            </div>

            {vehicleTires.length > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded p-3 flex items-start gap-3">
                <Info className="w-5 h-5 text-blue-600 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-blue-800">Pneus</p>
                  <p className="text-xs text-blue-700">
                    Este veículo tem <strong>{vehicleTires.length} pneus</strong> vinculados.
                  </p>
                </div>
              </div>
            )}

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* --- BLOCO DE PEÇAS --- */}
            <div className="border rounded-lg bg-slate-50 p-4 space-y-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                <Package className="w-4 h-4" /> Gestão de Peças
              </div>
              {existingParts.length > 0 && (
                <div className="space-y-2 mb-4">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Peças já baixadas:
                  </p>
                  <div className="bg-white rounded border divide-y">
                    {existingParts.map((part, idx) => (
                      <div key={idx} className="flex justify-between items-center p-2 text-sm">
                        <div className="flex items-center gap-2">
                          <Check className="w-3 h-3 text-green-600" />
                          <span className="font-medium">{part.name}</span>
                          <Badge variant="secondary" className="text-xs h-5">
                            {part.quantity} un
                          </Badge>
                        </div>
                        <span className="text-slate-500 text-xs">R$ {(part.cost * part.quantity).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="bg-white p-3 rounded border border-blue-100 shadow-sm">
                <p className="text-xs font-medium text-blue-700 mb-2">
                  Adicionar novas peças (Serão debitadas ao salvar):
                </p>
                <MaintenancePartsSelector
                  companyId={currentCompany?.id}
                  onPartsChange={(parts, total) => {
                    setNewParts(parts);
                    setNewPartsCost(total);
                  }}
                />
              </div>
            </div>

            {/* --- CUSTOS --- */}
            <div className="grid grid-cols-3 gap-4 border-t pt-4">
              <FormField
                control={form.control}
                name="labor_cost"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mão de Obra (R$)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="parts_cost"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Outros Custos (R$)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <div className="flex flex-col justify-end p-3 bg-green-50 rounded border border-green-100 text-right">
                <span className="text-xs text-muted-foreground uppercase">Total Geral</span>
                <span className="text-2xl font-bold text-green-700">R$ {displayTotal.toFixed(2)}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="service_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data Serviço</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="odometer_at_service"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Odômetro (KM)</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            <div className="bg-orange-50 p-4 rounded border border-orange-100 mt-2">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Wallet className="w-4 h-4 text-orange-700" />
                  <span className="text-sm font-semibold text-orange-800">Status & Financeiro</span>
                </div>
                <FormField
                  control={form.control}
                  name="generate_payable"
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-2 space-y-0">
                      <FormControl>
                        <input
                          type="checkbox"
                          checked={field.value}
                          onChange={field.onChange}
                          className="h-4 w-4 rounded border-gray-300"
                        />
                      </FormControl>
                      <FormLabel className="text-xs font-medium text-orange-700 cursor-pointer">
                        Gerar Conta a Pagar
                      </FormLabel>
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status Atual</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger className="bg-white">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="scheduled">Agendado</SelectItem>
                          <SelectItem value="in_progress">Em Progresso</SelectItem>
                          <SelectItem value="completed">Concluído</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="payable_due_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Venc. Financeiro</FormLabel>
                      <FormControl>
                        <Input type="date" className="bg-white" {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="next_due_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Próx. Manutenção</FormLabel>
                      <FormControl>
                        <Input type="date" className="bg-white" {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
              <p className="text-xs text-orange-600 mt-2">
                * Se marcado, uma conta a pagar será criada/atualizada no módulo Financeiro.
              </p>
            </div>

            <DialogFooter className="mt-6">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {maintenance ? "Salvar Alterações" : "Criar Manutenção"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
