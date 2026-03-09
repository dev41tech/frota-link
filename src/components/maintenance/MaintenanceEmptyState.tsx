import { Button } from "@/components/ui/button";
import { Wrench, Calendar, Plus, Search } from "lucide-react";

interface MaintenanceEmptyStateProps {
  type: "no-data" | "no-results" | "no-scheduled";
  onAction?: () => void;
}

export function MaintenanceEmptyState({ type, onAction }: MaintenanceEmptyStateProps) {
  const content = {
    "no-data": {
      icon: Wrench,
      title: "Nenhuma manutenção registrada",
      description: "Comece registrando a primeira manutenção da sua frota para ter controle total sobre os custos.",
      actionLabel: "Registrar Primeira Manutenção",
      showAction: true,
    },
    "no-results": {
      icon: Search,
      title: "Nenhuma manutenção encontrada",
      description: "Tente ajustar os filtros ou termos de busca para encontrar o que procura.",
      actionLabel: "",
      showAction: false,
    },
    "no-scheduled": {
      icon: Calendar,
      title: "Nenhuma manutenção agendada",
      description: "Agende manutenções preventivas para evitar surpresas e manter sua frota em dia.",
      actionLabel: "Agendar Manutenção",
      showAction: true,
    },
  };

  const { icon: Icon, title, description, actionLabel, showAction } = content[type];

  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="p-4 rounded-full bg-muted mb-4">
        <Icon className="h-10 w-10 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-muted-foreground max-w-sm mb-6">{description}</p>
      {showAction && onAction && (
        <Button onClick={onAction}>
          <Plus className="h-4 w-4 mr-2" />
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
