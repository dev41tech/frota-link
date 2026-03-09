import { useState, useEffect, useRef, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useMultiTenant } from "@/hooks/useMultiTenant";
import { useFinancialAccounts } from "@/hooks/useFinancialAccounts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Trash2,
  Upload,
  CheckCircle2,
  Loader2,
  FileText,
  Filter,
  Download,
  Edit,
  X,
  ListFilter,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import JourneyRevenueConverter from "@/components/revenue/JourneyRevenueConverter";
import { useRevenueCategories } from "@/hooks/useRevenueCategories";
import { CategoryBadge } from "@/components/categories/CategoryBadge";
import { format } from "date-fns";

// --- INTERFACES ---
interface Revenue {
  id: string;
  user_id: string | null;
  company_id: string | null;
  description: string;
  amount: number;
  date: string;
  payment_method: string | null;
  payment_date: string | null;
  client: string | null;
  invoice_number: string | null;
  notes: string | null;
  status: "received" | "pending" | "cancelled";
  category: string;
  category_id: string | null;
  journey_id?: string | null;
  receipt_url?: string | null;
  bank_transaction_id?: string | null;
  created_at?: string;
  updated_at?: string;
  deleted_at?: string | null;
  reconciled_at?: string | null;
  revenue_categories?: {
    id: string;
    name: string;
    icon: string;
    color: string;
  };
  journeys: { journey_number: string; freight_value?: number; status?: string } | null;
  virtual?: boolean;
}

interface Journey {
  id: string;
  journey_number: string;
  status?: string;
  freight_value?: number;
  created_at: string;
}

export default function Accounts() {
  const { user } = useAuth();
  const { currentCompany } = useMultiTenant();
  const { toast } = useToast();
  const { data: revenueCategories = [], isLoading: loadingCategories } = useRevenueCategories(true);
  const { accounts } = useFinancialAccounts();

  // Estados de Dados
  const [revenues, setRevenues] = useState<Revenue[]>([]);
  const [journeys, setJourneys] = useState<Journey[]>([]);
  const [loading, setLoading] = useState(true);

  // Estados de UI
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRevenue, setEditingRevenue] = useState<Revenue | null>(null);
  const [showConverter, setShowConverter] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // Modal de Recebimento Rápido
  const [receivingRevenue, setReceivingRevenue] = useState<Revenue | null>(null);
  const [receiptLink, setReceiptLink] = useState("");

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const receiptInputRef = useRef<HTMLInputElement>(null);

  // --- FILTROS ---
  const [dateRange, setDateRange] = useState({ from: "", to: "" });
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const [formData, setFormData] = useState({
    journey_id: "",
    description: "",
    amount: "",
    date: new Date().toISOString().split("T")[0],
    payment_method: "bank_transfer",
    client: "",
    invoice_number: "",
    notes: "",
    status: "pending" as "received" | "pending" | "cancelled", // ALTERADO PARA PENDING POR PADRÃO
    category_id: "",
    receipt_url: "",
    account_id: "",
  });

  // --- CARREGAMENTO INICIAL ---
  useEffect(() => {
    if (user && currentCompany?.id) {
      fetchRevenues();
      fetchJourneys();
      checkForUnconvertedJourneys();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, currentCompany?.id, dateRange]);

  const checkForUnconvertedJourneys = async () => {
    try {
      const { data: journeysData } = await supabase
        .from("journeys")
        .select("id")
        .eq("company_id", currentCompany?.id)
        .eq("status", "completed")
        .not("freight_value", "is", null)
        .gt("freight_value", 0);

      const { data: revenuesData } = await supabase.from("revenue").select("journey_id").not("journey_id", "is", null);

      const linkedJourneyIds = new Set(revenuesData?.map((r) => r.journey_id) || []);
      const hasUnconverted = journeysData?.some((j) => !linkedJourneyIds.has(j.id)) || false;

      setShowConverter(hasUnconverted);
    } catch (error) {
      console.error("Error checking unconverted journeys:", error);
    }
  };

  const fetchRevenues = async () => {
    try {
      const { data, error } = await supabase
        .from("revenue")
        .select(
          `
          *,
          journeys(journey_number, freight_value, status),
          revenue_categories (id, name, icon, color)
        `,
        )
        .eq("company_id", currentCompany?.id)
        .is("deleted_at", null)
        .order("date", { ascending: false });

      if (error) throw error;

      const { data: unlinkedJourneys } = await supabase
        .from("journeys")
        .select("id, journey_number, freight_value, status, created_at")
        .eq("company_id", currentCompany?.id)
        .eq("status", "completed")
        .not("freight_value", "is", null)
        .gt("freight_value", 0)
        .order("created_at", { ascending: false });

      const linkedJourneyIds = new Set(data?.map((r) => r.journey_id).filter(Boolean));
      const filteredUnlinkedJourneys = unlinkedJourneys?.filter((j) => !linkedJourneyIds.has(j.id)) || [];

      let allRevenues = [...(data || [])] as Revenue[];

      if (filteredUnlinkedJourneys && filteredUnlinkedJourneys.length > 0) {
        const virtualRevenues: Revenue[] = filteredUnlinkedJourneys
          .filter((j) => j.freight_value && j.freight_value > 0)
          .map((journey) => ({
            id: `virtual-${journey.id}`,
            user_id: user?.id || null,
            company_id: currentCompany?.id || null,
            journey_id: journey.id,
            description: `Frete - ${journey.journey_number}`,
            amount: journey.freight_value!,
            date: journey.created_at.split("T")[0],
            payment_method: "pending",
            payment_date: null,
            client: "A definir",
            invoice_number: null,
            notes: "Receita automática da jornada",
            status: "pending",
            category: "Frete",
            category_id: null,
            receipt_url: null,
            bank_transaction_id: null,
            created_at: journey.created_at,
            updated_at: journey.created_at,
            deleted_at: null,
            reconciled_at: null,
            journeys: {
              journey_number: journey.journey_number,
              freight_value: journey.freight_value,
              status: journey.status,
            },
            virtual: true,
          }));

        allRevenues = [...allRevenues, ...virtualRevenues];
      }

      if (dateRange.from) {
        allRevenues = allRevenues.filter((r) => r.date >= dateRange.from);
      }
      if (dateRange.to) {
        allRevenues = allRevenues.filter((r) => r.date <= dateRange.to);
      }

      allRevenues.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      setRevenues(allRevenues);
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const fetchJourneys = async () => {
    try {
      const { data, error } = await supabase
        .from("journeys")
        .select("*")
        .eq("company_id", currentCompany?.id)
        .in("status", ["completed", "in_progress", "planned"])
        .order("created_at", { ascending: false });

      if (error) throw error;
      setJourneys(data || []);
    } catch (error: any) {
      console.error(error);
    }
  };

  const filteredRevenues = useMemo(() => {
    if (statusFilter === "all") return revenues;
    return revenues.filter((r) => r.status === statusFilter);
  }, [revenues, statusFilter]);

  // --- HANDLERS ---

  const resetForm = () => {
    setFormData({
      journey_id: "",
      description: "",
      amount: "",
      date: new Date().toISOString().split("T")[0],
      payment_method: "bank_transfer",
      client: "",
      invoice_number: "",
      notes: "",
      status: "pending", // RESET PARA PENDING
      category_id: "",
      receipt_url: "",
      account_id: "",
    });
    setEditingRevenue(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id || !currentCompany?.id) return;

    try {
      const selectedCategory = revenueCategories.find((c) => c.id === formData.category_id);

      const revenueData = {
        user_id: user.id,
        company_id: currentCompany.id,
        journey_id: formData.journey_id === "no-journey" || formData.journey_id === "" ? null : formData.journey_id,
        description: formData.description,
        amount: parseFloat(formData.amount),
        date: formData.date,
        payment_method: formData.payment_method,
        client: formData.client || null,
        invoice_number: formData.invoice_number || null,
        notes: formData.notes || null,
        status: formData.status,
        category: selectedCategory?.name || "Receita",
        category_id: formData.category_id || null,
        receipt_url: formData.receipt_url || null,
        account_id: formData.account_id || null,
      };

      if (editingRevenue) {
        const { error } = await supabase.from("revenue").update(revenueData).eq("id", editingRevenue.id);
        if (error) throw error;
        toast({ title: "Atualizado!" });
      } else {
        const { error } = await supabase.from("revenue").insert([revenueData]);
        if (error) throw error;
        toast({ title: "Criado!" });
      }

      setDialogOpen(false);
      resetForm();
      fetchRevenues();
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    if (id.startsWith("virtual-")) {
      toast({
        title: "Ação bloqueada",
        description: "Receitas virtuais não podem ser excluídas.",
        variant: "destructive",
      });
      return;
    }
    if (!confirm("Excluir receita?")) return;

    try {
      const { error } = await supabase.from("revenue").update({ deleted_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
      toast({ title: "Excluído" });
      fetchRevenues();
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    }
  };

  const handleQuickReceiveClick = (revenue: Revenue) => {
    setReceivingRevenue(revenue);
    setReceiptLink("");
  };

  const handleReceiptUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${currentCompany?.id}/receipts/${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from("finance").upload(fileName, file);
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from("finance").getPublicUrl(fileName);
      setReceiptLink(data.publicUrl);
      toast({ title: "Comprovante anexado!" });
    } catch (error) {
      console.error(error);
      toast({ title: "Erro no upload", variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  };

  const confirmQuickReceive = async () => {
    if (!receivingRevenue) return;
    try {
      const updateData: any = {
        status: "received",
        payment_date: new Date().toISOString().split("T")[0],
      };
      if (receiptLink) updateData.receipt_url = receiptLink;

      const { error } = await supabase.from("revenue").update(updateData).eq("id", receivingRevenue.id);
      if (error) throw error;

      toast({ title: "Recebimento confirmado!", className: "bg-green-600 text-white" });
      setReceivingRevenue(null);
      fetchRevenues();
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    }
  };

  const handleXMLUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    // Lógica de importação XML
  };

  const exportToCSV = () => {
    const headers = ["Data", "Descrição", "Categoria", "Cliente", "Valor", "Status"];
    const rows = filteredRevenues.map((r) => [
      format(new Date(r.date), "dd/MM/yyyy"),
      r.description,
      r.category,
      r.client || "",
      r.amount.toFixed(2).replace(".", ","),
      r.status === "received" ? "Recebido" : "Pendente",
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(";"), ...rows.map((e) => e.join(";"))].join("\n");
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", `receitas.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);
  const formatDateStr = (str: string) => (str ? new Date(str).toLocaleDateString("pt-BR", { timeZone: "UTC" }) : "-");

  const totalRevenue = useMemo(() => revenues.reduce((acc, curr) => acc + curr.amount, 0), [revenues]);
  const pendingRevenue = useMemo(
    () => revenues.filter((r) => r.status === "pending").reduce((acc, curr) => acc + curr.amount, 0),
    [revenues],
  );

  if (loading)
    return (
      <div className="p-8 flex justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Contas a Receber</h1>
          <p className="text-muted-foreground">Gerencie o fluxo de entrada</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 items-end sm:items-center">
          <div className="flex items-center gap-2 bg-white border rounded-md p-1 px-2 shadow-sm h-9">
            <ListFilter className="w-4 h-4 text-muted-foreground" />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[110px] h-7 text-xs border-none shadow-none focus:ring-0">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="received">Recebidos</SelectItem>
                <SelectItem value="pending">A Receber</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2 bg-white border rounded-md p-1 px-2 shadow-sm h-9">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <div className="flex items-center gap-1">
              <span className="text-xs text-muted-foreground">De:</span>
              <input
                type="date"
                className="text-xs outline-none bg-transparent w-24 md:w-auto"
                value={dateRange.from}
                onChange={(e) => setDateRange({ ...dateRange, from: e.target.value })}
              />
            </div>
            <div className="w-px h-4 bg-gray-300 mx-1"></div>
            <div className="flex items-center gap-1">
              <span className="text-xs text-muted-foreground">Até:</span>
              <input
                type="date"
                className="text-xs outline-none bg-transparent w-24 md:w-auto"
                value={dateRange.to}
                onChange={(e) => setDateRange({ ...dateRange, to: e.target.value })}
              />
            </div>

            {(dateRange.from || dateRange.to) && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 ml-1 hover:bg-gray-100 rounded-full"
                onClick={() => setDateRange({ from: "", to: "" })}
              >
                <X className="w-3 h-3 text-red-500" />
              </Button>
            )}
          </div>

          <div className="flex gap-2 w-full sm:w-auto">
            <Button variant="outline" onClick={exportToCSV} title="Exportar CSV">
              <Download className="w-4 h-4 mr-2" /> <span className="hidden md:inline">Exportar</span>
            </Button>

            <input type="file" accept=".xml" ref={fileInputRef} className="hidden" onChange={handleXMLUpload} />
            <Button variant="outline" className="border-dashed" onClick={() => fileInputRef.current?.click()}>
              <Upload className="w-4 h-4 md:mr-2" /> <span className="hidden md:inline">Importar XML</span>
            </Button>

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-gradient-primary shadow-primary whitespace-nowrap" onClick={resetForm}>
                  <Plus className="w-4 h-4 md:mr-2" /> <span className="hidden md:inline">Nova Receita</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>{editingRevenue ? "Editar" : "Nova"} Receita</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Descrição</Label>
                      <Input
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Valor</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={formData.amount}
                        onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Data de Vencimento</Label>
                      <Input
                        type="date"
                        value={formData.date}
                        onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Categoria</Label>
                      <Select
                        value={formData.category_id}
                        onValueChange={(val) => setFormData({ ...formData, category_id: val })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                        <SelectContent>
                          {revenueCategories.map((cat) => (
                            <SelectItem key={cat.id} value={cat.id}>
                              {cat.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* ADICIONADO: CAMPO STATUS NO FORMULÁRIO */}
                    <div className="space-y-2">
                      <Label>Status</Label>
                      <Select
                        value={formData.status}
                        onValueChange={(val) => setFormData({ ...formData, status: val as any })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">Pendente</SelectItem>
                          <SelectItem value="received">Recebido</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* CONTA DE DESTINO */}
                    <div className="space-y-2">
                      <Label>Conta de Destino</Label>
                      <Select
                        value={formData.account_id}
                        onValueChange={(val) => setFormData({ ...formData, account_id: val })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione a conta..." />
                        </SelectTrigger>
                        <SelectContent>
                          {accounts.map((acc) => (
                            <SelectItem key={acc.id} value={acc.id}>
                              {acc.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" type="button" onClick={() => setDialogOpen(false)}>
                      Cancelar
                    </Button>
                    <Button type="submit">Salvar</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total no Período</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalRevenue)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Recebido</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(totalRevenue - pendingRevenue)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pendente</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{formatCurrency(pendingRevenue)}</div>
          </CardContent>
        </Card>
      </div>

      {showConverter && (
        <JourneyRevenueConverter
          onConversionComplete={() => {
            fetchRevenues();
            checkForUnconvertedJourneys();
          }}
        />
      )}

      <Card className="shadow-card">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-center">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRevenues.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Nenhuma receita encontrada neste período/filtro.
                  </TableCell>
                </TableRow>
              ) : (
                filteredRevenues.map((revenue) => (
                  <TableRow key={revenue.id}>
                    <TableCell className="font-medium text-muted-foreground">{formatDateStr(revenue.date)}</TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">{revenue.description}</span>
                        <span className="text-xs text-muted-foreground">{revenue.client}</span>
                        {revenue.virtual && (
                          <Badge variant="outline" className="w-fit text-[10px] mt-1">
                            Automático
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {revenue.revenue_categories ? (
                        <CategoryBadge
                          name={revenue.revenue_categories.name}
                          icon={revenue.revenue_categories.icon}
                          color={revenue.revenue_categories.color}
                        />
                      ) : (
                        <span className="text-sm text-muted-foreground">{revenue.category}</span>
                      )}
                    </TableCell>
                    <TableCell className="font-bold text-green-700">{formatCurrency(revenue.amount)}</TableCell>
                    <TableCell>
                      {revenue.status === "received" ? (
                        <Badge className="bg-green-100 text-green-800 hover:bg-green-200">Recebido</Badge>
                      ) : (
                        <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-200">Pendente</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center gap-2">
                        {revenue.status === "pending" && !revenue.virtual && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50"
                            onClick={() => handleQuickReceiveClick(revenue)}
                            title="Marcar como Recebido"
                          >
                            <CheckCircle2 className="w-5 h-5" />
                          </Button>
                        )}

                        {revenue.receipt_url && (
                          <a href={revenue.receipt_url} target="_blank" rel="noreferrer">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-blue-600 hover:bg-blue-50"
                              title="Ver Comprovante"
                            >
                              <FileText className="w-4 h-4" />
                            </Button>
                          </a>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground"
                          onClick={() => {
                            setEditingRevenue(revenue);
                            setFormData({
                              ...formData,
                              description: revenue.description,
                              amount: revenue.amount.toString(),
                              date: revenue.date,
                              status: revenue.status, // CARREGA STATUS CORRETO NA EDIÇÃO
                              category_id: revenue.category_id || "",
                            });
                            setDialogOpen(true);
                          }}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-red-400 hover:text-red-600 hover:bg-red-50"
                          onClick={() => handleDelete(revenue.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!receivingRevenue} onOpenChange={(open) => !open && setReceivingRevenue(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Recebimento</DialogTitle>
            <DialogDescription>
              Deseja dar baixa em <strong>{receivingRevenue?.description}</strong> no valor de{" "}
              <strong>{receivingRevenue && formatCurrency(receivingRevenue.amount)}</strong>?
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                className="w-full border-dashed flex gap-2"
                onClick={() => receiptInputRef.current?.click()}
                disabled={isUploading}
              >
                {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                {receiptLink ? "Comprovante Anexado!" : "Deseja anexar um anexo?"}
              </Button>
              <input
                type="file"
                ref={receiptInputRef}
                className="hidden"
                onChange={handleReceiptUpload}
                accept="image/*,.pdf"
              />
            </div>
            {receiptLink && (
              <p className="text-xs text-green-600 text-center flex items-center justify-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Anexo pronto para salvar
              </p>
            )}
          </div>
          <DialogFooter className="flex gap-2 sm:justify-between">
            <Button variant="ghost" onClick={() => setReceivingRevenue(null)}>
              Cancelar
            </Button>

            <Button
              variant={receiptLink ? "default" : "outline"}
              className={receiptLink ? "bg-green-600 hover:bg-green-700 text-white" : ""}
              onClick={confirmQuickReceive}
              disabled={isUploading}
            >
              {isUploading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {receiptLink ? "Salvar" : "Salvar sem Anexo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
