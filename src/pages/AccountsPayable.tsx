import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useMultiTenant } from "@/hooks/useMultiTenant";
import { useExpenseCategories } from "@/hooks/useExpenseCategories";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Edit,
  Trash2,
  Barcode,
  Upload,
  Loader2,
  CheckCircle2,
  Search,
  FileText,
  User,
  Car,
  UploadCloud,
  FileCode,
  Repeat,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  XCircle,
  Download,
  Paperclip,
  Link2,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { CategoryBadge } from "@/components/categories/CategoryBadge";
import { parseISO, addMonths, addWeeks, format } from "date-fns";
import { PartySelector } from "@/components/parties/PartySelector";
import { type Party } from "@/hooks/useParties";

// --- TIPOS ---
interface AccountPayable {
  id: string;
  description: string;
  amount: number;
  due_date: string;
  payment_date: string | null;
  supplier: string | null;
  supplier_id: string | null;
  category: string;
  category_id: string | null;
  invoice_number?: string | null;
  driver_id?: string | null;
  driver_name?: string | null;
  status: "pending" | "paid" | "overdue" | "cancelled";
  payment_method: string | null;
  notes: string | null;
  attachment_url?: string | null;
  invoice_url?: string | null;
  receipt_url?: string | null;
  expense_id?: string | null;
  expense_categories?: { id: string; name: string; icon: string; color: string; classification: string };
  parties?: { id: string; name: string } | null;
}

interface ReportHistory {
  id: string;
  created_at: string;
  report_type: string;
  filters_summary: string;
}

interface Driver {
  id: string;
  name: string;
}

type FormState = {
  description: string;
  amount: string;
  due_date: string;
  payment_date: string;
  supplier: string;
  supplier_id: string;
  category_id: string;
  invoice_number: string;
  driver_id: string;
  status: "pending" | "paid" | "cancelled";
  payment_method: string;
  notes: string;
  attachment_url: string;
  receipt_url: string;
  invoice_url: string;
};

// --- FUNÇÕES AUXILIARES ---
const isOverdue = (dueDate: string, status: any) => {
  if (status === "paid" || status === "cancelled") return false;
  if (status === "overdue") return true;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  due.setHours(due.getHours() + 3);
  return due < today;
};
const getStatusColor = (status: any, dueDate: string) => {
  if (status === "paid") return "border-green-500/40 text-green-700 bg-green-50";
  if (status === "cancelled") return "border-gray-400/40 text-gray-600 bg-gray-50";
  if (isOverdue(dueDate, status)) return "border-red-500/40 text-red-700 bg-red-50";
  return "border-yellow-500/40 text-yellow-700 bg-yellow-50";
};
const getStatusText = (status: any, dueDate: string) => {
  if (status === "paid") return "Pago";
  if (status === "cancelled") return "Cancelado";
  if (isOverdue(dueDate, status)) return "Vencido";
  return "Pendente";
};
const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value ?? 0);
const formatDate = (dateString: string) => {
  if (!dateString) return "-";
  const date = new Date(dateString);
  date.setMinutes(date.getMinutes() + date.getTimezoneOffset());
  return date.toLocaleDateString("pt-BR");
};
const parseAmount = (raw: string) => {
  const normalized = raw.toString().replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
  return parseFloat(normalized);
};
const formatAmountForInput = (value: number | string): string => {
  if (!value && value !== 0) return "";
  const numValue = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(numValue)) return "";
  return numValue.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export default function AccountsPayable() {
  const { user } = useAuth();
  const { currentCompany } = useMultiTenant();
  const { toast } = useToast();
  const { data: expenseCategories = [] } = useExpenseCategories(undefined, true);

  // --- ESTADOS DE DADOS ---
  const [accountsPayable, setAccountsPayable] = useState<AccountPayable[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);

  // Totais calculados separadamente
  const [summaryTotals, setSummaryTotals] = useState({ pending: 0, overdue: 0, paid: 0 });

  // --- PAGINAÇÃO ---
  const [page, setPage] = useState(1);
  const itemsPerPage = 10;
  const [totalCount, setTotalCount] = useState(0);

  // --- FILTROS (VISUALIZAÇÃO DA TELA) ---
  const currentYear = new Date().getFullYear().toString();
  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().getMonth().toString());
  const [selectedYear, setSelectedYear] = useState<string>(currentYear);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterDocType, setFilterDocType] = useState<string>("all");
  const [filterDriver, setFilterDriver] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");

  // --- UI STATES ---
  const [dialogOpen, setDialogOpen] = useState(false);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<AccountPayable | null>(null);
  const [saving, setSaving] = useState(false);

  // --- PAGAMENTO STATE ---
  const [accountToPay, setAccountToPay] = useState<AccountPayable | null>(null);
  const [paymentFile, setPaymentFile] = useState<File | null>(null);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  // --- RELATÓRIOS & UPLOAD ---
  const [reportTab, setReportTab] = useState("new");
  const [reportHistory, setReportHistory] = useState<ReportHistory[]>([]);
  const [reportFilters, setReportFilters] = useState({
    startDate: "",
    endDate: "",
    status: "all",
    driverId: "all",
    categoryId: "all",
    includeDetails: true,
  });

  const [isRecurrent, setIsRecurrent] = useState(false);
  const [recurrenceCount, setRecurrenceCount] = useState("2");
  const [recurrenceFrequency, setRecurrenceFrequency] = useState<"monthly" | "weekly">("monthly");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadingRowId, setUploadingRowId] = useState<string | null>(null);
  const boletoRowRef = useRef<HTMLInputElement>(null);
  const xmlRowRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState<FormState>({
    description: "",
    amount: "",
    due_date: "",
    payment_date: "",
    supplier: "",
    supplier_id: "",
    category_id: "",
    invoice_number: "",
    driver_id: "",
    status: "pending",
    payment_method: "",
    notes: "",
    attachment_url: "",
    receipt_url: "",
    invoice_url: "",
  });

  // --- USE EFFECTS ---
  useEffect(() => {
    if (currentCompany?.id) {
      fetchDrivers();
      fetchReportHistory();
    }
  }, [currentCompany?.id]);

  useEffect(() => {
    if (currentCompany?.id) {
      fetchAccountsPayable();
      fetchFinancialSummary();
    }
  }, [
    currentCompany?.id,
    page,
    selectedMonth,
    selectedYear,
    searchTerm,
    filterStatus,
    filterDriver,
    filterCategory,
    filterDocType,
  ]);

  const fetchDrivers = async () => {
    const { data } = await supabase.from("drivers").select("id, name").eq("company_id", currentCompany?.id);
    if (data) setDrivers(data);
  };

  const fetchReportHistory = async () => {
    // CORREÇÃO AQUI: (supabase as any)
    const { data } = await (supabase as any)
      .from("report_history")
      .select("*")
      .eq("company_id", currentCompany?.id)
      .order("created_at", { ascending: false })
      .limit(5);
    if (data) setReportHistory(data as ReportHistory[]);
  };

  // --- BUSCAS DE DADOS ---
  const fetchAccountsPayable = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from("accounts_payable")
        .select(`*, expense_categories (id, name, icon, color), drivers (name)`, { count: "exact" })
        .eq("company_id", currentCompany?.id)
        .is("deleted_at", null);

      if (selectedMonth !== "all" && selectedYear !== "all") {
        const start = new Date(parseInt(selectedYear), parseInt(selectedMonth), 1).toISOString();
        const end = new Date(parseInt(selectedYear), parseInt(selectedMonth) + 1, 0).toISOString();
        query = query.gte("due_date", start).lte("due_date", end);
      }
      if (searchTerm)
        query = query.or(
          `description.ilike.%${searchTerm}%,invoice_number.ilike.%${searchTerm}%,supplier.ilike.%${searchTerm}%`,
        );

      if (filterStatus !== "all") {
        if (filterStatus === "overdue") {
          const today = new Date().toISOString().split("T")[0];
          query = query.lt("due_date", today).neq("status", "paid").neq("status", "cancelled");
        } else {
          query = query.eq("status", filterStatus);
        }
      }
      if (filterDriver !== "all") query = query.eq("driver_id", filterDriver);
      if (filterCategory !== "all") query = query.eq("category_id", filterCategory);
      if (filterDocType !== "all") {
        if (filterDocType === "pending_docs") query = query.is("invoice_url", null).is("receipt_url", null);
      }

      const from = (page - 1) * itemsPerPage;
      const to = from + itemsPerPage - 1;

      const { data, error, count } = await query.order("due_date", { ascending: true }).range(from, to);
      if (error) throw error;

      setAccountsPayable(
        (data?.map((item: any) => ({ ...item, driver_name: item.drivers?.name })) || []) as unknown as AccountPayable[],
      );
      setTotalCount(count || 0);
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const fetchFinancialSummary = async () => {
    let query = supabase
      .from("accounts_payable")
      .select("amount, status, due_date")
      .eq("company_id", currentCompany?.id)
      .is("deleted_at", null);
    if (selectedMonth !== "all" && selectedYear !== "all") {
      const start = new Date(parseInt(selectedYear), parseInt(selectedMonth), 1).toISOString();
      const end = new Date(parseInt(selectedYear), parseInt(selectedMonth) + 1, 0).toISOString();
      query = query.gte("due_date", start).lte("due_date", end);
    }
    if (filterDriver !== "all") query = query.eq("driver_id", filterDriver);
    if (filterCategory !== "all") query = query.eq("category_id", filterCategory);

    const { data } = await query;
    if (!data) return;
    const totals = { pending: 0, overdue: 0, paid: 0 };
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    data.forEach((item: any) => {
      const dueDate = new Date(item.due_date);
      dueDate.setHours(dueDate.getHours() + 3);
      const isItemOverdue = item.status !== "paid" && item.status !== "cancelled" && dueDate < today;
      if (item.status === "paid") totals.paid += item.amount;
      else if (isItemOverdue || item.status === "overdue") totals.overdue += item.amount;
      else if (item.status === "pending") totals.pending += item.amount;
    });
    setSummaryTotals(totals);
  };

  const handleInitiatePayment = (account: AccountPayable) => {
    setAccountToPay(account);
    setPaymentFile(null);
    setPaymentModalOpen(true);
  };
  const handleConfirmPayment = async () => {
    if (!accountToPay) return;
    setIsProcessingPayment(true);
    try {
      let receiptUrl = null;
      if (paymentFile) {
        const fileExt = paymentFile.name.split(".").pop();
        const fileName = `${currentCompany?.id}/${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage.from("finance").upload(fileName, paymentFile);
        if (uploadError) throw uploadError;
        const { data } = supabase.storage.from("finance").getPublicUrl(fileName);
        receiptUrl = data.publicUrl;
      }
      const updateData: any = { status: "paid", payment_date: new Date().toISOString().split("T")[0] };
      if (receiptUrl) updateData.receipt_url = receiptUrl;
      await supabase.from("accounts_payable").update(updateData).eq("id", accountToPay.id);
      
      // Sincronização bidirecional: atualizar status da despesa vinculada
      if (accountToPay.expense_id) {
        await supabase
          .from("expenses")
          .update({ payment_status: "paid" })
          .eq("id", accountToPay.expense_id);
      }
      
      toast({ title: "Pago!", className: "bg-green-600 text-white" });
      setPaymentModalOpen(false);
      fetchAccountsPayable();
      fetchFinancialSummary();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setIsProcessingPayment(false);
    }
  };
  const handleUndoPayment = async (account: AccountPayable) => {
    if (!confirm(`Estornar pagamento?`)) return;
    try {
      await supabase.from("accounts_payable").update({ status: "pending", payment_date: null }).eq("id", account.id);
      
      // Sincronização bidirecional: reverter status da despesa vinculada
      if (account.expense_id) {
        await supabase
          .from("expenses")
          .update({ payment_status: "pending" })
          .eq("id", account.expense_id);
      }
      
      toast({ title: "Estornado", className: "bg-yellow-600 text-white" });
      fetchAccountsPayable();
      fetchFinancialSummary();
    } catch {
      toast({ title: "Erro", variant: "destructive" });
    }
  };

  const handleGenerateReport = async () => {
    setLoading(true);
    let query = supabase
      .from("accounts_payable")
      .select(`*, expense_categories(name), drivers(name)`)
      .eq("company_id", currentCompany?.id)
      .is("deleted_at", null);

    if (reportFilters.startDate) query = query.gte("due_date", reportFilters.startDate);
    if (reportFilters.endDate) query = query.lte("due_date", reportFilters.endDate);
    if (reportFilters.status !== "all") {
      if (reportFilters.status === "pending") query = query.neq("status", "paid");
      else query = query.eq("status", reportFilters.status);
    }
    if (reportFilters.driverId !== "all") query = query.eq("driver_id", reportFilters.driverId);
    if (reportFilters.categoryId !== "all") query = query.eq("category_id", reportFilters.categoryId);

    const { data: reportData } = await query.order("due_date", { ascending: true });

    if (!reportData || reportData.length === 0) {
      toast({ title: "Sem dados", description: "Nenhum registro encontrado para este período/filtro." });
      setLoading(false);
      return;
    }

    const headers = [
      "Vencimento",
      "Descrição",
      "Fornecedor",
      "Categoria",
      "Motorista",
      "Valor",
      "Status",
      "Nº Nota",
      "Link Anexo",
    ];
    const csvRows = reportData.map((i: any) => [
      format(parseISO(i.due_date), "dd/MM/yyyy"),
      `"${i.description}"`,
      `"${i.supplier || ""}"`,
      `"${i.expense_categories?.name || "Outros"}"`,
      `"${i.drivers?.name || "-"}"`,
      i.amount.toString().replace(".", ","),
      i.status === "paid" ? "Pago" : "Pendente",
      `"${i.invoice_number || ""}"`,
      reportFilters.includeDetails ? i.invoice_url || i.attachment_url || "" : "",
    ]);

    const csvContent = "\uFEFF" + [headers.join(";"), ...csvRows.map((r) => r.join(";"))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `Relatorio_Financeiro_${format(new Date(), "dd-MM-yyyy")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // CORREÇÃO AQUI: (supabase as any)
    const summary = `${reportFilters.status === "all" ? "Geral" : reportFilters.status} | Cat: ${reportFilters.categoryId === "all" ? "Todas" : "Filtrada"}`;
    await (supabase as any).from("report_history").insert({
      company_id: currentCompany?.id,
      user_id: user?.id,
      report_type: "financeiro_personalizado",
      filters_summary: summary,
    });

    setLoading(false);
    setReportModalOpen(false);
    toast({ title: "Gerado com sucesso!" });
  };

  const uploadToStorage = async (file: File) => {
    const fileExt = file.name.split(".").pop();
    const fileName = `${currentCompany?.id}/${Date.now()}.${fileExt}`;
    await supabase.storage.from("finance").upload(fileName, file);
    const { data } = supabase.storage.from("finance").getPublicUrl(fileName);
    return data.publicUrl;
  };

  const handleRowUpload = async (event: React.ChangeEvent<HTMLInputElement>, type: "boleto" | "invoice") => {
    const file = event.target.files?.[0];
    if (!file || !uploadingRowId) return;
    if (type === "boleto" && file.name.toLowerCase().endsWith(".xml"))
      return toast({ title: "Erro", description: "Boleto não aceita arquivo XML. Use o botão Danfe/XML.", variant: "destructive" });
    setIsUploading(true);
    try {
      const url = await uploadToStorage(file);
      const updateField = type === "boleto" ? "attachment_url" : "invoice_url";
      await supabase
        .from("accounts_payable")
        .update({ [updateField]: url } as any)
        .eq("id", uploadingRowId);
      toast({ title: "Enviado!" });
      fetchAccountsPayable();
    } catch {
      toast({ title: "Erro", variant: "destructive" });
    }
    setIsUploading(false);
    setUploadingRowId(null);
    event.target.value = "";
  };

  const triggerRowUpload = (id: string, type: "boleto" | "invoice") => {
    setUploadingRowId(id);
    setTimeout(() => {
      if (type === "boleto") boletoRowRef.current?.click();
      else xmlRowRef.current?.click();
    }, 50);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir?")) return;
    await supabase.from("accounts_payable").delete().eq("id", id);
    fetchAccountsPayable();
    fetchFinancialSummary();
  };

  const handleModalUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: string) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const url = await uploadToStorage(file);
      setFormData((p) => ({ ...p, [field]: url }));
      toast({ title: "Anexado" });
    } catch {
      toast({ title: "Erro", variant: "destructive" });
    }
    setIsUploading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      const parsedAmount = parseAmount(formData.amount);
      const payload = {
        user_id: user?.id,
        description: formData.description,
        amount: parsedAmount,
        due_date: formData.due_date,
        payment_date: formData.payment_date || null,
        supplier: formData.supplier || null,
        supplier_id: formData.supplier_id || null,
        category: expenseCategories.find((c) => c.id === formData.category_id)?.name || "Outros",
        category_id: formData.category_id || null,
        invoice_number: formData.invoice_number || null,
        driver_id: formData.driver_id === "none" || !formData.driver_id ? null : formData.driver_id,
        status: formData.status,
        payment_method: formData.payment_method || null,
        notes: formData.notes || null,
        attachment_url: formData.attachment_url || null,
        receipt_url: formData.receipt_url || null,
        invoice_url: formData.invoice_url || null,
        company_id: currentCompany?.id,
      };

      if (editingAccount) {
        await supabase.from("accounts_payable").update(payload).eq("id", editingAccount.id);
      } else if (isRecurrent && parseInt(recurrenceCount) > 1) {
        const payloads = [];
        for (let i = 0; i < parseInt(recurrenceCount); i++) {
          const nextDate =
            recurrenceFrequency === "weekly"
              ? addWeeks(parseISO(formData.due_date), i)
              : addMonths(parseISO(formData.due_date), i);
          payloads.push({
            ...payload,
            due_date: nextDate.toISOString().split("T")[0],
            description: `${formData.description} (${i + 1}/${recurrenceCount})`,
          });
        }
        await supabase.from("accounts_payable").insert(payloads);
      } else {
        await supabase.from("accounts_payable").insert([payload]);
      }
      toast({ title: "Salvo!" });
      setDialogOpen(false);
      fetchAccountsPayable();
      fetchFinancialSummary();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
    setSaving(false);
  };

  const handleEdit = (acc: AccountPayable) => {
    setEditingAccount(acc);
    setFormData({
      description: acc.description,
      amount: formatAmountForInput(acc.amount),
      due_date: acc.due_date,
      payment_date: acc.payment_date || "",
      supplier: acc.supplier || "",
      supplier_id: acc.supplier_id || "",
      category_id: acc.category_id || "",
      invoice_number: acc.invoice_number || "",
      driver_id: acc.driver_id || "",
      status: acc.status as any,
      payment_method: acc.payment_method || "",
      notes: acc.notes || "",
      attachment_url: acc.attachment_url || "",
      receipt_url: acc.receipt_url || "",
      invoice_url: acc.invoice_url || "",
    });
    setDialogOpen(true);
  };
  const resetForm = () => {
    setFormData({
      description: "",
      amount: "",
      due_date: "",
      payment_date: "",
      supplier: "",
      supplier_id: "",
      category_id: "",
      invoice_number: "",
      driver_id: "",
      status: "pending",
      payment_method: "",
      notes: "",
      attachment_url: "",
      receipt_url: "",
      invoice_url: "",
    });
    setEditingAccount(null);
    setIsRecurrent(false);
  };

  const months = [
    "Janeiro",
    "Fevereiro",
    "Março",
    "Abril",
    "Maio",
    "Junho",
    "Julho",
    "Agosto",
    "Setembro",
    "Outubro",
    "Novembro",
    "Dezembro",
  ];
  const years = Array.from({ length: 5 }, (_, i) => (parseInt(currentYear) - 2 + i).toString());
  const totalPages = Math.ceil(totalCount / itemsPerPage);

  return (
    <div className="p-6 space-y-6 bg-background/50">
      <input
        type="file"
        ref={boletoRowRef}
        className="hidden"
        onChange={(e) => handleRowUpload(e, "boleto")}
        accept=".pdf,.jpg,.png,.jpeg"
      />
      <input
        type="file"
        ref={xmlRowRef}
        className="hidden"
        onChange={(e) => handleRowUpload(e, "invoice")}
        accept=".xml,.pdf,.jpg,.png,.jpeg"
      />

      {/* HEADER */}
      <div className="flex flex-col lg:flex-row justify-between gap-4 items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Financeiro Geral</h1>
          <p className="text-sm text-muted-foreground">Contas a pagar, despesas fixas e frota.</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            className="bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200"
            onClick={() => setImportDialogOpen(true)}
          >
            <UploadCloud className="w-4 h-4 mr-2" /> Importar
          </Button>

          {/* BOTÃO DE RELATÓRIOS */}
          <Dialog open={reportModalOpen} onOpenChange={setReportModalOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <FileSpreadsheet className="w-4 h-4 mr-2" /> Relatórios
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Central de Relatórios</DialogTitle>
              </DialogHeader>
              <Tabs value={reportTab} onValueChange={setReportTab} className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="new">Novo Relatório</TabsTrigger>
                  <TabsTrigger value="history">Histórico</TabsTrigger>
                </TabsList>

                {/* CONTEÚDO NOVO: FILTROS DE RELATÓRIO */}
                <TabsContent value="new" className="space-y-6 py-4 px-1">
                  <div className="space-y-3">
                    <h3 className="text-sm font-medium text-muted-foreground border-b pb-1">1. Período de Análise</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Data Início</Label>
                        <Input
                          type="date"
                          value={reportFilters.startDate}
                          onChange={(e) => setReportFilters((p) => ({ ...p, startDate: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Data Fim</Label>
                        <Input
                          type="date"
                          value={reportFilters.endDate}
                          onChange={(e) => setReportFilters((p) => ({ ...p, endDate: e.target.value }))}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <h3 className="text-sm font-medium text-muted-foreground border-b pb-1">2. Filtrar Lançamentos</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Categoria</Label>
                        <Select
                          value={reportFilters.categoryId}
                          onValueChange={(v) => setReportFilters((p) => ({ ...p, categoryId: v }))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Todas" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Todas</SelectItem>
                            {expenseCategories.map((c) => (
                              <SelectItem key={c.id} value={c.id}>
                                {c.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Status</Label>
                        <Select
                          value={reportFilters.status}
                          onValueChange={(v) => setReportFilters((p) => ({ ...p, status: v }))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Todos</SelectItem>
                            <SelectItem value="paid">Pagos</SelectItem>
                            <SelectItem value="pending">Pendentes</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Vincular Motorista</Label>
                        <Select
                          value={reportFilters.driverId}
                          onValueChange={(v) => setReportFilters((p) => ({ ...p, driverId: v }))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Geral (Todos)</SelectItem>
                            {drivers.map((d) => (
                              <SelectItem key={d.id} value={d.id}>
                                {d.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-3 bg-muted/30 p-3 rounded-lg border">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="details"
                        checked={reportFilters.includeDetails}
                        onCheckedChange={(c) => setReportFilters((p) => ({ ...p, includeDetails: !!c }))}
                      />
                      <Label htmlFor="details" className="text-sm font-normal cursor-pointer">
                        Incluir links para download dos anexos (XML/Boleto)
                      </Label>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button onClick={handleGenerateReport} disabled={loading} className="w-full sm:w-auto">
                      {loading ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      ) : (
                        <Download className="w-4 h-4 mr-2" />
                      )}{" "}
                      Gerar Relatório CSV
                    </Button>
                  </DialogFooter>
                </TabsContent>

                <TabsContent value="history" className="py-4">
                  {reportHistory.length === 0 ? (
                    <div className="text-center text-muted-foreground">Vazio</div>
                  ) : (
                    <div className="space-y-2">
                      {reportHistory.map((h) => (
                        <div key={h.id} className="flex justify-between p-3 border rounded bg-muted/20">
                          <div>
                            <p className="text-sm font-medium">Relatório</p>
                            <p className="text-xs text-muted-foreground">
                              {format(parseISO(h.created_at), "dd/MM HH:mm")} • {h.filters_summary}
                            </p>
                          </div>
                          <Badge variant="outline">Gerado</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </DialogContent>
          </Dialog>

          <Button
            onClick={() => {
              resetForm();
              setDialogOpen(true);
            }}
          >
            <Plus className="w-4 h-4 mr-2" /> Novo Lançamento
          </Button>
        </div>
      </div>

      {/* FILTROS E BUSCA */}
      <Card className="p-4 shadow-sm border rounded-xl">
        <div className="flex flex-col md:flex-row gap-4 items-center">
          <div className="flex-1 w-full relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por descrição, fornecedor ou Nº Nota..."
              className="pl-10 h-10 rounded-lg"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-[140px] h-10 rounded-lg">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {months.map((m, i) => (
                  <SelectItem key={i} value={i.toString()}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger className="w-[100px] h-10 rounded-lg">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map((y) => (
                  <SelectItem key={y} value={y}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex flex-wrap gap-4 items-end mt-6">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground font-medium">Categoria</Label>
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="h-9 w-[160px] text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {expenseCategories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground font-medium">Motorista (Frota)</Label>
            <Select value={filterDriver} onValueChange={setFilterDriver}>
              <SelectTrigger className="h-9 w-[160px] text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos / Geral</SelectItem>
                {drivers.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground font-medium">Situação</Label>
            <div className="flex bg-muted/50 rounded-lg p-1 h-9 items-center border">
              {["all", "pending", "paid", "overdue"].map((st) => (
                <button
                  key={st}
                  onClick={() => setFilterStatus(st)}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${filterStatus === st ? "bg-white shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                >
                  {st === "all" ? "Todos" : st === "pending" ? "Aberto" : st === "paid" ? "Pago" : "Vencido"}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {/* CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="shadow-sm border rounded-xl bg-background">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">A Pagar</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold tracking-tight">{formatCurrency(summaryTotals.pending)}</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm border rounded-xl bg-background border-red-100">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-red-600/80">Vencido</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold tracking-tight text-red-600">{formatCurrency(summaryTotals.overdue)}</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm border rounded-xl bg-background border-green-100">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-green-600/80">Pago</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold tracking-tight text-green-600">{formatCurrency(summaryTotals.paid)}</p>
          </CardContent>
        </Card>
      </div>

      {/* TABELA */}
      <Card className="shadow-sm border rounded-xl overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30 border-b">
                <TableHead className="w-[120px]">Vencimento</TableHead>
                <TableHead>Fornecedor / Descrição</TableHead>
                <TableHead>Detalhes / Categoria</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Docs</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-32 text-center">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : accountsPayable.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
                    Nenhum lançamento encontrado.
                  </TableCell>
                </TableRow>
              ) : (
                accountsPayable.map((acc) => (
                  <TableRow key={acc.id} className="hover:bg-muted/20 transition-colors">
                    <TableCell className="font-medium text-sm text-muted-foreground">
                      {format(parseISO(acc.due_date), "dd/MM/yyyy")}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-sm text-foreground">{acc.supplier || acc.description}</span>
                          {acc.expense_id && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger>
                                  <div className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/30">
                                    <Link2 className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                  Vinculado a uma despesa
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </div>
                        {acc.supplier && <span className="text-xs text-muted-foreground">{acc.description}</span>}
                        {acc.invoice_number && (
                          <span className="text-[10px] text-muted-foreground font-mono">NF: {acc.invoice_number}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1 items-start">
                        {acc.expense_categories ? (
                          <CategoryBadge
                            name={acc.expense_categories.name}
                            icon={acc.expense_categories.icon}
                            color={acc.expense_categories.color}
                            showClassification={false}
                          />
                        ) : (
                          <Badge variant="outline" className="text-[10px]">
                            {acc.category}
                          </Badge>
                        )}
                        {acc.driver_name && (
                          <div className="flex items-center gap-1 text-[10px] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-full border border-blue-100">
                            <User className="w-3 h-3" /> {acc.driver_name}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="font-bold text-sm">{formatCurrency(acc.amount)}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        {acc.attachment_url ? (
                          <a
                            href={acc.attachment_url}
                            target="_blank"
                            className="flex items-center gap-1 px-2 py-1 rounded-md border text-xs bg-gray-50 hover:bg-gray-100 transition-colors"
                            title="Ver Boleto"
                          >
                            <Barcode className="w-3 h-3" /> Boleto
                          </a>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-[10px] border-dashed px-2"
                            onClick={() => triggerRowUpload(acc.id, "boleto")}
                          >
                            <Upload className="w-3 h-3 mr-1" /> Boleto
                          </Button>
                        )}
                        {acc.invoice_url ? (
                          <a
                            href={acc.invoice_url}
                            target="_blank"
                            className="flex items-center gap-1 px-2 py-1 rounded-md border text-xs bg-gray-50 hover:bg-gray-100 transition-colors"
                            title="Ver XML"
                          >
                            <FileCode className="w-3 h-3" /> Danfe/XML
                          </a>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-[10px] border-dashed px-2"
                            onClick={() => triggerRowUpload(acc.id, "invoice")}
                          >
                            <Upload className="w-3 h-3 mr-1" /> Danfe/XML
                          </Button>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(acc.status, acc.due_date)} variant="outline">
                        {getStatusText(acc.status, acc.due_date)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1 opacity-70 hover:opacity-100 transition-opacity">
                        {acc.status !== "paid" ? (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-green-600 hover:bg-green-50"
                            onClick={() => handleInitiatePayment(acc)}
                          >
                            <CheckCircle2 className="w-4 h-4" />
                          </Button>
                        ) : (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-yellow-600 hover:bg-yellow-50"
                            onClick={() => handleUndoPayment(acc)}
                          >
                            <XCircle className="w-4 h-4" />
                          </Button>
                        )}
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleEdit(acc)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-red-500 hover:bg-red-50"
                          onClick={() => handleDelete(acc.id)}
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
          <div className="flex items-center justify-between px-4 py-4 border-t bg-muted/20">
            <div className="text-xs text-muted-foreground">
              Mostrando {Math.min(itemsPerPage * page, totalCount)} de {totalCount}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                <ChevronLeft className="w-4 h-4" /> Ant
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
              >
                Prox <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* DIALOG FORM */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingAccount ? "Editar" : "Novo"} Lançamento</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-6 pt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Descrição</Label>
                <Input
                  placeholder="Ex: Conta de Luz"
                  value={formData.description}
                  onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Categoria</Label>
                <Select
                  value={formData.category_id}
                  onValueChange={(v) => setFormData((p) => ({ ...p, category_id: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {expenseCategories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Valor (R$)</Label>
                <Input
                  value={formData.amount}
                  onChange={(e) => setFormData((p) => ({ ...p, amount: e.target.value.replace(/[^\d.,]/g, "") }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Vencimento</Label>
                <Input
                  type="date"
                  value={formData.due_date}
                  onChange={(e) => setFormData((p) => ({ ...p, due_date: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Fornecedor (Opcional)</Label>
                <PartySelector
                  type="supplier"
                  value={formData.supplier_id || undefined}
                  onChange={(id, party) => setFormData((p) => ({ 
                    ...p, 
                    supplier_id: id || "",
                    supplier: party?.name || p.supplier
                  }))}
                  placeholder="Selecione o fornecedor (opcional)"
                  allowCreate
                  onCreateNew={() => window.open('/parties?tab=supplier', '_blank')}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 p-4 bg-muted/30 rounded-lg border">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-muted-foreground" /> Nº Nota Fiscal
                </Label>
                <Input
                  placeholder="Ex: 123456"
                  value={formData.invoice_number}
                  onChange={(e) => setFormData((p) => ({ ...p, invoice_number: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Car className="w-4 h-4 text-muted-foreground" /> Vincular a Veículo/Motorista?
                </Label>
                <Select
                  value={formData.driver_id || "none"}
                  onValueChange={(v) => setFormData((p) => ({ ...p, driver_id: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Não vinculado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum (Despesa Geral)</SelectItem>
                    {drivers.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* RECORRÊNCIA CORRIGIDA */}
            {!editingAccount && (
              <div className="flex flex-col gap-3 p-3 bg-blue-50/50 rounded-lg border border-blue-100">
                <div className="flex items-center gap-2">
                  <Checkbox id="rec" checked={isRecurrent} onCheckedChange={(c: any) => setIsRecurrent(!!c)} />
                  <Label htmlFor="rec" className="cursor-pointer font-medium text-blue-800">
                    Repetir lançamento?
                  </Label>
                </div>
                {isRecurrent && (
                  <div className="flex gap-4 pl-6 animate-in slide-in-from-top-1">
                    <div className="space-y-1 w-32">
                      <Label className="text-xs text-muted-foreground">Frequência</Label>
                      <Select value={recurrenceFrequency} onValueChange={(v: any) => setRecurrenceFrequency(v)}>
                        <SelectTrigger className="h-8 bg-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="monthly">Mensal</SelectItem>
                          <SelectItem value="weekly">Semanal</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1 w-24">
                      <Label className="text-xs text-muted-foreground">Quantidade</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          value={recurrenceCount}
                          onChange={(e) => setRecurrenceCount(e.target.value)}
                          className="h-8 bg-white"
                        />
                        <span className="text-xs text-muted-foreground">vezes</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-3 pt-2">
              <Label>Anexos</Label>
              <div className="grid grid-cols-2 gap-4">
                <div className="border rounded-lg p-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Barcode className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">Boleto</span>
                  </div>
                  <div className="flex gap-2 items-center">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => document.getElementById("f-boleto")?.click()}
                    >
                      Upload
                    </Button>
                    <span className="text-xs text-muted-foreground">{formData.attachment_url ? "Anexado" : ""}</span>
                    <Input
                      id="f-boleto"
                      type="file"
                      className="hidden"
                      onChange={(e) => handleModalUpload(e, "attachment_url")}
                    />
                  </div>
                </div>
                <div className="border rounded-lg p-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileCode className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">XML / Nota</span>
                  </div>
                  <div className="flex gap-2 items-center">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => document.getElementById("f-xml")?.click()}
                    >
                      Upload
                    </Button>
                    <span className="text-xs text-muted-foreground">{formData.invoice_url ? "Anexado" : ""}</span>
                    <Input
                      id="f-xml"
                      type="file"
                      className="hidden"
                      onChange={(e) => handleModalUpload(e, "invoice_url")}
                      accept=".xml"
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="pt-4 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving || isUploading}>
                Salvar
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* DIALOG PAGAMENTO */}
      <Dialog open={paymentModalOpen} onOpenChange={setPaymentModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmar Pagamento</DialogTitle>
            <DialogDescription>
              Deseja anexar o comprovante para <strong>{accountToPay?.description}</strong>?
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div
              className="flex flex-col gap-2 items-center justify-center border-2 border-dashed rounded-lg p-6 hover:bg-muted/50 transition-colors cursor-pointer"
              onClick={() => document.getElementById("payment-receipt")?.click()}
            >
              {paymentFile ? (
                <>
                  <FileText className="h-8 w-8 text-green-600" />
                  <span className="text-sm font-medium text-green-600">{paymentFile.name}</span>
                </>
              ) : (
                <>
                  <Paperclip className="h-8 w-8 text-muted-foreground" />
                  <span className="text-sm font-medium text-muted-foreground">Clique para anexar comprovante</span>
                </>
              )}
              <Input
                id="payment-receipt"
                type="file"
                className="hidden"
                onChange={(e) => setPaymentFile(e.target.files?.[0] || null)}
                accept=".pdf,.jpg,.jpeg,.png"
              />
            </div>
          </div>
          <DialogFooter className="sm:justify-between">
            <Button variant="ghost" onClick={() => setPaymentModalOpen(false)}>
              Fechar
            </Button>
            <Button
              variant={paymentFile ? "default" : "outline"}
              onClick={handleConfirmPayment}
              disabled={isProcessingPayment}
              className={paymentFile ? "bg-green-600 hover:bg-green-700" : ""}
            >
              {isProcessingPayment && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {paymentFile ? "Salvar" : "Salvar s/ comprovante"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG IMPORTAÇÃO */}
      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Importar</DialogTitle>
          </DialogHeader>
          <div className="border-2 border-dashed rounded-lg p-10 flex flex-col items-center justify-center">
            <UploadCloud className="w-12 h-12 text-blue-500" />
            <p>Arraste XML ou PDF</p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
