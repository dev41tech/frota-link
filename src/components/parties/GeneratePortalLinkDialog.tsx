import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Copy, ExternalLink, Loader2, Check, XCircle, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { PortalToken } from '@/hooks/useCustomerPortalTokens';

interface GeneratePortalLinkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  partyName: string;
  partyId: string;
  existingToken: PortalToken | undefined;
  onGenerate: (partyId: string) => Promise<PortalToken | null>;
  onToggle: (tokenId: string, isActive: boolean) => Promise<void>;
  getPortalUrl: (token: PortalToken) => string;
}

export function GeneratePortalLinkDialog({
  open, onOpenChange, partyName, partyId, existingToken, onGenerate, onToggle, getPortalUrl,
}: GeneratePortalLinkDialogProps) {
  const { toast } = useToast();
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  const portalUrl = existingToken ? getPortalUrl(existingToken) : null;

  const handleGenerate = async () => {
    setGenerating(true);
    await onGenerate(partyId);
    setGenerating(false);
  };

  const handleCopy = async () => {
    if (!portalUrl) return;
    await navigator.clipboard.writeText(portalUrl);
    setCopied(true);
    toast({ title: 'Link copiado!' });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleToggle = async () => {
    if (!existingToken) return;
    await onToggle(existingToken.id, !existingToken.is_active);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Portal do Cliente</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="text-muted-foreground text-xs">Cliente</Label>
            <p className="font-medium">{partyName}</p>
          </div>

          {existingToken ? (
            <>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label>Link do Portal</Label>
                  <Badge variant={existingToken.is_active ? 'default' : 'secondary'}>
                    {existingToken.is_active ? 'Ativo' : 'Inativo'}
                  </Badge>
                </div>
                <div className="flex gap-2">
                  <Input value={portalUrl || ''} readOnly className="text-xs" />
                  <Button size="icon" variant="outline" onClick={handleCopy}>
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                  <Button size="icon" variant="outline" asChild>
                    <a href={portalUrl || '#'} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </Button>
                </div>
              </div>

              {existingToken.last_accessed_at && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  Último acesso: {format(new Date(existingToken.last_accessed_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                </div>
              )}

              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                Criado em: {format(new Date(existingToken.created_at), "dd/MM/yyyy", { locale: ptBR })}
              </div>
            </>
          ) : (
            <div className="text-center py-4 text-muted-foreground">
              <p className="text-sm mb-3">Nenhum link gerado para este cliente.</p>
              <Button onClick={handleGenerate} disabled={generating}>
                {generating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Gerar Link do Portal
              </Button>
            </div>
          )}
        </div>

        {existingToken && (
          <DialogFooter>
            <Button variant="outline" onClick={handleToggle}>
              {existingToken.is_active ? (
                <><XCircle className="h-4 w-4 mr-2" />Desativar Acesso</>
              ) : (
                <><Check className="h-4 w-4 mr-2" />Reativar Acesso</>
              )}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
