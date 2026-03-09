import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useMultiTenant } from "@/hooks/useMultiTenant";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { maybeCreateMaintenanceFromExpense, SERVICE_CATEGORIES } from "@/lib/maintenanceAutoCreate";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus,
  Receipt,
  Edit,
  Trash2,
  Truck,
  Route,
  Calendar,
  Filter,
  TrendingDown,
  Fuel,
  Package,
  Link2,
  CheckCircle2,
  Clock,
  AlertCircle,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { useExpenseCategories } from "@/hooks/useExpenseCategories";
import * as LucideIcons from "lucide-react";
import { CategoryBadge } from "@/components/categories/CategoryBadge";
import { format } from "date-fns";
import { formatDateBR } from "@/lib/utils";
import { DeleteConfirmationDialog } from "@/components/ui/delete-confirmation-dialog";
import { PartySelector } from "@/components/parties/PartySelector";
import { type Party } from "@/hooks/useParties";

interface Expense {
  id: string;
  description: string;
  amount: number;
  date: string;
  category: string;
  category_id: string | null;
  is_direct: boolean | null;
  journey_id: string | null;
  vehicle_id: string | null;
  supplier: string | null;
  supplier_id: string | null;
  payment_method: string | null;
  notes: string | null;
  receipt_url: string | null;
  accounts_payable_id: string | null;
  payment_status: string | null;
  expense_categories?: {
    id: string;
    name: string;
    icon: string;
    color: string;
    classification: string;
  };
  journeys?: { journey_number: string } | null;
  vehicles?: { plate: string; brand: string; model: string } | null;
  accounts_payable?: { id: string; status: string } | null;
  parties?: { id: string; name: string } | null;
}

interface FuelExpense {
  id: string;
  date: string;
  liters: number;
  price_per_liter: number;
  total_amount: number;
  vehicle_id: string;
  journey_id: string | null;
  payment_method: string | null;
  notes: string | null;
  vehicles?: { plate: string; brand: string; model: string } | null;
  journeys?: { journey_number: string } | null;
}

interface Vehicle {
  id: string;
  plate: string;
  brand: string;
  model: string;
}

interface Journey {
  id: string;
  journey_number: string;
  status: string;
  origin: string;
  destination: string;
}
const normalizeText = (text: string) =>
  text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

export default function Expenses() {
  const { user } = useAuth();
  const { currentCompany } = useMultiTenant();
  const { toast } = useToast();
  const { data: expenseCategories = [], isLoading: loadingCategories } = useExpenseCategories(undefined, true);

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [fuelExpenses, setFuelExpenses] = useState<FuelExpense[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [journeys, setJourneys] = useState<Journey[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [activeTab, setActiveTab] = useState("all");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Filters
  const [filterClassification, setFilterClassification] = useState<string>("all");
  const [filterVehicle, setFilterVehicle] = useState<string>("all");
  const [filterPeriod, setFilterPeriod] = useState<string>("30d");

  const [formData, setFormData] = useState({
    category_id: "",
    description: "",
    amount: "",
    date: new Date().toISOString().split("T")[0],
    vehicle_id: "",
    journey_id: "",
    supplier: "",
    supplier_id: "",
    payment_method: "card",
    notes: "",
    generate_accounts_payable: true,
    maintenance_service_category: "",
    maintenance_type: "",
    maintenance_provider: "",
    maintenance_odometer: "",
    maintenance_notes: "",
  });

  useEffect(() => {
    if (user && currentCompany?.id) {
      fetchData();
    }
  }, [user, currentCompany?.id, filterPeriod]);

  useEffect(() => {
    const shouldOpen = localStorage.getItem("openNewExpense");
    if (shouldOpen) {
      localStorage.removeItem("openNewExpense");
      resetForm();
      setDialogOpen(true);
    }
  }, []);

  const getDateRange = () => {
    const end = new Date();
    let start = new Date();

    switch (filterPeriod) {
      case "7d":
        start.setDate(end.getDate() - 7);
        break;
      case "15d":
        start.setDate(end.getDate() - 15);
        break;
      case "30d":
        start.setDate(end.getDate() - 30);
        break;
      case "60d":
        start.setDate(end.getDate() - 60);
        break;
      case "90d":
        start.setDate(end.getDate() - 90);
        break;
      default:
        start.setDate(end.getDate() - 30);
    }

    return { start: start.toISOString(), end: end.toISOString() };
  };

  const fetchData = async () => {
    setLoading(true);
    const { start, end } = getDateRange();

    try {
      // Fetch expenses - com filtro de soft delete e relação com accounts_payable
      const { data: expensesData, error: expensesError } = await supabase
        .from("expenses")
        .select(
          `
   *,
   expense_categories (id, name, icon, color, classification),
   journeys (journey_number),
   vehicles (plate, brand, model),
   accounts_payable!expenses_accounts_payable_id_fkey (id, status)
 `,
        )
        .eq("company_id", currentCompany?.id)
        .is("deleted_at", null)
        .gte("date", start)
        .lte("date", end)
        .order("date", { ascending: false });

      if (expensesError) throw expensesError;
      setExpenses(expensesData || []);

      // Fetch fuel expenses - com filtro de soft delete
      const { data: fuelData, error: fuelError } = await supabase
        .from("fuel_expenses")
        .select(
          `
          *,
          vehicles (plate, brand, model),
          journeys (journey_number)
        `,
        )
        .eq("company_id", currentCompany?.id)
        .is("deleted_at", null)
        .gte("date", start)
        .lte("date", end)
        .order("date", { ascending: false });

      if (fuelError) throw fuelError;
      setFuelExpenses(fuelData || []);

      // Fetch vehicles and journeys for form
      const { data: vehiclesData } = await supabase
        .from("vehicles")
        .select("id, plate, brand, model")
        .eq("company_id", currentCompany?.id)
        .eq("status", "active");
      setVehicles(vehiclesData || []);

      const { data: journeysData } = await supabase
        .from("journeys")
        .select("id, journey_number, status, origin, destination")
        .eq("company_id", currentCompany?.id)
        .in("status", ["in_progress", "planned", "completed"])
        .order("created_at", { ascending: false })
        .limit(50);
      setJourneys(journeysData || []);
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      category_id: "",
      description: "",
      amount: "",
      date: new Date().toISOString().split("T")[0],
      vehicle_id: "",
      journey_id: "",
      supplier: "",
      supplier_id: "",
      payment_method: "card",
      notes: "",
      generate_accounts_payable: true,
      maintenance_service_category: "",
      maintenance_type: "",
      maintenance_provider: "",
      maintenance_odometer: "",
      maintenance_notes: "",
    });
    setEditingExpense(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const selectedCategory = expenseCategories.find((c) => c.id === formData.category_id);
      const isDirect = selectedCategory?.classification === "direct";
      const selectedVehicle = vehicles.find((v) => v.id === formData.vehicle_id);

      const expenseData = {
        user_id: user?.id,
        company_id: currentCompany?.id,
        category_id: formData.category_id || null,
        category: selectedCategory?.name || "Outros",
        description: formData.description,
        amount: parseFloat(formData.amount),
        date: formData.date,
        vehicle_id: formData.vehicle_id || null,
        journey_id: formData.journey_id || null,
        supplier: formData.supplier || null,
        supplier_id: formData.supplier_id || null,
        payment_method: formData.payment_method,
        notes: formData.notes || null,
        is_direct: isDirect,
        payment_status: "pending",
      };

      if (editingExpense) {
        const { error } = await supabase.from("expenses").update(expenseData).eq("id", editingExpense.id);

        if (error) throw error;

        toast({
          title: "Sucesso",
          description: "Despesa atualizada com sucesso!",
        });
      } else {
        // Inserir a despesa
        const { data: insertedExpense, error: insertError } = await supabase
          .from("expenses")
          .insert([expenseData])
          .select()
          .single();

        if (insertError) throw insertError;

        // Se marcado para gerar título no Contas a Pagar
        if (formData.generate_accounts_payable && insertedExpense) {
          // Montar descrição: Categoria + Veículo (se houver)
          let apDescription = selectedCategory?.name || "Despesa";
          if (selectedVehicle) {
            apDescription += ` - ${selectedVehicle.plate}`;
          }
          apDescription += ` - ${formData.description}`;

          const accountsPayableData = {
            user_id: user?.id,
            company_id: currentCompany?.id,
            description: apDescription,
            amount: parseFloat(formData.amount),
            due_date: formData.date,
            category: selectedCategory?.name || "Outros",
            category_id: formData.category_id || null,
            supplier: formData.supplier || null,
            supplier_id: formData.supplier_id || null,
            status: "pending",
            payment_method: formData.payment_method || null,
            notes: formData.notes || null,
            expense_id: insertedExpense.id,
            is_direct: isDirect,
          };

          const { data: insertedAP, error: apError } = await supabase
            .from("accounts_payable")
            .insert([accountsPayableData])
            .select()
            .single();

          if (apError) {
            console.error("Erro ao criar título no Contas a Pagar:", apError);
            // Não falhar a operação principal, apenas logar
          } else if (insertedAP) {
            // Atualizar a despesa com o ID do accounts_payable
            await supabase.from("expenses").update({ accounts_payable_id: insertedAP.id }).eq("id", insertedExpense.id);
          }
        }

        // Auto-criar manutenção se categoria for manutenção
        if (insertedExpense) {
          await maybeCreateMaintenanceFromExpense({
            expense_id: insertedExpense.id,
            category_name: selectedCategory?.name || "",
            vehicle_id: formData.vehicle_id || null,
            company_id: currentCompany?.id!,
            user_id: user?.id!,
            amount: parseFloat(formData.amount),
            description: formData.description,
            date: formData.date,
            supplier: formData.supplier || null,
            service_category: formData.maintenance_service_category || undefined,
            maintenance_type: (formData.maintenance_type as "preventive" | "corrective") || undefined,
            provider_name: formData.maintenance_provider || undefined,
            odometer_at_service: formData.maintenance_odometer ? parseInt(formData.maintenance_odometer) : undefined,
            notes: formData.maintenance_notes || undefined,
          });
        }

        toast({
          title: "Sucesso",
          description: formData.generate_accounts_payable
            ? "Despesa registrada e título gerado no Contas a Pagar!"
            : "Despesa registrada com sucesso!",
        });
      }

      setDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleEdit = (expense: Expense) => {
    setEditingExpense(expense);
    setFormData({
      category_id: expense.category_id || "",
      description: expense.description,
      amount: expense.amount.toString(),
      date: expense.date.split("T")[0],
      vehicle_id: expense.vehicle_id || "",
      journey_id: expense.journey_id || "",
      supplier: expense.supplier || "",
      supplier_id: expense.supplier_id || "",
      payment_method: expense.payment_method || "card",
      notes: expense.notes || "",
      generate_accounts_payable: false,
      maintenance_service_category: "",
      maintenance_type: "",
      maintenance_provider: "",
      maintenance_odometer: "",
      maintenance_notes: "",
    });
    setDialogOpen(true);
  };

  const openDeleteDialog = (id: string) => {
    setDeletingId(id);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    setIsDeleting(true);

    try {
      // Buscar a despesa para verificar se tem título vinculado
      const expenseToDelete = expenses.find((e) => e.id === deletingId);

      // Se houver título vinculado no Contas a Pagar e não estiver pago, deletar também
      if (expenseToDelete?.accounts_payable_id && expenseToDelete.accounts_payable?.status !== "paid") {
        await supabase.from("accounts_payable").delete().eq("id", expenseToDelete.accounts_payable_id);
      }

      // Hard Delete da despesa - exclusão permanente
      const { error } = await supabase.from("expenses").delete().eq("id", deletingId);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description:
          expenseToDelete?.accounts_payable_id && expenseToDelete.accounts_payable?.status !== "paid"
            ? "Despesa e título vinculado excluídos!"
            : "Despesa excluída permanentemente!",
      });

      setDeleteDialogOpen(false);
      setDeletingId(null);
      fetchData();
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    return formatDateBR(dateString);
  };

  // Filter expenses
  const filteredExpenses = expenses.filter((expense) => {
    if (filterClassification !== "all") {
      const classification = expense.expense_categories?.classification || (expense.is_direct ? "direct" : "indirect");
      if (filterClassification !== classification) return false;
    }
    if (filterVehicle !== "all" && expense.vehicle_id !== filterVehicle) return false;
    return true;
  });

  const filteredFuelExpenses = fuelExpenses.filter((expense) => {
    if (filterVehicle !== "all" && expense.vehicle_id !== filterVehicle) return false;
    return true;
  });

  // Totals
  const totalExpenses = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
  const totalFuel = filteredFuelExpenses.reduce((sum, e) => sum + e.total_amount, 0);
  const totalDirect =
    filteredExpenses
      .filter((e) => e.expense_categories?.classification === "direct" || e.is_direct)
      .reduce((sum, e) => sum + e.amount, 0) + totalFuel;
  const totalIndirect = filteredExpenses
    .filter(
      (e) =>
        e.expense_categories?.classification === "indirect" || (!e.is_direct && !e.expense_categories?.classification),
    )
    .reduce((sum, e) => sum + e.amount, 0);

  if (!currentCompany?.id) {
    return <div className="p-6">Carregando dados da empresa...</div>;
  }

  if (loading) {
    return <div className="p-6">Carregando...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Despesas</h1>
          <p className="text-muted-foreground">Controle de despesas diretas e indiretas</p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-primary shadow-primary" onClick={resetForm}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Despesa
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingExpense ? "Editar Despesa" : "Nova Despesa"}</DialogTitle>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="category_id">Categoria *</Label>
                  <Select
                    value={formData.category_id}
                    onValueChange={(value) => setFormData({ ...formData, category_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a categoria" />
                    </SelectTrigger>
                    <SelectContent>
                      {loadingCategories ? (
                        <SelectItem value="loading" disabled>
                          Carregando...
                        </SelectItem>
                      ) : expenseCategories.length === 0 ? (
                        <SelectItem value="no-categories" disabled>
                          Nenhuma categoria
                        </SelectItem>
                      ) : (
                        expenseCategories.map((category) => {
                          const IconComponent = (LucideIcons as any)[category.icon] || LucideIcons.Package;
                          return (
                            <SelectItem key={category.id} value={category.id}>
                              <div className="flex items-center gap-2">
                                <div className="p-1 rounded" style={{ backgroundColor: `${category.color}15` }}>
                                  <IconComponent className="h-4 w-4" style={{ color: category.color }} />
                                </div>
                                <span>{category.name}</span>
                                <Badge variant="outline" className="ml-1 text-xs">
                                  {category.classification === "direct" ? "Direta" : "Indireta"}
                                </Badge>
                              </div>
                            </SelectItem>
                          );
                        })
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="amount">Valor *</Label>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Descrição *</Label>
                <Input
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="date">Data *</Label>
                  <Input
                    id="date"
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="vehicle_id">Veículo</Label>
                  <Select
                    value={formData.vehicle_id}
                    onValueChange={(value) => setFormData({ ...formData, vehicle_id: value === "none" ? "" : value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione (opcional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhum</SelectItem>
                      {vehicles.map((v) => (
                        <SelectItem key={v.id} value={v.id}>
                          {v.plate} - {v.brand} {v.model}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="journey_id">Jornada</Label>
                  <Select
                    value={formData.journey_id}
                    onValueChange={(value) => setFormData({ ...formData, journey_id: value === "none" ? "" : value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione (opcional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhuma</SelectItem>
                      {journeys.map((j) => (
                        <SelectItem key={j.id} value={j.id}>
                          {j.journey_number} ({j.origin} → {j.destination})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="supplier">Fornecedor</Label>
                  <PartySelector
                    type="supplier"
                    value={formData.supplier_id || undefined}
                    onChange={(id, party) => setFormData({ 
                      ...formData, 
                      supplier_id: id || "",
                      supplier: party?.name || formData.supplier
                    })}
                    placeholder="Selecione o fornecedor (opcional)"
                    allowCreate
                    onCreateNew={() => window.open('/parties?tab=supplier', '_blank')}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="payment_method">Forma de Pagamento</Label>
                  <Select
                    value={formData.payment_method}
                    onValueChange={(value) => setFormData({ ...formData, payment_method: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="card">Cartão</SelectItem>
                      <SelectItem value="cash">Dinheiro</SelectItem>
                      <SelectItem value="pix">PIX</SelectItem>
                      <SelectItem value="bank_transfer">Transferência</SelectItem>
                      <SelectItem value="boleto">Boleto</SelectItem>
                      <SelectItem value="tag">Tag</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Observações</Label>
                <Input
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                />
              </div>

              {/* Campos extras para categoria Manutenção */}
              {(() => {
                const selectedCat = expenseCategories.find((c) => c.id === formData.category_id);
                const isMaintenance = selectedCat && normalizeText(selectedCat.name).includes("manutencao");
                if (!isMaintenance) return null;
                return (
                  <div className="space-y-4 p-4 border rounded-lg bg-muted/20 animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                      <LucideIcons.Wrench className="h-4 w-4" />
                      Detalhes da Manutenção
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Tipo de Serviço *</Label>
                        <Select
                          value={formData.maintenance_service_category}
                          onValueChange={(v) => setFormData({ ...formData, maintenance_service_category: v })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o serviço" />
                          </SelectTrigger>
                          <SelectContent>
                            {SERVICE_CATEGORIES.map((sc) => (
                              <SelectItem key={sc.value} value={sc.value}>{sc.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Tipo de Manutenção</Label>
                        <Select
                          value={formData.maintenance_type}
                          onValueChange={(v) => setFormData({ ...formData, maintenance_type: v })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione (opcional)" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="corrective">Corretiva</SelectItem>
                            <SelectItem value="preventive">Preventiva</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Oficina / Fornecedor</Label>
                        <Input
                          placeholder="Nome da oficina"
                          value={formData.maintenance_provider}
                          onChange={(e) => setFormData({ ...formData, maintenance_provider: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Odômetro (km)</Label>
                        <Input
                          type="number"
                          placeholder="Ex: 125430"
                          value={formData.maintenance_odometer}
                          onChange={(e) => setFormData({ ...formData, maintenance_odometer: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Observações do serviço</Label>
                      <Textarea
                        placeholder="Detalhes sobre o serviço realizado..."
                        value={formData.maintenance_notes}
                        onChange={(e) => setFormData({ ...formData, maintenance_notes: e.target.value })}
                        rows={2}
                      />
                    </div>
                  </div>
                );
              })()}
              {!editingExpense && (
                <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/30">
                  <div className="space-y-0.5">
                    <Label htmlFor="generate_ap" className="text-sm font-medium">
                      Gerar Título no Contas a Pagar
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Cria automaticamente um título pendente no Financeiro
                    </p>
                  </div>
                  <Switch
                    id="generate_ap"
                    checked={formData.generate_accounts_payable}
                    onCheckedChange={(checked) => setFormData({ ...formData, generate_accounts_payable: checked })}
                  />
                </div>
              )}

              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit">{editingExpense ? "Salvar" : "Registrar"}</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-destructive/10">
                <TrendingDown className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Despesas</p>
                <p className="text-xl font-bold">{formatCurrency(totalExpenses + totalFuel)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-500/10">
                <Truck className="h-5 w-5 text-orange-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Despesas Diretas</p>
                <p className="text-xl font-bold">{formatCurrency(totalDirect)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/10">
                <Package className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Despesas Indiretas</p>
                <p className="text-xl font-bold">{formatCurrency(totalIndirect)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-500/10">
                <Fuel className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Combustível</p>
                <p className="text-xl font-bold">{formatCurrency(totalFuel)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Filtros:</span>
            </div>

            <Select value={filterPeriod} onValueChange={setFilterPeriod}>
              <SelectTrigger className="w-[140px]">
                <Calendar className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">7 dias</SelectItem>
                <SelectItem value="15d">15 dias</SelectItem>
                <SelectItem value="30d">30 dias</SelectItem>
                <SelectItem value="60d">60 dias</SelectItem>
                <SelectItem value="90d">90 dias</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterClassification} onValueChange={setFilterClassification}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Classificação" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="direct">Diretas</SelectItem>
                <SelectItem value="indirect">Indiretas</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterVehicle} onValueChange={setFilterVehicle}>
              <SelectTrigger className="w-[180px]">
                <Truck className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Veículo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {vehicles.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.plate}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all">Todas ({filteredExpenses.length + filteredFuelExpenses.length})</TabsTrigger>
          <TabsTrigger value="general">Despesas ({filteredExpenses.length})</TabsTrigger>
          <TabsTrigger value="fuel">Combustível ({filteredFuelExpenses.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-4">
          {/* Combined view */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Todas as Despesas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Veículo</TableHead>
                      <TableHead>Jornada</TableHead>
                      <TableHead className="text-center">Financeiro</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {/* General expenses */}
                    {filteredExpenses.map((expense) => (
                      <TableRow key={expense.id}>
                        <TableCell>{formatDate(expense.date)}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              expense.expense_categories?.classification === "direct" || expense.is_direct
                                ? "default"
                                : "secondary"
                            }
                          >
                            {expense.expense_categories?.classification === "direct" || expense.is_direct
                              ? "Direta"
                              : "Indireta"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {expense.expense_categories ? (
                            <CategoryBadge
                              name={expense.expense_categories.name}
                              icon={expense.expense_categories.icon}
                              color={expense.expense_categories.color}
                            />
                          ) : (
                            expense.category
                          )}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate">{expense.description}</TableCell>
                        <TableCell>
                          {expense.vehicles ? (
                            <span className="text-sm">{expense.vehicles.plate}</span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {expense.journeys ? (
                            <Badge variant="outline">{expense.journeys.journey_number}</Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger>
                                {expense.accounts_payable_id ? (
                                  expense.accounts_payable?.status === "paid" ? (
                                    <div className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
                                      <CheckCircle2 className="h-3.5 w-3.5" />
                                      <span className="text-xs font-medium">Pago</span>
                                    </div>
                                  ) : (
                                    <div className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300">
                                      <Clock className="h-3.5 w-3.5" />
                                      <span className="text-xs font-medium">Pendente</span>
                                    </div>
                                  )
                                ) : (
                                  <span className="text-muted-foreground text-xs">-</span>
                                )}
                              </TooltipTrigger>
                              <TooltipContent>
                                {expense.accounts_payable_id
                                  ? expense.accounts_payable?.status === "paid"
                                    ? "Título pago no Contas a Pagar"
                                    : "Título pendente no Contas a Pagar"
                                  : "Sem título vinculado"}
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(expense.amount)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" onClick={() => handleEdit(expense)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => openDeleteDialog(expense.id)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}

                    {/* Fuel expenses */}
                    {filteredFuelExpenses.map((fuel) => (
                      <TableRow key={`fuel-${fuel.id}`} className="bg-red-50/30 dark:bg-red-950/10">
                        <TableCell>{formatDate(fuel.date)}</TableCell>
                        <TableCell>
                          <Badge variant="default">Direta</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="p-1 rounded bg-red-100 dark:bg-red-900/30">
                              <Fuel className="h-4 w-4 text-red-500" />
                            </div>
                            <span>Combustível</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {fuel.liters.toFixed(2)}L × R$ {fuel.price_per_liter.toFixed(2)}
                        </TableCell>
                        <TableCell>
                          {fuel.vehicles ? (
                            <span className="text-sm">{fuel.vehicles.plate}</span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {fuel.journeys ? (
                            <Badge variant="outline">{fuel.journeys.journey_number}</Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="text-muted-foreground text-xs">-</span>
                        </TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(fuel.total_amount)}</TableCell>
                        <TableCell className="text-right">
                          <span className="text-xs text-muted-foreground">Via Combustível</span>
                        </TableCell>
                      </TableRow>
                    ))}

                    {filteredExpenses.length === 0 && filteredFuelExpenses.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                          Nenhuma despesa encontrada no período
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="general">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Despesas Gerais</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Classificação</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Fornecedor</TableHead>
                      <TableHead>Veículo</TableHead>
                      <TableHead>Jornada</TableHead>
                      <TableHead className="text-center">Financeiro</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredExpenses.map((expense) => (
                      <TableRow key={expense.id}>
                        <TableCell>{formatDate(expense.date)}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              expense.expense_categories?.classification === "direct" || expense.is_direct
                                ? "default"
                                : "secondary"
                            }
                          >
                            {expense.expense_categories?.classification === "direct" || expense.is_direct
                              ? "Direta"
                              : "Indireta"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {expense.expense_categories ? (
                            <CategoryBadge
                              name={expense.expense_categories.name}
                              icon={expense.expense_categories.icon}
                              color={expense.expense_categories.color}
                            />
                          ) : (
                            expense.category
                          )}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate">{expense.description}</TableCell>
                        <TableCell>{expense.supplier || "-"}</TableCell>
                        <TableCell>{expense.vehicles ? expense.vehicles.plate : "-"}</TableCell>
                        <TableCell>
                          {expense.journeys ? <Badge variant="outline">{expense.journeys.journey_number}</Badge> : "-"}
                        </TableCell>
                        <TableCell className="text-center">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger>
                                {expense.accounts_payable_id ? (
                                  expense.accounts_payable?.status === "paid" ? (
                                    <div className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
                                      <CheckCircle2 className="h-3.5 w-3.5" />
                                      <span className="text-xs font-medium">Pago</span>
                                    </div>
                                  ) : (
                                    <div className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300">
                                      <Clock className="h-3.5 w-3.5" />
                                      <span className="text-xs font-medium">Pendente</span>
                                    </div>
                                  )
                                ) : (
                                  <span className="text-muted-foreground text-xs">-</span>
                                )}
                              </TooltipTrigger>
                              <TooltipContent>
                                {expense.accounts_payable_id
                                  ? expense.accounts_payable?.status === "paid"
                                    ? "Título pago no Contas a Pagar"
                                    : "Título pendente no Contas a Pagar"
                                  : "Sem título vinculado"}
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(expense.amount)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" onClick={() => handleEdit(expense)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => openDeleteDialog(expense.id)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredExpenses.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                          Nenhuma despesa encontrada
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="fuel">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Abastecimentos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Veículo</TableHead>
                      <TableHead>Jornada</TableHead>
                      <TableHead className="text-right">Litros</TableHead>
                      <TableHead className="text-right">Preço/L</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead>Pagamento</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredFuelExpenses.map((fuel) => (
                      <TableRow key={fuel.id}>
                        <TableCell>{formatDate(fuel.date)}</TableCell>
                        <TableCell>{fuel.vehicles ? `${fuel.vehicles.plate} - ${fuel.vehicles.brand}` : "-"}</TableCell>
                        <TableCell>
                          {fuel.journeys ? <Badge variant="outline">{fuel.journeys.journey_number}</Badge> : "-"}
                        </TableCell>
                        <TableCell className="text-right">{fuel.liters.toFixed(2)}</TableCell>
                        <TableCell className="text-right">R$ {fuel.price_per_liter.toFixed(2)}</TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(fuel.total_amount)}</TableCell>
                        <TableCell>{fuel.payment_method || "-"}</TableCell>
                      </TableRow>
                    ))}
                    {filteredFuelExpenses.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                          Nenhum abastecimento encontrado
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <DeleteConfirmationDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleDelete}
        title="Excluir despesa?"
        description="Esta despesa será removida permanentemente. Esta ação não pode ser desfeita."
        isDeleting={isDeleting}
      />
    </div>
  );
}
