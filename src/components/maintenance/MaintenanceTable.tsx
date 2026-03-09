import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Edit, Trash2, LucideIcon } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { parseDateString } from "@/lib/utils";

interface Vehicle {
  id: string;
  plate: string;
  model: string;
}

interface Maintenance {
  id: string;
  vehicle_id: string;
  maintenance_type: "preventive" | "corrective";
  service_category: string;
  description: string;
  provider_name: string | null;
  total_cost: number;
  service_date: string;
  status: "scheduled" | "in_progress" | "completed";
  vehicles?: Vehicle;
}

interface MaintenanceTableProps {
  data: Maintenance[];
  onEdit: (maintenance: Maintenance) => void;
  onDelete: (id: string) => void;
  emptyIcon: LucideIcon;
  emptyMessage: string;
  serviceCategories: Record<string, string>;
}

export function MaintenanceTable({
  data,
  onEdit,
  onDelete,
  emptyIcon: EmptyIcon,
  emptyMessage,
  serviceCategories,
}: MaintenanceTableProps) {
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "scheduled":
        return <Badge variant="secondary">Agendada</Badge>;
      case "in_progress":
        return <Badge className="bg-amber-500 hover:bg-amber-600">Em andamento</Badge>;
      case "completed":
        return <Badge className="bg-green-500 hover:bg-green-600">Concluída</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getTypeBadge = (type: string) => {
    return type === "preventive" ? (
      <Badge variant="outline" className="border-blue-500 text-blue-500">
        Preventiva
      </Badge>
    ) : (
      <Badge variant="outline" className="border-orange-500 text-orange-500">
        Corretiva
      </Badge>
    );
  };

  if (data.length === 0) {
    return (
      <div className="border rounded-lg p-8 text-center">
        <EmptyIcon className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
        <p className="text-muted-foreground">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="border rounded-lg hidden md:block">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Data</TableHead>
            <TableHead>Veículo</TableHead>
            <TableHead>Serviço</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead className="text-right">Valor</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-[100px]">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((m) => (
            <TableRow key={m.id} className="group">
              <TableCell>
                {format(parseDateString(m.service_date), "dd/MM/yyyy", {
                  locale: ptBR,
                })}
              </TableCell>
              <TableCell>
                <div>
                  <span className="font-medium">{m.vehicles?.plate}</span>
                  <p className="text-xs text-muted-foreground">
                    {m.vehicles?.model}
                  </p>
                </div>
              </TableCell>
              <TableCell>
                <div>
                  <span>{serviceCategories[m.service_category] || m.service_category}</span>
                  <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                    {m.description}
                  </p>
                </div>
              </TableCell>
              <TableCell>{getTypeBadge(m.maintenance_type)}</TableCell>
              <TableCell className="text-right font-medium">
                {m.total_cost.toLocaleString("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                })}
              </TableCell>
              <TableCell>{getStatusBadge(m.status)}</TableCell>
              <TableCell>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onEdit(m)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onDelete(m.id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
