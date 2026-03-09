import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trash2, Package, Plus, AlertCircle } from "lucide-react";
import { toast } from "sonner";

// Definição do tipo exportado para ser usado no formulário
export interface SelectedPart {
  item_id: string;
  name: string;
  quantity: number;
  unit_price: number;
  total: number;
}

interface StockItem {
  id: string;
  name: string;
  quantity: number;
  unit_price: number;
}

interface Props {
  companyId: string | undefined;
  onPartsChange: (parts: SelectedPart[], totalCost: number) => void;
  initialParts?: SelectedPart[];
}

export function MaintenancePartsSelector({ companyId, onPartsChange, initialParts = [] }: Props) {
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [selectedParts, setSelectedParts] = useState<SelectedPart[]>(initialParts);
  const [currentItemId, setCurrentItemId] = useState("");
  const [currentQty, setCurrentQty] = useState(1);

  // Carrega itens com saldo > 0
  useEffect(() => {
    async function loadStock() {
      if (!companyId) return;

      const { data } = await supabase
        .from("inventory_items" as any)
        .select("id, name, quantity, unit_price")
        .eq("company_id", companyId)
        .gt("quantity", 0)
        .order("name");

      if (data) setStockItems(data as unknown as StockItem[]);
    }
    loadStock();
  }, [companyId]);

  const handleAddPart = () => {
    const item = stockItems.find((i) => i.id === currentItemId);
    if (!item) return;

    if (currentQty > item.quantity) {
      toast.error(`Estoque insuficiente! Disponível: ${item.quantity}`);
      return;
    }

    const existingIndex = selectedParts.findIndex((p) => p.item_id === item.id);
    let updatedList;

    if (existingIndex >= 0) {
      const newTotalQty = selectedParts[existingIndex].quantity + currentQty;
      if (newTotalQty > item.quantity) {
        toast.error(`Total excederia o estoque. Disponível: ${item.quantity}`);
        return;
      }
      updatedList = [...selectedParts];
      updatedList[existingIndex].quantity = newTotalQty;
      updatedList[existingIndex].total = newTotalQty * item.unit_price;
    } else {
      const newPart: SelectedPart = {
        item_id: item.id,
        name: item.name,
        quantity: currentQty,
        unit_price: item.unit_price,
        total: currentQty * item.unit_price,
      };
      updatedList = [...selectedParts, newPart];
    }

    setSelectedParts(updatedList);
    const total = updatedList.reduce((acc, p) => acc + p.total, 0);
    onPartsChange(updatedList, total);

    setCurrentItemId("");
    setCurrentQty(1);
  };

  const handleRemovePart = (index: number) => {
    const updatedList = selectedParts.filter((_, i) => i !== index);
    setSelectedParts(updatedList);
    const total = updatedList.reduce((acc, p) => acc + p.total, 0);
    onPartsChange(updatedList, total);
  };

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);

  return (
    <div className="space-y-3 border rounded-md p-4 bg-slate-50">
      <div className="flex items-center gap-2 mb-2 text-sm font-semibold text-slate-700">
        <Package className="w-4 h-4" /> Peças do Almoxarifado
      </div>

      <div className="flex gap-2 items-end">
        <div className="flex-1 space-y-1">
          <Label className="text-xs">Item</Label>
          <Select value={currentItemId} onValueChange={setCurrentItemId}>
            <SelectTrigger className="bg-white h-9">
              <SelectValue placeholder="Selecione..." />
            </SelectTrigger>
            <SelectContent>
              {stockItems.map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {item.name} <span className="text-xs text-muted-foreground">({item.quantity} un)</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-20 space-y-1">
          <Label className="text-xs">Qtd</Label>
          <Input
            type="number"
            min={1}
            value={currentQty}
            onChange={(e) => setCurrentQty(Number(e.target.value))}
            className="bg-white h-9"
          />
        </div>
        <Button type="button" size="sm" onClick={handleAddPart} disabled={!currentItemId} className="h-9">
          <Plus className="w-4 h-4" />
        </Button>
      </div>

      {selectedParts.length > 0 && (
        <div className="bg-white border rounded overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="h-8">
                <TableHead className="py-1">Item</TableHead>
                <TableHead className="py-1 text-center">Qtd</TableHead>
                <TableHead className="py-1 text-right">Total</TableHead>
                <TableHead className="w-8"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {selectedParts.map((part, idx) => (
                <TableRow key={idx} className="h-9">
                  <TableCell className="py-1 text-sm">{part.name}</TableCell>
                  <TableCell className="py-1 text-center text-sm">{part.quantity}</TableCell>
                  <TableCell className="py-1 text-right text-sm">{formatCurrency(part.total)}</TableCell>
                  <TableCell className="py-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-red-500"
                      onClick={() => handleRemovePart(idx)}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
