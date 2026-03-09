import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useMultiTenant } from '@/hooks/useMultiTenant';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit, Trash2, Receipt } from 'lucide-react';
import { LocationDisplay } from '@/components/ui/location-display';
import * as LucideIcons from 'lucide-react';
import { formatCurrency } from '@/lib/profitabilityCalculations';
import { useExpenseCategories } from '@/hooks/useExpenseCategories';
import { CategoryBadge } from '@/components/categories/CategoryBadge';
import { formatDateBR } from '@/lib/utils';
import { DeleteConfirmationDialog } from '@/components/ui/delete-confirmation-dialog';
import { maybeCreateMaintenanceFromExpense, SERVICE_CATEGORIES } from '@/lib/maintenanceAutoCreate';
import { Textarea } from '@/components/ui/textarea';
import { useFinancialAccounts } from '@/hooks/useFinancialAccounts';
import { api } from '@/lib/apiClient';

const normalizeText = (text: string) =>
  text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

interface Expense {
  id: string;
  category: string;
  category_id: string | null;
  expense_categories?: {
    id: string;
    name: string;
    icon: string;
    color: string;
    classification: string;
  };
  description: string;
  amount: number;
  date: string;
  supplier?: string;
  payment_method?: string;
  notes?: string;
  location_lat?: number | null;
  location_lng?: number | null;
  location_address?: string | null;
}

interface JourneyLeg {
  id: string;
  origin: string;
  destination: string;
  leg_number: number;
  status: string;
}

interface JourneyData {
  distance: number | null;
  freight_value: number | null;
  start_km: number | null;
  end_km: number | null;
}

interface FinancialReserve {
  id: string;
  name: string;
  default_percentage?: number;
}

interface JourneyExpensesProps {
  journeyId: string;
}

export function JourneyExpenses({ journeyId }: JourneyExpensesProps) {
  const { user } = useAuth();
  const { currentCompany } = useMultiTenant();
  const { toast } = useToast();
  const { data: expenseCategories = [], isLoading: loadingCategories } = useExpenseCategories(undefined, true);
  const { accounts } = useFinancialAccounts();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [fuelExpenses, setFuelExpenses] = useState<any[]>([]);
  const [journeyLegs, setJourneyLegs] = useState<JourneyLeg[]>([]);
  const [journey, setJourney] = useState<JourneyData | null>(null);
  const [reserves, setReserves] = useState<FinancialReserve[]>([]);
  const [selectedLegId, setSelectedLegId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [formData, setFormData] = useState({
    category_id: '',
    description: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    supplier: '',
    payment_method: 'card',
    notes: '',
    maintenance_service_category: '',
    maintenance_type: '',
    maintenance_provider: '',
    maintenance_odometer: '',
    maintenance_notes: '',
    calculation_type: 'fixed' as 'fixed' | 'per_km' | 'percentage' | 'reserve',
    unit_value: '',
    percentage_value: '',
    reserve_id: '',
    account_id: '',
  });

  useEffect(() => {
    fetchExpenses();
    fetchJourneyLegs();
  }, [journeyId]);

  const fetchJourneyLegs = async () => {
    try {
      const { data, error } = await supabase
        .from('journey_legs')
        .select('id, origin, destination, leg_number, status')
        .eq('journey_id', journeyId)
        .order('leg_number');
      if (!error && data) {
        setJourneyLegs(data);
      }
    } catch (err) {
      console.error('Error fetching legs:', err);
    }
  };

  const fetchExpenses = async () => {
    try {
      setLoading(true);

      const { data: expData, error: expError } = await supabase
        .from('expenses')
        .select(`
          *,
          expense_categories (
            id,
            name,
            icon,
            color,
            classification
          )
        `)
        .eq('journey_id', journeyId)
        .order('date', { ascending: false });

      if (expError) throw expError;

      const { data: fuelData, error: fuelError } = await supabase
        .from('fuel_expenses')
        .select('*')
        .eq('journey_id', journeyId)
        .order('date', { ascending: false });

      if (fuelError) throw fuelError;

      // Fetch journey data for computed amounts
      const { data: journeyData } = await supabase
        .from('journeys')
        .select('distance, freight_value, start_km, end_km')
        .eq('id', journeyId)
        .single();

      setJourney(journeyData ?? null);

      // Fetch financial reserves
      const { data: reservesData } = await supabase
        .from('financial_reserves' as any)
        .select('id, name, default_percentage')
        .eq('company_id', currentCompany?.id);

      setReserves((reservesData as FinancialReserve[]) || []);

      setExpenses(expData || []);
      setFuelExpenses(fuelData || []);
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      category_id: '',
      description: '',
      amount: '',
      date: new Date().toISOString().split('T')[0],
      supplier: '',
      payment_method: 'card',
      notes: '',
      maintenance_service_category: '',
      maintenance_type: '',
      maintenance_provider: '',
      maintenance_odometer: '',
      maintenance_notes: '',
      calculation_type: 'fixed',
      unit_value: '',
      percentage_value: '',
      reserve_id: '',
      account_id: '',
    });
  };

  // Computed amount logic
  const kmRodados = journey
    ? (journey.distance ?? ((journey.end_km ?? 0) - (journey.start_km ?? 0)))
    : 0;
  const freightValue = journey?.freight_value ?? 0;

  const computedAmount = useMemo(() => {
    if (formData.calculation_type === 'per_km') {
      return parseFloat(formData.unit_value || '0') * kmRodados;
    } else if (formData.calculation_type === 'percentage' || formData.calculation_type === 'reserve') {
      return (parseFloat(formData.percentage_value || '0') / 100) * freightValue;
    }
    return parseFloat(formData.amount || '0');
  }, [formData.calculation_type, formData.unit_value, formData.percentage_value, formData.amount, kmRodados, freightValue]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.category_id) {
      toast({ title: 'Erro', description: 'Selecione uma categoria', variant: 'destructive' });
      return;
    }

    try {
      const selectedCategory = expenseCategories.find(c => c.id === formData.category_id);
      const finalAmount = formData.calculation_type === 'fixed'
        ? parseFloat(formData.amount || '0')
        : computedAmount;

      const response = await api.fetch('/expenses/journey', {
        method: 'POST',
        body: JSON.stringify({
          journey_id: journeyId,
          journey_leg_id: selectedLegId || null,
          category_id: formData.category_id,
          category: selectedCategory?.name || 'Outros',
          description: formData.description,
          date: formData.date,
          supplier: formData.supplier || null,
          payment_method: formData.payment_method,
          notes: formData.notes || null,
          calculation_type: formData.calculation_type,
          amount: finalAmount,
          unit_value: formData.unit_value || null,
          percentage_value: formData.percentage_value || null,
          reserve_id: formData.reserve_id || null,
          account_id: formData.account_id || null,
        }),
      });

      // Auto-criar manutenção se categoria for manutenção
      if (response?.id) {
        await maybeCreateMaintenanceFromExpense({
          expense_id: response.id,
          category_name: selectedCategory?.name || '',
          vehicle_id: null,
          company_id: currentCompany?.id!,
          user_id: user?.id!,
          amount: finalAmount,
          description: formData.description,
          date: formData.date,
          supplier: formData.supplier || null,
          service_category: formData.maintenance_service_category || undefined,
          maintenance_type: (formData.maintenance_type as "preventive" | "corrective") || undefined,
          provider_name: formData.maintenance_provider || undefined,
          odometer_at_service: formData.maintenance_odometer ? parseInt(formData.maintenance_odometer) : undefined,
          notes: formData.maintenance_notes || undefined,
        });
      }

      toast({ title: 'Sucesso', description: 'Despesa lançada com sucesso!' });
      setDialogOpen(false);
      resetForm();
      fetchExpenses();
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
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
      const { error } = await supabase.from('expenses').delete().eq('id', deletingId);
      if (error) throw error;

      toast({ title: 'Sucesso', description: 'Despesa excluída permanentemente!' });
      setDeleteDialogOpen(false);
      setDeletingId(null);
      fetchExpenses();
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } finally {
      setIsDeleting(false);
    }
  };


  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const totalFuel = fuelExpenses.reduce((sum, f) => sum + f.total_amount, 0);
  const grandTotal = totalExpenses + totalFuel;

  if (loading) return <div>Carregando despesas...</div>;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              Despesas da Jornada
            </CardTitle>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={resetForm}>
                  <Plus className="h-4 w-4 mr-2" />
                  Nova Despesa
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Lançar Despesa</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Tipo de Cálculo - FIRST FIELD */}
                  <div className="space-y-2">
                    <Label>Tipo de Cálculo</Label>
                    <Select
                      value={formData.calculation_type}
                      onValueChange={(v) => setFormData(prev => ({ ...prev, calculation_type: v as any }))}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="fixed">Valor Fixo</SelectItem>
                        <SelectItem value="per_km">Por KM Rodado</SelectItem>
                        <SelectItem value="percentage">Por Percentual (%)</SelectItem>
                        <SelectItem value="reserve">Aporte à Caixa de Reserva</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Seletor de Trecho */}
                  {journeyLegs.length > 1 && (
                    <div className="space-y-2">
                      <Label>Trecho</Label>
                      <Select
                        value={selectedLegId}
                        onValueChange={setSelectedLegId}
                      >
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
                  <div className="space-y-2">
                    <Label htmlFor="category_id">Categoria *</Label>
                    <Select
                      value={formData.category_id}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, category_id: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a categoria" />
                      </SelectTrigger>
                      <SelectContent>
                        {loadingCategories ? (
                          <SelectItem value="" disabled>Carregando...</SelectItem>
                        ) : expenseCategories.length === 0 ? (
                          <SelectItem value="" disabled>Nenhuma categoria disponível</SelectItem>
                        ) : (
                          expenseCategories.map((category) => {
                            const IconComponent = (LucideIcons as any)[category.icon] || LucideIcons.Package;
                            return (
                              <SelectItem key={category.id} value={category.id}>
                                <div className="flex items-center gap-2">
                                  <div className="p-1 rounded" style={{ backgroundColor: `${category.color}15` }}>
                                    <IconComponent className="h-4 w-4" style={{ color: category.color }} />
                                  </div>
                                  <span>{category.name}</span>
                                  <Badge variant={category.classification === 'direct' ? 'default' : 'secondary'} className="text-xs ml-auto">
                                    {category.classification === 'direct' ? 'Direta' : 'Indireta'}
                                  </Badge>
                                </div>
                              </SelectItem>
                            );
                          })
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Descrição</Label>
                    <Input
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    {/* Valor fixo */}
                    {formData.calculation_type === 'fixed' && (
                      <div className="space-y-2">
                        <Label htmlFor="amount">Valor</Label>
                        <Input
                          id="amount"
                          type="number"
                          step="0.01"
                          value={formData.amount}
                          onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                          required
                        />
                      </div>
                    )}

                    {/* Por KM */}
                    {formData.calculation_type === 'per_km' && (
                      <div className="space-y-2">
                        <Label>Valor por KM (R$)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="Ex: 0.50"
                          value={formData.unit_value}
                          onChange={(e) => setFormData(prev => ({ ...prev, unit_value: e.target.value }))}
                          required
                        />
                        <p className="text-xs text-muted-foreground">
                          {kmRodados} km x R$ {formData.unit_value || '0'} = <strong>{formatCurrency(computedAmount)}</strong> (calculado automaticamente)
                        </p>
                      </div>
                    )}

                    {/* Por Percentual */}
                    {formData.calculation_type === 'percentage' && (
                      <div className="space-y-2">
                        <Label>Percentual (%)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="Ex: 5"
                          value={formData.percentage_value}
                          onChange={(e) => setFormData(prev => ({ ...prev, percentage_value: e.target.value }))}
                          required
                        />
                        <p className="text-xs text-muted-foreground">
                          {formData.percentage_value || '0'}% de {formatCurrency(freightValue)} = <strong>{formatCurrency(computedAmount)}</strong> (calculado automaticamente)
                        </p>
                      </div>
                    )}

                    {/* Caixa de Reserva */}
                    {formData.calculation_type === 'reserve' && (
                      <div className="space-y-2 col-span-2">
                        <Label>Caixa de Reserva</Label>
                        <Select
                          value={formData.reserve_id}
                          onValueChange={(v) => {
                            const reserve = reserves.find(r => r.id === v);
                            setFormData(prev => ({
                              ...prev,
                              reserve_id: v,
                              percentage_value: reserve?.default_percentage?.toString() || prev.percentage_value,
                            }));
                          }}
                        >
                          <SelectTrigger><SelectValue placeholder="Selecione a caixa de reserva" /></SelectTrigger>
                          <SelectContent>
                            {reserves.map(r => (
                              <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <div className="space-y-1">
                          <Label>Percentual (%)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="Ex: 5"
                            value={formData.percentage_value}
                            onChange={(e) => setFormData(prev => ({ ...prev, percentage_value: e.target.value }))}
                            required
                          />
                          <p className="text-xs text-muted-foreground">
                            {formData.percentage_value || '0'}% de {formatCurrency(freightValue)} = <strong>{formatCurrency(computedAmount)}</strong> (calculado automaticamente)
                          </p>
                        </div>
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label htmlFor="date">Data</Label>
                      <Input
                        id="date"
                        type="date"
                        value={formData.date}
                        onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="supplier">Fornecedor</Label>
                    <Input
                      id="supplier"
                      value={formData.supplier}
                      onChange={(e) => setFormData(prev => ({ ...prev, supplier: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="payment_method">Método de Pagamento</Label>
                    <Select
                      value={formData.payment_method}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, payment_method: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="card">Cartão</SelectItem>
                        <SelectItem value="cash">Dinheiro</SelectItem>
                        <SelectItem value="pix">PIX</SelectItem>
                        <SelectItem value="bank_transfer">Transferência</SelectItem>
                        <SelectItem value="tag">Tag</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {/* Conta de Origem */}
                  <div className="space-y-2">
                    <Label>Conta de Origem</Label>
                    <Select
                      value={formData.account_id}
                      onValueChange={(v) => setFormData(prev => ({ ...prev, account_id: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a conta (opcional)" />
                      </SelectTrigger>
                      <SelectContent>
                        {accounts.map((acc) => (
                          <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Campos extras para categoria Manutenção */}
                  {(() => {
                    const selectedCat = expenseCategories.find((c) => c.id === formData.category_id);
                    const isMaintenance = selectedCat && normalizeText(selectedCat.name).includes("manutencao");
                    if (!isMaintenance) return null;
                    return (
                      <div className="space-y-4 p-4 border rounded-lg bg-muted/20 animate-in fade-in slide-in-from-top-2 duration-300">
                        <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                          <LucideIcons.Wrench className="h-4 w-4" />
                          Detalhes da Manutenção
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Tipo de Serviço *</Label>
                            <Select
                              value={formData.maintenance_service_category}
                              onValueChange={(v) => setFormData(prev => ({ ...prev, maintenance_service_category: v }))}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione o serviço" />
                              </SelectTrigger>
                              <SelectContent>
                                {SERVICE_CATEGORIES.map((sc) => (
                                  <SelectItem key={sc.value} value={sc.value}>{sc.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>Tipo de Manutenção</Label>
                            <Select
                              value={formData.maintenance_type}
                              onValueChange={(v) => setFormData(prev => ({ ...prev, maintenance_type: v }))}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione (opcional)" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="corrective">Corretiva</SelectItem>
                                <SelectItem value="preventive">Preventiva</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Oficina / Fornecedor</Label>
                            <Input
                              placeholder="Nome da oficina"
                              value={formData.maintenance_provider}
                              onChange={(e) => setFormData(prev => ({ ...prev, maintenance_provider: e.target.value }))}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Odômetro (km)</Label>
                            <Input
                              type="number"
                              placeholder="Ex: 125430"
                              value={formData.maintenance_odometer}
                              onChange={(e) => setFormData(prev => ({ ...prev, maintenance_odometer: e.target.value }))}
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>Observações do serviço</Label>
                          <Textarea
                            placeholder="Detalhes sobre o serviço realizado..."
                            value={formData.maintenance_notes}
                            onChange={(e) => setFormData(prev => ({ ...prev, maintenance_notes: e.target.value }))}
                            rows={2}
                          />
                        </div>
                      </div>
                    );
                  })()}
                  <Button type="submit" className="w-full">Salvar Despesa</Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4 p-4 bg-muted rounded-lg">
              <div>
                <p className="text-sm text-muted-foreground">Despesas Gerais</p>
                <p className="text-2xl font-bold">{formatCurrency(totalExpenses)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Combustível</p>
                <p className="text-2xl font-bold">{formatCurrency(totalFuel)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total</p>
                <p className="text-2xl font-bold text-primary">{formatCurrency(grandTotal)}</p>
              </div>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  {journeyLegs.length > 1 && <TableHead>Trecho</TableHead>}
                  <TableHead>Categoria</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Fornecedor</TableHead>
                  <TableHead>Local</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fuelExpenses.map((fuel) => (
                  <TableRow key={fuel.id}>
                    <TableCell>{formatDateBR(fuel.date)}</TableCell>
                    {journeyLegs.length > 1 && (
                      <TableCell>
                        {(() => {
                          const leg = journeyLegs.find(l => l.id === fuel.journey_leg_id);
                          return leg ? (
                            <Badge variant="outline" className="text-xs">
                              T{leg.leg_number}: {leg.origin}→{leg.destination}
                            </Badge>
                          ) : <span className="text-muted-foreground text-xs">-</span>;
                        })()}
                      </TableCell>
                    )}
                    <TableCell>Combustível</TableCell>
                    <TableCell>{fuel.liters}L @ {formatCurrency(fuel.price_per_liter)}/L</TableCell>
                    <TableCell>-</TableCell>
                    <TableCell>
                      <LocationDisplay
                        lat={fuel.location_lat}
                        lng={fuel.location_lng}
                        address={fuel.location_address}
                        compact
                      />
                    </TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(fuel.total_amount)}</TableCell>
                    <TableCell className="text-right text-muted-foreground text-sm">Abastecimento</TableCell>
                  </TableRow>
                ))}
                {expenses.map((expense) => (
                  <TableRow key={expense.id}>
                    <TableCell>{formatDateBR(expense.date)}</TableCell>
                    {journeyLegs.length > 1 && (
                      <TableCell>
                        {(() => {
                          const leg = journeyLegs.find(l => l.id === (expense as any).journey_leg_id);
                          return leg ? (
                            <Badge variant="outline" className="text-xs">
                              T{leg.leg_number}: {leg.origin}→{leg.destination}
                            </Badge>
                          ) : <span className="text-muted-foreground text-xs">-</span>;
                        })()}
                      </TableCell>
                    )}
                    <TableCell>
                      {expense.expense_categories ? (
                        <CategoryBadge
                          name={expense.expense_categories.name}
                          icon={expense.expense_categories.icon}
                          color={expense.expense_categories.color}
                          classification={expense.expense_categories.classification as 'direct' | 'indirect'}
                          showClassification
                        />
                      ) : (
                        <Badge variant="outline">{expense.category}</Badge>
                      )}
                    </TableCell>
                    <TableCell>{expense.description}</TableCell>
                    <TableCell>{expense.supplier || '-'}</TableCell>
                    <TableCell>
                      <LocationDisplay
                        lat={expense.location_lat}
                        lng={expense.location_lng}
                        address={expense.location_address}
                        compact
                      />
                    </TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(expense.amount)}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openDeleteDialog(expense.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {expenses.length === 0 && fuelExpenses.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={journeyLegs.length > 1 ? 8 : 7} className="text-center text-muted-foreground">
                      Nenhuma despesa lançada
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <DeleteConfirmationDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleDelete}
        title="Excluir despesa?"
        description="Esta despesa será removida permanentemente. Esta ação não pode ser desfeita."
        isDeleting={isDeleting}
      />
    </div>
  );
}
