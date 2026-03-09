import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PartySelector } from "@/components/parties/PartySelector";
import { Plus, Trash2, Route, ArrowDown } from "lucide-react";

export interface LegData {
  id?: string;
  leg_number: number;
  origin: string;
  destination: string;
  customer_id?: string;
  freight_value?: string;
  freight_status?: string;
  freight_due_date?: string;
  freight_received_date?: string;
  distance?: string;
  status?: string;
}

interface JourneyLegsEditorProps {
  legs: LegData[];
  onLegsChange: (legs: LegData[]) => void;
  isDriverMode?: boolean;
}

export function JourneyLegsEditor({ legs, onLegsChange, isDriverMode = false }: JourneyLegsEditorProps) {
  const addLeg = () => {
    const lastLeg = legs[legs.length - 1];
    const newLeg: LegData = {
      leg_number: legs.length + 1,
      origin: lastLeg?.destination || '',
      destination: '',
      freight_status: 'pending',
    };
    onLegsChange([...legs, newLeg]);
  };

  const removeLeg = (index: number) => {
    if (legs.length <= 1) return;
    const updated = legs.filter((_, i) => i !== index).map((leg, i) => ({
      ...leg,
      leg_number: i + 1,
    }));
    onLegsChange(updated);
  };

  const updateLeg = (index: number, field: keyof LegData, value: string) => {
    const updated = [...legs];
    updated[index] = { ...updated[index], [field]: value };
    
    // Auto-fill next leg's origin when destination changes
    if (field === 'destination' && index < legs.length - 1) {
      updated[index + 1] = { ...updated[index + 1], origin: value };
    }
    
    onLegsChange(updated);
  };

  if (legs.length <= 1 && isDriverMode) {
    // Show simple add button for driver mode when only 1 leg
    return (
      <Button
        type="button"
        variant="outline"
        className="w-full border-dashed border-2 text-muted-foreground hover:text-foreground"
        onClick={addLeg}
      >
        <Plus className="h-4 w-4 mr-2" />
        Adicionar Retorno / Trecho
      </Button>
    );
  }

  if (legs.length <= 1 && !isDriverMode) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="border-dashed"
        onClick={addLeg}
      >
        <Plus className="h-4 w-4 mr-2" />
        Adicionar Trecho (Retorno)
      </Button>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <Route className="h-4 w-4" />
        Trechos da Jornada
      </div>
      
      {legs.map((leg, index) => (
        <div key={index} className="border rounded-lg p-3 space-y-3 bg-muted/20 relative">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase">
              Trecho {leg.leg_number} {index === 0 ? '(Ida)' : index === 1 ? '(Retorno)' : ''}
            </span>
            {legs.length > 1 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                onClick={() => removeLeg(index)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>

          {isDriverMode ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Origem</Label>
                <Input
                  placeholder="De onde?"
                  value={leg.origin}
                  onChange={(e) => updateLeg(index, 'origin', e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Destino</Label>
                <Input
                  placeholder="Para onde?"
                  value={leg.destination}
                  onChange={(e) => updateLeg(index, 'destination', e.target.value)}
                  required
                />
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Origem</Label>
                  <Input
                    value={leg.origin}
                    onChange={(e) => updateLeg(index, 'origin', e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Destino</Label>
                  <Input
                    value={leg.destination}
                    onChange={(e) => updateLeg(index, 'destination', e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Cliente</Label>
                <PartySelector
                  type="customer"
                  value={leg.customer_id || undefined}
                  onChange={(id) => updateLeg(index, 'customer_id', id || '')}
                  placeholder="Cliente deste trecho (opcional)"
                  allowCreate
                  onCreateNew={() => window.open('/parties?tab=customer', '_blank')}
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Frete (R$)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0,00"
                    value={leg.freight_value || ''}
                    onChange={(e) => updateLeg(index, 'freight_value', e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Status</Label>
                  <Select
                    value={leg.freight_status || 'pending'}
                    onValueChange={(v) => updateLeg(index, 'freight_status', v)}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pendente</SelectItem>
                      <SelectItem value="received">Recebido</SelectItem>
                      <SelectItem value="invoiced">Faturado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  {leg.freight_status === 'received' ? (
                    <>
                      <Label className="text-xs">Dt. Recebimento</Label>
                      <Input
                        type="date"
                        className="h-9"
                        value={leg.freight_received_date || ''}
                        onChange={(e) => updateLeg(index, 'freight_received_date', e.target.value)}
                      />
                    </>
                  ) : (
                    <>
                      <Label className="text-xs">Dt. Vencimento</Label>
                      <Input
                        type="date"
                        className="h-9"
                        value={leg.freight_due_date || ''}
                        onChange={(e) => updateLeg(index, 'freight_due_date', e.target.value)}
                      />
                    </>
                  )}
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Distância (km)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={leg.distance || ''}
                  onChange={(e) => updateLeg(index, 'distance', e.target.value)}
                  className="w-32"
                />
              </div>
            </>
          )}

          {index < legs.length - 1 && (
            <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-background rounded-full p-0.5 z-10">
              <ArrowDown className="h-4 w-4 text-muted-foreground" />
            </div>
          )}
        </div>
      ))}

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full border-dashed"
        onClick={addLeg}
      >
        <Plus className="h-4 w-4 mr-2" />
        Adicionar Trecho
      </Button>
    </div>
  );
}

/** Build route string from legs: "A → B → C" */
export function buildRouteString(legs: Array<{ origin: string; destination: string }>): string {
  if (!legs.length) return '';
  const parts = [legs[0].origin];
  legs.forEach(leg => parts.push(leg.destination));
  return parts.join(' → ');
}
