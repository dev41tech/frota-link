import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Loader2, Search, Package, CalendarIcon, X, ArrowUpDown } from 'lucide-react';
import { useFreightRequests, type FreightRequest } from '@/hooks/useFreightRequests';
import { FreightRequestCard } from '@/components/freight/FreightRequestCard';
import { StartOperationDialog } from '@/components/freight/StartOperationDialog';
import { ApproveRequestDialog } from '@/components/freight/ApproveRequestDialog';
import { useToast } from '@/hooks/use-toast';
import { format, isAfter, isBefore, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

export default function FreightRequests() {
  const navigate = useNavigate();
  const { requests, loading, updateRequestStatus, startOperation, companyId } = useFreightRequests();
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [clientFilter, setClientFilter] = useState('all');
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({ from: undefined, to: undefined });
  const [sortBy, setSortBy] = useState('newest');
  const [operationRequest, setOperationRequest] = useState<FreightRequest | null>(null);
  const [approveRequest, setApproveRequest] = useState<FreightRequest | null>(null);

  const uniqueClients = useMemo(() => {
    const map = new Map<string, string>();
    requests.forEach(r => {
      if (r.party_id && r.party_name) map.set(r.party_id, r.party_name);
    });
    return Array.from(map, ([id, name]) => ({ id, name }));
  }, [requests]);

  const hasActiveFilters = search !== '' || statusFilter !== 'all' || clientFilter !== 'all' || dateRange.from || sortBy !== 'newest';

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('all');
    setClientFilter('all');
    setDateRange({ from: undefined, to: undefined });
    setSortBy('newest');
  };

  const filtered = useMemo(() => {
    let result = requests.filter(r => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (clientFilter !== 'all' && r.party_id !== clientFilter) return false;
      if (dateRange.from && isBefore(new Date(r.created_at), startOfDay(dateRange.from))) return false;
      if (dateRange.to && isAfter(new Date(r.created_at), endOfDay(dateRange.to))) return false;
      if (search) {
        const q = search.toLowerCase();
        const matchFields = [
          r.request_number, r.party_name, r.origin_city, r.destination_city, r.nfe_number,
        ].filter(Boolean).map(f => f!.toLowerCase());
        if (!matchFields.some(f => f.includes(q))) return false;
      }
      return true;
    });

    result.sort((a, b) => {
      switch (sortBy) {
        case 'oldest':
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case 'highest_value':
          return (b.freight_value || 0) - (a.freight_value || 0);
        case 'lowest_value':
          return (a.freight_value || 0) - (b.freight_value || 0);
        case 'newest':
        default:
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });

    return result;
  }, [requests, statusFilter, clientFilter, dateRange, search, sortBy]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    requests.forEach(r => { counts[r.status] = (counts[r.status] || 0) + 1; });
    return counts;
  }, [requests]);

  const handleReject = async (request: FreightRequest) => {
    const ok = await updateRequestStatus(request.id, 'rejected');
    if (ok) toast({ title: 'Solicitação rejeitada' });
  };

  const handleApproveConfirm = async (requestId: string, data: {
    collection_address: string;
    collection_date: string | null;
    collection_notes: string | null;
    approved_by_operator_at: string;
  }) => {
    const ok = await updateRequestStatus(requestId, 'approved', {
      collection_address: data.collection_address,
      collection_date: data.collection_date,
      collection_notes: data.collection_notes,
      approved_by_operator_at: data.approved_by_operator_at,
    });
    if (ok) toast({ title: 'Solicitação aprovada', description: 'Agora você pode iniciar a operação.' });
    return ok;
  };

  const handleConfirmOperation = async (vehicleId: string, driverId: string) => {
    if (!operationRequest) return false;
    return await startOperation(operationRequest.id, vehicleId, driverId, operationRequest);
  };

  const handleEmitDocuments = (request: FreightRequest) => {
    navigate('/cte');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Package className="h-6 w-6" />
            Solicitações de Frete
          </h1>
          <p className="text-muted-foreground text-sm">Gerencie as solicitações recebidas pelo portal do cliente</p>
        </div>
      </div>

      {/* Status summary */}
      <div className="flex flex-wrap gap-2">
        {[
          { key: 'all', label: 'Todos', count: requests.length },
          { key: 'pending', label: 'Pendentes', count: statusCounts['pending'] || 0 },
          { key: 'approved', label: 'Aprovados', count: statusCounts['approved'] || 0 },
          { key: 'in_operation', label: 'Em Operação', count: statusCounts['in_operation'] || 0 },
          { key: 'completed', label: 'Concluídos', count: statusCounts['completed'] || 0 },
          { key: 'rejected', label: 'Rejeitados', count: statusCounts['rejected'] || 0 },
        ].map(s => (
          <Badge
            key={s.key}
            variant={statusFilter === s.key ? 'default' : 'outline'}
            className="cursor-pointer"
            onClick={() => setStatusFilter(s.key)}
          >
            {s.label} ({s.count})
          </Badge>
        ))}
      </div>

      {/* Filters bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por número, cliente, cidade..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {uniqueClients.length > 0 && (
          <Select value={clientFilter} onValueChange={setClientFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Cliente" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os clientes</SelectItem>
              {uniqueClients.map(c => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Date range picker */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className={cn("w-[220px] justify-start text-left font-normal", !dateRange.from && "text-muted-foreground")}>
              <CalendarIcon className="mr-2 h-4 w-4" />
              {dateRange.from ? (
                dateRange.to ? (
                  `${format(dateRange.from, "dd/MM/yy")} - ${format(dateRange.to, "dd/MM/yy")}`
                ) : format(dateRange.from, "dd/MM/yy")
              ) : "Período"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="range"
              selected={dateRange.from ? { from: dateRange.from, to: dateRange.to } : undefined}
              onSelect={(range) => setDateRange({ from: range?.from, to: range?.to })}
              numberOfMonths={2}
              locale={ptBR}
              className={cn("p-3 pointer-events-auto")}
            />
          </PopoverContent>
        </Popover>

        {/* Sort */}
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-[170px]">
            <ArrowUpDown className="mr-2 h-4 w-4" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Mais recentes</SelectItem>
            <SelectItem value="oldest">Mais antigos</SelectItem>
            <SelectItem value="highest_value">Maior valor</SelectItem>
            <SelectItem value="lowest_value">Menor valor</SelectItem>
          </SelectContent>
        </Select>

        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <X className="h-4 w-4 mr-1" />
            Limpar filtros
          </Button>
        )}
      </div>

      {/* Results counter */}
      <p className="text-sm text-muted-foreground">
        Exibindo {filtered.length} de {requests.length} solicitações
      </p>

      {/* Request cards */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p>Nenhuma solicitação encontrada</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map(r => (
            <FreightRequestCard
              key={r.id}
              request={r}
              onStartOperation={setOperationRequest}
              onReject={handleReject}
              onApprove={setApproveRequest}
              onEmitDocuments={handleEmitDocuments}
            />
          ))}
        </div>
      )}

      {/* Approve dialog */}
      <ApproveRequestDialog
        open={!!approveRequest}
        onOpenChange={open => { if (!open) setApproveRequest(null); }}
        request={approveRequest}
        onConfirm={handleApproveConfirm}
      />

      {/* Start operation dialog */}
      <StartOperationDialog
        open={!!operationRequest}
        onOpenChange={open => { if (!open) setOperationRequest(null); }}
        request={operationRequest}
        companyId={companyId || ''}
        onConfirm={handleConfirmOperation}
      />
    </div>
  );
}
