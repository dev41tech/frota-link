import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Trash2, Edit2, Package } from "lucide-react";

export interface MaintenancePart {
  id?: string;
  description: string;
  partCode: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  totalPrice: number;
  ncm?: string;
  cfop?: string;
}

interface PartsListTableProps {
  parts: MaintenancePart[];
  onPartsChange: (parts: MaintenancePart[]) => void;
  readOnly?: boolean;
}

export function PartsListTable({ parts, onPartsChange, readOnly = false }: PartsListTableProps) {
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingPart, setEditingPart] = useState<MaintenancePart | null>(null);
  const [editingIndex, setEditingIndex] = useState<number>(-1);

  const handleAddPart = () => {
    setEditingPart({
      description: "",
      partCode: "",
      quantity: 1,
      unit: "UN",
      unitPrice: 0,
      totalPrice: 0,
    });
    setEditingIndex(-1);
    setEditDialogOpen(true);
  };

  const handleEditPart = (part: MaintenancePart, index: number) => {
    setEditingPart({ ...part });
    setEditingIndex(index);
    setEditDialogOpen(true);
  };

  const handleDeletePart = (index: number) => {
    const newParts = parts.filter((_, i) => i !== index);
    onPartsChange(newParts);
  };

  const handleSavePart = () => {
    if (!editingPart || !editingPart.description) return;

    const partToSave = {
      ...editingPart,
      totalPrice: editingPart.quantity * editingPart.unitPrice,
    };

    if (editingIndex >= 0) {
      const newParts = [...parts];
      newParts[editingIndex] = partToSave;
      onPartsChange(newParts);
    } else {
      onPartsChange([...parts, partToSave]);
    }

    setEditDialogOpen(false);
    setEditingPart(null);
    setEditingIndex(-1);
  };

  const totalPartsValue = parts.reduce((sum, p) => sum + p.totalPrice, 0);

  if (parts.length === 0 && readOnly) {
    return (
      <div className="text-center py-6 text-muted-foreground">
        <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">Nenhuma peça registrada</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Package className="h-4 w-4 text-primary" />
          <span className="font-medium">Peças e Materiais</span>
          {parts.length > 0 && (
            <Badge variant="secondary">{parts.length}</Badge>
          )}
        </div>
        {!readOnly && (
          <Button size="sm" variant="outline" onClick={handleAddPart}>
            <Plus className="h-4 w-4 mr-1" />
            Adicionar
          </Button>
        )}
      </div>

      {/* Table */}
      {parts.length > 0 && (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-[40%]">Descrição</TableHead>
                <TableHead className="text-center">Qtd</TableHead>
                <TableHead className="text-right">Unitário</TableHead>
                <TableHead className="text-right">Total</TableHead>
                {!readOnly && <TableHead className="w-[80px]"></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {parts.map((part, index) => (
                <TableRow key={index}>
                  <TableCell>
                    <div>
                      <p className="font-medium truncate">{part.description}</p>
                      {part.partCode && (
                        <p className="text-xs text-muted-foreground">
                          Cód: {part.partCode}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    {part.quantity} {part.unit}
                  </TableCell>
                  <TableCell className="text-right">
                    R$ {part.unitPrice.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    R$ {part.totalPrice.toFixed(2)}
                  </TableCell>
                  {!readOnly && (
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={() => handleEditPart(part, index)}
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-destructive"
                          onClick={() => handleDeletePart(index)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="p-3 bg-muted/50 flex justify-between items-center border-t">
            <span className="text-sm font-medium">Total em Peças:</span>
            <span className="text-lg font-bold text-primary">
              R$ {totalPartsValue.toFixed(2)}
            </span>
          </div>
        </div>
      )}

      {/* Empty State for Edit Mode */}
      {parts.length === 0 && !readOnly && (
        <div 
          className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
          onClick={handleAddPart}
        >
          <Package className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Clique para adicionar peças manualmente ou importe uma NF-e
          </p>
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingIndex >= 0 ? "Editar Peça" : "Adicionar Peça"}
            </DialogTitle>
          </DialogHeader>
          {editingPart && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="part-description">Descrição *</Label>
                <Input
                  id="part-description"
                  value={editingPart.description}
                  onChange={(e) =>
                    setEditingPart({ ...editingPart, description: e.target.value })
                  }
                  placeholder="Nome da peça"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="part-code">Código</Label>
                  <Input
                    id="part-code"
                    value={editingPart.partCode}
                    onChange={(e) =>
                      setEditingPart({ ...editingPart, partCode: e.target.value })
                    }
                    placeholder="Referência"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="part-unit">Unidade</Label>
                  <Input
                    id="part-unit"
                    value={editingPart.unit}
                    onChange={(e) =>
                      setEditingPart({ ...editingPart, unit: e.target.value })
                    }
                    placeholder="UN"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="part-quantity">Quantidade</Label>
                  <Input
                    id="part-quantity"
                    type="number"
                    step="0.001"
                    min="0"
                    value={editingPart.quantity}
                    onChange={(e) =>
                      setEditingPart({
                        ...editingPart,
                        quantity: parseFloat(e.target.value) || 0,
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="part-price">Valor Unitário (R$)</Label>
                  <Input
                    id="part-price"
                    type="number"
                    step="0.01"
                    min="0"
                    value={editingPart.unitPrice}
                    onChange={(e) =>
                      setEditingPart({
                        ...editingPart,
                        unitPrice: parseFloat(e.target.value) || 0,
                      })
                    }
                  />
                </div>
              </div>

              <div className="p-3 bg-muted rounded-lg flex justify-between items-center">
                <span>Total:</span>
                <span className="text-lg font-bold text-primary">
                  R$ {(editingPart.quantity * editingPart.unitPrice).toFixed(2)}
                </span>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleSavePart} disabled={!editingPart.description}>
                  Salvar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
