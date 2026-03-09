import { useState } from "react";
import { useFreightRates, type FreightRate, type FreightRateFormData } from "@/hooks/useFreightRates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DeleteConfirmationDialog } from "@/components/ui/delete-confirmation-dialog";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Search, MoreVertical, Pencil, Trash2, CheckCircle, XCircle, DollarSign, Sparkles } from "lucide-react";
import { SmartFreightTableDialog } from "@/components/freight/SmartFreightTableDialog";
import { PricingSettingsCard } from "@/components/freight/PricingSettingsCard";

const BRAZILIAN_STATES = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA",
  "PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
];

export default function FreightRates() {
  const { rates, loading, createRate, updateRate, deleteRate, toggleActive } = useFreightRates();
  const [searchTerm, setSearchTerm] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingRate, setEditingRate] = useState<FreightRate | null>(null);
  const [deletingRate, setDeletingRate] = useState<FreightRate | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSmartDialog, setShowSmartDialog] = useState(false);

  // Form state
  const [formData, setFormData] = useState<FreightRateFormData>({
    origin_state: null, destination_state: null,
    origin_city: null, destination_city: null,
    min_weight_kg: 0, max_weight_kg: 999999,
    rate_per_kg: 0, minimum_freight: 0,
    cubage_factor: 300, volume_rate: null,
  });

  const filteredRates = rates.filter(r => {
    if (!searchTerm) return true;
    const s = searchTerm.toLowerCase();
    return (r.origin_state?.toLowerCase().includes(s) ||
      r.destination_state?.toLowerCase().includes(s) ||
      r.origin_city?.toLowerCase().includes(s) ||
      r.destination_city?.toLowerCase().includes(s));
  });

  const handleNewRate = () => {
    setEditingRate(null);
    setFormData({
      origin_state: null, destination_state: null,
      origin_city: null, destination_city: null,
      min_weight_kg: 0, max_weight_kg: 999999,
      rate_per_kg: 0, minimum_freight: 0,
      cubage_factor: 300, volume_rate: null,
    });
    setShowForm(true);
  };

  const handleEdit = (rate: FreightRate) => {
    setEditingRate(rate);
    setFormData({
      origin_state: rate.origin_state,
      destination_state: rate.destination_state,
      origin_city: rate.origin_city,
      destination_city: rate.destination_city,
      min_weight_kg: rate.min_weight_kg,
      max_weight_kg: rate.max_weight_kg,
      rate_per_kg: rate.rate_per_kg,
      minimum_freight: rate.minimum_freight,
      cubage_factor: rate.cubage_factor,
      volume_rate: rate.volume_rate,
    });
    setShowForm(true);
  };

  const handleSubmit = async () => {
    if (formData.rate_per_kg <= 0 && formData.minimum_freight <= 0) {
      return;
    }
    setIsSubmitting(true);
    try {
      if (editingRate) {
        await updateRate(editingRate.id, formData);
      } else {
        await createRate(formData);
      }
      setShowForm(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingRate) return;
    await deleteRate(deletingRate.id);
    setDeletingRate(null);
  };

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  const formatWeight = (v: number) =>
    v >= 999999 ? "Sem limite" : `${new Intl.NumberFormat("pt-BR").format(v)} kg`;

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tabela de Frete</h1>
          <p className="text-muted-foreground">Gerencie as regras de precificação por rota e faixa de peso</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowSmartDialog(true)}>
            <Sparkles className="mr-2 h-4 w-4" />
            Gerar Tabela Inteligente
          </Button>
          <Button onClick={handleNewRate}>
            <Plus className="mr-2 h-4 w-4" />
            Nova Regra
          </Button>
        </div>
      </div>

      <PricingSettingsCard />

      <div className="relative w-full sm:w-72">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por UF ou cidade..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {loading ? (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </CardContent>
        </Card>
      ) : filteredRates.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <DollarSign className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">Nenhuma regra de frete cadastrada</p>
            <p className="text-sm text-muted-foreground mt-1">Crie regras para calcular automaticamente o valor do frete no portal do cliente</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Origem</TableHead>
                  <TableHead>Destino</TableHead>
                  <TableHead>Faixa de Peso</TableHead>
                  <TableHead>Valor/kg</TableHead>
                  <TableHead>Frete Mínimo</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="w-[60px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRates.map((rate) => (
                  <TableRow key={rate.id}>
                    <TableCell>
                      <div className="font-medium">{rate.origin_state || "Qualquer UF"}</div>
                      {rate.origin_city && <div className="text-sm text-muted-foreground">{rate.origin_city}</div>}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{rate.destination_state || "Qualquer UF"}</div>
                      {rate.destination_city && <div className="text-sm text-muted-foreground">{rate.destination_city}</div>}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatWeight(rate.min_weight_kg)} — {formatWeight(rate.max_weight_kg)}
                    </TableCell>
                    <TableCell className="font-medium">{formatCurrency(rate.rate_per_kg)}</TableCell>
                    <TableCell className="font-medium">{formatCurrency(rate.minimum_freight)}</TableCell>
                    <TableCell className="text-center">
                      {rate.is_active ? (
                        <Badge variant="default" className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
                          <CheckCircle className="h-3 w-3 mr-1" /> Ativa
                        </Badge>
                      ) : (
                        <Badge variant="secondary">
                          <XCircle className="h-3 w-3 mr-1" /> Inativa
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEdit(rate)}>
                            <Pencil className="h-4 w-4 mr-2" /> Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => toggleActive(rate.id, !rate.is_active)}>
                            {rate.is_active ? (
                              <><XCircle className="h-4 w-4 mr-2" /> Desativar</>
                            ) : (
                              <><CheckCircle className="h-4 w-4 mr-2" /> Ativar</>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setDeletingRate(rate)} className="text-destructive focus:text-destructive">
                            <Trash2 className="h-4 w-4 mr-2" /> Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Form Dialog */}
      <Dialog open={showForm} onOpenChange={() => setShowForm(false)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingRate ? "Editar Regra de Frete" : "Nova Regra de Frete"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>UF Origem</Label>
                <Select
                  value={formData.origin_state || "any"}
                  onValueChange={(v) => setFormData({ ...formData, origin_state: v === "any" ? null : v })}
                >
                  <SelectTrigger><SelectValue placeholder="Qualquer" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Qualquer UF</SelectItem>
                    {BRAZILIAN_STATES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>UF Destino</Label>
                <Select
                  value={formData.destination_state || "any"}
                  onValueChange={(v) => setFormData({ ...formData, destination_state: v === "any" ? null : v })}
                >
                  <SelectTrigger><SelectValue placeholder="Qualquer" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Qualquer UF</SelectItem>
                    {BRAZILIAN_STATES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Cidade Origem (opcional)</Label>
                <Input
                  value={formData.origin_city || ""}
                  onChange={(e) => setFormData({ ...formData, origin_city: e.target.value || null })}
                  placeholder="Qualquer cidade"
                />
              </div>
              <div className="space-y-2">
                <Label>Cidade Destino (opcional)</Label>
                <Input
                  value={formData.destination_city || ""}
                  onChange={(e) => setFormData({ ...formData, destination_city: e.target.value || null })}
                  placeholder="Qualquer cidade"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Peso Mínimo (kg)</Label>
                <Input
                  type="number"
                  min={0}
                  value={formData.min_weight_kg}
                  onChange={(e) => setFormData({ ...formData, min_weight_kg: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label>Peso Máximo (kg)</Label>
                <Input
                  type="number"
                  min={0}
                  value={formData.max_weight_kg}
                  onChange={(e) => setFormData({ ...formData, max_weight_kg: Number(e.target.value) })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Valor por kg (R$)</Label>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  value={formData.rate_per_kg}
                  onChange={(e) => setFormData({ ...formData, rate_per_kg: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label>Frete Mínimo (R$)</Label>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  value={formData.minimum_freight}
                  onChange={(e) => setFormData({ ...formData, minimum_freight: Number(e.target.value) })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Fator de Cubagem (kg/m³)</Label>
                <Input
                  type="number"
                  min={0}
                  value={formData.cubage_factor ?? 300}
                  onChange={(e) => setFormData({ ...formData, cubage_factor: Number(e.target.value) })}
                />
                <p className="text-xs text-muted-foreground">Padrão: 300 kg/m³</p>
              </div>
              <div className="space-y-2">
                <Label>Valor por m³ cubado (R$)</Label>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  value={formData.volume_rate ?? ""}
                  onChange={(e) => setFormData({ ...formData, volume_rate: e.target.value ? Number(e.target.value) : null })}
                  placeholder="Opcional"
                />
                <p className="text-xs text-muted-foreground">Preparado para uso futuro</p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? "Salvando..." : editingRate ? "Salvar" : "Criar Regra"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DeleteConfirmationDialog
        open={!!deletingRate}
        onOpenChange={() => setDeletingRate(null)}
        onConfirm={handleDelete}
        title="Excluir Regra de Frete"
        description={`Tem certeza que deseja excluir a regra ${deletingRate?.origin_state || 'Qualquer'} → ${deletingRate?.destination_state || 'Qualquer'}? Esta ação não pode ser desfeita.`}
      />
      <SmartFreightTableDialog open={showSmartDialog} onOpenChange={setShowSmartDialog} />
    </div>
  );
}
