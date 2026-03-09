import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Fuel, Receipt, AlertCircle, MoreHorizontal, Link2, EyeOff, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatCurrency } from "@/lib/profitabilityCalculations";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { UnlinkedExpense } from "@/hooks/useVehicleProfitability";
import { LinkToJourneyDialog } from "./LinkToJourneyDialog";

interface UnlinkedExpensesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expenses: UnlinkedExpense[];
  onRefresh?: () => void;
}

export function UnlinkedExpensesDialog({
  open,
  onOpenChange,
  expenses,
  onRefresh,
}: UnlinkedExpensesDialogProps) {
  const { toast } = useToast();
  const [selectedExpense, setSelectedExpense] = useState<UnlinkedExpense | null>(null);
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const totalAmount = expenses.reduce((sum, e) => sum + e.amount, 0);
  const fuelCount = expenses.filter(e => e.type === 'fuel').length;
  const expenseCount = expenses.filter(e => e.type === 'expense').length;

  const handleIgnore = async (expense: UnlinkedExpense) => {
    try {
      setActionLoading(true);
      const table = expense.type === 'fuel' ? 'fuel_expenses' : 'expenses';
      
      const { error } = await supabase
        .from(table)
        .update({ is_ignored: true })
        .eq('id', expense.id);

      if (error) throw error;

      toast({
        title: "Despesa ignorada",
        description: "A despesa não aparecerá mais nos alertas de qualidade.",
      });
      onRefresh?.();
    } catch (err: any) {
      toast({
        title: "Erro ao ignorar",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedExpense) return;
    
    try {
      setActionLoading(true);
      const table = selectedExpense.type === 'fuel' ? 'fuel_expenses' : 'expenses';
      
      const { error } = await supabase
        .from(table)
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', selectedExpense.id);

      if (error) throw error;

      toast({
        title: "Despesa excluída",
        description: "A despesa foi removida com sucesso.",
      });
      setShowDeleteConfirm(false);
      setSelectedExpense(null);
      onRefresh?.();
    } catch (err: any) {
      toast({
        title: "Erro ao excluir",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleLinkSuccess = () => {
    setShowLinkDialog(false);
    setSelectedExpense(null);
    onRefresh?.();
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-warning" />
              Despesas Não Vinculadas a Jornadas
            </DialogTitle>
            <DialogDescription>
              Estas despesas foram registradas no período mas não estão vinculadas a nenhuma jornada.
              Use as ações para vincular, ignorar ou excluir.
            </DialogDescription>
          </DialogHeader>

          {/* Summary badges */}
          <div className="flex flex-wrap gap-2 py-2">
            <Badge variant="outline" className="gap-1">
              <Receipt className="h-3 w-3" />
              {expenseCount} despesa(s)
            </Badge>
            <Badge variant="outline" className="gap-1">
              <Fuel className="h-3 w-3" />
              {fuelCount} abastecimento(s)
            </Badge>
            <Badge variant="secondary" className="gap-1 font-semibold">
              Total: {formatCurrency(totalAmount)}
            </Badge>
          </div>

          {/* Table */}
          <div className="flex-1 overflow-auto border rounded-md">
            <Table>
              <TableHeader className="sticky top-0 bg-background">
                <TableRow>
                  <TableHead className="w-[80px]">Tipo</TableHead>
                  <TableHead className="w-[100px]">Data</TableHead>
                  <TableHead className="w-[100px]">Veículo</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="text-right w-[120px]">Valor</TableHead>
                  <TableHead className="w-[60px] text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expenses.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      Nenhuma despesa não vinculada encontrada.
                    </TableCell>
                  </TableRow>
                ) : (
                  expenses
                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                    .map((expense) => (
                      <TableRow key={`${expense.type}-${expense.id}`}>
                        <TableCell>
                          {expense.type === 'fuel' ? (
                            <Badge variant="outline" className="gap-1 text-amber-600 border-amber-200 bg-amber-50">
                              <Fuel className="h-3 w-3" />
                              Comb.
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="gap-1 text-blue-600 border-blue-200 bg-blue-50">
                              <Receipt className="h-3 w-3" />
                              Desp.
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="font-medium">
                          {format(new Date(expense.date), "dd/MM/yyyy", { locale: ptBR })}
                        </TableCell>
                        <TableCell>
                          <span className="font-mono text-sm">{expense.vehiclePlate}</span>
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate" title={expense.description}>
                          {expense.description}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(expense.amount)}
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" disabled={actionLoading}>
                                <MoreHorizontal className="h-4 w-4" />
                                <span className="sr-only">Abrir menu</span>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="bg-popover">
                              <DropdownMenuItem 
                                onClick={() => {
                                  setSelectedExpense(expense);
                                  setShowLinkDialog(true);
                                }}
                              >
                                <Link2 className="h-4 w-4 mr-2" />
                                Vincular a Jornada
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleIgnore(expense)}>
                                <EyeOff className="h-4 w-4 mr-2" />
                                Ignorar
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                onClick={() => {
                                  setSelectedExpense(expense);
                                  setShowDeleteConfirm(true);
                                }}
                                className="text-destructive focus:text-destructive"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Excluir
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Footer with total */}
          {expenses.length > 0 && (
            <div className="flex justify-between items-center pt-4 border-t">
              <span className="text-sm text-muted-foreground">
                {expenses.length} registro(s) encontrado(s)
              </span>
              <div className="text-right">
                <span className="text-sm text-muted-foreground mr-2">Total:</span>
                <span className="text-lg font-bold">{formatCurrency(totalAmount)}</span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Link to Journey Dialog */}
      {selectedExpense && (
        <LinkToJourneyDialog
          open={showLinkDialog}
          onOpenChange={setShowLinkDialog}
          expense={selectedExpense}
          onSuccess={handleLinkSuccess}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta despesa? Esta ação pode ser revertida posteriormente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
