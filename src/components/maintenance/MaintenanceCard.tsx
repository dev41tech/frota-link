import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Edit, Trash2, Car, Calendar } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

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

interface MaintenanceCardProps {
  maintenance: Maintenance;
  onEdit: (maintenance: Maintenance) => void;
  onDelete: (id: string) => void;
  serviceCategories: Record<string, string>;
}

export function MaintenanceCard({
  maintenance: m,
  onEdit,
  onDelete,
  serviceCategories,
}: MaintenanceCardProps) {
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

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <Car className="h-4 w-4 text-muted-foreground" />
              <span className="font-semibold">{m.vehicles?.plate}</span>
              <span className="text-sm text-muted-foreground truncate">
                {m.vehicles?.model}
              </span>
            </div>
            
            <p className="font-medium mb-1">
              {serviceCategories[m.service_category] || m.service_category}
            </p>
            <p className="text-sm text-muted-foreground truncate mb-2">
              {m.description}
            </p>
            
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
              <Calendar className="h-3 w-3" />
              {format(new Date(m.service_date), "dd/MM/yyyy", { locale: ptBR })}
            </div>
            
            <div className="flex items-center gap-2 flex-wrap">
              {getTypeBadge(m.maintenance_type)}
              {getStatusBadge(m.status)}
            </div>
          </div>
          
          <div className="text-right flex flex-col items-end gap-2">
            <span className="text-lg font-bold">
              {m.total_cost.toLocaleString("pt-BR", {
                style: "currency",
                currency: "BRL",
              })}
            </span>
            
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => onEdit(m)}
              >
                <Edit className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => onDelete(m.id)}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
