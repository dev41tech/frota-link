import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup,
  SelectLabel,
} from "@/components/ui/select";
import { Check, X, AlertCircle, Link2, Unlink, ArrowRight } from "lucide-react";
import type { BankTransaction } from "@/hooks/useBankReconciliation";
import type { RecordToMatch } from "@/lib/bankParsers";

// Configurações de UI centralizadas para evitar switch/case repetitivos
const RECORD_STYLES = {
  revenue: { label: "Receita", color: "text-green-600", badge: "bg-green-100 text-green-700" },
  expense: { label: "Despesa", color: "text-red-600", badge: "bg-red-100 text-red-700" },
  accounts_payable: { label: "Conta a Pagar", color: "text-orange-600", badge: "bg-orange-100 text-orange-700" },
  fuel_expense: { label: "Combustível", color: "text-blue-600", badge: "bg-blue-100 text-blue-700" },
};

// Formatador memoizado fora do componente para performance
const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

interface ReconciliationPanelProps {
  transaction: BankTransaction;
  records: RecordToMatch[];
  onReconcile: (recordId: string, recordType: RecordToMatch["type"]) => void;
  onUnreconcile: () => void;
  onIgnore: () => void;
  onRestore: () => void;
}

export function ReconciliationPanel({
  transaction,
  records,
  onReconcile,
  onUnreconcile,
  onIgnore,
  onRestore,
}: ReconciliationPanelProps) {
  const [selectedRecordId, setSelectedRecordId] = useState<string>("");

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("pt-BR");
  };

  // 1. Performance: Memoizar filtros pesados
  const { exactMatches, approximateMatches, otherRecords } = useMemo(() => {
    // Primeiro filtra o tipo compatível
    const compatible = records.filter((r) => {
      if (r.isReconciled) return false;
      return transaction.transaction_type === "credit" ? r.type === "revenue" : r.type !== "revenue";
    });

    const exact: RecordToMatch[] = [];
    const approx: RecordToMatch[] = [];
    const others: RecordToMatch[] = [];

    compatible.forEach((r) => {
      const diff = Math.abs(r.amount - transaction.amount);

      if (diff < 0.01) {
        exact.push(r);
      } else {
        const percentDiff = (diff / transaction.amount) * 100;
        if (percentDiff < 10) {
          // Margem de 10%
          approx.push(r);
        } else {
          others.push(r);
        }
      }
    });

    return {
      exactMatches: exact,
      approximateMatches: approx,
      otherRecords: others,
    };
  }, [records, transaction]);

  const handleReconcile = () => {
    if (!selectedRecordId) return;
    const record = records.find((r) => r.id === selectedRecordId);
    if (record) {
      onReconcile(selectedRecordId, record.type);
      setSelectedRecordId("");
    }
  };

  // Renderiza um item da lista de sugestões
  const renderMatchItem = (record: RecordToMatch, isExact: boolean) => {
    const style = RECORD_STYLES[record.type];
    const isSelected = selectedRecordId === record.id;

    return (
      <button
        key={record.id}
        onClick={() => setSelectedRecordId(record.id)}
        className={`w-full text-left p-2.5 rounded-md text-xs transition-all border ${
          isSelected
            ? "bg-primary/5 border-primary ring-1 ring-primary"
            : "hover:bg-accent border-transparent hover:border-border"
        }`}
      >
        <div className="flex justify-between items-center mb-1">
          <Badge variant="secondary" className={`text-[10px] px-1 h-5 ${style.badge} hover:${style.badge}`}>
            {style.label}
          </Badge>
          <span className={`font-semibold ${isExact ? "text-green-600" : ""}`}>
            {currencyFormatter.format(record.amount)}
          </span>
        </div>
        <div className="flex justify-between text-muted-foreground">
          <span className="truncate flex-1 mr-2" title={record.description}>
            {record.client || record.supplier || record.description}
          </span>
          <span className="whitespace-nowrap">{formatDate(record.date)}</span>
        </div>
      </button>
    );
  };

  // --- ESTADOS DE VISUALIZAÇÃO ---

  // 1. Já Conciliado
  if (transaction.status === "reconciled") {
    return (
      <Card className="border-green-200 bg-green-50/50 shadow-sm">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center">
                <Check className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-green-800">Transação Conciliada</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <Badge variant="outline" className="text-[10px] bg-white text-green-700 border-green-200">
                    {transaction.reconciliation?.match_type === "auto" ? "Automático" : "Manual"}
                  </Badge>
                  {transaction.reconciliation?.match_confidence && (
                    <span className="text-xs text-green-600">
                      {transaction.reconciliation.match_confidence}% confiança
                    </span>
                  )}
                </div>
              </div>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={onUnreconcile}
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <Unlink className="h-4 w-4 mr-2" />
              Desfazer
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // 2. Ignorado
  if (transaction.status === "ignored") {
    return (
      <Card className="border-dashed bg-muted/20">
        <CardContent className="pt-4 pb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <X className="h-5 w-5 text-muted-foreground" />
            <span className="text-sm font-medium text-muted-foreground">Esta transação foi ignorada</span>
          </div>
          <Button size="sm" variant="outline" onClick={onRestore}>
            Restaurar
          </Button>
        </CardContent>
      </Card>
    );
  }

  // 3. Pendente (Painel Principal)
  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3 border-b bg-muted/5">
        <div className="flex justify-between items-center">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Link2 className="h-4 w-4 text-primary" />
            Conciliar Lançamento
          </CardTitle>
          <span className="font-mono text-sm font-bold">{currencyFormatter.format(transaction.amount)}</span>
        </div>
        <CardDescription className="text-xs truncate">{transaction.description}</CardDescription>
      </CardHeader>

      <CardContent className="pt-4 space-y-4">
        {/* Sugestões de Match */}
        <div className="space-y-3">
          {exactMatches.length === 0 && approximateMatches.length === 0 && (
            <div className="text-center py-4 text-muted-foreground text-xs">
              Nenhuma sugestão automática encontrada.
            </div>
          )}

          {exactMatches.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-green-600 flex items-center gap-1.5">
                <Check className="h-3 w-3" /> Correspondência Exata
              </p>
              {exactMatches.map((r) => renderMatchItem(r, true))}
            </div>
          )}

          {approximateMatches.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-orange-600 flex items-center gap-1.5 mt-2">
                <AlertCircle className="h-3 w-3" /> Valores Próximos
              </p>
              {approximateMatches.slice(0, 3).map((r) => renderMatchItem(r, false))}
            </div>
          )}
        </div>

        {/* Seleção Manual */}
        <div className="space-y-2 pt-2 border-t">
          <label className="text-xs text-muted-foreground font-medium">Buscar outro registro manualmente:</label>
          <Select value={selectedRecordId} onValueChange={setSelectedRecordId}>
            <SelectTrigger className="text-xs h-9">
              <SelectValue placeholder="Selecione um registro..." />
            </SelectTrigger>
            <SelectContent>
              <ScrollArea className="h-[200px]">
                {/* Agrupar por Exatos/Outros no Select também melhora a UX */}
                {exactMatches.length > 0 && (
                  <SelectGroup>
                    <SelectLabel className="text-xs text-green-600">Sugeridos</SelectLabel>
                    {exactMatches.map((r) => (
                      <SelectItem key={r.id} value={r.id} className="text-xs">
                        {currencyFormatter.format(r.amount)} - {r.description}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                )}

                <SelectGroup>
                  <SelectLabel className="text-xs text-muted-foreground">Todos os pendentes</SelectLabel>
                  {otherRecords.map((record) => (
                    <SelectItem key={record.id} value={record.id} className="text-xs">
                      <span className={`${RECORD_STYLES[record.type].color} font-medium mr-1`}>
                        [{RECORD_STYLES[record.type].label}]
                      </span>
                      {formatDate(record.date)} - {currencyFormatter.format(record.amount)} -{" "}
                      {record.description?.substring(0, 20)}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </ScrollArea>
            </SelectContent>
          </Select>
        </div>

        {/* Botões de Ação */}
        <div className="flex gap-2 pt-2">
          <Button
            size="sm"
            onClick={handleReconcile}
            disabled={!selectedRecordId}
            className={`flex-1 transition-all ${selectedRecordId ? "opacity-100" : "opacity-80"}`}
          >
            {selectedRecordId ? (
              <>
                <Check className="h-4 w-4 mr-2" /> Confirmar Vínculo
              </>
            ) : (
              "Selecione um registro"
            )}
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={onIgnore}
            title="Ignorar esta transação por enquanto"
            className="text-muted-foreground hover:text-foreground"
          >
            Ignorar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
