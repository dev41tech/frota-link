import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useMultiTenant } from '@/hooks/useMultiTenant';
import { useStaffAccess } from '@/hooks/useStaffAccess';
import { CheckCircle, XCircle, Clock } from 'lucide-react';

interface ClosureRequest {
  id: string;
  journey_number: string;
  origin: string;
  destination: string;
  closure_requested_at: string;
  closure_notes: string | null;
  vehicles: { plate: string; model: string } | null;
  drivers: { name: string } | null;
}

export function ClosureApprovalPanel() {
  const { toast } = useToast();
  const { currentCompany } = useMultiTenant();
  const { staffContext } = useStaffAccess();
  
  const effectiveCompanyId = staffContext?.company_id || currentCompany?.id;
  
  const [requests, setRequests] = useState<ClosureRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<ClosureRequest | null>(null);
  const [adminNotes, setAdminNotes] = useState('');

  const fetchClosureRequests = useCallback(async () => {
    if (!effectiveCompanyId) {
      setRequests([]);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('journeys')
        .select(`
          id,
          journey_number,
          origin,
          destination,
          closure_requested_at,
          closure_notes,
          vehicles(plate, model),
          drivers(name)
        `)
        .eq('company_id', effectiveCompanyId)
        .not('closure_requested_at', 'is', null)
        .eq('status', 'in_progress')
        .order('closure_requested_at', { ascending: false });

      if (error) throw error;
      setRequests(data || []);
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [effectiveCompanyId, toast]);

  useEffect(() => {
    fetchClosureRequests();
  }, [fetchClosureRequests]);

  const handleApprove = async (requestId: string, approve: boolean) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const updateData = approve
        ? {
            status: 'completed',
            closed_at: new Date().toISOString(),
            closed_by: user?.id,
            closure_notes: adminNotes || selectedRequest?.closure_notes
          }
        : {
            closure_requested_at: null,
            closure_requested_by: null,
            closure_notes: adminNotes || null
          };

      const { error } = await supabase
        .from('journeys')
        .update(updateData)
        .eq('id', requestId);

      if (error) throw error;

      // Marcar todos os trechos como concluídos ao aprovar
      if (approve) {
        await supabase
          .from('journey_legs')
          .update({ status: 'completed' })
          .eq('journey_id', requestId);
      }

      toast({
        title: 'Sucesso',
        description: approve
          ? 'Jornada fechada com sucesso!'
          : 'Solicitação de fechamento recusada.'
      });

      setDialogOpen(false);
      setAdminNotes('');
      setSelectedRequest(null);
      fetchClosureRequests();
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('pt-BR');
  };

  if (loading) return <div className="p-6">Carregando...</div>;

  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Solicitações de Fechamento ({requests.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {requests.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            Nenhuma solicitação pendente
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Jornada</TableHead>
                <TableHead>Veículo</TableHead>
                <TableHead>Motorista</TableHead>
                <TableHead>Rota</TableHead>
                <TableHead>Solicitado em</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.map((request) => (
                <TableRow key={request.id}>
                  <TableCell className="font-medium">
                    {request.journey_number}
                  </TableCell>
                  <TableCell>
                    {request.vehicles?.plate || 'N/A'}
                  </TableCell>
                  <TableCell>
                    {request.drivers?.name || 'N/A'}
                  </TableCell>
                  <TableCell>
                    {request.origin} → {request.destination}
                  </TableCell>
                  <TableCell>
                    {formatDate(request.closure_requested_at)}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedRequest(request);
                          setAdminNotes('');
                          setDialogOpen(true);
                        }}
                      >
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Aprovar
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Aprovar Fechamento de Jornada</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium">Jornada: {selectedRequest?.journey_number}</p>
                <p className="text-sm text-muted-foreground">
                  {selectedRequest?.origin} → {selectedRequest?.destination}
                </p>
              </div>

              {selectedRequest?.closure_notes && (
                <div>
                  <Label>Observações do Motorista:</Label>
                  <p className="text-sm bg-muted p-3 rounded-md mt-1">
                    {selectedRequest.closure_notes}
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="adminNotes">Observações do Admin (opcional):</Label>
                <Textarea
                  id="adminNotes"
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Adicione observações sobre o fechamento..."
                  rows={3}
                />
              </div>

              <div className="flex gap-3 justify-end">
                <Button
                  variant="outline"
                  onClick={() => selectedRequest && handleApprove(selectedRequest.id, false)}
                >
                  <XCircle className="h-4 w-4 mr-1" />
                  Recusar
                </Button>
                <Button
                  onClick={() => selectedRequest && handleApprove(selectedRequest.id, true)}
                  className="bg-gradient-primary"
                >
                  <CheckCircle className="h-4 w-4 mr-1" />
                  Aprovar Fechamento
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
