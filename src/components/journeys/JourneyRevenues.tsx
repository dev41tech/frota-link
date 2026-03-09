import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useMultiTenant } from '@/hooks/useMultiTenant';
import { useRevenueCategories } from '@/hooks/useRevenueCategories';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, DollarSign, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { formatDateBR } from '@/lib/utils';
import { DeleteConfirmationDialog } from '@/components/ui/delete-confirmation-dialog';

interface Revenue {
  id: string;
  description: string;
  amount: number;
  date: string;
  category: string;
  status: string;
  payment_method: string;
  journey_leg_id?: string | null;
  revenue_categories?: {
    name: string;
    color: string;
  };
}

interface JourneyLeg {
  id: string;
  origin: string;
  destination: string;
  leg_number: number;
  status: string;
}

interface JourneyRevenuesProps {
  journeyId: string;
  journeyNumber: string;
  freightValue: number | null;
}

export function JourneyRevenues({ journeyId, journeyNumber, freightValue }: JourneyRevenuesProps) {
  const { user } = useAuth();
  const { currentCompany } = useMultiTenant();
  const { toast } = useToast();
  const { data: categories } = useRevenueCategories(true);
  const [revenues, setRevenues] = useState<Revenue[]>([]);
  const [journeyLegs, setJourneyLegs] = useState<JourneyLeg[]>([]);
  const [selectedLegId, setSelectedLegId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [formData, setFormData] = useState({
    description: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    category_id: '',
    payment_method: 'bank_transfer',
    notes: '',
    status: 'received'
  });

  useEffect(() => {
    if (journeyId) {
      fetchRevenues();
      fetchJourneyLegs();
    }
  }, [journeyId]);

  const fetchJourneyLegs = async () => {
    try {
      const { data, error } = await supabase
        .from('journey_legs')
        .select('id, origin, destination, leg_number, status')
        .eq('journey_id', journeyId)
        .order('leg_number');
      if (!error && data) setJourneyLegs(data);
    } catch (err) {
      console.error('Error fetching legs:', err);
    }
  };

  const fetchRevenues = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('revenue')
        .select(`
          *,
          revenue_categories(name, color)
        `)
        .eq('journey_id', journeyId)
        .order('date', { ascending: false });

      if (error) throw error;
      setRevenues(data || []);
    } catch (error: any) {
      console.error('Error fetching revenues:', error);
      toast({
        title: 'Erro ao carregar receitas',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentCompany?.id || !user?.id) return;

    try {
      const { error } = await supabase
        .from('revenue')
        .insert({
          journey_id: journeyId,
          journey_leg_id: selectedLegId || null,
          company_id: currentCompany.id,
          user_id: user.id,
          description: formData.description,
          amount: parseFloat(formData.amount),
          date: formData.date,
          category_id: formData.category_id || null,
          category: categories?.find(c => c.id === formData.category_id)?.name || 'Outros',
          payment_method: formData.payment_method,
          notes: formData.notes || null,
          status: formData.status,
        });

      if (error) throw error;

      toast({
        title: 'Receita adicionada',
        description: 'Receita vinculada à jornada com sucesso.',
      });

      setFormData({
        description: '',
        amount: '',
        date: new Date().toISOString().split('T')[0],
        category_id: '',
        payment_method: 'bank_transfer',
        notes: '',
        status: 'received'
      });
      setAdding(false);
      fetchRevenues();
    } catch (error: any) {
      console.error('Error adding revenue:', error);
      toast({
        title: 'Erro ao adicionar receita',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const openDeleteDialog = (id: string) => {
    setDeletingId(id);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    setIsDeleting(true);

    try {
      const { error } = await supabase
        .from('revenue')
        .delete()
        .eq('id', deletingId);

      if (error) throw error;

      toast({
        title: 'Receita removida',
        description: 'Receita excluída permanentemente.',
      });

      setDeleteDialogOpen(false);
      setDeletingId(null);
      fetchRevenues();
    } catch (error: any) {
      console.error('Error deleting revenue:', error);
      toast({
        title: 'Erro ao remover receita',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const formatCurrency = (value: number | null) => {
    if (value === null) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const totalRevenues = revenues.reduce((sum, rev) => sum + rev.amount, 0);

  return (
    <div className="space-y-4">
      {/* Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Resumo de Receitas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label className="text-muted-foreground">Valor do Frete</Label>
              <p className="text-xl font-bold">{formatCurrency(freightValue)}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Receitas Lançadas</Label>
              <p className="text-xl font-bold">{formatCurrency(totalRevenues)}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Diferença</Label>
              <p className={`text-xl font-bold ${
                totalRevenues >= (freightValue || 0) ? 'text-green-600' : 'text-orange-600'
              }`}>
                {formatCurrency(totalRevenues - (freightValue || 0))}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Add Revenue Button/Form */}
      {!adding ? (
        <Button onClick={() => setAdding(true)} className="w-full">
          <Plus className="h-4 w-4 mr-2" />
          Adicionar Receita
        </Button>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Nova Receita - Jornada {journeyNumber}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Seletor de Trecho */}
              {journeyLegs.length > 1 && (
                <div>
                  <Label>Trecho</Label>
                  <Select value={selectedLegId} onValueChange={setSelectedLegId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o trecho (opcional)" />
                    </SelectTrigger>
                    <SelectContent>
                      {journeyLegs.map((leg) => (
                        <SelectItem key={leg.id} value={leg.id}>
                          Trecho {leg.leg_number}: {leg.origin} → {leg.destination}
                          {leg.status === 'in_progress' ? ' (Ativo)' : leg.status === 'completed' ? ' (Concluído)' : ' (Pendente)'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="description">Descrição *</Label>
                  <Input
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Ex: Frete complementar, bonificação..."
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="amount">Valor *</Label>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="date">Data *</Label>
                  <Input
                    id="date"
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="category_id">Categoria</Label>
                  <Select
                    value={formData.category_id}
                    onValueChange={(value) => setFormData({ ...formData, category_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {categories?.map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="payment_method">Método de Pagamento</Label>
                  <Select
                    value={formData.payment_method}
                    onValueChange={(value) => setFormData({ ...formData, payment_method: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bank_transfer">Transferência Bancária</SelectItem>
                      <SelectItem value="pix">PIX</SelectItem>
                      <SelectItem value="cash">Dinheiro</SelectItem>
                      <SelectItem value="card">Cartão</SelectItem>
                      <SelectItem value="tag">Tag</SelectItem>
                      <SelectItem value="check">Cheque</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="status">Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value) => setFormData({ ...formData, status: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="received">Recebido</SelectItem>
                      <SelectItem value="pending">Pendente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2">
                  <Label htmlFor="notes">Observações</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Informações adicionais..."
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button type="submit">Adicionar</Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setAdding(false);
                    setFormData({
                      description: '',
                      amount: '',
                      date: new Date().toISOString().split('T')[0],
                      category_id: '',
                      payment_method: 'bank_transfer',
                      notes: '',
                      status: 'received'
                    });
                  }}
                >
                  Cancelar
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Revenues List */}
      {loading ? (
        <p className="text-center text-muted-foreground">Carregando receitas...</p>
      ) : revenues.length === 0 ? (
        <Card>
          <CardContent className="py-8">
            <p className="text-center text-muted-foreground">
              Nenhuma receita lançada para esta jornada.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Receitas Lançadas ({revenues.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  {journeyLegs.length > 1 && <TableHead>Trecho</TableHead>}
                  <TableHead>Descrição</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {revenues.map((revenue) => (
                  <TableRow key={revenue.id}>
                    <TableCell>
                      {formatDateBR(revenue.date)}
                    </TableCell>
                    {journeyLegs.length > 1 && (
                      <TableCell>
                        {(() => {
                          const leg = journeyLegs.find(l => l.id === revenue.journey_leg_id);
                          return leg ? (
                            <Badge variant="outline" className="text-xs">
                              T{leg.leg_number}: {leg.origin}→{leg.destination}
                            </Badge>
                          ) : <span className="text-muted-foreground text-xs">-</span>;
                        })()}
                      </TableCell>
                    )}
                    <TableCell>{revenue.description}</TableCell>
                    <TableCell>
                      {revenue.revenue_categories ? (
                        <Badge
                          variant="outline"
                          style={{
                            borderColor: revenue.revenue_categories.color,
                            color: revenue.revenue_categories.color,
                          }}
                        >
                          {revenue.revenue_categories.name}
                        </Badge>
                      ) : (
                        revenue.category
                      )}
                    </TableCell>
                    <TableCell className="font-semibold">
                      {formatCurrency(revenue.amount)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={revenue.status === 'received' ? 'default' : 'secondary'}>
                        {revenue.status === 'received' ? 'Recebido' : 'Pendente'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openDeleteDialog(revenue.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <DeleteConfirmationDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleDelete}
        title="Excluir receita?"
        description="Esta receita será removida permanentemente. Esta ação não pode ser desfeita."
        isDeleting={isDeleting}
      />
    </div>
  );
}
