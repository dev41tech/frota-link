import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { CheckCircle, Loader2, MapPin, Package, User, CalendarClock } from 'lucide-react';
import type { FreightRequest } from '@/hooks/useFreightRequests';

function buildCollectionAddress(request: FreightRequest): string {
  const addr = (request.nfe_xml_data as any)?.emitter?.address;
  if (addr) {
    const parts: string[] = [];
    const streetPart = [addr.logradouro, addr.numero].filter(Boolean).join(', ');
    if (streetPart) parts.push(streetPart);
    if (addr.bairro) parts.push(addr.bairro);
    const cityUf = [addr.cidade, addr.uf].filter(Boolean).join('/');
    if (cityUf) parts.push(cityUf);
    if (addr.cep) parts.push(`CEP ${addr.cep}`);
    if (parts.length > 0) {
      // Format: "Rua X, 123 - Bairro, Cidade/UF - CEP 00000-000"
      const [street, ...rest] = parts;
      return [street, rest.join(', ')].filter(Boolean).join(' - ');
    }
  }
  // Fallback 2: emitter city/state (registros antigos sem address)
  const emitter = (request.nfe_xml_data as any)?.emitter;
  if (emitter?.city && emitter?.state) {
    return `${emitter.city} - ${emitter.state}`;
  }
  // Fallback 3: origin_city/origin_state da tabela freight_requests
  return [request.origin_city, request.origin_state].filter(Boolean).join(' - ');
}

interface ApproveRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  request: FreightRequest | null;
  onConfirm: (requestId: string, data: {
    collection_address: string;
    collection_date: string | null;
    collection_notes: string | null;
    approved_by_operator_at: string;
  }) => Promise<boolean>;
}

export function ApproveRequestDialog({ open, onOpenChange, request, onConfirm }: ApproveRequestDialogProps) {
  const [collectionAddress, setCollectionAddress] = useState('');
  const [collectionDate, setCollectionDate] = useState('');
  const [collectionNotes, setCollectionNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open && request) {
      setCollectionAddress(buildCollectionAddress(request));
      setCollectionDate('');
      setCollectionNotes('');
    }
  }, [open, request]);

  const handleConfirm = async () => {
    if (!request || !collectionAddress.trim()) return;
    setSubmitting(true);
    const success = await onConfirm(request.id, {
      collection_address: collectionAddress.trim(),
      collection_date: collectionDate || null,
      collection_notes: collectionNotes.trim() || null,
      approved_by_operator_at: new Date().toISOString(),
    });
    setSubmitting(false);
    if (success) onOpenChange(false);
  };

  if (!request) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-emerald-600" />
            Aprovar Solicitação
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Request summary */}
          <div className="rounded-lg bg-muted/50 p-3 space-y-1 text-sm">
            <div className="flex items-center gap-2">
              <span className="font-semibold">{request.request_number}</span>
            </div>
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <span>{request.party_name}</span>
            </div>
            <div className="text-muted-foreground">
              {request.origin_city}/{request.origin_state} → {request.destination_city}/{request.destination_state}
            </div>
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1">
                <Package className="h-4 w-4 text-muted-foreground" />
                {request.cargo_weight_kg ? `${Number(request.cargo_weight_kg).toLocaleString('pt-BR')} kg` : '-'}
              </span>
              <span className="font-semibold text-primary">
                {request.freight_value
                  ? `R$ ${Number(request.freight_value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                  : '-'}
              </span>
            </div>
          </div>

          {/* Collection address */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <MapPin className="h-4 w-4" />
              Endereço de Coleta *
            </Label>
            <Input
              value={collectionAddress}
              onChange={e => setCollectionAddress(e.target.value)}
              placeholder="Endereço completo para coleta"
            />
          </div>

          {/* Collection date */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <CalendarClock className="h-4 w-4" />
              Data Prevista de Coleta
            </Label>
            <Input
              type="datetime-local"
              value={collectionDate}
              onChange={e => setCollectionDate(e.target.value)}
            />
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label>Observações da Coleta</Label>
            <Textarea
              value={collectionNotes}
              onChange={e => setCollectionNotes(e.target.value)}
              placeholder="Horário de funcionamento, contato no local, etc."
              maxLength={500}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            onClick={handleConfirm}
            disabled={!collectionAddress.trim() || submitting}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Aprovar Solicitação
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
