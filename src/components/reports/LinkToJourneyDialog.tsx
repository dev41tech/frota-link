import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Link2, Loader2, MapPin, Calendar } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useMultiTenant } from "@/hooks/useMultiTenant";
import type { UnlinkedExpense } from "@/hooks/useVehicleProfitability";

interface Journey {
  id: string;
  journey_number: string;
  origin: string;
  destination: string;
  start_date: string | null;
  status: string | null;
}

interface LinkToJourneyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expense: UnlinkedExpense;
  onSuccess: () => void;
}

export function LinkToJourneyDialog({
  open,
  onOpenChange,
  expense,
  onSuccess,
}: LinkToJourneyDialogProps) {
  const { toast } = useToast();
  const { currentCompany } = useMultiTenant();
  const [journeys, setJourneys] = useState<Journey[]>([]);
  const [selectedJourneyId, setSelectedJourneyId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && expense) {
      fetchJourneys();
    }
  }, [open, expense]);

  const fetchJourneys = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('journeys')
        .select('id, journey_number, origin, destination, start_date, status')
        .eq('company_id', currentCompany?.id)
        .eq('vehicle_id', expense.vehicleId)
        .is('deleted_at', null)
        .order('start_date', { ascending: false })
        .limit(50);

      if (error) throw error;
      setJourneys(data || []);
    } catch (err: any) {
      toast({
        title: "Erro ao carregar jornadas",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleLink = async () => {
    if (!selectedJourneyId) {
      toast({
        title: "Selecione uma jornada",
        description: "É necessário selecionar uma jornada para vincular.",
        variant: "destructive",
      });
      return;
    }

    try {
      setSaving(true);
      const table = expense.type === 'fuel' ? 'fuel_expenses' : 'expenses';

      const { error } = await supabase
        .from(table)
        .update({ journey_id: selectedJourneyId })
        .eq('id', expense.id);

      if (error) throw error;

      const selectedJourney = journeys.find(j => j.id === selectedJourneyId);
      toast({
        title: "Despesa vinculada",
        description: `Vinculada à jornada ${selectedJourney?.journey_number || ''}.`,
      });
      
      setSelectedJourneyId("");
      onSuccess();
    } catch (err: any) {
      toast({
        title: "Erro ao vincular",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const getStatusBadgeClass = (status: string | null) => {
    switch (status) {
      case 'completed':
        return 'text-emerald-600';
      case 'in_progress':
        return 'text-blue-600';
      case 'planned':
        return 'text-amber-600';
      default:
        return 'text-muted-foreground';
    }
  };

  const getStatusLabel = (status: string | null) => {
    switch (status) {
      case 'completed':
        return 'Finalizada';
      case 'in_progress':
        return 'Em andamento';
      case 'planned':
        return 'Planejada';
      default:
        return status || 'Desconhecido';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            Vincular Despesa a Jornada
          </DialogTitle>
          <DialogDescription>
            Selecione uma jornada do veículo <strong>{expense.vehiclePlate}</strong> para vincular esta despesa.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Expense info */}
          <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Descrição:</span>
              <span className="font-medium">{expense.description}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Valor:</span>
              <span className="font-medium">R$ {expense.amount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Data:</span>
              <span className="font-medium">{format(new Date(expense.date), "dd/MM/yyyy", { locale: ptBR })}</span>
            </div>
          </div>

          {/* Journey selector */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Jornada</label>
            {loading ? (
              <div className="flex items-center justify-center h-10">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : journeys.length === 0 ? (
              <div className="text-sm text-muted-foreground text-center py-4 border rounded-md">
                Nenhuma jornada encontrada para este veículo.
              </div>
            ) : (
              <Select value={selectedJourneyId} onValueChange={setSelectedJourneyId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma jornada..." />
                </SelectTrigger>
                <SelectContent>
                  {journeys.map((journey) => (
                    <SelectItem key={journey.id} value={journey.id}>
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{journey.journey_number}</span>
                          <span className={`text-xs ${getStatusBadgeClass(journey.status)}`}>
                            ({getStatusLabel(journey.status)})
                          </span>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <MapPin className="h-3 w-3" />
                          {journey.origin} → {journey.destination}
                          {journey.start_date && (
                            <>
                              <Calendar className="h-3 w-3 ml-2" />
                              {format(new Date(journey.start_date), "dd/MM/yy", { locale: ptBR })}
                            </>
                          )}
                        </div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button 
            onClick={handleLink} 
            disabled={!selectedJourneyId || saving}
          >
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Vincular
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
