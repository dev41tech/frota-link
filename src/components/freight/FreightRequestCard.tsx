import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MapPin, Package, DollarSign, User, Truck, Play, FileText, Clock, CheckCircle, CalendarClock } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { FreightRequest } from '@/hooks/useFreightRequests';

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  pending: { label: 'Pendente', variant: 'secondary' },
  quoted: { label: 'Cotado', variant: 'outline' },
  approved: { label: 'Aprovado', variant: 'default' },
  rejected: { label: 'Rejeitado', variant: 'destructive' },
  in_operation: { label: 'Em Operação', variant: 'default' },
  completed: { label: 'Concluído', variant: 'secondary' },
};

interface FreightRequestCardProps {
  request: FreightRequest;
  onStartOperation: (request: FreightRequest) => void;
  onReject: (request: FreightRequest) => void;
  onApprove?: (request: FreightRequest) => void;
  onEmitDocuments?: (request: FreightRequest) => void;
}

export function FreightRequestCard({ request, onStartOperation, onReject, onApprove, onEmitDocuments }: FreightRequestCardProps) {
  const status = statusConfig[request.status] || { label: request.status, variant: 'secondary' as const };
  const canApprove = request.status === 'pending';
  const canStartOperation = request.status === 'approved';
  const canReject = ['pending', 'quoted', 'approved'].includes(request.status);
  const canEmitDocs = request.status === 'in_operation' && !request.cte_document_id;

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm">{request.request_number || 'Sem número'}</span>
            <Badge variant={status.variant}>{status.label}</Badge>
          </div>
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {format(new Date(request.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
          </span>
        </div>

        {/* Client */}
        <div className="flex items-center gap-2 text-sm">
          <User className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{request.party_name}</span>
        </div>

        {/* Route */}
        <div className="flex items-center gap-2 text-sm">
          <MapPin className="h-4 w-4 text-muted-foreground" />
          <span>
            {request.origin_city}/{request.origin_state} → {request.destination_city}/{request.destination_state}
          </span>
        </div>

        {/* Cargo + Value */}
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-muted-foreground" />
            <span>{request.cargo_weight_kg ? `${Number(request.cargo_weight_kg).toLocaleString('pt-BR')} kg` : '-'}</span>
          </div>
          <div className="flex items-center gap-1 font-semibold text-primary">
            <DollarSign className="h-4 w-4" />
            {request.freight_value ? `R$ ${Number(request.freight_value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '-'}
          </div>
        </div>

        {/* Operation info */}
        {(request.status === 'in_operation' || request.status === 'completed') && (
          <div className="flex items-center gap-4 text-xs text-muted-foreground border-t pt-2">
            {request.vehicle_plate && (
              <span className="flex items-center gap-1"><Truck className="h-3 w-3" />{request.vehicle_plate}</span>
            )}
            {request.driver_name && (
              <span className="flex items-center gap-1"><User className="h-3 w-3" />{request.driver_name}</span>
            )}
            {request.cte_document_id && (
              <Badge variant="outline" className="text-xs">
                <FileText className="h-3 w-3 mr-1" />
                CT-e Emitido
              </Badge>
            )}
          </div>
        )}

        {/* Collection info (when approved) */}
        {request.status === 'approved' && request.collection_date && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground border-t pt-2">
            <CalendarClock className="h-3 w-3" />
            <span>Coleta prevista: {format(new Date(request.collection_date), "dd/MM/yy HH:mm", { locale: ptBR })}</span>
          </div>
        )}

        {/* Notes */}
        {request.customer_notes && (
          <p className="text-xs text-muted-foreground italic border-t pt-2">"{request.customer_notes}"</p>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          {canApprove && onApprove && (
            <Button size="sm" onClick={() => onApprove(request)} className="flex-1 bg-emerald-600 hover:bg-emerald-700">
              <CheckCircle className="h-4 w-4 mr-1" />
              Aprovar
            </Button>
          )}
          {canStartOperation && (
            <Button size="sm" onClick={() => onStartOperation(request)} className="flex-1">
              <Play className="h-4 w-4 mr-1" />
              Iniciar Operação
            </Button>
          )}
          {canEmitDocs && onEmitDocuments && (
            <Button size="sm" variant="secondary" onClick={() => onEmitDocuments(request)} className="flex-1">
              <FileText className="h-4 w-4 mr-1" />
              Emitir Documentos
            </Button>
          )}
          {canReject && (
            <Button size="sm" variant="outline" onClick={() => onReject(request)}>
              Rejeitar
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
