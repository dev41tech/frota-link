import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { X, Filter } from "lucide-react";

interface FiltersState {
  period: string;
  type: string;
  category: string;
  status: string;
}

interface MaintenanceFiltersProps {
  filters: FiltersState;
  onFilterChange: (key: keyof FiltersState, value: string) => void;
  onClearFilters: () => void;
  serviceCategories: Record<string, string>;
}

export function MaintenanceFilters({
  filters,
  onFilterChange,
  onClearFilters,
  serviceCategories,
}: MaintenanceFiltersProps) {
  const hasActiveFilters = Object.values(filters).some((v) => v !== "all");

  const getFilterLabel = (key: keyof FiltersState, value: string): string => {
    if (value === "all") return "";
    
    const labels: Record<string, Record<string, string>> = {
      period: {
        "7": "Últimos 7 dias",
        "30": "Últimos 30 dias",
        "90": "Últimos 90 dias",
        "365": "Este ano",
      },
      type: {
        preventive: "Preventiva",
        corrective: "Corretiva",
      },
      status: {
        scheduled: "Agendada",
        in_progress: "Em andamento",
        completed: "Concluída",
      },
    };

    if (key === "category") {
      return serviceCategories[value] || value;
    }

    return labels[key]?.[value] || value;
  };

  const activeFilters = Object.entries(filters)
    .filter(([_, value]) => value !== "all")
    .map(([key, value]) => ({
      key: key as keyof FiltersState,
      value,
      label: getFilterLabel(key as keyof FiltersState, value),
    }));

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <Filter className="h-4 w-4 text-muted-foreground" />
        
        <Select
          value={filters.period}
          onValueChange={(v) => onFilterChange("period", v)}
        >
          <SelectTrigger className="w-[140px] h-8">
            <SelectValue placeholder="Período" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todo período</SelectItem>
            <SelectItem value="7">Últimos 7 dias</SelectItem>
            <SelectItem value="30">Últimos 30 dias</SelectItem>
            <SelectItem value="90">Últimos 90 dias</SelectItem>
            <SelectItem value="365">Este ano</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={filters.type}
          onValueChange={(v) => onFilterChange("type", v)}
        >
          <SelectTrigger className="w-[130px] h-8">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos tipos</SelectItem>
            <SelectItem value="preventive">Preventiva</SelectItem>
            <SelectItem value="corrective">Corretiva</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={filters.category}
          onValueChange={(v) => onFilterChange("category", v)}
        >
          <SelectTrigger className="w-[150px] h-8">
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas categorias</SelectItem>
            {Object.entries(serviceCategories).map(([key, label]) => (
              <SelectItem key={key} value={key}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.status}
          onValueChange={(v) => onFilterChange("status", v)}
        >
          <SelectTrigger className="w-[140px] h-8">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos status</SelectItem>
            <SelectItem value="scheduled">Agendada</SelectItem>
            <SelectItem value="in_progress">Em andamento</SelectItem>
            <SelectItem value="completed">Concluída</SelectItem>
          </SelectContent>
        </Select>

        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearFilters}
            className="h-8 text-muted-foreground"
          >
            Limpar filtros
          </Button>
        )}
      </div>

      {activeFilters.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-muted-foreground">Filtros ativos:</span>
          {activeFilters.map(({ key, label }) => (
            <Badge
              key={key}
              variant="secondary"
              className="gap-1 cursor-pointer hover:bg-secondary/80"
              onClick={() => onFilterChange(key, "all")}
            >
              {label}
              <X className="h-3 w-3" />
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
