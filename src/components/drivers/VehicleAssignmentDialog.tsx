import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { Truck, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface Vehicle {
  id: string;
  plate: string;
  model: string;
  brand: string;
}

interface VehicleAssignment {
  vehicle_id: string;
  status: string;
}

interface VehicleAssignmentDialogProps {
  driverId: string;
  driverName: string;
  companyId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function VehicleAssignmentDialog({
  driverId,
  driverName,
  companyId,
  open,
  onOpenChange
}: VehicleAssignmentDialogProps) {
  const { toast } = useToast();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [assignments, setAssignments] = useState<VehicleAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      fetchData();
    }
  }, [open, driverId]);

  const fetchData = async () => {
    try {
      // Buscar veículos ativos da empresa
      const { data: vehiclesData, error: vehiclesError } = await supabase
        .from('vehicles')
        .select('id, plate, model, brand')
        .eq('company_id', companyId)
        .eq('status', 'active')
        .order('plate');

      if (vehiclesError) throw vehiclesError;

      // Buscar vínculos existentes
      const { data: assignmentsData, error: assignmentsError } = await supabase
        .from('driver_vehicles')
        .select('vehicle_id, status')
        .eq('driver_id', driverId);

      if (assignmentsError) throw assignmentsError;

      setVehicles(vehiclesData || []);
      setAssignments(assignmentsData || []);
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const isVehicleAssigned = (vehicleId: string) => {
    return assignments.some(a => a.vehicle_id === vehicleId && a.status === 'active');
  };

  const toggleVehicle = async (vehicleId: string, currentlyAssigned: boolean) => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (currentlyAssigned) {
        // Desativar vínculo
        const { error } = await supabase
          .from('driver_vehicles')
          .update({ status: 'inactive' })
          .eq('driver_id', driverId)
          .eq('vehicle_id', vehicleId);

        if (error) throw error;
      } else {
        // Verificar se já existe um vínculo inativo
        const { data: existing } = await supabase
          .from('driver_vehicles')
          .select('id')
          .eq('driver_id', driverId)
          .eq('vehicle_id', vehicleId)
          .single();

        if (existing) {
          // Reativar vínculo
          const { error } = await supabase
            .from('driver_vehicles')
            .update({ status: 'active' })
            .eq('id', existing.id);

          if (error) throw error;
        } else {
          // Criar novo vínculo
          const { error } = await supabase
            .from('driver_vehicles')
            .insert([{
              driver_id: driverId,
              vehicle_id: vehicleId,
              assigned_by: user?.id,
              status: 'active',
              company_id: companyId
            }]);

          if (error) throw error;
        }
      }

      await fetchData();
      toast({
        title: 'Sucesso',
        description: currentlyAssigned
          ? 'Veículo removido do motorista'
          : 'Veículo vinculado ao motorista'
      });
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Veículos de {driverName}</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : vehicles.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            Nenhum veículo disponível
          </p>
        ) : (
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {vehicles.map((vehicle) => {
              const assigned = isVehicleAssigned(vehicle.id);
              return (
                <div
                  key={vehicle.id}
                  className="flex items-center gap-3 p-3 rounded-lg border hover:bg-accent/50 transition-colors"
                >
                  <Checkbox
                    checked={assigned}
                    onCheckedChange={() => toggleVehicle(vehicle.id, assigned)}
                    disabled={saving}
                  />
                  <Truck className="h-5 w-5 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="font-medium">{vehicle.plate}</p>
                    <p className="text-sm text-muted-foreground">
                      {vehicle.brand} {vehicle.model}
                    </p>
                  </div>
                  {assigned && (
                    <Badge variant="default">Ativo</Badge>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="flex justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
