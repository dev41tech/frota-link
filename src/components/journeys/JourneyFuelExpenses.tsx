import { useState, useEffect } from 'react';
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
import { Plus, Trash2, Fuel, TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react';
import { MAX_REALISTIC_CONSUMPTION } from '@/lib/fuelCalculations';
import { formatCurrency } from '@/lib/profitabilityCalculations';
import { Badge } from '@/components/ui/badge';
import { formatDateBR } from '@/lib/utils';
import { DeleteConfirmationDialog } from '@/components/ui/delete-confirmation-dialog';

interface FuelExpense {
  id: string;
  date: string;
  liters: number;
  price_per_liter: number;
  total_amount: number;
  odometer?: number;
  fuel_consumed?: number;
  tank_level_before?: number;
  tank_level_after?: number;
  distance_traveled?: number;
  gas_station_id?: string;
  payment_method?: string;
  receipt_number?: string;
  notes?: string;
  journey_leg_id?: string | null;
}

interface GasStation {
  id: string;
  name: string;
}

interface JourneyLeg {
  id: string;
  origin: string;
  destination: string;
  leg_number: number;
  status: string;
}

interface JourneyFuelExpensesProps {
  journeyId: string;
  vehicleId: string;
  distance?: number;
  journeyStartKm?: number;
}

export function JourneyFuelExpenses({ journeyId, vehicleId, distance, journeyStartKm }: JourneyFuelExpensesProps) {
  const { user } = useAuth();
  const { currentCompany } = useMultiTenant();
  const { toast } = useToast();
  const [fuelExpenses, setFuelExpenses] = useState<FuelExpense[]>([]);
  const [gasStations, setGasStations] = useState<GasStation[]>([]);
  const [journeyLegs, setJourneyLegs] = useState<JourneyLeg[]>([]);
  const [selectedLegId, setSelectedLegId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [lastOdometer, setLastOdometer] = useState<number | null>(null);
  const [vehicleTarget, setVehicleTarget] = useState<number | null>(null);
  const [currentFuelLevel, setCurrentFuelLevel] = useState<number | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    liters: '',
    price_per_liter: '',
    odometer: '',
    gas_station_id: '',
    payment_method: 'card',
    receipt_number: '',
    notes: ''
  });

  useEffect(() => {
    fetchFuelExpenses();
    fetchGasStations();
    fetchLastOdometer();
    fetchVehicleTarget();
    fetchVehicleFuelLevel();
    fetchJourneyLegs();
  }, [journeyId, vehicleId]);

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

  const fetchFuelExpenses = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('fuel_expenses')
        .select('*')
        .eq('journey_id', journeyId)
        .order('date', { ascending: false });

      if (error) throw error;
      setFuelExpenses(data || []);
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const fetchGasStations = async () => {
    try {
      const { data, error } = await supabase
        .from('gas_stations')
        .select('id, name')
        .eq('status', 'active')
        .order('name');

      if (error) throw error;
      setGasStations(data || []);
    } catch (error: any) {
      console.error('Erro ao buscar postos:', error);
    }
  };

  const fetchLastOdometer = async () => {
    try {
      const { data, error } = await supabase
        .from('fuel_expenses')
        .select('odometer')
        .eq('vehicle_id', vehicleId)
        .not('odometer', 'is', null)
        .order('date', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      setLastOdometer(data?.odometer || null);
    } catch (error: any) {
      console.error('Erro ao buscar último hodômetro:', error);
    }
  };

  const fetchVehicleTarget = async () => {
    try {
      const { data, error } = await supabase
        .from('vehicles')
        .select('target_consumption')
        .eq('id', vehicleId)
        .single();

      if (error) throw error;
      setVehicleTarget(data?.target_consumption || null);
    } catch (error: any) {
      console.error('Erro ao buscar meta do veículo:', error);
    }
  };

  const fetchVehicleFuelLevel = async () => {
    try {
      const { data, error } = await supabase
        .from('vehicles')
        .select('current_fuel_level')
        .eq('id', vehicleId)
        .single();

      if (error) throw error;
      setCurrentFuelLevel(data?.current_fuel_level || 0);
    } catch (error: any) {
      console.error('Erro ao buscar nível do tanque:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      date: new Date().toISOString().split('T')[0],
      liters: '',
      price_per_liter: '',
      odometer: '',
      gas_station_id: '',
      payment_method: 'card',
      receipt_number: '',
      notes: ''
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const liters = parseFloat(formData.liters);
      const pricePerLiter = parseFloat(formData.price_per_liter);
      const totalAmount = liters * pricePerLiter;

      // Calculate distance automatically based on previous odometer or journey start
      let distanceTraveled: number | null = null;
      let fuelConsumed: number | null = null;
      const currentOdometer = formData.odometer ? parseInt(formData.odometer) : null;
      
      // Reference point: last fuel expense odometer OR journey start km
      const referenceOdometer = lastOdometer || journeyStartKm || null;

      if (currentOdometer && referenceOdometer && currentOdometer > referenceOdometer) {
        const calcDistance = currentOdometer - referenceOdometer;
        const calcConsumption = calcDistance / liters;
        // Only save if consumption is realistic (≤ 15 km/L)
        if (calcConsumption <= MAX_REALISTIC_CONSUMPTION) {
          distanceTraveled = calcDistance;
          fuelConsumed = liters;
        }
      }

      const { error } = await supabase.from('fuel_expenses').insert([
        {
          user_id: user?.id,
          company_id: currentCompany?.id,
          journey_id: journeyId,
          journey_leg_id: selectedLegId || null,
          vehicle_id: vehicleId,
          date: formData.date,
          liters,
          price_per_liter: pricePerLiter,
          total_amount: totalAmount,
          odometer: currentOdometer,
          distance_traveled: distanceTraveled,
          fuel_consumed: fuelConsumed,
          gas_station_id: formData.gas_station_id || null,
          payment_method: formData.payment_method,
          receipt_number: formData.receipt_number || null,
          notes: formData.notes || null
        }
      ]);

      if (error) {
        if (error.message.includes('Hodômetro inválido')) {
          toast({ 
            title: '⚠️ Hodômetro Inválido', 
            description: error.message,
            variant: 'destructive',
            duration: 5000 
          });
          return;
        }
        throw error;
      }

      toast({ title: 'Sucesso', description: 'Abastecimento registrado com sucesso!' });
      setDialogOpen(false);
      resetForm();
      fetchFuelExpenses();
      fetchLastOdometer();
      fetchVehicleFuelLevel();
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
      const { error } = await supabase.from('fuel_expenses').delete().eq('id', deletingId);
      if (error) throw error;

      toast({ title: 'Sucesso', description: 'Abastecimento excluído permanentemente!' });
      setDeleteDialogOpen(false);
      setDeletingId(null);
      fetchFuelExpenses();
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } finally {
      setIsDeleting(false);
    }
  };

  // Calculate total amount and average preview
  const totalAmount = (parseFloat(formData.liters) || 0) * (parseFloat(formData.price_per_liter) || 0);
  
  // Calculate preview average for the form
  const formLiters = parseFloat(formData.liters) || 0;
  const formOdometer = parseInt(formData.odometer) || 0;
  const referenceOdometer = lastOdometer || journeyStartKm || 0;
  
  const previewDistance = formOdometer > referenceOdometer ? formOdometer - referenceOdometer : 0;
  const previewAverage = (previewDistance > 0 && formLiters > 0) ? previewDistance / formLiters : null;
  const isUnrealisticAverage = previewAverage !== null && previewAverage > MAX_REALISTIC_CONSUMPTION;
  const isReferenceInconsistent = lastOdometer !== null && formOdometer > 0 && (formOdometer - lastOdometer) > 10000;
  const canCalculateAverage = previewDistance > 0 && formLiters > 0;
  
  const getPreviewAverageColor = (avg: number) => {
    if (avg >= 8) return 'text-green-600';
    if (avg >= 5) return 'text-yellow-600';
    return 'text-red-600';
  };
  
  const getPreviewAverageBgColor = (avg: number) => {
    if (avg >= 8) return 'bg-green-50 border-green-200';
    if (avg >= 5) return 'bg-yellow-50 border-yellow-200';
    return 'bg-red-50 border-red-200';
  };

  // Calculate stats
  const totalLiters = fuelExpenses.reduce((sum, f) => sum + f.liters, 0);
  const totalCost = fuelExpenses.reduce((sum, f) => sum + f.total_amount, 0);
  const avgPricePerLiter = totalLiters > 0 ? totalCost / totalLiters : 0;

  // Calculate consumption
  const expensesWithOdometer = fuelExpenses.filter(f => f.odometer);
  let averageConsumption: number | null = null;
  let consumptionStatus: 'excellent' | 'good' | 'warning' | 'critical' | null = null;

  if (expensesWithOdometer.length >= 1) {
    const sortedExpenses = [...expensesWithOdometer].sort((a, b) => (a.odometer || 0) - (b.odometer || 0));
    const lastOdometerValue = sortedExpenses[sortedExpenses.length - 1].odometer || 0;
    const firstOdometerValue = sortedExpenses[0].odometer || 0;
    
    // Use journey start KM as anchor when available and lower than first fuel odometer
    const startReference = (journeyStartKm && journeyStartKm < firstOdometerValue)
      ? journeyStartKm
      : firstOdometerValue;
    
    const totalDistance = lastOdometerValue - startReference;
    const totalLitersWithOdometer = expensesWithOdometer.reduce((sum, f) => sum + f.liters, 0);
    
    if (totalDistance > 0 && totalLitersWithOdometer > 0) {
      const rawConsumption = totalDistance / totalLitersWithOdometer;
      averageConsumption = rawConsumption <= MAX_REALISTIC_CONSUMPTION ? rawConsumption : null;
      
      if (vehicleTarget) {
        const variance = ((averageConsumption - vehicleTarget) / vehicleTarget) * 100;
        if (variance >= 15) consumptionStatus = 'excellent';
        else if (variance >= 0) consumptionStatus = 'good';
        else if (variance >= -15) consumptionStatus = 'warning';
        else consumptionStatus = 'critical';
      }
    }
  }

  const getConsumptionBadge = () => {
    if (!consumptionStatus || !averageConsumption) return null;

    const badges = {
      excellent: { color: 'bg-green-100 text-green-800', icon: TrendingUp, text: 'Excelente' },
      good: { color: 'bg-blue-100 text-blue-800', icon: Minus, text: 'Ótimo' },
      warning: { color: 'bg-yellow-100 text-yellow-800', icon: TrendingDown, text: 'Atenção' },
      critical: { color: 'bg-red-100 text-red-800', icon: TrendingDown, text: 'Crítico' }
    };

    const badge = badges[consumptionStatus];
    const Icon = badge.icon;

    return (
      <Badge className={badge.color}>
        <Icon className="h-3 w-3 mr-1" />
        {badge.text}
      </Badge>
    );
  };

  if (loading) return <div>Carregando abastecimentos...</div>;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Fuel className="h-5 w-5" />
              Abastecimentos da Jornada
            </CardTitle>
            <Dialog open={dialogOpen} onOpenChange={(open) => {
              setDialogOpen(open);
              if (open) resetForm();
            }}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Novo Abastecimento
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Registrar Abastecimento</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Seletor de Trecho */}
                  {journeyLegs.length > 1 && (
                    <div className="space-y-1">
                      <Label className="text-xs">Trecho</Label>
                      <Select value={selectedLegId} onValueChange={setSelectedLegId}>
                        <SelectTrigger className="h-9">
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
                  {/* Campos principais em grid compacto */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label htmlFor="date" className="text-xs">Data</Label>
                      <Input
                        id="date"
                        type="date"
                        value={formData.date}
                        onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                        required
                        className="h-9"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="liters" className="text-xs">Litros</Label>
                      <Input
                        id="liters"
                        type="number"
                        step="0.01"
                        placeholder="50"
                        value={formData.liters}
                        onChange={(e) => setFormData(prev => ({ ...prev, liters: e.target.value }))}
                        required
                        className="h-9"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="price_per_liter" className="text-xs">Preço/L</Label>
                      <Input
                        id="price_per_liter"
                        type="number"
                        step="0.01"
                        placeholder="5.89"
                        value={formData.price_per_liter}
                        onChange={(e) => setFormData(prev => ({ ...prev, price_per_liter: e.target.value }))}
                        required
                        className="h-9"
                      />
                    </div>
                  </div>

                  {/* Posto */}
                  <div className="space-y-1">
                    <Label htmlFor="gas_station_id" className="text-xs">Posto de Combustível</Label>
                    <Select
                      value={formData.gas_station_id}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, gas_station_id: value }))}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Selecione (opcional)" />
                      </SelectTrigger>
                      <SelectContent>
                        {gasStations.map((station) => (
                          <SelectItem key={station.id} value={station.id}>
                            {station.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Valor Total */}
                  {totalAmount > 0 && (
                    <div className="p-3 bg-muted rounded-lg flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Valor Total</span>
                      <span className="text-xl font-bold text-primary">{formatCurrency(totalAmount)}</span>
                    </div>
                  )}

                  {/* Hodômetro Simplificado */}
                  <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg space-y-3">
                    <div className="space-y-1">
                      <Label htmlFor="odometer" className="text-xs font-medium flex items-center gap-1">
                        <Fuel className="h-3 w-3" />
                        Hodômetro Atual
                      </Label>
                      <Input
                        id="odometer"
                        type="number"
                        placeholder="Ex: 150450"
                        value={formData.odometer}
                        onChange={(e) => setFormData(prev => ({ ...prev, odometer: e.target.value }))}
                        className="h-9"
                      />
                      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                        {lastOdometer !== null && (
                          <span>
                            Último registro: {lastOdometer.toLocaleString('pt-BR')} km
                            {isReferenceInconsistent && (
                              <span className="text-amber-600 ml-1">(muito distante do valor atual)</span>
                            )}
                          </span>
                        )}
                        {journeyStartKm && lastOdometer === null && (
                          <span>Início da jornada: {journeyStartKm.toLocaleString('pt-BR')} km</span>
                        )}
                      </div>
                    </div>

                    {/* Preview da média calculada */}
                    {canCalculateAverage && previewAverage ? (
                      isUnrealisticAverage ? (
                        <div className="p-2 rounded-lg border bg-amber-50 border-amber-300">
                          <div className="flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                            <div>
                              <p className="text-xs font-medium text-amber-800">Média irreal ({previewAverage.toFixed(1)} km/L)</p>
                              <p className="text-xs text-amber-600">
                                Verifique se o hodômetro de referência está correto
                              </p>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className={`p-2 rounded-lg border ${getPreviewAverageBgColor(previewAverage)}`}>
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-xs font-medium text-foreground">Média Estimada</p>
                              <p className="text-xs text-muted-foreground">
                                {previewDistance.toFixed(0)} km ÷ {formLiters.toFixed(1)} L
                              </p>
                            </div>
                            <p className={`text-lg font-bold ${getPreviewAverageColor(previewAverage)}`}>
                              {previewAverage.toFixed(2)} km/L
                            </p>
                          </div>
                        </div>
                      )
                    ) : formLiters > 0 && formData.odometer === '' ? (
                      <p className="text-xs text-muted-foreground">
                        Preencha o hodômetro para calcular a média
                      </p>
                    ) : null}
                  </div>

                  {/* Campos opcionais em linha */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label htmlFor="payment_method" className="text-xs">Pagamento</Label>
                      <Select
                        value={formData.payment_method}
                        onValueChange={(value) => setFormData(prev => ({ ...prev, payment_method: value }))}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="card">Cartão</SelectItem>
                          <SelectItem value="cash">Dinheiro</SelectItem>
                          <SelectItem value="pix">PIX</SelectItem>
                          <SelectItem value="credit">Crédito</SelectItem>
                          <SelectItem value="tag">Tag</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="receipt_number" className="text-xs">Recibo</Label>
                      <Input
                        id="receipt_number"
                        value={formData.receipt_number}
                        onChange={(e) => setFormData(prev => ({ ...prev, receipt_number: e.target.value }))}
                        placeholder="Opcional"
                        className="h-9"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="notes" className="text-xs">Observações</Label>
                    <Input
                      id="notes"
                      value={formData.notes}
                      onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                      placeholder="Opcional"
                      className="h-9"
                    />
                  </div>

                  <Button type="submit" className="w-full">Salvar Abastecimento</Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Resumo unificado */}
            <div className="p-3 bg-muted rounded-lg">
              <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-7 gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">Tanque Atual</p>
                  <p className="text-base font-bold text-primary">
                    {currentFuelLevel !== null ? `${currentFuelLevel.toFixed(1)}L` : '0L'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total Litros</p>
                  <p className="text-base font-bold">{totalLiters.toFixed(1)}L</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Custo Total</p>
                  <p className="text-base font-bold">{formatCurrency(totalCost)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Preço Médio/L</p>
                  <p className="text-base font-bold">{formatCurrency(avgPricePerLiter)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Consumo Jornada</p>
                  <p className="text-base font-bold text-orange-600">
                    {fuelExpenses.reduce((sum, f) => sum + (f.fuel_consumed || 0), 0).toFixed(1)}L
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Distância Total</p>
                  <p className="text-base font-bold text-green-600">
                    {(() => {
                      const withOdo = fuelExpenses.filter(f => f.odometer);
                      if (withOdo.length >= 1) {
                        const sorted = [...withOdo].sort((a, b) => (a.odometer || 0) - (b.odometer || 0));
                        const lastOdo = sorted[sorted.length - 1].odometer || 0;
                        const firstOdo = sorted[0].odometer || 0;
                        const start = (journeyStartKm && journeyStartKm < firstOdo) ? journeyStartKm : firstOdo;
                        return (lastOdo - start).toFixed(0);
                      }
                      return fuelExpenses.reduce((sum, f) => sum + (f.distance_traveled || 0), 0).toFixed(0);
                    })()} km
                  </p>
                </div>
                {averageConsumption && (
                  <div>
                    <p className="text-xs text-muted-foreground">Consumo Médio</p>
                    <div className="flex items-center gap-1">
                      <p className="text-base font-bold">{averageConsumption.toFixed(2)} km/L</p>
                      {getConsumptionBadge()}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="px-2">Data</TableHead>
                  {journeyLegs.length > 1 && <TableHead className="px-2">Trecho</TableHead>}
                  <TableHead className="px-2">Litros</TableHead>
                  <TableHead className="px-2">Valor</TableHead>
                  <TableHead className="px-2">Hodômetro</TableHead>
                  <TableHead className="px-2">Pagamento</TableHead>
                  <TableHead className="px-2 text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fuelExpenses.map((fuel) => (
                  <TableRow key={fuel.id}>
                    <TableCell className="px-2 py-2 text-sm">{formatDateBR(fuel.date)}</TableCell>
                    {journeyLegs.length > 1 && (
                      <TableCell className="px-2 py-2 text-sm">
                        {(() => {
                          const leg = journeyLegs.find(l => l.id === fuel.journey_leg_id);
                          return leg ? (
                            <Badge variant="outline" className="text-xs">
                              T{leg.leg_number}
                            </Badge>
                          ) : '-';
                        })()}
                      </TableCell>
                    )}
                    <TableCell className="px-2 py-2 text-sm">{fuel.liters.toFixed(1)}L</TableCell>
                    <TableCell className="px-2 py-2 text-sm font-medium">{formatCurrency(fuel.total_amount)}</TableCell>
                    <TableCell className="px-2 py-2 text-sm">{fuel.odometer ? `${fuel.odometer.toLocaleString('pt-BR')} km` : '-'}</TableCell>
                    <TableCell className="px-2 py-2 text-sm capitalize">{fuel.payment_method || '-'}</TableCell>
                    <TableCell className="px-2 py-2 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openDeleteDialog(fuel.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {fuelExpenses.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={journeyLegs.length > 1 ? 7 : 6} className="text-center text-muted-foreground">
                      Nenhum abastecimento registrado
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
        title="Excluir abastecimento?"
        description="Este abastecimento será removido permanentemente. Esta ação não pode ser desfeita."
        isDeleting={isDeleting}
      />
    </div>
  );
}
