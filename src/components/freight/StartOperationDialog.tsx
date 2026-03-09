import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, CheckCircle, Loader2, Truck, User, Package } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { FreightRequest } from '@/hooks/useFreightRequests';

interface Vehicle {
  id: string;
  plate: string;
  model: string | null;
  vehicle_type: string | null;
  load_capacity: number | null;
}

interface Driver {
  id: string;
  name: string;
  status: string | null;
}

interface StartOperationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  request: FreightRequest | null;
  companyId: string;
  onConfirm: (vehicleId: string, driverId: string) => Promise<boolean>;
}

export function StartOperationDialog({ open, onOpenChange, request, companyId, onConfirm }: StartOperationDialogProps) {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState('');
  const [selectedDriver, setSelectedDriver] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open || !companyId) return;
    setSelectedVehicle('');
    setSelectedDriver('');

    const fetchData = async () => {
      const [vRes, dRes] = await Promise.all([
        supabase.from('vehicles').select('id, plate, model, vehicle_type, load_capacity').eq('company_id', companyId).order('plate'),
        supabase.from('drivers').select('id, name, status').eq('company_id', companyId).eq('status', 'active').order('name'),
      ]);
      setVehicles(vRes.data || []);
      setDrivers(dRes.data || []);
    };
    fetchData();
  }, [open, companyId]);

  const selectedVehicleData = vehicles.find(v => v.id === selectedVehicle);
  const cargoWeight = request?.cargo_weight_kg ? Number(request.cargo_weight_kg) : 0;
  const loadCapacity = selectedVehicleData?.load_capacity ? Number(selectedVehicleData.load_capacity) : null;

  const isOverweight = loadCapacity !== null && cargoWeight > loadCapacity;
  const noCapacityInfo = selectedVehicle && loadCapacity === null;

  const canConfirm = selectedVehicle && selectedDriver && !isOverweight;

  const handleConfirm = async () => {
    if (!canConfirm) return;
    setSubmitting(true);
    const success = await onConfirm(selectedVehicle, selectedDriver);
    setSubmitting(false);
    if (success) onOpenChange(false);
  };

  if (!request) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Iniciar Operação - {request.request_number}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Request summary */}
          <div className="rounded-lg bg-muted/50 p-3 space-y-1 text-sm">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{request.party_name}</span>
            </div>
            <div className="text-muted-foreground">
              {request.origin_city}/{request.origin_state} → {request.destination_city}/{request.destination_state}
            </div>
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-muted-foreground" />
              <span>Peso: <strong>{cargoWeight.toLocaleString('pt-BR')} kg</strong></span>
            </div>
          </div>

          {/* Collection info */}
          {request.collection_address && (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/20 p-3 space-y-1 text-sm">
              <p className="font-medium text-emerald-700 dark:text-emerald-400 text-xs uppercase tracking-wide">Dados da Coleta</p>
              <p>{request.collection_address}</p>
              {request.collection_date && (
                <p className="text-muted-foreground">
                  Prevista: {new Date(request.collection_date).toLocaleString('pt-BR')}
                </p>
              )}
              {request.collection_notes && (
                <p className="text-muted-foreground italic">"{request.collection_notes}"</p>
              )}
            </div>
          )}

          {/* Vehicle select */}
          <div className="space-y-2">
            <Label>Veículo</Label>
            <Select value={selectedVehicle} onValueChange={setSelectedVehicle}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o veículo" />
              </SelectTrigger>
              <SelectContent>
                {vehicles.map(v => (
                  <SelectItem key={v.id} value={v.id}>
                    <span className="flex items-center gap-2">
                      <Truck className="h-3 w-3" />
                      {v.plate} - {v.model || 'Sem modelo'}
                      {v.load_capacity ? ` (${Number(v.load_capacity).toLocaleString('pt-BR')} kg)` : ''}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Weight validation alerts */}
          {isOverweight && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>ATENÇÃO:</strong> Peso da carga ({cargoWeight.toLocaleString('pt-BR')} kg) excede a capacidade do veículo ({loadCapacity!.toLocaleString('pt-BR')} kg). Risco de multa por excesso de peso.
              </AlertDescription>
            </Alert>
          )}

          {noCapacityInfo && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Capacidade de carga não cadastrada para este veículo. Verifique manualmente.
              </AlertDescription>
            </Alert>
          )}

          {selectedVehicle && !isOverweight && !noCapacityInfo && (
            <Alert className="border-emerald-500/50 bg-emerald-50 dark:bg-emerald-950/20">
              <CheckCircle className="h-4 w-4 text-emerald-600" />
              <AlertDescription className="text-emerald-700 dark:text-emerald-400">
                Peso dentro da capacidade do veículo.
              </AlertDescription>
            </Alert>
          )}

          {/* Driver select */}
          <div className="space-y-2">
            <Label>Motorista</Label>
            <Select value={selectedDriver} onValueChange={setSelectedDriver}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o motorista" />
              </SelectTrigger>
              <SelectContent>
                {drivers.map(d => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleConfirm} disabled={!canConfirm || submitting}>
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Confirmar e Criar Jornada
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
