import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface VehicleStatusBadgeProps {
  status: string;
  isCoupled?: boolean;
  className?: string;
}

export function VehicleStatusBadge({ status, isCoupled, className }: VehicleStatusBadgeProps) {
  // If vehicle is coupled, show coupling badge
  if (isCoupled) {
    return (
      <Badge className={cn("bg-blue-100 text-blue-800 hover:bg-blue-100", className)}>
        Engatado
      </Badge>
    );
  }

  const getStatusConfig = (status: string) => {
    switch (status) {
      case "active":
        return { label: "Disponível", className: "bg-green-100 text-green-800 hover:bg-green-100" };
      case "maintenance":
        return { label: "Manutenção", className: "bg-red-100 text-red-800 hover:bg-red-100" };
      case "inactive":
        return { label: "Inativo", className: "bg-gray-100 text-gray-800 hover:bg-gray-100" };
      case "sold":
        return { label: "Vendido", className: "bg-gray-100 text-gray-600 hover:bg-gray-100" };
      default:
        return { label: status, className: "bg-gray-100 text-gray-800 hover:bg-gray-100" };
    }
  };

  const config = getStatusConfig(status);

  return (
    <Badge className={cn(config.className, className)}>
      {config.label}
    </Badge>
  );
}

export function CouplingTypeBadge({ type, className }: { type: string; className?: string }) {
  const getTypeConfig = (type: string) => {
    switch (type) {
      case "simple":
        return { label: "Simples", className: "bg-purple-100 text-purple-800" };
      case "bitrem":
        return { label: "Bitrem", className: "bg-indigo-100 text-indigo-800" };
      case "rodotrem":
        return { label: "Rodotrem", className: "bg-cyan-100 text-cyan-800" };
      default:
        return { label: type, className: "bg-gray-100 text-gray-800" };
    }
  };

  const config = getTypeConfig(type);

  return (
    <Badge variant="outline" className={cn(config.className, className)}>
      {config.label}
    </Badge>
  );
}
