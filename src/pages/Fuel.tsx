import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useMultiTenant } from '@/hooks/useMultiTenant';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Fuel as FuelIcon, MapPin, Calendar, Edit, Trash2, Truck, AlertTriangle } from 'lucide-react';
import { LocationDisplay } from '@/components/ui/location-display';
import { useToast } from '@/hooks/use-toast';
import { formatDateBR } from '@/lib/utils';

interface GasStation {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  phone: string;
  cnpj: string;
  status: string;
}

interface FuelExpense {
  id: string;
  date: string;
  liters: number;
  price_per_liter: number;
  total_amount: number;
  odometer: number;
  odometer_final?: number;
  fuel_consumed?: number;
  tank_level_before?: number;
  tank_level_after?: number;
  distance_traveled?: number;
  payment_method: string;
  receipt_number: string;
  notes: string;
  location_lat?: number | null;
  location_lng?: number | null;
  location_address?: string | null;
  vehicles: { plate: string; model: string } | null;
  gas_stations: { name: string } | null;
  journeys: { journey_number: string; distance: number | null; start_km: number | null; end_km: number | null } | null;
}

interface Vehicle {
  id: string;
  plate: string;
  model: string;
}

interface Journey {
  id: string;
  journey_number: string;
}

export default function Fuel() {
  const { user } = useAuth();
  const { currentCompany } = useMultiTenant();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [gasStations, setGasStations] = useState<GasStation[]>([]);
  const [fuelExpenses, setFuelExpenses] = useState<FuelExpense[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [journeys, setJourneys] = useState<Journey[]>([]);
  const [loading, setLoading] = useState(true);
  const [stationDialogOpen, setStationDialogOpen] = useState(false);
  const [expenseDialogOpen, setExpenseDialogOpen] = useState(false);
  const [editingStation, setEditingStation] = useState<GasStation | null>(null);
  const [editingExpense, setEditingExpense] = useState<FuelExpense | null>(null);

  const [stationFormData, setStationFormData] = useState({
    name: '',
    address: '',
    city: '',
    state: '',
    phone: '',
    cnpj: '',
    status: 'active'
  });

  const [expenseFormData, setExpenseFormData] = useState({
    vehicle_id: '',
    journey_id: '',
    gas_station_id: '',
    date: new Date().toISOString().split('T')[0],
    liters: '',
    price_per_liter: '',
    odometer: '',
    odometer_final: '',
    distance_direct: '', // Campo alternativo de KM rodados
    payment_method: 'card',
    receipt_number: '',
    notes: ''
  });

  useEffect(() => {
    if (user && currentCompany?.id) {
      fetchGasStations();
      fetchFuelExpenses();
      fetchVehicles();
      fetchJourneys();
    }
  }, [user, currentCompany?.id]);

  // Auto-open dialog with pre-selected vehicle from URL parameter
  useEffect(() => {
    const vehicleId = searchParams.get('vehicle');
    if (vehicleId && vehicles.length > 0 && !loading) {
      const vehicleExists = vehicles.find(v => v.id === vehicleId);
      if (vehicleExists) {
        resetExpenseForm();
        setExpenseFormData(prev => ({ ...prev, vehicle_id: vehicleId }));
        setExpenseDialogOpen(true);
        // Clear parameter to avoid re-opening
        searchParams.delete('vehicle');
        setSearchParams(searchParams, { replace: true });
      }
    }
  }, [vehicles, loading, searchParams]);

  const fetchGasStations = async () => {
    try {
      const { data, error } = await supabase
        .from('gas_stations')
        .select('*')
        .eq('company_id', currentCompany?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setGasStations(data || []);
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchFuelExpenses = async () => {
    try {
      const { data, error } = await supabase
        .from('fuel_expenses')
        .select(`
          *,
          vehicles(plate, model),
          gas_stations(name),
          journeys(journey_number, distance, start_km, end_km)
        `)
        .eq('company_id', currentCompany?.id)
        .is('deleted_at', null)
        .order('date', { ascending: false });

      if (error) throw error;
      setFuelExpenses(data || []);
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const fetchVehicles = async () => {
    try {
      const { data, error } = await supabase
        .from('vehicles')
        .select('id, plate, model')
        .eq('company_id', currentCompany?.id)
        .eq('status', 'active');

      if (error) throw error;
      setVehicles(data || []);
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const fetchJourneys = async () => {
    try {
      const { data, error } = await supabase
        .from('journeys')
        .select('id, journey_number')
        .eq('company_id', currentCompany?.id)
        .in('status', ['planned', 'in_progress']);

      if (error) throw error;
      setJourneys(data || []);
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const resetStationForm = () => {
    setStationFormData({
      name: '',
      address: '',
      city: '',
      state: '',
      phone: '',
      cnpj: '',
      status: 'active'
    });
    setEditingStation(null);
  };

  const resetExpenseForm = () => {
    setExpenseFormData({
      vehicle_id: '',
      journey_id: '',
      gas_station_id: '',
      date: new Date().toISOString().split('T')[0],
      liters: '',
      price_per_liter: '',
      odometer: '',
      odometer_final: '',
      distance_direct: '',
      payment_method: 'card',
      receipt_number: '',
      notes: ''
    });
    setEditingExpense(null);
  };

  const handleStationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const stationData = {
        user_id: user?.id,
        company_id: currentCompany?.id,
        ...stationFormData
      };

      if (editingStation) {
        const { error } = await supabase
          .from('gas_stations')
          .update(stationData)
          .eq('id', editingStation.id);

        if (error) throw error;
        
        toast({
          title: "Sucesso",
          description: "Posto atualizado com sucesso!"
        });
      } else {
        const { error } = await supabase
          .from('gas_stations')
          .insert([stationData]);

        if (error) throw error;
        
        toast({
          title: "Sucesso",
          description: "Posto cadastrado com sucesso!"
        });
      }

      setStationDialogOpen(false);
      resetStationForm();
      fetchGasStations();
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const handleExpenseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const total_amount = parseFloat(expenseFormData.liters) * parseFloat(expenseFormData.price_per_liter);
      
      // Calcular distância e consumo no frontend
      const odometer = parseInt(expenseFormData.odometer) || null;
      const odometerFinal = parseInt(expenseFormData.odometer_final) || null;
      const distanceDirect = parseInt(expenseFormData.distance_direct) || null;
      const liters = parseFloat(expenseFormData.liters);
      
      let distance_traveled = null;
      let fuel_consumed = null;
      
      // Prioridade: campo direto de distância > cálculo por hodômetros
      if (distanceDirect && distanceDirect > 0 && liters > 0) {
        distance_traveled = distanceDirect;
        fuel_consumed = parseFloat((distance_traveled / liters).toFixed(2));
      } else if (odometer && odometerFinal && liters > 0) {
        distance_traveled = odometerFinal - odometer;
        fuel_consumed = parseFloat((distance_traveled / liters).toFixed(2));
      }
      
      const expenseData = {
        user_id: user?.id,
        company_id: currentCompany?.id,
        vehicle_id: expenseFormData.vehicle_id,
        journey_id: expenseFormData.journey_id || null,
        gas_station_id: expenseFormData.gas_station_id || null,
        date: expenseFormData.date,
        liters,
        price_per_liter: parseFloat(expenseFormData.price_per_liter),
        total_amount,
        odometer,
        odometer_final: odometerFinal,
        distance_traveled,
        fuel_consumed,
        payment_method: expenseFormData.payment_method,
        receipt_number: expenseFormData.receipt_number || null,
        notes: expenseFormData.notes || null
      };

      if (editingExpense) {
        const { error } = await supabase
          .from('fuel_expenses')
          .update(expenseData)
          .eq('id', editingExpense.id);

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
        
        toast({
          title: "Sucesso",
          description: "Abastecimento atualizado com sucesso!"
        });
      } else {
        const { error } = await supabase
          .from('fuel_expenses')
          .insert([expenseData]);

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
        
        toast({
          title: "Sucesso",
          description: "Abastecimento registrado com sucesso!"
        });
      }

      setExpenseDialogOpen(false);
      resetExpenseForm();
      fetchFuelExpenses();
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const handleEditStation = (station: GasStation) => {
    setEditingStation(station);
    setStationFormData({
      name: station.name,
      address: station.address || '',
      city: station.city || '',
      state: station.state || '',
      phone: station.phone || '',
      cnpj: station.cnpj || '',
      status: station.status
    });
    setStationDialogOpen(true);
  };

  const handleEditExpense = (expense: FuelExpense) => {
    setEditingExpense(expense);
    setExpenseFormData({
      vehicle_id: '', // Will need to get from vehicles table
      journey_id: '', // Will need to get from journeys table
      gas_station_id: '', // Will need to get from gas_stations table
      date: expense.date.split('T')[0],
      liters: expense.liters.toString(),
      price_per_liter: expense.price_per_liter.toString(),
      odometer: expense.odometer?.toString() || '',
      odometer_final: expense.odometer_final?.toString() || '',
      distance_direct: expense.distance_traveled?.toString() || '',
      payment_method: expense.payment_method,
      receipt_number: expense.receipt_number || '',
      notes: expense.notes || ''
    });
    setExpenseDialogOpen(true);
  };

  const handleDeleteStation = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este posto?')) return;

    try {
      const { error } = await supabase
        .from('gas_stations')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      toast({
        title: "Sucesso",
        description: "Posto excluído com sucesso!"
      });
      
      fetchGasStations();
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const handleDeleteExpense = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este abastecimento?')) return;

    try {
      // Soft Delete - mantém histórico auditável
      const { error } = await supabase
        .from('fuel_expenses')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
      
      toast({
        title: "Sucesso",
        description: "Abastecimento excluído com sucesso!"
      });
      
      fetchFuelExpenses();
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    return formatDateBR(dateString);
  };

  if (loading || !currentCompany?.id) {
    return <div className="p-6">Carregando...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Combustível</h1>
          <p className="text-muted-foreground">Gerencie postos e despesas de combustível</p>
        </div>
      </div>

      <Tabs defaultValue="expenses" className="space-y-6">
        <TabsList>
          <TabsTrigger value="expenses">Abastecimentos</TabsTrigger>
          <TabsTrigger value="stations">Postos</TabsTrigger>
        </TabsList>

        <TabsContent value="expenses">
          <div className="space-y-6">
            <div className="flex justify-end">
              <Dialog open={expenseDialogOpen} onOpenChange={setExpenseDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-gradient-primary shadow-primary" onClick={resetExpenseForm}>
                    <Plus className="h-4 w-4 mr-2" />
                    Novo Abastecimento
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>
                      {editingExpense ? 'Editar Abastecimento' : 'Novo Abastecimento'}
                    </DialogTitle>
                  </DialogHeader>
                  
                  <form onSubmit={handleExpenseSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="vehicle_id">Veículo *</Label>
                        <Select value={expenseFormData.vehicle_id} onValueChange={(value) => setExpenseFormData(prev => ({ ...prev, vehicle_id: value }))}>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione um veículo" />
                          </SelectTrigger>
                          <SelectContent>
                            {vehicles.map((vehicle) => (
                              <SelectItem key={vehicle.id} value={vehicle.id}>
                                {vehicle.plate} - {vehicle.model}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="gas_station_id">Posto</Label>
                        <Select value={expenseFormData.gas_station_id} onValueChange={(value) => setExpenseFormData(prev => ({ ...prev, gas_station_id: value }))}>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione um posto" />
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
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="journey_id">Jornada</Label>
                        <Select value={expenseFormData.journey_id} onValueChange={(value) => setExpenseFormData(prev => ({ ...prev, journey_id: value }))}>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione uma jornada" />
                          </SelectTrigger>
                          <SelectContent>
                            {journeys.map((journey) => (
                              <SelectItem key={journey.id} value={journey.id}>
                                {journey.journey_number}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="date">Data *</Label>
                        <Input
                          id="date"
                          type="date"
                          value={expenseFormData.date}
                          onChange={(e) => setExpenseFormData(prev => ({ ...prev, date: e.target.value }))}
                          required
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="liters">Litros *</Label>
                        <Input
                          id="liters"
                          type="number"
                          step="0.001"
                          value={expenseFormData.liters}
                          onChange={(e) => setExpenseFormData(prev => ({ ...prev, liters: e.target.value }))}
                          required
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="price_per_liter">Preço por Litro *</Label>
                        <Input
                          id="price_per_liter"
                          type="number"
                          step="0.0001"
                          value={expenseFormData.price_per_liter}
                          onChange={(e) => setExpenseFormData(prev => ({ ...prev, price_per_liter: e.target.value }))}
                          required
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="total">Total</Label>
                        <Input
                          id="total"
                          value={formatCurrency((parseFloat(expenseFormData.liters) || 0) * (parseFloat(expenseFormData.price_per_liter) || 0))}
                          disabled
                        />
                      </div>
                    </div>

                    {/* Seção de Hodômetro com destaque visual */}
                    <div className="p-4 border border-dashed border-primary/30 rounded-lg bg-primary/5 space-y-4">
                      <div className="flex items-center gap-2">
                        <FuelIcon className="h-4 w-4 text-primary" />
                        <span className="text-sm font-medium text-primary">Cálculo de Consumo</span>
                      </div>
                      
                      {/* Campo alternativo: KM Rodados direto */}
                      <div className="space-y-2">
                        <Label htmlFor="distance_direct" className="flex items-center gap-1">
                          KM Rodados
                          <span className="text-xs text-muted-foreground">(distância percorrida)</span>
                        </Label>
                        <Input
                          id="distance_direct"
                          type="number"
                          placeholder="Ex: 500"
                          value={expenseFormData.distance_direct}
                          onChange={(e) => setExpenseFormData(prev => ({ ...prev, distance_direct: e.target.value }))}
                          className="border-primary/50"
                        />
                        <p className="text-xs text-muted-foreground">
                          Se você sabe a distância percorrida, preencha aqui. Caso contrário, use os campos de hodômetro abaixo.
                        </p>
                      </div>
                      
                      <div className="border-t border-dashed border-primary/20 pt-4">
                        <p className="text-xs text-muted-foreground mb-3">Ou calcule pela diferença de hodômetro:</p>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="odometer" className="text-sm">
                              KM Inicial <span className="text-xs text-muted-foreground">(hodômetro total)</span>
                            </Label>
                            <Input
                              id="odometer"
                              type="number"
                              placeholder="Ex: 150000"
                              value={expenseFormData.odometer}
                              onChange={(e) => {
                                const value = e.target.value;
                                // Validação: alerta se hodômetro parece muito baixo
                                if (value && parseInt(value) < 10000) {
                                  console.warn('Hodômetro muito baixo - verifique se é a quilometragem total do veículo');
                                }
                                setExpenseFormData(prev => ({ ...prev, odometer: value }));
                              }}
                            />
                          </div>
                          
                          <div className="space-y-2">
                            <Label htmlFor="odometer_final" className="text-sm">
                              KM Final <span className="text-xs text-muted-foreground">(no próx. abast.)</span>
                            </Label>
                            <Input
                              id="odometer_final"
                              type="number"
                              placeholder="Ex: 150500"
                              value={expenseFormData.odometer_final}
                              onChange={(e) => setExpenseFormData(prev => ({ ...prev, odometer_final: e.target.value }))}
                            />
                          </div>
                        </div>
                      </div>
                      
                      {/* Preview da média calculada */}
                      {(() => {
                        const distDirect = parseInt(expenseFormData.distance_direct) || 0;
                        const distCalc = (parseInt(expenseFormData.odometer_final) || 0) - (parseInt(expenseFormData.odometer) || 0);
                        const distance = distDirect > 0 ? distDirect : distCalc > 0 ? distCalc : 0;
                        const liters = parseFloat(expenseFormData.liters) || 0;
                        
                        if (distance > 0 && liters > 0) {
                          const avg = (distance / liters).toFixed(2);
                          const avgNum = parseFloat(avg);
                          const colorClass = avgNum >= 3.5 ? 'text-green-600 bg-green-50 border-green-200' : avgNum >= 2.5 ? 'text-yellow-600 bg-yellow-50 border-yellow-200' : 'text-red-600 bg-red-50 border-red-200';
                          
                          return (
                            <div className={`p-3 rounded-lg border ${colorClass} mt-4`}>
                              <p className="text-center font-bold">
                                Média: {avg} km/l • Distância: {distance.toLocaleString('pt-BR')} km
                              </p>
                              <p className="text-xs text-center mt-1 opacity-75">
                                {distDirect > 0 ? 'Calculado com KM Rodados' : 'Calculado pela diferença de hodômetro'}
                              </p>
                            </div>
                          );
                        }
                        
                        return (
                          <p className="text-xs text-amber-600 flex items-center gap-1 mt-4">
                            <AlertTriangle className="h-3 w-3" />
                            Preencha KM Rodados ou ambos os hodômetros + Litros para calcular a média
                          </p>
                        );
                      })()}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="payment_method">Forma de Pagamento</Label>
                        <Select value={expenseFormData.payment_method} onValueChange={(value) => setExpenseFormData(prev => ({ ...prev, payment_method: value }))}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="cash">Dinheiro</SelectItem>
                            <SelectItem value="card">Cartão</SelectItem>
                            <SelectItem value="pix">PIX</SelectItem>
                            <SelectItem value="credit">Crédito</SelectItem>
                            <SelectItem value="tag">Tag</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="receipt_number">Número do Cupom</Label>
                        <Input
                          id="receipt_number"
                          value={expenseFormData.receipt_number}
                          onChange={(e) => setExpenseFormData(prev => ({ ...prev, receipt_number: e.target.value }))}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="notes">Observações</Label>
                      <Input
                        id="notes"
                        value={expenseFormData.notes}
                        onChange={(e) => setExpenseFormData(prev => ({ ...prev, notes: e.target.value }))}
                      />
                    </div>

                    <div className="flex justify-end space-x-3">
                      <Button type="button" variant="outline" onClick={() => setExpenseDialogOpen(false)}>
                        Cancelar
                      </Button>
                      <Button type="submit" className="bg-gradient-primary">
                        {editingExpense ? 'Atualizar' : 'Registrar'}
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            <Card className="shadow-card">
              <CardHeader>
                <CardTitle>Abastecimentos</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Veículo</TableHead>
                      <TableHead>Posto</TableHead>
                      <TableHead>Litros</TableHead>
                      <TableHead>Preço/L</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Hodômetro</TableHead>
                      <TableHead>Distância</TableHead>
                      <TableHead>Média (km/l)</TableHead>
                      <TableHead>Local</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {fuelExpenses.map((expense) => (
                      <TableRow key={expense.id}>
                        <TableCell>
                          <div className="flex items-center space-x-1">
                            <Calendar className="h-3 w-3 text-muted-foreground" />
                            <span className="text-sm">{formatDate(expense.date)}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-1">
                            <Truck className="h-3 w-3 text-muted-foreground" />
                            <span className="text-sm">
                              {expense.vehicles ? `${expense.vehicles.plate} - ${expense.vehicles.model}` : 'N/A'}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-1">
                            <MapPin className="h-3 w-3 text-muted-foreground" />
                            <span className="text-sm">{expense.gas_stations?.name || 'N/A'}</span>
                          </div>
                        </TableCell>
                        <TableCell>{expense.liters.toFixed(3)}L</TableCell>
                        <TableCell>{formatCurrency(expense.price_per_liter)}</TableCell>
                        <TableCell className="font-medium">{formatCurrency(expense.total_amount)}</TableCell>
                        <TableCell>
                          {expense.odometer ? `${expense.odometer.toLocaleString('pt-BR')} km` : '-'}
                        </TableCell>
                        <TableCell>
                          {(() => {
                            const dist = expense.distance_traveled 
                              || (expense.journeys?.end_km && expense.journeys?.start_km 
                                  ? expense.journeys.end_km - expense.journeys.start_km 
                                  : null)
                              || expense.journeys?.distance
                              || null;
                            return dist && dist > 0 ? `${Math.round(dist).toLocaleString('pt-BR')} km` : '-';
                          })()}
                        </TableCell>
                        <TableCell>
                          {(() => {
                            const dist = expense.distance_traveled 
                              || (expense.journeys?.end_km && expense.journeys?.start_km 
                                  ? expense.journeys.end_km - expense.journeys.start_km 
                                  : null)
                              || expense.journeys?.distance
                              || null;
                            const avg = expense.fuel_consumed 
                              || (dist && dist > 0 && expense.liters > 0 ? parseFloat((dist / expense.liters).toFixed(2)) : null);
                            if (!avg) return '-';
                            const colorClass = avg >= 3.5 ? 'text-green-600' : avg >= 2.5 ? 'text-yellow-600' : 'text-red-600';
                            return <span className={`font-medium ${colorClass}`}>{avg.toFixed(2)} km/l</span>;
                          })()}
                        </TableCell>
                        <TableCell>
                          <LocationDisplay
                            lat={expense.location_lat}
                            lng={expense.location_lng}
                            address={expense.location_address}
                            compact
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => handleEditExpense(expense)}
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => handleDeleteExpense(expense.id)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="stations">
          <div className="space-y-6">
            <div className="flex justify-end">
              <Dialog open={stationDialogOpen} onOpenChange={setStationDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-gradient-primary shadow-primary" onClick={resetStationForm}>
                    <Plus className="h-4 w-4 mr-2" />
                    Novo Posto
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>
                      {editingStation ? 'Editar Posto' : 'Novo Posto'}
                    </DialogTitle>
                  </DialogHeader>
                  
                  <form onSubmit={handleStationSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Nome do Posto *</Label>
                      <Input
                        id="name"
                        value={stationFormData.name}
                        onChange={(e) => setStationFormData(prev => ({ ...prev, name: e.target.value }))}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="address">Endereço</Label>
                      <Input
                        id="address"
                        value={stationFormData.address}
                        onChange={(e) => setStationFormData(prev => ({ ...prev, address: e.target.value }))}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="city">Cidade</Label>
                        <Input
                          id="city"
                          value={stationFormData.city}
                          onChange={(e) => setStationFormData(prev => ({ ...prev, city: e.target.value }))}
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="state">Estado</Label>
                        <Input
                          id="state"
                          value={stationFormData.state}
                          onChange={(e) => setStationFormData(prev => ({ ...prev, state: e.target.value }))}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="phone">Telefone</Label>
                        <Input
                          id="phone"
                          value={stationFormData.phone}
                          onChange={(e) => setStationFormData(prev => ({ ...prev, phone: e.target.value }))}
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="cnpj">CNPJ</Label>
                        <Input
                          id="cnpj"
                          value={stationFormData.cnpj}
                          onChange={(e) => setStationFormData(prev => ({ ...prev, cnpj: e.target.value }))}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="status">Status</Label>
                      <Select value={stationFormData.status} onValueChange={(value) => setStationFormData(prev => ({ ...prev, status: value as any }))}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">Ativo</SelectItem>
                          <SelectItem value="inactive">Inativo</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex justify-end space-x-3">
                      <Button type="button" variant="outline" onClick={() => setStationDialogOpen(false)}>
                        Cancelar
                      </Button>
                      <Button type="submit" className="bg-gradient-primary">
                        {editingStation ? 'Atualizar' : 'Cadastrar'}
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            <Card className="shadow-card">
              <CardHeader>
                <CardTitle>Postos de Combustível</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Endereço</TableHead>
                      <TableHead>Cidade/Estado</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {gasStations.map((station) => (
                      <TableRow key={station.id}>
                        <TableCell className="font-medium">{station.name}</TableCell>
                        <TableCell>{station.address || 'N/A'}</TableCell>
                        <TableCell>{station.city && station.state ? `${station.city}/${station.state}` : 'N/A'}</TableCell>
                        <TableCell>{station.phone || 'N/A'}</TableCell>
                        <TableCell>
                          <span className={`px-2 py-1 rounded-full text-xs ${
                            station.status === 'active' 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {station.status === 'active' ? 'Ativo' : 'Inativo'}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => handleEditStation(station)}
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => handleDeleteStation(station.id)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}