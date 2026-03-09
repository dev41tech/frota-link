import { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Truck, User, AlertCircle, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useMultiTenant } from '@/hooks/useMultiTenant';

export interface VehicleDriverData {
  vehicleId: string;
  vehiclePlate: string;
  vehicleRenavam: string;
  vehicleUf: string;
  vehicleRntrc: string;
  vehicleTara: string; // Peso próprio do veículo
  vehicleCapacidade: string; // Capacidade em kg
  driverId: string;
  driverName: string;
  driverCpf: string;
}

interface VehicleDriverStepProps {
  value: VehicleDriverData;
  onChange: (data: VehicleDriverData) => void;
}

interface Vehicle {
  id: string;
  plate: string;
  model: string;
  brand: string;
  renavam: string | null;
}

interface Driver {
  id: string;
  name: string;
  cpf: string | null;
}

export function VehicleDriverStep({ value, onChange }: VehicleDriverStepProps) {
  const { currentCompany } = useMultiTenant();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!currentCompany?.id) return;
      
      setLoading(true);
      
      // Fetch vehicles and drivers in parallel
      const [vehiclesRes, driversRes] = await Promise.all([
        supabase
          .from('vehicles')
          .select('id, plate, model, brand, renavam')
          .eq('company_id', currentCompany.id)
          .eq('status', 'active')
          .order('plate'),
        supabase
          .from('drivers')
          .select('id, name, cpf')
          .eq('company_id', currentCompany.id)
          .eq('status', 'active')
          .order('name')
      ]);

      if (vehiclesRes.data) setVehicles(vehiclesRes.data);
      if (driversRes.data) setDrivers(driversRes.data);
      
      setLoading(false);
    };

    fetchData();
  }, [currentCompany?.id]);

  const handleVehicleSelect = (vehicleId: string) => {
    const vehicle = vehicles.find(v => v.id === vehicleId);
    if (vehicle) {
      onChange({
        ...value,
        vehicleId: vehicle.id,
        vehiclePlate: vehicle.plate,
        vehicleRenavam: vehicle.renavam || ''
      });
    }
  };

  const handleDriverSelect = (driverId: string) => {
    const driver = drivers.find(d => d.id === driverId);
    if (driver) {
      onChange({
        ...value,
        driverId: driver.id,
        driverName: driver.name,
        driverCpf: driver.cpf || ''
      });
    }
  };

  const formatCpf = (cpf: string) => {
    const cleaned = cpf.replace(/\D/g, '');
    return cleaned
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  };

  const formatPlate = (plate: string) => {
    const cleaned = plate.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (cleaned.length <= 3) return cleaned;
    return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 7)}`;
  };

  const isValidRntrc = (rntrc: string) => {
    const cleaned = rntrc.replace(/\D/g, '');
    return cleaned.length >= 8;
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Veículo */}
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-4">
              <Truck className="h-5 w-5 text-primary" />
              <h4 className="font-medium">Dados do Veículo</h4>
            </div>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Selecionar Veículo da Frota</Label>
                <Select
                  value={value.vehicleId}
                  onValueChange={handleVehicleSelect}
                  disabled={loading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Escolha um veículo cadastrado" />
                  </SelectTrigger>
                  <SelectContent>
                    {vehicles.map((vehicle) => (
                      <SelectItem key={vehicle.id} value={vehicle.id}>
                        {vehicle.plate} - {vehicle.brand} {vehicle.model}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {vehicles.length === 0 && !loading && (
                  <p className="text-xs text-amber-600">
                    Nenhum veículo ativo cadastrado. Cadastre veículos primeiro.
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Placa *</Label>
                <Input
                  value={formatPlate(value.vehiclePlate)}
                  onChange={(e) => onChange({ 
                    ...value, 
                    vehiclePlate: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') 
                  })}
                  placeholder="ABC-1234"
                  maxLength={8}
                />
              </div>

              <div className="space-y-2">
                <Label>RENAVAM *</Label>
                <Input
                  value={value.vehicleRenavam}
                  onChange={(e) => onChange({ 
                    ...value, 
                    vehicleRenavam: e.target.value.replace(/\D/g, '') 
                  })}
                  placeholder="00000000000"
                  maxLength={11}
                />
              </div>

              <div className="space-y-2">
                <Label>UF de Licenciamento *</Label>
                <Select
                  value={value.vehicleUf}
                  onValueChange={(uf) => onChange({ ...value, vehicleUf: uf })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'].map((uf) => (
                      <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Tara (kg)</Label>
                  <Input
                    value={value.vehicleTara}
                    onChange={(e) => onChange({ 
                      ...value, 
                      vehicleTara: e.target.value.replace(/\D/g, '') 
                    })}
                    placeholder="0"
                  />
                  <p className="text-xs text-muted-foreground">Peso próprio</p>
                </div>

                <div className="space-y-2">
                  <Label>Capacidade (kg)</Label>
                  <Input
                    value={value.vehicleCapacidade}
                    onChange={(e) => onChange({ 
                      ...value, 
                      vehicleCapacidade: e.target.value.replace(/\D/g, '') 
                    })}
                    placeholder="0"
                  />
                  <p className="text-xs text-muted-foreground">Capacidade máx.</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Motorista */}
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-4">
              <User className="h-5 w-5 text-primary" />
              <h4 className="font-medium">Dados do Motorista</h4>
            </div>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Selecionar Motorista Cadastrado</Label>
                <Select
                  value={value.driverId}
                  onValueChange={handleDriverSelect}
                  disabled={loading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Escolha um motorista" />
                  </SelectTrigger>
                  <SelectContent>
                    {drivers.map((driver) => (
                      <SelectItem key={driver.id} value={driver.id}>
                        {driver.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {drivers.length === 0 && !loading && (
                  <p className="text-xs text-amber-600">
                    Nenhum motorista ativo cadastrado. Cadastre motoristas primeiro.
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Nome Completo *</Label>
                <Input
                  value={value.driverName}
                  onChange={(e) => onChange({ ...value, driverName: e.target.value })}
                  placeholder="Nome do motorista"
                />
              </div>

              <div className="space-y-2">
                <Label>CPF *</Label>
                <Input
                  value={formatCpf(value.driverCpf)}
                  onChange={(e) => onChange({ 
                    ...value, 
                    driverCpf: e.target.value.replace(/\D/g, '') 
                  })}
                  placeholder="000.000.000-00"
                  maxLength={14}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* RNTRC */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center gap-2 mb-4">
            <Truck className="h-5 w-5 text-primary" />
            <h4 className="font-medium">RNTRC - Registro Nacional de Transportadores Rodoviários de Cargas</h4>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Número do RNTRC *</Label>
              <Input
                value={value.vehicleRntrc}
                onChange={(e) => onChange({ 
                  ...value, 
                  vehicleRntrc: e.target.value.replace(/\D/g, '') 
                })}
                placeholder="00000000"
                maxLength={14}
              />
              <p className="text-xs text-muted-foreground">
                Registro obrigatório na ANTT para transporte rodoviário de cargas
              </p>
            </div>

            <div className="flex items-center">
              {value.vehicleRntrc && isValidRntrc(value.vehicleRntrc) ? (
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle2 className="h-5 w-5" />
                  <span className="text-sm">Formato válido</span>
                </div>
              ) : value.vehicleRntrc ? (
                <div className="flex items-center gap-2 text-amber-600">
                  <AlertCircle className="h-5 w-5" />
                  <span className="text-sm">RNTRC deve ter no mínimo 8 dígitos</span>
                </div>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>

      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          <strong>Importante:</strong> Os dados do veículo e motorista são obrigatórios para emissão 
          do CT-e e são validados pela SEFAZ. O RNTRC é exigido para transportadoras que realizam 
          transporte rodoviário de cargas.
        </AlertDescription>
      </Alert>
    </div>
  );
}

export const emptyVehicleDriver: VehicleDriverData = {
  vehicleId: '',
  vehiclePlate: '',
  vehicleRenavam: '',
  vehicleUf: '',
  vehicleRntrc: '',
  vehicleTara: '',
  vehicleCapacidade: '',
  driverId: '',
  driverName: '',
  driverCpf: ''
};
