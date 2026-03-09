import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { FileText, Trash2, CheckCircle, Clock, Calendar } from 'lucide-react';
import type { ImportBatch } from '@/hooks/useBankReconciliation';

interface ImportHistoryProps {
  batches: ImportBatch[];
  onDeleteBatch: (batchId: string) => void;
  onSelectBatch?: (batchId: string | null) => void;
  selectedBatchId?: string | null;
}

export function ImportHistory({
  batches,
  onDeleteBatch,
  onSelectBatch,
  selectedBatchId,
}: ImportHistoryProps) {
  const [deletingBatchId, setDeletingBatchId] = useState<string | null>(null);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleDelete = (batchId: string) => {
    onDeleteBatch(batchId);
    setDeletingBatchId(null);
  };

  if (batches.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Calendar className="h-4 w-4" />
          Histórico de Importações
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {onSelectBatch && (
            <Button
              variant={selectedBatchId === null ? 'secondary' : 'ghost'}
              size="sm"
              className="w-full justify-start"
              onClick={() => onSelectBatch(null)}
            >
              Todas as importações
            </Button>
          )}
          
          {batches.map(batch => {
            const progressPercent = batch.transaction_count > 0
              ? Math.round((batch.reconciled_count / batch.transaction_count) * 100)
              : 0;

            return (
              <div
                key={batch.id}
                className={`flex items-center justify-between p-2 rounded-lg border transition-colors ${
                  selectedBatchId === batch.id ? 'border-primary bg-accent' : 'hover:bg-accent/50'
                }`}
              >
                <button
                  className="flex-1 text-left"
                  onClick={() => onSelectBatch?.(batch.id)}
                >
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium truncate max-w-[150px]">
                        {batch.file_name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(batch.imported_at)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline" className="text-xs">
                      {batch.file_type.toUpperCase()}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {batch.transaction_count} transações
                    </span>
                    {progressPercent === 100 ? (
                      <Badge className="text-xs bg-green-600">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Completo
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-xs">
                        <Clock className="h-3 w-3 mr-1" />
                        {progressPercent}%
                      </Badge>
                    )}
                  </div>
                </button>

                <AlertDialog
                  open={deletingBatchId === batch.id}
                  onOpenChange={(open) => !open && setDeletingBatchId(null)}
                >
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeletingBatchId(batch.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Excluir importação?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Esta ação excluirá todas as {batch.transaction_count} transações 
                        desta importação. As conciliações serão desfeitas.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        onClick={() => handleDelete(batch.id)}
                      >
                        Excluir
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
