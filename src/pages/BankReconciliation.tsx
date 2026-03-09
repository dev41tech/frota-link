import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useMultiTenant } from "@/hooks/useMultiTenant";
import { useAuth } from "@/hooks/useAuth";
import { useFinancialAccounts } from "@/hooks/useFinancialAccounts";
import {
  Upload,
  Check,
  X,
  ArrowUpCircle,
  ArrowDownCircle,
  Save,
  RefreshCw,
  Wand2,
  Loader2,
  ListPlus,
  AlertCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";

// --- TIPOS ---
interface BankTransaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: "credit" | "debit";
  matched: boolean;
  matchedItems: {
    id: string;
    type: "revenue" | "expense";
    amount: number;
    description: string;
  }[];
}

interface SystemTransaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: "credit" | "debit";
  reconciled: boolean;
  originTable: "revenue" | "accounts_payable";
}

export default function BankReconciliation() {
  const { user } = useAuth();
  const { currentCompany } = useMultiTenant();
  const { toast } = useToast();
  const { accounts } = useFinancialAccounts();

  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [bankTransactions, setBankTransactions] = useState<BankTransaction[]>([]);
  const [systemTransactions, setSystemTransactions] = useState<SystemTransaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Estados para Conciliação Múltipla
  const [multiMatchTransaction, setMultiMatchTransaction] = useState<BankTransaction | null>(null);
  const [selectedMultiIds, setSelectedMultiIds] = useState<string[]>([]);

  // Estado para Confirmação de Divergência (Pop-up do Sistema)
  const [confirmationData, setConfirmationData] = useState<{
    bankId: string;
    systemId: string;
    bankAmount: number;
    systemAmount: number;
  } | null>(null);

  useEffect(() => {
    if (currentCompany) fetchSystemData();
  }, [currentCompany, selectedAccountId]);

  // --- 1. BUSCAR DADOS DO SISTEMA ---
  const fetchSystemData = async () => {
    if (!currentCompany?.id) return;

    setLoading(true);
    try {
      // --- BUSCA RECEITAS ---
      let revenueQuery = supabase
        .from("revenue" as any)
        .select("*")
        .eq("company_id", currentCompany.id)
        // REMOVI O FILTRO .eq('reconciled', false) DAQUI PARA GARANTIR
        .order("date", { ascending: false });

      if (selectedAccountId) {
        revenueQuery = (revenueQuery as any).eq("account_id", selectedAccountId);
      }

      const { data: revenues } = await revenueQuery;

      // --- BUSCA DESPESAS ---
      let expenseQuery = supabase
        .from("accounts_payable" as any)
        .select("*")
        .eq("company_id", currentCompany.id)
        // REMOVI O FILTRO .eq('reconciled', false) DAQUI PARA GARANTIR
        .order("due_date", { ascending: false });

      if (selectedAccountId) {
        expenseQuery = (expenseQuery as any).eq("account_id", selectedAccountId);
      }

      const { data: expenses } = await expenseQuery;

      const unified: SystemTransaction[] = [];

      // --- FILTRAGEM INTELIGENTE NO JAVASCRIPT ---

      revenues?.forEach((r: any) => {
        // Se já estiver conciliado (true), pula fora. Aceita false ou null.
        if (r.reconciled) return;

        unified.push({
          id: r.id,
          date: r.date,
          description: `(Rec) ${r.client || ""} - ${r.description}`,
          amount: Number(r.amount),
          type: "credit",
          reconciled: r.reconciled || false,
          originTable: "revenue",
        });
      });

      expenses?.forEach((e: any) => {
        // Se já estiver conciliado (true), pula fora. Aceita false ou null.
        if (e.reconciled) return;

        unified.push({
          id: e.id,
          // Lógica de data: se pago usa data pgto, se pendente usa vencimento
          date: e.status === "paid" ? e.payment_date : e.due_date,
          description: `(Pag) ${e.supplier || ""} - ${e.description}`,
          amount: Number(e.amount),
          type: "debit",
          reconciled: e.reconciled || false,
          originTable: "accounts_payable",
        });
      });

      setSystemTransactions(unified);
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // --- 2. INTELIGÊNCIA DE AUTO-MATCH (1 para 1) ---
  const runAutoMatch = () => {
    const availableSystemTx = [...systemTransactions.filter((s) => !s.reconciled)];
    const currentBankTx = [...bankTransactions];

    let matchCount = 0;

    const newBankTx = currentBankTx.map((btx) => {
      if (btx.matched) return btx;

      const candidates = availableSystemTx.filter((stx) => stx.type === btx.type);

      const matchIndex = candidates.findIndex((stx) => {
        const amountDiff = Math.abs(stx.amount - btx.amount);
        const isAmountClose = amountDiff <= 0.05;

        const sDate = new Date(stx.date.split("T")[0]).getTime();
        const bDate = new Date(btx.date.split("T")[0]).getTime();
        const diffTime = Math.abs(sDate - bDate);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        const isDateClose = diffDays <= 3;

        return isAmountClose && isDateClose;
      });

      if (matchIndex >= 0) {
        const matched = candidates[matchIndex];
        const realIndex = availableSystemTx.findIndex((s) => s.id === matched.id);
        if (realIndex > -1) availableSystemTx.splice(realIndex, 1);

        matchCount++;

        return {
          ...btx,
          matched: true,
          matchedItems: [
            {
              id: matched.id,
              type: (matched.originTable === "revenue" ? "revenue" : "expense") as "revenue" | "expense",
              amount: matched.amount,
              description: matched.description,
            },
          ],
        };
      }
      return btx;
    });

    setBankTransactions(newBankTx);

    if (matchCount > 0) {
      toast({ title: "Auto Conciliação", description: `${matchCount} itens conciliados!` });
    } else {
      toast({
        title: "Auto Conciliação",
        description: "Nenhuma correspondência encontrada (Margem: R$ 0,05 / 3 dias).",
      });
    }
  };

  // --- 3. PARSERS DE ARQUIVO ---
  const parseOFX = (text: string): BankTransaction[] => {
    const transactions: BankTransaction[] = [];
    const transactionRegex = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/g;
    const amountRegex = /<TRNAMT>([-0-9.]+)/;
    const dateRegex = /<DTPOSTED>([0-9]{8})/;
    const memoRegex = /<MEMO>(.*?)(\n|<)/;

    let match;
    while ((match = transactionRegex.exec(text)) !== null) {
      const block = match[1];
      const amountStr = block.match(amountRegex)?.[1];
      const dateStr = block.match(dateRegex)?.[1];
      const memo = block.match(memoRegex)?.[1]?.trim() || "Sem descrição";

      if (amountStr && dateStr) {
        const amount = parseFloat(amountStr);
        const formattedDate = `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`;

        transactions.push({
          id: Math.random().toString(36).substr(2, 9),
          date: formattedDate,
          description: memo,
          amount: Math.abs(amount),
          type: amount < 0 ? "debit" : "credit",
          matched: false,
          matchedItems: [],
        });
      }
    }
    return transactions;
  };

  const parseCSV = (text: string): BankTransaction[] => {
    const lines = text.split("\n");
    const transactions: BankTransaction[] = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const parts = line.split(",");
      if (parts.length >= 3) {
        const amount = parseFloat(parts[2]);
        if (!isNaN(amount)) {
          transactions.push({
            id: Math.random().toString(36).substr(2, 9),
            date: parts[0],
            description: parts[1],
            amount: Math.abs(amount),
            type: amount < 0 ? "debit" : "credit",
            matched: false,
            matchedItems: [],
          });
        }
      }
    }
    return transactions;
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const text = await file.text();
      const newTransactions = file.name.toLowerCase().endsWith(".ofx") ? parseOFX(text) : parseCSV(text);
      setBankTransactions(newTransactions);
      toast({ title: "Importado!", description: `${newTransactions.length} linhas carregadas.` });
    } catch (err) {
      toast({ title: "Erro", variant: "destructive" });
    }
    setUploading(false);
    e.target.value = "";
  };

  // --- 4. MATCHING MANUAL ---

  const executeMatch = (bankId: string, systemId: string) => {
    const systemItem = systemTransactions.find((s) => s.id === systemId);
    if (!systemItem) return;

    setBankTransactions((prev) =>
      prev.map((t) =>
        t.id === bankId
          ? {
              ...t,
              matched: true,
              matchedItems: [
                {
                  id: systemItem.id,
                  type: (systemItem.originTable === "revenue" ? "revenue" : "expense") as "revenue" | "expense",
                  amount: systemItem.amount,
                  description: systemItem.description,
                },
              ],
            }
          : t,
      ),
    );
  };

  const handleSingleMatch = (bankId: string, systemId: string) => {
    const systemItem = systemTransactions.find((s) => s.id === systemId);
    const bankItem = bankTransactions.find((b) => b.id === bankId);
    if (!systemItem || !bankItem) return;

    // Alerta de Divergência se > 5 centavos
    if (Math.abs(systemItem.amount - bankItem.amount) > 0.05) {
      setConfirmationData({
        bankId,
        systemId,
        bankAmount: bankItem.amount,
        systemAmount: systemItem.amount,
      });
      return;
    }

    executeMatch(bankId, systemId);
  };

  const handleUnmatch = (bankId: string) => {
    setBankTransactions((prev) => prev.map((t) => (t.id === bankId ? { ...t, matched: false, matchedItems: [] } : t)));
  };

  const openMultiMatch = (transaction: BankTransaction) => {
    setMultiMatchTransaction(transaction);
    setSelectedMultiIds([]);
  };

  const toggleMultiSelection = (id: string) => {
    setSelectedMultiIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  const confirmMultiMatch = () => {
    if (!multiMatchTransaction) return;

    const selectedItems = systemTransactions
      .filter((s) => selectedMultiIds.includes(s.id))
      .map((s) => ({
        id: s.id,
        type: (s.originTable === "revenue" ? "revenue" : "expense") as "revenue" | "expense",
        amount: s.amount,
        description: s.description,
      }));

    setBankTransactions((prev) =>
      prev.map((t) => (t.id === multiMatchTransaction.id ? { ...t, matched: true, matchedItems: selectedItems } : t)),
    );

    setMultiMatchTransaction(null);
    toast({ title: "Vínculo Múltiplo Criado!" });
  };

  // --- 5. SALVAR NO BANCO (COM BAIXA FINANCEIRA) ---
  const saveReconciliation = async () => {
    // Filtra apenas o que foi conciliado
    const matches = bankTransactions.filter((t) => t.matched && t.matchedItems.length > 0);

    if (matches.length === 0) {
      toast({ title: "Nada a salvar", description: "Vincule itens antes de salvar." });
      return;
    }

    setSaving(true);

    try {
      let updatedCount = 0;

      // Vamos processar transação bancária por transação bancária
      // para garantir que pegamos a DATA DO BANCO correta para cada item
      const promises = matches.map(async (bankTx) => {
        // Para cada item do sistema vinculado a essa linha do banco
        const itemPromises = bankTx.matchedItems.map(async (systemItem) => {
          if (systemItem.type === "expense") {
            // Se for DESPESA: Muda status para 'paid' e atualiza data de pagamento
            return supabase
              .from("accounts_payable")
              .update({
                reconciled: true,
                status: "paid", // Força o status pago
                payment_date: bankTx.date, // Usa a data real do banco!
                amount_paid: systemItem.amount, // Confirma o valor pago
              } as any)
              .eq("id", systemItem.id);
          } else if (systemItem.type === "revenue") {
            // Se for RECEITA: Muda status para 'received'
            return supabase
              .from("revenue")
              .update({
                reconciled: true,
                status: "received",
                date: bankTx.date, // Em regime de caixa, a data é a do recebimento
              } as any)
              .eq("id", systemItem.id);
          }
        });

        await Promise.all(itemPromises);
        updatedCount++;
      });

      await Promise.all(promises);

      toast({
        title: "Sucesso!",
        description: `${updatedCount} baixas realizadas com a data do extrato.`,
      });

      // Limpa e recarrega
      setBankTransactions([]);
      fetchSystemData();
    } catch (err: any) {
      console.error(err);
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const formatMoney = (val: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">Conciliação Bancária</h1>
          <p className="text-muted-foreground">Compare extrato bancário com Receitas e Despesas.</p>
        </div>

        <div className="flex gap-2">
          {bankTransactions.length > 0 && (
            <Button onClick={runAutoMatch} variant="outline" className="border-blue-200 text-blue-700 hover:bg-blue-50">
              <Wand2 className="mr-2 h-4 w-4" /> Auto Conciliar
            </Button>
          )}
          {bankTransactions.some((t) => t.matched) && (
            <Button onClick={saveReconciliation} disabled={saving} className="bg-green-600 hover:bg-green-700">
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Salvar Conciliação
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="space-y-2">
            <Label>Selecione a conta bancária</Label>
            <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
              <SelectTrigger className="max-w-sm">
                <SelectValue placeholder="Todas as contas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Todas as contas</SelectItem>
                {accounts.map((acc) => (
                  <SelectItem key={acc.id} value={acc.id}>
                    {acc.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedAccountId && (
              <p className="text-xs text-muted-foreground">
                Exibindo apenas lançamentos vinculados a esta conta.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="border-dashed border-2">
        <CardContent className="pt-6 flex flex-col items-center justify-center space-y-4">
          <div className="p-3 bg-primary/10 rounded-full">
            <Upload className="h-8 w-8 text-primary" />
          </div>
          <div className="text-center">
            <h3 className="text-lg font-semibold">Arraste seu extrato (OFX/CSV)</h3>
            <p className="text-sm text-muted-foreground">
              O sistema identificará Créditos (Receitas) e Débitos (Despesas)
            </p>
          </div>
          <Input
            type="file"
            accept=".ofx,.csv"
            className="hidden"
            id="file-upload"
            onChange={handleFileUpload}
            disabled={uploading}
          />
          <Button variant="outline" onClick={() => document.getElementById("file-upload")?.click()}>
            {uploading ? "Lendo..." : "Selecionar Arquivo"}
          </Button>
        </CardContent>
      </Card>

      {bankTransactions.length > 0 && (
        <div className="space-y-4">
          <div className="flex gap-4">
            <Card className="flex-1 bg-muted/20 py-2">
              <CardHeader className="pb-1 py-2">
                <CardTitle className="text-sm">Total</CardTitle>
              </CardHeader>
              <CardContent className="py-2">
                <div className="text-2xl font-bold">{bankTransactions.length}</div>
              </CardContent>
            </Card>
            <Card className="flex-1 bg-green-50 border-green-200 py-2">
              <CardHeader className="pb-1 py-2">
                <CardTitle className="text-sm text-green-700">Conciliados</CardTitle>
              </CardHeader>
              <CardContent className="py-2">
                <div className="text-2xl font-bold text-green-700">
                  {bankTransactions.filter((t) => t.matched).length}
                </div>
              </CardContent>
            </Card>
            <Card className="flex-1 py-2">
              <CardHeader className="pb-1 py-2">
                <CardTitle className="text-sm">Progresso</CardTitle>
              </CardHeader>
              <CardContent className="py-2">
                <Progress
                  value={(bankTransactions.filter((t) => t.matched).length / bankTransactions.length) * 100}
                  className="h-2 mt-2"
                />
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Extrato x Sistema</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Descrição Banco</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Vínculo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bankTransactions.map((t) => (
                    <TableRow key={t.id} className={t.matched ? "bg-green-50/50" : ""}>
                      <TableCell>{t.date}</TableCell>
                      <TableCell className="max-w-[200px] truncate" title={t.description}>
                        {t.description}
                      </TableCell>

                      <TableCell
                        className={t.type === "credit" ? "text-green-600 font-bold" : "text-red-600 font-bold"}
                      >
                        {t.type === "debit" ? "-" : "+"} {formatMoney(t.amount)}
                      </TableCell>

                      <TableCell>
                        {t.type === "credit" ? (
                          <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                            <ArrowUpCircle className="w-3 h-3 mr-1" /> Entr.
                          </Badge>
                        ) : (
                          <Badge className="bg-red-100 text-red-800 hover:bg-red-100">
                            <ArrowDownCircle className="w-3 h-3 mr-1" /> Saída
                          </Badge>
                        )}
                      </TableCell>

                      <TableCell className="min-w-[350px]">
                        {t.matched ? (
                          <div className="flex flex-col gap-1 border rounded p-2 bg-white shadow-sm">
                            {t.matchedItems.map((item) => (
                              <div
                                key={item.id}
                                className="flex justify-between items-center text-xs border-b last:border-0 pb-1 last:pb-0"
                              >
                                <span className="truncate max-w-[180px] font-medium" title={item.description}>
                                  {item.description}
                                </span>
                                <div className="flex items-center gap-2">
                                  <span className="text-muted-foreground">{formatMoney(item.amount)}</span>
                                </div>
                              </div>
                            ))}
                            {/* Soma total dos vinculados vs Banco */}
                            {t.matchedItems.length > 0 &&
                              Math.abs(t.amount - t.matchedItems.reduce((acc, i) => acc + i.amount, 0)) > 0.05 && (
                                <div className="text-xs text-yellow-600 font-bold flex items-center mt-1">
                                  <AlertCircle className="w-3 h-3 mr-1" />
                                  Diferença:{" "}
                                  {formatMoney(t.amount - t.matchedItems.reduce((acc, i) => acc + i.amount, 0))}
                                </div>
                              )}
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 text-red-500 hover:text-red-700 hover:bg-red-50 mt-1 w-full text-xs"
                              onClick={() => handleUnmatch(t.id)}
                            >
                              <X className="w-3 h-3 mr-1" /> Desfazer Vínculo
                            </Button>
                          </div>
                        ) : (
                          <div className="flex gap-2 items-center">
                            {/* Select Simples com value="" para resetar visualmente em caso de cancelamento */}
                            <Select value="" onValueChange={(val) => handleSingleMatch(t.id, val)}>
                              <SelectTrigger className="h-8 text-xs flex-1 border-dashed text-muted-foreground">
                                <SelectValue
                                  placeholder={`Vincular ${t.type === "credit" ? "Receita" : "Despesa"}...`}
                                />
                              </SelectTrigger>
                              <SelectContent>
                                {systemTransactions
                                  .filter(
                                    (s) =>
                                      s.type === t.type &&
                                      !s.reconciled &&
                                      !bankTransactions.some((bt) => bt.matchedItems.some((mi) => mi.id === s.id)),
                                  )
                                  .map((s) => (
                                    <SelectItem key={s.id} value={s.id}>
                                      <span className="flex items-center gap-2 w-full">
                                        <span className="font-mono text-gray-500 w-16">
                                          {s.date.split("-").reverse().slice(0, 2).join("/")}
                                        </span>
                                        <span className="truncate max-w-[120px]">{s.description}</span>
                                        <span className="font-bold ml-auto">{formatMoney(s.amount)}</span>
                                      </span>
                                    </SelectItem>
                                  ))}
                              </SelectContent>
                            </Select>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 shrink-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                              title="Criar como Novo Lançamento"
                              onClick={() => {
                                // Verifica se temos usuário e empresa
                                if (!user?.id || !currentCompany?.id) {
                                  toast({
                                    title: "Erro",
                                    description: "Usuário não identificado",
                                    variant: "destructive",
                                  });
                                  return;
                                }

                                const isExpense = t.type === "debit";
                                const tableName = isExpense ? "accounts_payable" : "revenue";

                                if (window.confirm(`Deseja criar um lançamento automático para "${t.description}"?`)) {
                                  const payload = isExpense
                                    ? {
                                        user_id: user.id, // <--- CAMPO OBRIGATÓRIO
                                        company_id: currentCompany.id,
                                        description: t.description,
                                        amount: t.amount,
                                        due_date: t.date,
                                        payment_date: t.date, // Data da baixa
                                        status: "paid", // Já nasce pago
                                        reconciled: true, // Já nasce conciliado
                                        category: "Outros", // Categoria padrão (string)
                                        is_direct: false, // Define como indireta por padrão para evitar erro
                                      }
                                    : {
                                        user_id: user.id, // <--- CAMPO OBRIGATÓRIO
                                        company_id: currentCompany.id,
                                        description: t.description,
                                        amount: t.amount,
                                        date: t.date,
                                        status: "received",
                                        reconciled: true,
                                      };

                                  // ATENÇÃO AQUI: Passando como Array [payload]
                                  supabase
                                    .from(tableName)
                                    .insert([payload])
                                    .then(({ error }) => {
                                      if (!error) {
                                        toast({ title: "Criado!", description: "Item adicionado e conciliado." });
                                        // Remove da lista visualmente
                                        setBankTransactions((prev) => prev.filter((x) => x.id !== t.id));
                                        // Atualiza os dados do sistema para refletir a criação
                                        fetchSystemData();
                                      } else {
                                        console.error(error);
                                        toast({
                                          title: "Erro ao criar",
                                          description: error.message,
                                          variant: "destructive",
                                        });
                                      }
                                    });
                                }
                              }}
                            >
                              <ListPlus className="w-4 h-4" />
                            </Button>
                            {/* Botão Multi-Match */}
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-8 w-8 shrink-0"
                              title="Vincular Vários (Split)"
                              onClick={() => openMultiMatch(t)}
                            >
                              <ListPlus className="w-4 h-4 text-blue-600" />
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}

      {/* --- ALERT DIALOG PARA DIVERGÊNCIAS --- */}
      <AlertDialog open={!!confirmationData} onOpenChange={(o) => !o && setConfirmationData(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-yellow-600">
              <AlertCircle className="h-5 w-5" />
              Divergência de Valores
            </AlertDialogTitle>
            <AlertDialogDescription>
              Você está tentando vincular itens com valores diferentes. Isso pode gerar inconsistências financeiras.
              <div className="mt-4 p-3 bg-muted rounded-lg space-y-2 text-sm text-foreground">
                <div className="flex justify-between">
                  <span>Valor no Banco:</span>
                  <span className="font-bold">{confirmationData && formatMoney(confirmationData.bankAmount)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Valor no Sistema:</span>
                  <span className="font-bold">{confirmationData && formatMoney(confirmationData.systemAmount)}</span>
                </div>
                <div className="border-t pt-2 mt-2 flex justify-between text-yellow-600 font-bold">
                  <span>Diferença:</span>
                  <span>
                    {confirmationData && formatMoney(confirmationData.bankAmount - confirmationData.systemAmount)}
                  </span>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-yellow-600 hover:bg-yellow-700 text-white"
              onClick={() => {
                if (confirmationData) {
                  executeMatch(confirmationData.bankId, confirmationData.systemId);
                  setConfirmationData(null);
                }
              }}
            >
              Confirmar Mesmo Assim
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* --- MODAL DE MULTI CONCILIAÇÃO --- */}
      <Dialog open={!!multiMatchTransaction} onOpenChange={(o) => !o && setMultiMatchTransaction(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Conciliação Múltipla</DialogTitle>
            <DialogDescription>Selecione os lançamentos do sistema que compõem este valor do banco.</DialogDescription>
          </DialogHeader>

          {multiMatchTransaction && (
            <div className="space-y-4">
              {/* Cabeçalho Resumo */}
              <div className="bg-muted/50 p-4 rounded-lg flex justify-between items-center border">
                <div>
                  <p className="text-sm text-muted-foreground font-medium">Valor no Extrato</p>
                  <p
                    className={`text-2xl font-bold ${multiMatchTransaction.type === "credit" ? "text-green-600" : "text-red-600"}`}
                  >
                    {formatMoney(multiMatchTransaction.amount)}
                  </p>
                  <p className="text-xs text-muted-foreground">{multiMatchTransaction.description}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground font-medium">Total Selecionado</p>
                  {(() => {
                    const totalSelected = systemTransactions
                      .filter((s) => selectedMultiIds.includes(s.id))
                      .reduce((acc, curr) => acc + curr.amount, 0);
                    const diff = multiMatchTransaction.amount - totalSelected;
                    const isMatch = Math.abs(diff) < 0.05;

                    return (
                      <div>
                        <p className="text-2xl font-bold">{formatMoney(totalSelected)}</p>
                        <p className={`text-sm font-medium ${isMatch ? "text-green-600" : "text-red-500"}`}>
                          Diferença: {formatMoney(diff)}
                        </p>
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Lista Selecionável */}
              <div className="border rounded-md max-h-[300px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px] text-center">Sel.</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {systemTransactions
                      .filter(
                        (s) =>
                          !s.reconciled && // Não conciliado
                          s.type === multiMatchTransaction.type && // Mesmo tipo
                          !bankTransactions.some((bt) => bt.matchedItems.some((mi) => mi.id === s.id)), // Não usado
                      )
                      .map((sys) => (
                        <TableRow
                          key={sys.id}
                          className={`cursor-pointer ${selectedMultiIds.includes(sys.id) ? "bg-blue-50 hover:bg-blue-100" : "hover:bg-muted/50"}`}
                          onClick={() => toggleMultiSelection(sys.id)}
                        >
                          <TableCell className="text-center">
                            <div
                              className={`w-4 h-4 rounded border flex items-center justify-center mx-auto ${selectedMultiIds.includes(sys.id) ? "bg-blue-600 border-blue-600" : "border-gray-400"}`}
                            >
                              {selectedMultiIds.includes(sys.id) && <Check className="w-3 h-3 text-white" />}
                            </div>
                          </TableCell>
                          <TableCell className="text-xs">
                            {sys.date.split("-").reverse().slice(0, 2).join("/")}
                          </TableCell>
                          <TableCell className="text-xs">{sys.description}</TableCell>
                          <TableCell className="text-right text-xs font-medium">{formatMoney(sys.amount)}</TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setMultiMatchTransaction(null)}>
                  Cancelar
                </Button>
                <Button
                  onClick={confirmMultiMatch}
                  disabled={
                    Math.abs(
                      multiMatchTransaction.amount -
                        systemTransactions
                          .filter((s) => selectedMultiIds.includes(s.id))
                          .reduce((a, b) => a + b.amount, 0),
                    ) > 0.05
                  }
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  Confirmar Vínculo
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
