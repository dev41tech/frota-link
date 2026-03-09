import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useMultiTenant } from "@/hooks/useMultiTenant";
import { toast } from "sonner";
import { 
  Settings2, 
  Plus, 
  Edit2, 
  Trash2, 
  Calendar, 
  Gauge, 
  Bell,
  Loader2,
  AlertTriangle
} from "lucide-react";

interface MaintenanceSchedule {
  id: string;
  vehicle_id: string | null;
  service_category: string;
  service_name: string;
  interval_months: number | null;
  interval_km: number | null;
  alert_days_before: number;
  alert_km_before: number;
  is_active: boolean;
}

interface Vehicle {
  id: string;
  plate: string;
  model: string;
}

const SERVICE_CATEGORIES = [
  { value: "oil_change", label: "Troca de Óleo", defaultMonths: 6, defaultKm: 10000 },
  { value: "general_revision", label: "Revisão Geral", defaultMonths: 12, defaultKm: 20000 },
  { value: "tires", label: "Pneus", defaultMonths: null, defaultKm: 40000 },
  { value: "brakes", label: "Freios", defaultMonths: null, defaultKm: 30000 },
  { value: "filters", label: "Filtros (Ar/Combustível)", defaultMonths: 12, defaultKm: 15000 },
  { value: "cooling", label: "Arrefecimento", defaultMonths: 24, defaultKm: 40000 },
  { value: "transmission", label: "Câmbio/Transmissão", defaultMonths: 24, defaultKm: 60000 },
  { value: "suspension", label: "Suspensão", defaultMonths: null, defaultKm: 50000 },
  { value: "electrical", label: "Parte Elétrica", defaultMonths: null, defaultKm: null },
];

interface MaintenanceScheduleConfigProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MaintenanceScheduleConfig({ open, onOpenChange }: MaintenanceScheduleConfigProps) {
  const { user } = useAuth();
  const { currentCompany } = useMultiTenant();
  const [schedules, setSchedules] = useState<MaintenanceSchedule[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<Partial<MaintenanceSchedule> | null>(null);

  useEffect(() => {
    if (open && currentCompany?.id) {
      fetchData();
    }
  }, [open, currentCompany?.id]);

  const fetchData = async () => {
    if (!currentCompany?.id) return;

    setLoading(true);
    try {
      const [schedulesRes, vehiclesRes] = await Promise.all([
        supabase
          .from("maintenance_schedules")
          .select("*")
          .eq("company_id", currentCompany.id)
          .order("service_category"),
        supabase
          .from("vehicles")
          .select("id, plate, model")
          .eq("company_id", currentCompany.id)
          .eq("status", "active")
          .order("plate"),
      ]);

      if (schedulesRes.error) throw schedulesRes.error;
      if (vehiclesRes.error) throw vehiclesRes.error;

      setSchedules(schedulesRes.data || []);
      setVehicles(vehiclesRes.data || []);
    } catch (error) {
      console.error("Error fetching schedules:", error);
      toast.error("Erro ao carregar configurações");
    } finally {
      setLoading(false);
    }
  };

  const handleAddSchedule = () => {
    setEditingSchedule({
      vehicle_id: null,
      service_category: "",
      service_name: "",
      interval_months: null,
      interval_km: null,
      alert_days_before: 7,
      alert_km_before: 500,
      is_active: true,
    });
    setEditDialogOpen(true);
  };

  const handleEditSchedule = (schedule: MaintenanceSchedule) => {
    setEditingSchedule({ ...schedule });
    setEditDialogOpen(true);
  };

  const handleDeleteSchedule = async (id: string) => {
    try {
      const { error } = await supabase
        .from("maintenance_schedules")
        .delete()
        .eq("id", id);

      if (error) throw error;

      setSchedules(schedules.filter((s) => s.id !== id));
      toast.success("Configuração removida");
    } catch (error: any) {
      console.error("Error deleting schedule:", error);
      toast.error(error.message || "Erro ao remover configuração");
    }
  };

  const handleSaveSchedule = async () => {
    if (!user || !currentCompany?.id || !editingSchedule?.service_category) {
      toast.error("Preencha os campos obrigatórios");
      return;
    }

    if (!editingSchedule.interval_months && !editingSchedule.interval_km) {
      toast.error("Informe pelo menos um intervalo (meses ou km)");
      return;
    }

    setSaving(true);
    try {
      const category = SERVICE_CATEGORIES.find(c => c.value === editingSchedule.service_category);
      
      const payload = {
        company_id: currentCompany.id,
        user_id: user.id,
        vehicle_id: editingSchedule.vehicle_id || null,
        service_category: editingSchedule.service_category,
        service_name: editingSchedule.service_name || category?.label || editingSchedule.service_category,
        interval_months: editingSchedule.interval_months || null,
        interval_km: editingSchedule.interval_km || null,
        alert_days_before: editingSchedule.alert_days_before || 7,
        alert_km_before: editingSchedule.alert_km_before || 500,
        is_active: editingSchedule.is_active ?? true,
      };

      if (editingSchedule.id) {
        const { data, error } = await supabase
          .from("maintenance_schedules")
          .update(payload)
          .eq("id", editingSchedule.id)
          .select()
          .single();

        if (error) throw error;

        setSchedules(schedules.map((s) => (s.id === data.id ? data : s)));
        toast.success("Configuração atualizada");
      } else {
        const { data, error } = await supabase
          .from("maintenance_schedules")
          .insert(payload)
          .select()
          .single();

        if (error) throw error;

        setSchedules([...schedules, data]);
        toast.success("Configuração criada");
      }

      setEditDialogOpen(false);
      setEditingSchedule(null);
    } catch (error: any) {
      console.error("Error saving schedule:", error);
      toast.error(error.message || "Erro ao salvar configuração");
    } finally {
      setSaving(false);
    }
  };

  const handleCategoryChange = (category: string) => {
    const cat = SERVICE_CATEGORIES.find((c) => c.value === category);
    setEditingSchedule({
      ...editingSchedule,
      service_category: category,
      service_name: cat?.label || category,
      interval_months: cat?.defaultMonths || null,
      interval_km: cat?.defaultKm || null,
    });
  };

  const getCategoryLabel = (category: string) => {
    return SERVICE_CATEGORIES.find((c) => c.value === category)?.label || category;
  };

  const getVehicleLabel = (vehicleId: string | null) => {
    if (!vehicleId) return "Todos os veículos";
    const vehicle = vehicles.find((v) => v.id === vehicleId);
    return vehicle ? `${vehicle.plate} - ${vehicle.model}` : vehicleId;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            Configurar Intervalos de Manutenção
          </DialogTitle>
          <DialogDescription>
            Configure os intervalos padrão para alertas de manutenção preventiva
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="space-y-4">
              {/* Info Card */}
              <Card className="bg-muted/50">
                <CardContent className="p-4">
                  <div className="flex gap-3">
                    <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                    <div className="text-sm">
                      <p className="font-medium">Como funcionam os alertas</p>
                      <p className="text-muted-foreground mt-1">
                        O sistema irá gerar alertas quando uma manutenção preventiva estiver próxima do vencimento,
                        baseado na data e/ou quilometragem definida. Você pode configurar intervalos padrão para
                        todos os veículos ou específicos por veículo.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Schedules Table */}
              {schedules.length > 0 ? (
                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead>Serviço</TableHead>
                        <TableHead>Veículo</TableHead>
                        <TableHead className="text-center">Intervalo</TableHead>
                        <TableHead className="text-center">Alertar</TableHead>
                        <TableHead className="text-center">Status</TableHead>
                        <TableHead className="w-[80px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {schedules.map((schedule) => (
                        <TableRow key={schedule.id}>
                          <TableCell>
                            <p className="font-medium">{schedule.service_name}</p>
                            <p className="text-xs text-muted-foreground">
                              {getCategoryLabel(schedule.service_category)}
                            </p>
                          </TableCell>
                          <TableCell>
                            <Badge variant={schedule.vehicle_id ? "outline" : "secondary"}>
                              {getVehicleLabel(schedule.vehicle_id)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex flex-col items-center gap-1">
                              {schedule.interval_months && (
                                <div className="flex items-center gap-1 text-sm">
                                  <Calendar className="h-3 w-3" />
                                  {schedule.interval_months} meses
                                </div>
                              )}
                              {schedule.interval_km && (
                                <div className="flex items-center gap-1 text-sm">
                                  <Gauge className="h-3 w-3" />
                                  {schedule.interval_km.toLocaleString()} km
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex flex-col items-center gap-1 text-xs text-muted-foreground">
                              {schedule.alert_days_before > 0 && (
                                <span>{schedule.alert_days_before} dias antes</span>
                              )}
                              {schedule.alert_km_before > 0 && (
                                <span>{schedule.alert_km_before} km antes</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant={schedule.is_active ? "default" : "secondary"}>
                              {schedule.is_active ? "Ativo" : "Inativo"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7"
                                onClick={() => handleEditSchedule(schedule)}
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 text-destructive"
                                onClick={() => handleDeleteSchedule(schedule.id)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-12 border rounded-lg">
                  <Bell className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                  <p className="text-muted-foreground">Nenhuma configuração de alerta</p>
                  <p className="text-sm text-muted-foreground">
                    Clique em "Adicionar" para configurar intervalos de manutenção
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-between pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          <Button onClick={handleAddSchedule}>
            <Plus className="h-4 w-4 mr-2" />
            Adicionar Intervalo
          </Button>
        </div>

        {/* Edit Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingSchedule?.id ? "Editar Intervalo" : "Novo Intervalo"}
              </DialogTitle>
            </DialogHeader>

            {editingSchedule && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Tipo de Serviço *</Label>
                  <Select
                    value={editingSchedule.service_category}
                    onValueChange={handleCategoryChange}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o serviço" />
                    </SelectTrigger>
                    <SelectContent>
                      {SERVICE_CATEGORIES.map((cat) => (
                        <SelectItem key={cat.value} value={cat.value}>
                          {cat.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Veículo</Label>
                  <Select
                    value={editingSchedule.vehicle_id || "all"}
                    onValueChange={(v) =>
                      setEditingSchedule({
                        ...editingSchedule,
                        vehicle_id: v === "all" ? null : v,
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os veículos (padrão)</SelectItem>
                      {vehicles.map((v) => (
                        <SelectItem key={v.id} value={v.id}>
                          {v.plate} - {v.model}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="interval-months" className="flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" />
                      Intervalo (meses)
                    </Label>
                    <Input
                      id="interval-months"
                      type="number"
                      min="0"
                      value={editingSchedule.interval_months || ""}
                      onChange={(e) =>
                        setEditingSchedule({
                          ...editingSchedule,
                          interval_months: parseInt(e.target.value) || null,
                        })
                      }
                      placeholder="6"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="interval-km" className="flex items-center gap-1">
                      <Gauge className="h-3.5 w-3.5" />
                      Intervalo (km)
                    </Label>
                    <Input
                      id="interval-km"
                      type="number"
                      min="0"
                      step="1000"
                      value={editingSchedule.interval_km || ""}
                      onChange={(e) =>
                        setEditingSchedule({
                          ...editingSchedule,
                          interval_km: parseInt(e.target.value) || null,
                        })
                      }
                      placeholder="10000"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="alert-days">Alertar (dias antes)</Label>
                    <Input
                      id="alert-days"
                      type="number"
                      min="0"
                      value={editingSchedule.alert_days_before || ""}
                      onChange={(e) =>
                        setEditingSchedule({
                          ...editingSchedule,
                          alert_days_before: parseInt(e.target.value) || 0,
                        })
                      }
                      placeholder="7"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="alert-km">Alertar (km antes)</Label>
                    <Input
                      id="alert-km"
                      type="number"
                      min="0"
                      value={editingSchedule.alert_km_before || ""}
                      onChange={(e) =>
                        setEditingSchedule({
                          ...editingSchedule,
                          alert_km_before: parseInt(e.target.value) || 0,
                        })
                      }
                      placeholder="500"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <Label htmlFor="is-active" className="cursor-pointer">
                    Alerta ativo
                  </Label>
                  <Switch
                    id="is-active"
                    checked={editingSchedule.is_active ?? true}
                    onCheckedChange={(checked) =>
                      setEditingSchedule({ ...editingSchedule, is_active: checked })
                    }
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleSaveSchedule}
                    disabled={saving || !editingSchedule.service_category}
                  >
                    {saving ? "Salvando..." : "Salvar"}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}
