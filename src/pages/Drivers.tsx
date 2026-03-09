import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useMultiTenant } from '@/hooks/useMultiTenant';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, User, Phone, CreditCard, Edit, Trash2, Calendar, AlertTriangle, Truck as TruckIcon, UserPlus as UserPlusIcon, ShieldAlert, UserX, MapPin, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { differenceInDays } from 'date-fns';
import { VehicleAssignmentDialog } from '@/components/drivers/VehicleAssignmentDialog';
import { CreateDriverUserDialog } from '@/components/drivers/CreateDriverUserDialog';
import { formatDateBR } from '@/lib/utils';

interface Driver {
  id: string;
  name: string;
  cpf: string;
  cnh: string;
  cnh_category: string;
  cnh_expiry: string;
  phone: string;
  email: string;
  address: string;
  emergency_contact: string;
  emergency_phone: string;
  status: string;
  auth_user_id: string | null;
  can_add_revenue: boolean;
  can_start_journey: boolean;
  can_auto_close_journey: boolean;
  can_create_journey_without_approval: boolean;
}

export default function Drivers() {
  const { user } = useAuth();
  const { currentCompany } = useMultiTenant();
  const { toast } = useToast();
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null);
  const [vehicleDialogOpen, setVehicleDialogOpen] = useState(false);
  const [createUserDialogOpen, setCreateUserDialogOpen] = useState(false);
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null);

  // Delete dialog states
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteDriverId, setDeleteDriverId] = useState<string | null>(null);
  const [deleteDriverName, setDeleteDriverName] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteFetching, setDeleteFetching] = useState(false);
  const [deleteConfirmed, setDeleteConfirmed] = useState(false);
  const [showDeleteOption, setShowDeleteOption] = useState(false);
  const [deleteData, setDeleteData] = useState<{
    activeJourneys: { id: string; journey_number?: number; origin?: string; destination?: string; status: string }[];
    completedJourneyCount: number;
    expenseCount: number;
    fuelExpenseCount: number;
    accountsPayableCount: number;
  } | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    cpf: '',
    cnh: '',
    cnh_category: '',
    cnh_expiry: '',
    phone: '',
    email: '',
    address: '',
    emergency_contact: '',
    emergency_phone: '',
    status: 'active',
    can_add_revenue: false,
    can_start_journey: true,
    can_auto_close_journey: false,
    can_create_journey_without_approval: false
  });

  useEffect(() => {
    if (user && currentCompany?.id) {
      fetchDrivers();
    }
  }, [user, currentCompany?.id]);

  const fetchDrivers = async () => {
    try {
      const { data, error } = await supabase
        .from('drivers')
        .select('*')
        .eq('company_id', currentCompany?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDrivers(data || []);
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

  const resetForm = () => {
    setFormData({
      name: '',
      cpf: '',
      cnh: '',
      cnh_category: '',
      cnh_expiry: '',
      phone: '',
      email: '',
      address: '',
      emergency_contact: '',
      emergency_phone: '',
      status: 'active',
      can_add_revenue: false,
      can_start_journey: true,
      can_auto_close_journey: false,
      can_create_journey_without_approval: false
    });
    setEditingDriver(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const driverData = {
        user_id: user?.id,
        company_id: currentCompany?.id,
        name: formData.name,
        cpf: formData.cpf || null,
        cnh: formData.cnh || null,
        cnh_category: formData.cnh_category || null,
        cnh_expiry: formData.cnh_expiry || null,
        phone: formData.phone || null,
        email: formData.email || null,
        address: formData.address || null,
        emergency_contact: formData.emergency_contact || null,
        emergency_phone: formData.emergency_phone || null,
        status: formData.status,
        can_add_revenue: formData.can_add_revenue,
        can_start_journey: formData.can_start_journey,
        can_auto_close_journey: formData.can_auto_close_journey,
        can_create_journey_without_approval: formData.can_create_journey_without_approval
      };

      if (editingDriver) {
        const { error } = await supabase
          .from('drivers')
          .update(driverData)
          .eq('id', editingDriver.id);

        if (error) throw error;
        
        toast({
          title: "Sucesso",
          description: "Motorista atualizado com sucesso!"
        });
      } else {
        const { error } = await supabase
          .from('drivers')
          .insert([driverData]);

        if (error) throw error;
        
        toast({
          title: "Sucesso",
          description: "Motorista cadastrado com sucesso!"
        });
      }

      setDialogOpen(false);
      resetForm();
      fetchDrivers();
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const handleEdit = (driver: Driver) => {
    setEditingDriver(driver);
    setFormData({
      name: driver.name,
      cpf: driver.cpf || '',
      cnh: driver.cnh || '',
      cnh_category: driver.cnh_category || '',
      cnh_expiry: driver.cnh_expiry || '',
      phone: driver.phone || '',
      email: driver.email || '',
      address: driver.address || '',
      emergency_contact: driver.emergency_contact || '',
      emergency_phone: driver.emergency_phone || '',
      status: driver.status,
      can_add_revenue: driver.can_add_revenue ?? false,
      can_start_journey: driver.can_start_journey ?? true,
      can_auto_close_journey: driver.can_auto_close_journey ?? false,
      can_create_journey_without_approval: driver.can_create_journey_without_approval ?? false
    });
    setDialogOpen(true);
  };

  const handleDelete = async (driver: Driver) => {
    setDeleteDriverId(driver.id);
    setDeleteDriverName(driver.name);
    setDeleteConfirmed(false);
    setShowDeleteOption(false);
    setDeleteData(null);
    setDeleteDialogOpen(true);
    setDeleteFetching(true);

    try {
      const activeJourneysRes = await supabase.from('journeys')
        .select('id, journey_number, origin, destination, status')
        .eq('driver_id', driver.id).in('status', ['planned', 'in_progress']);

      const completedRes = await supabase.from('journeys')
        .select('*', { count: 'exact', head: true })
        .eq('driver_id', driver.id).not('status', 'in', '("planned","in_progress")');

      const expensesQuery = supabase.from('expenses').select('id', { count: 'exact', head: true });
      const expensesRes = await (expensesQuery as any).eq('driver_id', driver.id);

      const apRes = await supabase.from('accounts_payable')
        .select('*', { count: 'exact', head: true })
        .eq('driver_id', driver.id);

      // Re-fetch fuel by vehicles assigned to this driver
      const { data: driverVehicles } = await supabase
        .from('driver_vehicles').select('vehicle_id').eq('driver_id', driver.id);
      
      let fuelCount = 0;
      if (driverVehicles && driverVehicles.length > 0) {
        const vehicleIds = driverVehicles.map(dv => dv.vehicle_id);
        const { count } = await supabase.from('fuel_expenses')
          .select('*', { count: 'exact', head: true })
          .in('vehicle_id', vehicleIds);
        fuelCount = count || 0;
      }

      setDeleteData({
        activeJourneys: (activeJourneysRes.data || []).map(j => ({
          id: j.id,
          journey_number: j.journey_number ? Number(j.journey_number) : undefined,
          origin: j.origin || undefined,
          destination: j.destination || undefined,
          status: j.status,
        })),
        completedJourneyCount: completedRes.count || 0,
        expenseCount: expensesRes.count || 0,
        fuelExpenseCount: fuelCount,
        accountsPayableCount: apRes.count || 0,
      });
    } catch {
      toast({ title: "Erro", description: "Não foi possível carregar os dados do motorista.", variant: "destructive" });
      setDeleteDialogOpen(false);
    } finally {
      setDeleteFetching(false);
    }
  };

  const handleInactivate = async () => {
    if (!deleteDriverId) return;
    setDeleteLoading(true);
    try {
      const { error } = await supabase.from('drivers').update({ status: 'inactive' }).eq('id', deleteDriverId);
      if (error) throw error;
      toast({ title: "Motorista inativado", description: `"${deleteDriverName}" foi inativado. Todo o histórico foi preservado.` });
      setDeleteDialogOpen(false);
      fetchDrivers();
    } catch {
      toast({ title: "Erro", description: "Não foi possível inativar o motorista.", variant: "destructive" });
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteDriverId) return;
    setDeleteLoading(true);
    try {
      // Desvincular registros históricos
      await supabase.from('accounts_payable').update({ driver_id: null }).eq('driver_id', deleteDriverId);
      await supabase.from('journeys').update({ driver_id: null }).eq('driver_id', deleteDriverId);

      // Excluir registros dependentes
      await supabase.from('driver_vehicles').delete().eq('driver_id', deleteDriverId);
      await supabase.from('driver_messages').delete().eq('driver_id', deleteDriverId);
      await supabase.from('driver_performance_history').delete().eq('driver_id', deleteDriverId);
      await supabase.from('journey_checklists').delete().eq('driver_id', deleteDriverId);

      const { error } = await supabase.from('drivers').delete().eq('id', deleteDriverId);
      if (error) throw error;

      toast({ title: "Motorista excluído", description: `"${deleteDriverName}" foi excluído permanentemente. Registros históricos foram desvinculados.` });
      setDeleteDialogOpen(false);
      fetchDrivers();
    } catch {
      toast({ title: "Erro ao excluir", description: "Não foi possível excluir o motorista. Verifique se não há registros pendentes.", variant: "destructive" });
    } finally {
      setDeleteLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'inactive': return 'bg-gray-100 text-gray-800';
      case 'suspended': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'active': return 'Ativo';
      case 'inactive': return 'Inativo';
      case 'suspended': return 'Suspenso';
      default: return status;
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    return formatDateBR(dateString);
  };

  const formatCPF = (cpf: string) => {
    if (!cpf) return '';
    return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  };

  const getCNHExpiryStatus = (expiryDate: string) => {
    if (!expiryDate) return null;
    
    const today = new Date();
    const expiry = new Date(expiryDate);
    const daysUntilExpiry = differenceInDays(expiry, today);
    
    if (daysUntilExpiry < 0) {
      return { variant: 'destructive' as const, label: 'Vencida', icon: true };
    } else if (daysUntilExpiry <= 30) {
      return { variant: 'destructive' as const, label: `${daysUntilExpiry} dias`, icon: true };
    } else if (daysUntilExpiry <= 60) {
      return { variant: 'default' as const, label: `${daysUntilExpiry} dias`, icon: true };
    }
    
    return null;
  };

  if (loading || !currentCompany?.id) {
    return <div className="p-6">Carregando...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Motoristas</h1>
          <p className="text-muted-foreground">Gerencie os motoristas da sua frota</p>
        </div>
        
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-primary shadow-primary" onClick={resetForm}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Motorista
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingDriver ? 'Editar Motorista' : 'Novo Motorista'}
              </DialogTitle>
            </DialogHeader>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome Completo *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="cpf">CPF</Label>
                  <Input
                    id="cpf"
                    value={formData.cpf}
                    onChange={(e) => setFormData(prev => ({ ...prev, cpf: e.target.value }))}
                    placeholder="000.000.000-00"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="cnh">CNH</Label>
                  <Input
                    id="cnh"
                    value={formData.cnh}
                    onChange={(e) => setFormData(prev => ({ ...prev, cnh: e.target.value }))}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="cnh_category">Categoria CNH</Label>
                  <Select value={formData.cnh_category} onValueChange={(value) => setFormData(prev => ({ ...prev, cnh_category: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="A">A</SelectItem>
                      <SelectItem value="B">B</SelectItem>
                      <SelectItem value="C">C</SelectItem>
                      <SelectItem value="D">D</SelectItem>
                      <SelectItem value="E">E</SelectItem>
                      <SelectItem value="AB">AB</SelectItem>
                      <SelectItem value="AC">AC</SelectItem>
                      <SelectItem value="AD">AD</SelectItem>
                      <SelectItem value="AE">AE</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="cnh_expiry">Vencimento CNH</Label>
                  <Input
                    id="cnh_expiry"
                    type="date"
                    value={formData.cnh_expiry}
                    onChange={(e) => setFormData(prev => ({ ...prev, cnh_expiry: e.target.value }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">Telefone</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="(11) 99999-9999"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Endereço</Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="emergency_contact">Contato de Emergência</Label>
                  <Input
                    id="emergency_contact"
                    value={formData.emergency_contact}
                    onChange={(e) => setFormData(prev => ({ ...prev, emergency_contact: e.target.value }))}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="emergency_phone">Telefone de Emergência</Label>
                  <Input
                    id="emergency_phone"
                    value={formData.emergency_phone}
                    onChange={(e) => setFormData(prev => ({ ...prev, emergency_phone: e.target.value }))}
                    placeholder="(11) 99999-9999"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select value={formData.status} onValueChange={(value) => setFormData(prev => ({ ...prev, status: value as any }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Ativo</SelectItem>
                    <SelectItem value="inactive">Inativo</SelectItem>
                    <SelectItem value="suspended">Suspenso</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Permissões do App */}
              <div className="border rounded-lg p-4 space-y-4 bg-muted/30">
                <h3 className="text-sm font-semibold text-foreground">Permissões do App (PWA)</h3>
                
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-sm font-medium">Iniciar Jornada</Label>
                      <p className="text-xs text-muted-foreground">Permite criar novas jornadas pelo app</p>
                    </div>
                    <Switch
                      checked={formData.can_start_journey}
                      onCheckedChange={(checked) => setFormData(prev => ({ ...prev, can_start_journey: checked }))}
                    />
                  </div>

                  {formData.can_start_journey && (
                    <div className="flex items-center justify-between pl-4 border-l-2 border-muted">
                      <div>
                        <Label className="text-sm font-medium">Criar Jornadas sem Aprovação</Label>
                        <p className="text-xs text-muted-foreground">Se desligado, jornadas aguardam aprovação do gestor</p>
                      </div>
                      <Switch
                        checked={formData.can_create_journey_without_approval}
                        onCheckedChange={(checked) => setFormData(prev => ({ ...prev, can_create_journey_without_approval: checked }))}
                      />
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-sm font-medium">Encerrar Jornada sem Aprovação</Label>
                      <p className="text-xs text-muted-foreground">Se desligado, encerramentos aguardam aprovação</p>
                    </div>
                    <Switch
                      checked={formData.can_auto_close_journey}
                      onCheckedChange={(checked) => setFormData(prev => ({ ...prev, can_auto_close_journey: checked }))}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-sm font-medium">Lançar Receitas</Label>
                      <p className="text-xs text-muted-foreground">Permite registrar receitas pelo app</p>
                    </div>
                    <Switch
                      checked={formData.can_add_revenue}
                      onCheckedChange={(checked) => setFormData(prev => ({ ...prev, can_add_revenue: checked }))}
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-3">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" className="bg-gradient-primary">
                  {editingDriver ? 'Atualizar' : 'Cadastrar'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle>Lista de Motoristas</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>CPF</TableHead>
                <TableHead>CNH</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Vencimento CNH</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Permissões</TableHead>
                <TableHead>Acesso App</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {drivers.map((driver) => (
                <TableRow key={driver.id}>
                  <TableCell>
                    <div className="flex items-center space-x-1">
                      <User className="h-3 w-3 text-muted-foreground" />
                      <span className="font-medium">{driver.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>{formatCPF(driver.cpf)}</TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-1">
                      <CreditCard className="h-3 w-3 text-muted-foreground" />
                      <span className="text-sm">
                        {driver.cnh} {driver.cnh_category && `(${driver.cnh_category})`}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-1">
                      <Phone className="h-3 w-3 text-muted-foreground" />
                      <span className="text-sm">{driver.phone || 'N/A'}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center space-x-1">
                        <Calendar className="h-3 w-3 text-muted-foreground" />
                        <span className="text-sm">{formatDate(driver.cnh_expiry)}</span>
                      </div>
                      {getCNHExpiryStatus(driver.cnh_expiry) && (
                        <Badge variant={getCNHExpiryStatus(driver.cnh_expiry)!.variant}>
                          {getCNHExpiryStatus(driver.cnh_expiry)!.icon && (
                            <AlertTriangle className="h-3 w-3 mr-1" />
                          )}
                          {getCNHExpiryStatus(driver.cnh_expiry)!.label}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={getStatusColor(driver.status)}>
                      {getStatusText(driver.status)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {driver.can_start_journey && (
                        <Badge variant="outline" className="text-xs">Jornada</Badge>
                      )}
                      {driver.can_auto_close_journey && (
                        <Badge variant="outline" className="text-xs">Auto-Encerrar</Badge>
                      )}
                      {driver.can_add_revenue && (
                        <Badge variant="outline" className="text-xs">Receita</Badge>
                      )}
                      {driver.can_start_journey && !driver.can_create_journey_without_approval && (
                        <Badge variant="outline" className="text-xs text-orange-600 border-orange-300">Requer Aprov.</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {driver.auth_user_id ? (
                      <Badge variant="default" className="bg-green-100 text-green-800">
                        Configurado
                      </Badge>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedDriver(driver);
                          setCreateUserDialogOpen(true);
                        }}
                      >
                        <UserPlusIcon className="h-3 w-3 mr-1" />
                        Criar Acesso
                      </Button>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedDriver(driver);
                          setVehicleDialogOpen(true);
                        }}
                        title="Gerenciar Veículos"
                      >
                        <TruckIcon className="h-3 w-3" />
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleEdit(driver)}
                      >
                        <Edit className="h-3 w-3" />
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleDelete(driver)}
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

      {selectedDriver && (
        <>
          <VehicleAssignmentDialog
            driverId={selectedDriver.id}
            driverName={selectedDriver.name}
            companyId={currentCompany?.id || ''}
            open={vehicleDialogOpen}
            onOpenChange={setVehicleDialogOpen}
          />
          <CreateDriverUserDialog
            driverId={selectedDriver.id}
            driverName={selectedDriver.name}
            driverEmail={selectedDriver.email}
            open={createUserDialogOpen}
            onOpenChange={setCreateUserDialogOpen}
            onSuccess={fetchDrivers}
          />
        </>
      )}

      {/* Delete / Inactivate Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={(open) => {
        if (!deleteLoading) {
          setDeleteDialogOpen(open);
          if (!open) {
            setShowDeleteOption(false);
            setDeleteConfirmed(false);
          }
        }
      }}>
        <DialogContent className="max-w-lg">
          {deleteFetching ? (
            <div className="flex flex-col items-center justify-center py-8 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Carregando dados do motorista...</p>
            </div>
          ) : deleteData && deleteData.activeJourneys.length > 0 ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <ShieldAlert className="h-5 w-5 text-amber-500" />
                  Motorista com jornadas ativas
                </DialogTitle>
                <DialogDescription>
                  <span className="font-semibold text-foreground">"{deleteDriverName}"</span> possui jornadas em andamento. Não é possível excluir.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-2 my-2">
                {deleteData.activeJourneys.map((j) => (
                  <div key={j.id} className="flex items-center gap-3 p-3 rounded-lg border bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800">
                    <MapPin className="h-4 w-4 text-amber-600 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {j.journey_number ? `Jornada #${j.journey_number}` : 'Jornada'}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {j.origin || '?'} → {j.destination || '?'}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-xs shrink-0 border-amber-300 text-amber-700">
                      {j.status === 'in_progress' ? 'Em andamento' : 'Planejada'}
                    </Badge>
                  </div>
                ))}
              </div>

              <p className="text-sm text-muted-foreground">
                Finalize ou cancele as jornadas ativas antes de excluir. Você pode <strong>inativar</strong> o motorista para impedir novas operações.
              </p>

              <DialogFooter className="gap-2 sm:gap-0">
                <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} disabled={deleteLoading}>
                  Cancelar
                </Button>
                <Button onClick={handleInactivate} disabled={deleteLoading} className="gap-2">
                  {deleteLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                  <UserX className="h-4 w-4" />
                  Inativar motorista
                </Button>
              </DialogFooter>
            </>
          ) : deleteData ? (
            <>
              <DialogHeader>
                <DialogTitle>O que deseja fazer com este motorista?</DialogTitle>
                <DialogDescription>
                  <span className="font-semibold text-foreground">"{deleteDriverName}"</span>
                </DialogDescription>
              </DialogHeader>

              {/* Summary of linked records */}
              {(deleteData.completedJourneyCount > 0 || deleteData.expenseCount > 0 || deleteData.fuelExpenseCount > 0 || deleteData.accountsPayableCount > 0) && (
                <div className="rounded-lg border p-4 space-y-2 bg-muted/30">
                  <p className="text-sm font-medium">Registros vinculados:</p>
                  <div className="grid grid-cols-2 gap-2">
                    {deleteData.completedJourneyCount > 0 && (
                      <div className="text-sm text-muted-foreground">
                        📋 {deleteData.completedJourneyCount} jornada{deleteData.completedJourneyCount !== 1 ? 's' : ''} concluída{deleteData.completedJourneyCount !== 1 ? 's' : ''}
                      </div>
                    )}
                    {deleteData.expenseCount > 0 && (
                      <div className="text-sm text-muted-foreground">
                        💰 {deleteData.expenseCount} despesa{deleteData.expenseCount !== 1 ? 's' : ''}
                      </div>
                    )}
                    {deleteData.fuelExpenseCount > 0 && (
                      <div className="text-sm text-muted-foreground">
                        ⛽ {deleteData.fuelExpenseCount} abastecimento{deleteData.fuelExpenseCount !== 1 ? 's' : ''}
                      </div>
                    )}
                    {deleteData.accountsPayableCount > 0 && (
                      <div className="text-sm text-muted-foreground">
                        📄 {deleteData.accountsPayableCount} conta{deleteData.accountsPayableCount !== 1 ? 's' : ''} a pagar
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Inactivate option (recommended) */}
              <button
                type="button"
                onClick={handleInactivate}
                disabled={deleteLoading}
                className="w-full text-left rounded-lg border-2 border-primary/30 bg-primary/5 hover:bg-primary/10 p-4 transition-colors group"
              >
                <div className="flex items-start gap-3">
                  <UserX className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-sm">Inativar motorista</p>
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Recomendado</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Preserva todo o histórico e relatórios (DRE). O motorista não poderá mais operar.
                    </p>
                  </div>
                </div>
              </button>

              {/* Delete option (destructive) */}
              {!showDeleteOption ? (
                <button
                  type="button"
                  onClick={() => setShowDeleteOption(true)}
                  className="w-full text-left rounded-lg border border-destructive/20 hover:border-destructive/40 p-4 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <Trash2 className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
                    <div>
                      <p className="font-semibold text-sm text-destructive">Excluir permanentemente</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Remove o motorista e desvincula todo o histórico. Pode impactar o DRE.
                      </p>
                    </div>
                  </div>
                </button>
              ) : (
                <div className="rounded-lg border-2 border-destructive/40 p-4 space-y-3 bg-destructive/5">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
                    <div>
                      <p className="font-semibold text-sm text-destructive">Atenção: ação irreversível</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        O motorista será removido permanentemente. Jornadas, despesas e contas a pagar vinculadas perderão a referência ao motorista, <strong>impactando o DRE e relatórios históricos</strong>.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pl-1">
                    <Checkbox
                      id="confirm-delete"
                      checked={deleteConfirmed}
                      onCheckedChange={(checked) => setDeleteConfirmed(checked === true)}
                    />
                    <label htmlFor="confirm-delete" className="text-xs cursor-pointer select-none">
                      Entendo que os dados serão desvinculados e o DRE será impactado
                    </label>
                  </div>

                  <Button
                    variant="destructive"
                    size="sm"
                    className="w-full"
                    disabled={!deleteConfirmed || deleteLoading}
                    onClick={handleConfirmDelete}
                  >
                    {deleteLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Excluir permanentemente
                  </Button>
                </div>
              )}

              <DialogFooter>
                <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} disabled={deleteLoading}>
                  Cancelar
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}