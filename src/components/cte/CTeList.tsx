import { useState, useEffect } from 'react';
import { useMultiTenant } from '@/hooks/useMultiTenant';
import { supabase } from '@/integrations/supabase/client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Edit, Download, X, Search, RefreshCw, AlertTriangle, FileText, ArrowUpCircle, Copy, Trash2, FlaskConical, Building2 } from 'lucide-react';
import { format, differenceInHours } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';

interface CTe {
  id: string;
  cte_number: string;
  cte_key?: string;
  status: string;
  recipient_name: string;
  freight_value: number;
  emission_date: string;
  created_at: string;
  journey_id?: string;
  is_draft?: boolean;
  environment?: string;
}

interface CTeListProps {
  onEdit: () => void;
}

export function CTeList({ onEdit }: CTeListProps) {
  const [ctes, setCtes] = useState<CTe[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [environmentFilter, setEnvironmentFilter] = useState('all');
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedCte, setSelectedCte] = useState<CTe | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [cancellationReason, setCancellationReason] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { currentCompany } = useMultiTenant();
  const { toast } = useToast();

  const fetchCTes = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('cte_documents')
        .select('*')
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (currentCompany) {
        query = query.eq('company_id', currentCompany.id);
      }

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      if (environmentFilter !== 'all') {
        query = query.eq('environment', environmentFilter);
      }

      const { data, error } = await query;

      if (error) throw error;
      setCtes(data || []);
      setSelectedIds(new Set());
    } catch (error) {
      console.error('Error fetching CT-es:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar CT-es",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCTes();
  }, [currentCompany, statusFilter, environmentFilter]);

  const filteredCTes = ctes.filter(cte =>
    cte.recipient_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    cte.cte_number?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusBadge = (status: string, isDraft?: boolean) => {
    if (isDraft) {
      return (
        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300">
          <FileText className="h-3 w-3 mr-1" />
          Rascunho
        </Badge>
      );
    }

    const statusMap = {
      draft: { label: 'Rascunho', variant: 'secondary' as const },
      processing: { label: 'Processando', variant: 'default' as const },
      authorized: { label: 'Autorizado', variant: 'default' as const },
      cancelled: { label: 'Cancelado', variant: 'destructive' as const },
      rejected: { label: 'Rejeitado', variant: 'destructive' as const },
    };

    const config = statusMap[status as keyof typeof statusMap] || { label: status, variant: 'secondary' as const };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getEnvironmentBadge = (environment?: string) => {
    if (environment === 'producao') {
      return (
        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
          <Building2 className="h-3 w-3 mr-1" />
          Produção
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-300">
        <FlaskConical className="h-3 w-3 mr-1" />
        Homologação
      </Badge>
    );
  };

  const handleDownload = async (cteId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('cte-download', {
        body: { cteId }
      });

      if (error) {
        console.error('[CTeList] Erro invoke:', error);
        toast({
          title: "Erro de conexão",
          description: "Não foi possível conectar ao servidor. Tente novamente.",
          variant: "destructive",
        });
        return;
      }

      const response = data as { 
        success?: boolean; 
        error?: string; 
        status?: string;
        content?: number[]; 
        filename?: string;
        contentType?: string;
      };

      if (!response?.success) {
        const isProcessing = response?.status === "processing" || response?.status === "not_authorized";
        toast({
          title: isProcessing ? "CT-e em processamento" : "Erro",
          description: response?.error || "Erro ao baixar CT-e",
          variant: isProcessing ? "default" : "destructive",
        });
        return;
      }

      if (!response.content || !response.filename) {
        toast({
          title: "Erro",
          description: "Resposta inválida do servidor. Tente novamente.",
          variant: "destructive",
        });
        return;
      }

      const uint8Array = new Uint8Array(response.content);
      const blob = new Blob([uint8Array], { type: response.contentType || 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = response.filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Sucesso",
        description: "CT-e baixado com sucesso",
      });
    } catch (error) {
      console.error('Error downloading CT-e:', error);
      toast({
        title: "Erro",
        description: "Erro ao baixar CT-e",
        variant: "destructive",
      });
    }
  };

  const openCancelDialog = (cte: CTe) => {
    if (cte.emission_date) {
      const hoursSinceEmission = differenceInHours(new Date(), new Date(cte.emission_date));
      if (hoursSinceEmission > 24) {
        toast({
          title: "Prazo expirado",
          description: "CT-e só pode ser cancelado em até 24 horas após a emissão",
          variant: "destructive",
        });
        return;
      }
    }
    
    setSelectedCte(cte);
    setCancellationReason('');
    setCancelDialogOpen(true);
  };

  const handleConfirmCancel = async () => {
    if (!selectedCte || !cancellationReason.trim()) {
      toast({
        title: "Erro",
        description: "É necessário informar o motivo do cancelamento",
        variant: "destructive",
      });
      return;
    }

    if (cancellationReason.length < 15) {
      toast({
        title: "Motivo muito curto",
        description: "O motivo deve ter pelo menos 15 caracteres",
        variant: "destructive",
      });
      return;
    }

    try {
      setCancelling(true);
      const { error } = await supabase.functions.invoke('cte-cancel', {
        body: { 
          cteId: selectedCte.id,
          reason: cancellationReason 
        }
      });

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "CT-e cancelado com sucesso",
      });
      
      setCancelDialogOpen(false);
      fetchCTes();
    } catch (error: any) {
      console.error('Error cancelling CT-e:', error);
      toast({
        title: "Erro ao cancelar",
        description: error.message || "Erro ao cancelar CT-e",
        variant: "destructive",
      });
    } finally {
      setCancelling(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredCTes.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredCTes.map(cte => cte.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const canDeleteCte = (cte: CTe) => {
    // Pode excluir: rejeitados, rascunhos, cancelados
    if (['rejected', 'draft', 'cancelled'].includes(cte.status)) return true;
    // Pode excluir: autorizados em homologação (são apenas testes)
    if (cte.status === 'authorized' && cte.environment === 'homologacao') return true;
    // Não pode excluir: autorizados em produção (são documentos fiscais válidos)
    return false;
  };

  const getSelectedDeletable = () => {
    return filteredCTes.filter(cte => selectedIds.has(cte.id) && canDeleteCte(cte));
  };

  const getSelectedNotDeletable = () => {
    return filteredCTes.filter(cte => selectedIds.has(cte.id) && !canDeleteCte(cte));
  };

  const handleOpenDeleteDialog = () => {
    const deletable = getSelectedDeletable();
    if (deletable.length === 0) {
      toast({
        title: "Nenhum CT-e pode ser excluído",
        description: "CT-es autorizados em produção não podem ser excluídos por serem documentos fiscais válidos.",
        variant: "destructive",
      });
      return;
    }
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    const toDelete = getSelectedDeletable();
    if (toDelete.length === 0) return;

    try {
      setDeleting(true);
      
      const { error } = await supabase
        .from('cte_documents')
        .update({ deleted_at: new Date().toISOString() })
        .in('id', toDelete.map(cte => cte.id));

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: `${toDelete.length} CT-e(s) excluído(s) com sucesso`,
      });
      
      setDeleteDialogOpen(false);
      setSelectedIds(new Set());
      fetchCTes();
    } catch (error: any) {
      console.error('Error deleting CT-es:', error);
      toast({
        title: "Erro ao excluir",
        description: error.message || "Erro ao excluir CT-es",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  const handleClearAllTests = async () => {
    try {
      setDeleting(true);
      
      const { error } = await supabase
        .from('cte_documents')
        .update({ deleted_at: new Date().toISOString() })
        .eq('company_id', currentCompany?.id)
        .eq('environment', 'homologacao')
        .is('deleted_at', null);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Todos os CT-es de homologação foram excluídos",
      });
      
      setDeleteDialogOpen(false);
      fetchCTes();
    } catch (error: any) {
      console.error('Error clearing tests:', error);
      toast({
        title: "Erro ao limpar testes",
        description: error.message || "Erro ao limpar CT-es de teste",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <RefreshCw className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  const selectedCount = selectedIds.size;
  const deletableCount = getSelectedDeletable().length;
  const notDeletableCount = getSelectedNotDeletable().length;
  const homologacaoCount = ctes.filter(c => c.environment === 'homologacao').length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por destinatário ou número..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos status</SelectItem>
            <SelectItem value="draft">Rascunho</SelectItem>
            <SelectItem value="processing">Processando</SelectItem>
            <SelectItem value="authorized">Autorizado</SelectItem>
            <SelectItem value="cancelled">Cancelado</SelectItem>
            <SelectItem value="rejected">Rejeitado</SelectItem>
          </SelectContent>
        </Select>
        <Select value={environmentFilter} onValueChange={setEnvironmentFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Ambiente" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos ambientes</SelectItem>
            <SelectItem value="homologacao">Homologação</SelectItem>
            <SelectItem value="producao">Produção</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={fetchCTes} variant="outline" size="icon">
          <RefreshCw className="h-4 w-4" />
        </Button>
        {homologacaoCount > 0 && (
          <Button 
            variant="outline" 
            className="text-orange-600 border-orange-300 hover:bg-orange-50"
            onClick={() => setDeleteDialogOpen(true)}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Limpar Testes ({homologacaoCount})
          </Button>
        )}
      </div>

      {selectedCount > 0 && (
        <div className="flex items-center gap-4 p-3 bg-muted rounded-lg">
          <span className="text-sm font-medium">
            {selectedCount} selecionado(s)
          </span>
          <Button 
            variant="destructive" 
            size="sm"
            onClick={handleOpenDeleteDialog}
            disabled={deletableCount === 0}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Excluir {deletableCount > 0 ? `(${deletableCount})` : ''}
          </Button>
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => setSelectedIds(new Set())}
          >
            Limpar seleção
          </Button>
        </div>
      )}

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]">
                <Checkbox 
                  checked={selectedIds.size === filteredCTes.length && filteredCTes.length > 0}
                  onCheckedChange={toggleSelectAll}
                />
              </TableHead>
              <TableHead>Número</TableHead>
              <TableHead>Destinatário</TableHead>
              <TableHead>Valor do Frete</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Ambiente</TableHead>
              <TableHead>Data de Emissão</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredCTes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  Nenhum CT-e encontrado
                </TableCell>
              </TableRow>
            ) : (
              filteredCTes.map((cte) => (
                <TableRow key={cte.id} className={selectedIds.has(cte.id) ? 'bg-muted/50' : ''}>
                  <TableCell>
                    <Checkbox 
                      checked={selectedIds.has(cte.id)}
                      onCheckedChange={() => toggleSelect(cte.id)}
                    />
                  </TableCell>
                  <TableCell className="font-medium">
                    {cte.cte_number || 'Sem número'}
                  </TableCell>
                  <TableCell>{cte.recipient_name}</TableCell>
                  <TableCell>
                    {cte.freight_value ? `R$ ${cte.freight_value.toFixed(2)}` : '-'}
                  </TableCell>
                  <TableCell>{getStatusBadge(cte.status, cte.is_draft)}</TableCell>
                  <TableCell>{getEnvironmentBadge(cte.environment)}</TableCell>
                  <TableCell>
                    {cte.emission_date 
                      ? format(new Date(cte.emission_date), 'dd/MM/yyyy', { locale: ptBR })
                      : format(new Date(cte.created_at), 'dd/MM/yyyy', { locale: ptBR })
                    }
                  </TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button variant="ghost" size="sm" onClick={onEdit}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    {cte.cte_key && (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => {
                          navigator.clipboard.writeText(cte.cte_key!);
                          toast({
                            title: "Copiado",
                            description: "Chave de acesso copiada para a área de transferência",
                          });
                        }}
                        title="Copiar chave de acesso"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    )}
                    {cte.status === 'authorized' && (
                      <Button variant="ghost" size="sm" onClick={() => handleDownload(cte.id)}>
                        <Download className="h-4 w-4" />
                      </Button>
                    )}
                    {cte.is_draft && cte.status === 'authorized' && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="text-green-600 border-green-300 hover:bg-green-50"
                        title="Converter para emissão real"
                      >
                        <ArrowUpCircle className="h-4 w-4" />
                      </Button>
                    )}
                    {cte.status === 'authorized' && !cte.is_draft && cte.environment === 'producao' && (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => openCancelDialog(cte)}
                        className="text-destructive hover:text-destructive"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                    {canDeleteCte(cte) && (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => {
                          setSelectedIds(new Set([cte.id]));
                          setDeleteDialogOpen(true);
                        }}
                        className="text-muted-foreground hover:text-destructive"
                        title="Excluir CT-e"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Dialog de Cancelamento */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Cancelar CT-e
            </DialogTitle>
            <DialogDescription>
              Esta ação não pode ser desfeita. O CT-e será cancelado na SEFAZ.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <p className="text-sm font-medium">
                CT-e: {selectedCte?.cte_number}
              </p>
              <p className="text-sm text-muted-foreground">
                Destinatário: {selectedCte?.recipient_name}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="reason">Motivo do Cancelamento *</Label>
              <Textarea
                id="reason"
                placeholder="Informe o motivo do cancelamento (mínimo 15 caracteres)"
                value={cancellationReason}
                onChange={(e) => setCancellationReason(e.target.value)}
                rows={4}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground">
                {cancellationReason.length}/15 caracteres mínimos
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCancelDialogOpen(false)}
              disabled={cancelling}
            >
              Voltar
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmCancel}
              disabled={cancelling || cancellationReason.length < 15}
            >
              {cancelling ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Cancelando...
                </>
              ) : (
                'Confirmar Cancelamento'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Exclusão */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-destructive" />
              Excluir CT-es
            </DialogTitle>
            <DialogDescription>
              Esta ação removerá os CT-es selecionados do histórico.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {selectedCount > 0 ? (
              <>
                <p className="text-sm">
                  Você está prestes a excluir:
                </p>
                <ul className="text-sm space-y-1 ml-4">
                  {deletableCount > 0 && (
                    <li className="text-muted-foreground">
                      • {deletableCount} CT-e(s) que podem ser excluídos
                    </li>
                  )}
                  {notDeletableCount > 0 && (
                    <li className="text-destructive">
                      • {notDeletableCount} CT-e(s) autorizados em produção (não serão excluídos)
                    </li>
                  )}
                </ul>
              </>
            ) : (
              <>
                <p className="text-sm">
                  Deseja limpar todos os CT-es de <strong>homologação</strong>?
                </p>
                <p className="text-sm text-muted-foreground">
                  Isso removerá {homologacaoCount} CT-e(s) de teste do histórico.
                </p>
              </>
            )}
            
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-md">
              <p className="text-sm text-amber-800">
                <strong>Nota:</strong> Esta ação não pode ser desfeita. Os registros serão marcados como excluídos e não aparecerão mais no sistema.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={deleting}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={selectedCount > 0 ? handleConfirmDelete : handleClearAllTests}
              disabled={deleting || (selectedCount > 0 && deletableCount === 0)}
            >
              {deleting ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Excluindo...
                </>
              ) : (
                'Confirmar Exclusão'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
