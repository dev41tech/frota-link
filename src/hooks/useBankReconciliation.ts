import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useMultiTenant } from "./useMultiTenant";
import { useAuth } from "./useAuth";
import { useToast } from "./use-toast";
import { parseBankStatement, ParsedTransaction, findMatches, RecordToMatch, MatchSuggestion } from "@/lib/bankParsers";

export interface BankTransaction {
  id: string;
  transaction_date: string;
  description: string;
  amount: number;
  transaction_type: "credit" | "debit";
  bank_reference?: string;
  status: "pending" | "reconciled" | "ignored";
  import_batch_id: string;
  file_name?: string;
  created_at: string;
  // Linked record info
  reconciliation?: {
    id: string;
    revenue_id?: string;
    expense_id?: string;
    accounts_payable_id?: string;
    fuel_expense_id?: string;
    match_type: "auto" | "manual";
    match_confidence?: number;
  };
}

export interface ImportBatch {
  id: string;
  file_name: string;
  file_type: string;
  imported_at: string;
  transaction_count: number;
  reconciled_count: number;
}

export interface ReconciliationStats {
  totalTransactions: number;
  reconciledCount: number;
  pendingCount: number;
  ignoredCount: number;
  totalCredits: number;
  totalDebits: number;
  reconciledCredits: number;
  reconciledDebits: number;
}

export function useBankReconciliation() {
  const [transactions, setTransactions] = useState<BankTransaction[]>([]);
  const [importBatches, setImportBatches] = useState<ImportBatch[]>([]);
  const [records, setRecords] = useState<RecordToMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [stats, setStats] = useState<ReconciliationStats | null>(null);

  const { currentCompany } = useMultiTenant();
  const { user } = useAuth();
  const { toast } = useToast();

  // Fetch transactions and import history
  const fetchData = useCallback(async () => {
    if (!currentCompany?.id) return;

    try {
      setLoading(true);

      // Fetch bank transactions with reconciliation info
      const { data: transactionsData, error: transactionsError } = await supabase
        .from("bank_transactions")
        .select(
          `
          *,
          bank_reconciliations (
            id,
            revenue_id,
            expense_id,
            accounts_payable_id,
            fuel_expense_id,
            match_type,
            match_confidence
          )
        `,
        )
        .eq("company_id", currentCompany.id)
        .order("transaction_date", { ascending: false })
        .limit(500);

      if (transactionsError) throw transactionsError;

      const formattedTransactions: BankTransaction[] = (transactionsData || []).map((t) => ({
        id: t.id,
        transaction_date: t.transaction_date,
        description: t.description,
        amount: Number(t.amount),
        transaction_type: t.transaction_type as "credit" | "debit",
        bank_reference: t.bank_reference || undefined,
        status: t.status as "pending" | "reconciled" | "ignored",
        import_batch_id: t.import_batch_id,
        file_name: t.file_name || undefined,
        created_at: t.created_at,
        reconciliation: t.bank_reconciliations?.[0]
          ? {
              id: t.bank_reconciliations[0].id,
              revenue_id: t.bank_reconciliations[0].revenue_id || undefined,
              expense_id: t.bank_reconciliations[0].expense_id || undefined,
              accounts_payable_id: t.bank_reconciliations[0].accounts_payable_id || undefined,
              fuel_expense_id: t.bank_reconciliations[0].fuel_expense_id || undefined,
              match_type: t.bank_reconciliations[0].match_type as "auto" | "manual",
              match_confidence: t.bank_reconciliations[0].match_confidence || undefined,
            }
          : undefined,
      }));

      setTransactions(formattedTransactions);

      // Calculate stats
      const totalCredits = formattedTransactions
        .filter((t) => t.transaction_type === "credit")
        .reduce((sum, t) => sum + t.amount, 0);
      const totalDebits = formattedTransactions
        .filter((t) => t.transaction_type === "debit")
        .reduce((sum, t) => sum + t.amount, 0);
      const reconciledCredits = formattedTransactions
        .filter((t) => t.transaction_type === "credit" && t.status === "reconciled")
        .reduce((sum, t) => sum + t.amount, 0);
      const reconciledDebits = formattedTransactions
        .filter((t) => t.transaction_type === "debit" && t.status === "reconciled")
        .reduce((sum, t) => sum + t.amount, 0);

      setStats({
        totalTransactions: formattedTransactions.length,
        reconciledCount: formattedTransactions.filter((t) => t.status === "reconciled").length,
        pendingCount: formattedTransactions.filter((t) => t.status === "pending").length,
        ignoredCount: formattedTransactions.filter((t) => t.status === "ignored").length,
        totalCredits,
        totalDebits,
        reconciledCredits,
        reconciledDebits,
      });

      // Get unique import batches
      const batches = new Map<string, ImportBatch>();
      formattedTransactions.forEach((t) => {
        if (!batches.has(t.import_batch_id)) {
          batches.set(t.import_batch_id, {
            id: t.import_batch_id,
            file_name: t.file_name || "Importação",
            file_type: t.file_name?.endsWith(".ofx") ? "ofx" : "csv",
            imported_at: t.created_at,
            transaction_count: 0,
            reconciled_count: 0,
          });
        }
        const batch = batches.get(t.import_batch_id)!;
        batch.transaction_count++;
        if (t.status === "reconciled") batch.reconciled_count++;
      });
      setImportBatches(Array.from(batches.values()));
    } catch (error: any) {
      console.error("Error fetching bank reconciliation data:", error);
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [currentCompany?.id, toast]);

  // Fetch records for matching (revenues, expenses, etc.)
  const fetchRecordsForMatching = useCallback(async () => {
    if (!currentCompany?.id) return;

    try {
      // Fetch unreconciled revenues
      const { data: revenues } = await supabase
        .from("revenue")
        .select("id, date, amount, description, client, reconciled_at")
        .eq("company_id", currentCompany.id)
        .is("reconciled_at", null)
        .order("date", { ascending: false })
        .limit(200);

      // Fetch unreconciled expenses
      const { data: expenses } = await supabase
        .from("expenses")
        .select("id, date, amount, description, supplier, reconciled_at")
        .eq("company_id", currentCompany.id)
        .is("reconciled_at", null)
        .order("date", { ascending: false })
        .limit(200);

      // Fetch unreconciled accounts payable
      const { data: accountsPayable } = await supabase
        .from("accounts_payable")
        .select("id, due_date, amount, description, supplier, reconciled_at")
        .eq("company_id", currentCompany.id)
        .eq("status", "paid")
        .is("reconciled_at", null)
        .order("due_date", { ascending: false })
        .limit(200);

      // Fetch unreconciled fuel expenses
      const { data: fuelExpenses } = await supabase
        .from("fuel_expenses")
        .select("id, date, total_amount, notes, reconciled_at")
        .eq("company_id", currentCompany.id)
        .is("reconciled_at", null)
        .order("date", { ascending: false })
        .limit(200);

      const allRecords: RecordToMatch[] = [
        ...(revenues || []).map((r) => ({
          id: r.id,
          date: r.date,
          amount: Number(r.amount),
          description: r.description,
          type: "revenue" as const,
          client: r.client || undefined,
          isReconciled: !!r.reconciled_at,
        })),
        ...(expenses || []).map((e) => ({
          id: e.id,
          date: e.date,
          amount: Number(e.amount),
          description: e.description,
          type: "expense" as const,
          supplier: e.supplier || undefined,
          isReconciled: !!e.reconciled_at,
        })),
        ...(accountsPayable || []).map((a) => ({
          id: a.id,
          date: a.due_date,
          amount: Number(a.amount),
          description: a.description,
          type: "accounts_payable" as const,
          supplier: a.supplier || undefined,
          isReconciled: !!a.reconciled_at,
        })),
        ...(fuelExpenses || []).map((f) => ({
          id: f.id,
          date: f.date,
          amount: Number(f.total_amount),
          description: f.notes || "Abastecimento",
          type: "fuel_expense" as const,
          isReconciled: !!f.reconciled_at,
        })),
      ];

      setRecords(allRecords);
    } catch (error) {
      console.error("Error fetching records for matching:", error);
    }
  }, [currentCompany?.id]);

  useEffect(() => {
    fetchData();
    fetchRecordsForMatching();
  }, [fetchData, fetchRecordsForMatching]);

  // Import file
  const importFile = async (file: File): Promise<{ success: boolean; count: number; matched: number }> => {
    if (!currentCompany?.id || !user?.id) {
      throw new Error("Empresa ou usuário não encontrado");
    }

    setImporting(true);

    try {
      const content = await file.text();
      const result = parseBankStatement(content, file.name);

      if (result.errors.length > 0) {
        result.errors.forEach((err) => {
          console.warn("Parse warning:", err);
        });
      }

      if (result.transactions.length === 0) {
        throw new Error("Nenhuma transação encontrada no arquivo");
      }

      // Generate batch ID
      const batchId = crypto.randomUUID();

      // Insert transactions
      const transactionsToInsert = result.transactions.map((t) => ({
        company_id: currentCompany.id,
        user_id: user.id,
        import_batch_id: batchId,
        transaction_date: t.date,
        description: t.description,
        amount: t.amount,
        transaction_type: t.type,
        bank_reference: t.bankReference || null,
        file_name: file.name,
        file_type: result.fileType,
        status: "pending",
      }));

      const { data: insertedTransactions, error: insertError } = await supabase
        .from("bank_transactions")
        .insert(transactionsToInsert)
        .select();

      if (insertError) throw insertError;

      // Fetch fresh records for matching
      await fetchRecordsForMatching();

      // Auto-match with existing records
      const matchSuggestions = findMatches(result.transactions, records);
      let matchedCount = 0;

      // Apply auto-matches
      for (const suggestion of matchSuggestions) {
        if (suggestion.confidence >= 70 && insertedTransactions?.[suggestion.transactionIndex]) {
          const transactionId = insertedTransactions[suggestion.transactionIndex].id;

          try {
            await reconcileTransaction(
              transactionId,
              suggestion.recordId,
              suggestion.recordType,
              "auto",
              suggestion.confidence,
            );
            matchedCount++;
          } catch (e) {
            console.error("Auto-match failed:", e);
          }
        }
      }

      await fetchData();

      toast({
        title: "Importação concluída",
        description: `${result.transactions.length} transações importadas, ${matchedCount} conciliadas automaticamente`,
      });

      return { success: true, count: result.transactions.length, matched: matchedCount };
    } catch (error: any) {
      console.error("Error importing file:", error);
      toast({
        title: "Erro na importação",
        description: error.message,
        variant: "destructive",
      });
      throw error;
    } finally {
      setImporting(false);
    }
  };

  // Reconcile a transaction with a record
  const reconcileTransaction = async (
    transactionId: string,
    recordId: string,
    recordType: "revenue" | "expense" | "accounts_payable" | "fuel_expense",
    matchType: "auto" | "manual" = "manual",
    confidence?: number,
  ) => {
    if (!currentCompany?.id || !user?.id) return;

    try {
      // Create reconciliation record
      const reconciliationData: any = {
        company_id: currentCompany.id,
        bank_transaction_id: transactionId,
        match_type: matchType,
        match_confidence: confidence || null,
        reconciled_by: user.id,
      };

      // Set the appropriate foreign key
      if (recordType === "revenue") {
        reconciliationData.revenue_id = recordId;
      } else if (recordType === "expense") {
        reconciliationData.expense_id = recordId;
      } else if (recordType === "accounts_payable") {
        reconciliationData.accounts_payable_id = recordId;
      } else if (recordType === "fuel_expense") {
        reconciliationData.fuel_expense_id = recordId;
      }

      const { error: reconcileError } = await supabase.from("bank_reconciliations").insert(reconciliationData);

      if (reconcileError) throw reconcileError;

      // Update transaction status
      const { error: transactionError } = await supabase
        .from("bank_transactions")
        .update({ status: "reconciled" })
        .eq("id", transactionId);

      if (transactionError) throw transactionError;

      // Update the record's reconciled_at field
      // FIX: Lógica para garantir o nome correto da tabela e evitar erro de TypeScript
      let tableName = "";
      switch (recordType) {
        case "expense":
          tableName = "expenses";
          break;
        case "fuel_expense":
          tableName = "fuel_expenses";
          break;
        default:
          tableName = recordType; // 'revenue' ou 'accounts_payable'
      }

      const { error: recordError } = await supabase
        .from(tableName as any) // FIX: Cast 'as any' para resolver o erro TS2769
        .update({
          reconciled_at: new Date().toISOString(),
          bank_transaction_id: transactionId,
        })
        .eq("id", recordId);

      if (recordError) throw recordError;

      await fetchData();
      await fetchRecordsForMatching();

      if (matchType === "manual") {
        toast({
          title: "Conciliação realizada",
          description: "Transação vinculada com sucesso",
        });
      }
    } catch (error: any) {
      console.error("Error reconciling:", error);
      toast({
        title: "Erro na conciliação",
        description: error.message,
        variant: "destructive",
      });
      throw error;
    }
  };

  // Unreconcile a transaction
  const unreconcileTransaction = async (transactionId: string) => {
    if (!currentCompany?.id) return;

    try {
      const transaction = transactions.find((t) => t.id === transactionId);
      if (!transaction?.reconciliation) return;

      // Get the linked record ID
      const reconciliation = transaction.reconciliation;
      const recordId =
        reconciliation.revenue_id ||
        reconciliation.expense_id ||
        reconciliation.accounts_payable_id ||
        reconciliation.fuel_expense_id;

      const recordType: "revenue" | "expenses" | "accounts_payable" | "fuel_expenses" = reconciliation.revenue_id
        ? "revenue"
        : reconciliation.expense_id
          ? "expenses"
          : reconciliation.accounts_payable_id
            ? "accounts_payable"
            : "fuel_expenses";

      // Delete reconciliation
      const { error: deleteError } = await supabase
        .from("bank_reconciliations")
        .delete()
        .eq("bank_transaction_id", transactionId);

      if (deleteError) throw deleteError;

      // Update transaction status
      const { error: transactionError } = await supabase
        .from("bank_transactions")
        .update({ status: "pending" })
        .eq("id", transactionId);

      if (transactionError) throw transactionError;

      // Clear the record's reconciled_at field
      if (recordId && recordType) {
        // Aqui usamos nomes de tabelas explícitos, então não precisamos de 'as any'
        if (recordType === "revenue") {
          await supabase.from("revenue").update({ reconciled_at: null, bank_transaction_id: null }).eq("id", recordId);
        } else if (recordType === "expenses") {
          await supabase.from("expenses").update({ reconciled_at: null, bank_transaction_id: null }).eq("id", recordId);
        } else if (recordType === "accounts_payable") {
          await supabase
            .from("accounts_payable")
            .update({ reconciled_at: null, bank_transaction_id: null })
            .eq("id", recordId);
        } else if (recordType === "fuel_expenses") {
          await supabase
            .from("fuel_expenses")
            .update({ reconciled_at: null, bank_transaction_id: null })
            .eq("id", recordId);
        }
      }

      await fetchData();
      await fetchRecordsForMatching();

      toast({
        title: "Conciliação removida",
        description: "Transação desvinculada com sucesso",
      });
    } catch (error: any) {
      console.error("Error unreconciling:", error);
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  // Ignore a transaction
  const ignoreTransaction = async (transactionId: string) => {
    try {
      const { error } = await supabase.from("bank_transactions").update({ status: "ignored" }).eq("id", transactionId);

      if (error) throw error;

      await fetchData();

      toast({
        title: "Transação ignorada",
        description: "A transação foi marcada como ignorada",
      });
    } catch (error: any) {
      console.error("Error ignoring transaction:", error);
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  // Restore ignored transaction
  const restoreTransaction = async (transactionId: string) => {
    try {
      const { error } = await supabase.from("bank_transactions").update({ status: "pending" }).eq("id", transactionId);

      if (error) throw error;

      await fetchData();

      toast({
        title: "Transação restaurada",
        description: "A transação voltou para pendente",
      });
    } catch (error: any) {
      console.error("Error restoring transaction:", error);
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  // Delete import batch
  const deleteImportBatch = async (batchId: string) => {
    try {
      const { error } = await supabase.from("bank_transactions").delete().eq("import_batch_id", batchId);

      if (error) throw error;

      await fetchData();

      toast({
        title: "Importação excluída",
        description: "Todas as transações da importação foram removidas",
      });
    } catch (error: any) {
      console.error("Error deleting batch:", error);
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return {
    transactions,
    importBatches,
    records,
    stats,
    loading,
    importing,
    importFile,
    reconcileTransaction,
    unreconcileTransaction,
    ignoreTransaction,
    restoreTransaction,
    deleteImportBatch,
    refetch: fetchData,
  };
}
