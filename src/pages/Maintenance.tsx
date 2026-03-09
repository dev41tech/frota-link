import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useMultiTenant } from "@/hooks/useMultiTenant";
import { toast } from "sonner";
import { Search, Plus, Wrench, Calendar, History, Loader2, Settings, CircleDot } from "lucide-react";
import { MaintenanceStats } from "@/components/maintenance/MaintenanceStats";
import { MaintenanceForm } from "@/components/maintenance/MaintenanceForm";
import { MaintenanceAlerts } from "@/components/maintenance/MaintenanceAlerts";
import { MaintenanceTable } from "@/components/maintenance/MaintenanceTable";
import { MaintenanceCard } from "@/components/maintenance/MaintenanceCard";
import { MaintenanceFilters } from "@/components/maintenance/MaintenanceFilters";
import { MaintenanceEmptyState } from "@/components/maintenance/MaintenanceEmptyState";
import { MaintenanceScheduleConfig } from "@/components/maintenance/MaintenanceScheduleConfig";
import { TireManagementSection } from "@/components/maintenance/TireManagementSection";
import { Badge } from "@/components/ui/badge";
import { subDays, startOfYear, isAfter, parseISO, differenceInDays } from "date-fns";

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
  provider_cnpj: string | null;
  labor_cost: number;
  parts_cost: number;
  total_cost: number;
  service_date: string;
  odometer_at_service: number | null;
  next_due_date: string | null;
  next_due_km: number | null;
  status: "scheduled" | "in_progress" | "completed";
  notes: string | null;
  created_at: string;
  vehicles?: Vehicle;
}

const SERVICE_CATEGORIES: Record<string, string> = {
  oil_change: "Troca de óleo",
  general_revision: "Revisão geral",
  tires: "Pneus",
  brakes: "Freios",
  electrical: "Parte elétrica",
  suspension: "Suspensão",
  cooling: "Arrefecimento",
  transmission: "Transmissão",
  engine: "Motor",
  bodywork: "Funilaria/Pintura",
  other: "Outros",
};

type StatsFilter = "all" | "scheduled" | "overdue" | "active" | "upcoming"; // Adicionado novos filtros

interface FiltersState {
  period: string;
  type: string;
  category: string;
  status: string;
}

export default function Maintenance() {
  const { user } = useAuth();
  const { currentCompany } = useMultiTenant();
  const [maintenances, setMaintenances] = useState<Maintenance[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [vehicleFilter, setVehicleFilter] = useState("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editingMaintenance, setEditingMaintenance] = useState<Maintenance | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [activeMainTab, setActiveMainTab] = useState("maintenance");
  const [activeTab, setActiveTab] = useState("history");
  const [statsFilter, setStatsFilter] = useState<StatsFilter>("all");
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [filters, setFilters] = useState<FiltersState>({
    period: "all",
    type: "all",
    category: "all",
    status: "all",
  });

  // Stats
  const [totalCost, setTotalCost] = useState(0);
  const [monthCost, setMonthCost] = useState(0);
  const [previousMonthCost, setPreviousMonthCost] = useState(0);
  const [scheduledCount, setScheduledCount] = useState(0);
  const [overdueCount, setOverdueCount] = useState(0);
  const [previousOverdueCount, setPreviousOverdueCount] = useState(0);
  // Novos States para os KPIs Inteligentes
  const [activeCount, setActiveCount] = useState(0);
  const [upcomingCount, setUpcomingCount] = useState(0);

  useEffect(() => {
    if (user && currentCompany?.id) {
      fetchData();
    }
  }, [user, currentCompany?.id]);

  const fetchData = async () => {
    if (!currentCompany?.id) return;

    setLoading(true);
    try {
      const { data: vehiclesData } = await supabase
        .from("vehicles")
        .select("id, plate, model")
        .eq("company_id", currentCompany.id)
        .order("plate");

      if (vehiclesData) {
        setVehicles(vehiclesData);
      }

      const { data: maintenancesData, error } = await supabase
        .from("vehicle_maintenances")
        .select(
          `
          *,
          vehicles:vehicle_id (id, plate, model)
        `,
        )
        .eq("company_id", currentCompany.id)
        .is("deleted_at", null)
        .order("service_date", { ascending: false });

      if (error) throw error;

      if (maintenancesData) {
        setMaintenances(maintenancesData as Maintenance[]);
        calculateStats(maintenancesData as Maintenance[]);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Erro ao carregar manutenções");
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (data: Maintenance[]) => {
    const today = new Date();
    const total = data.reduce((sum, m) => sum + (m.total_cost || 0), 0);
    setTotalCost(total);

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    // Current month cost
    const monthTotal = data
      .filter((m) => {
        const date = new Date(m.service_date);
        return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
      })
      .reduce((sum, m) => sum + (m.total_cost || 0), 0);
    setMonthCost(monthTotal);

    // Previous month cost
    const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;
    const prevMonthTotal = data
      .filter((m) => {
        const date = new Date(m.service_date);
        return date.getMonth() === prevMonth && date.getFullYear() === prevYear;
      })
      .reduce((sum, m) => sum + (m.total_cost || 0), 0);
    setPreviousMonthCost(prevMonthTotal);

    // Scheduled count: inclui status "scheduled" E manutenções concluídas com next_due_date futuro
    const scheduled = data.filter((m) => {
      if (m.status === "scheduled") return true;
      // Manutenção concluída mas com próxima data agendada
      if (m.status === "completed" && m.next_due_date && new Date(m.next_due_date) > today) return true;
      return false;
    }).length;
    setScheduledCount(scheduled);

    // Calculate overdue
    const overdue = data.filter((m) => {
      if (m.maintenance_type !== "preventive") return false;
      if (m.next_due_date && new Date(m.next_due_date) < today && m.status !== "completed") return true;
      return false;
    }).length;
    setOverdueCount(overdue);
    setPreviousOverdueCount(Math.max(0, overdue - 1));

    // NOVA LÓGICA: Active (Em progresso)
    const active = data.filter((m) => m.status === "in_progress").length;
    setActiveCount(active);

    // NOVA LÓGICA: Upcoming (Próximos 7 dias)
    const upcoming = data.filter((m) => {
      if (m.maintenance_type !== "preventive" || m.status === "completed") return false;
      if (!m.next_due_date) return false;

      const dueDate = new Date(m.next_due_date);
      const daysDiff = differenceInDays(dueDate, today);

      // Retorna true se vencer entre hoje e 7 dias
      return daysDiff >= 0 && daysDiff <= 7;
    }).length;
    setUpcomingCount(upcoming);
  };

  const handleDelete = async () => {
    if (!deletingId || !currentCompany) return;

    try {
      // Primeiro, deletar peças associadas (se houver)
      const { error: partsError } = await supabase
        .from("maintenance_parts")
        .delete()
        .eq("maintenance_id", deletingId);

      if (partsError) {
        console.warn("Error deleting maintenance parts:", partsError);
        // Continua mesmo se não houver peças
      }

      // Soft delete da manutenção
      const { error } = await supabase
        .from("vehicle_maintenances")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", deletingId);

      if (error) throw error;

      toast.success("Manutenção excluída com sucesso!");
      fetchData();
    } catch (error: any) {
      console.error("Error deleting maintenance:", error);
      toast.error("Erro ao excluir manutenção");
    } finally {
      setDeleteDialogOpen(false);
      setDeletingId(null);
    }
  };

  const handleFilterChange = (key: keyof FiltersState, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({
      period: "all",
      type: "all",
      category: "all",
      status: "all",
    });
  };

  const handleStatsFilterChange = (filter: StatsFilter) => {
    setStatsFilter(filter);

    // Reset tabs based on filter context
    if (filter === "scheduled" || filter === "upcoming" || filter === "active") {
      // Se clicar em Scheduled, Active ou Upcoming, vamos para a aba de agendadas/futuras
      // Nota: Dependendo da sua lógica de abas, talvez precise ajustar o filtro da tabela também
      setActiveTab("scheduled");

      // Auto-aplicar filtros na tabela para corresponder ao card clicado
      if (filter === "active") handleFilterChange("status", "in_progress");
      if (filter === "scheduled") handleFilterChange("status", "scheduled");
    } else if (filter === "overdue") {
      setActiveTab("history"); // Geralmente atrasados estão misturados, ou poderia criar uma aba só pra eles
      setFilters((prev) => ({ ...prev, status: "all" })); // Limpa status para mostrar os atrasados calculados
    } else {
      setActiveTab("history");
      clearFilters();
    }
  };

  const filteredMaintenances = maintenances.filter((m) => {
    // Search filter
    const matchesSearch =
      m.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.vehicles?.plate.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.provider_name?.toLowerCase().includes(searchTerm.toLowerCase());

    // Vehicle filter
    const matchesVehicle = vehicleFilter === "all" || m.vehicle_id === vehicleFilter;

    // Stats filter specific logic
    const today = new Date();

    // Tab filter logic
    if (activeTab === "scheduled") {
      // Na aba agendadas mostramos: agendadas, em progresso, vencendo E manutenções concluídas com next_due_date futuro
      const validStatuses = ["scheduled", "in_progress"];
      const hasUpcomingService = m.status === "completed" && m.next_due_date && new Date(m.next_due_date) > today;
      
      if (!validStatuses.includes(m.status) && !hasUpcomingService && statsFilter !== "upcoming") return false;
    }

    if (statsFilter === "overdue") {
      if (m.maintenance_type !== "preventive" || m.status === "completed") return false;
      if (!m.next_due_date || new Date(m.next_due_date) >= today) return false;
    }

    if (statsFilter === "upcoming") {
      if (m.maintenance_type !== "preventive" || m.status === "completed" || !m.next_due_date) return false;
      const diff = differenceInDays(new Date(m.next_due_date), today);
      if (diff < 0 || diff > 7) return false;
    }

    if (statsFilter === "active") {
      if (m.status !== "in_progress") return false;
    }

    // Period filter
    if (filters.period !== "all") {
      const serviceDate = parseISO(m.service_date);
      const daysAgo = parseInt(filters.period);
      if (daysAgo === 365) {
        if (!isAfter(serviceDate, startOfYear(new Date()))) return false;
      } else {
        if (!isAfter(serviceDate, subDays(new Date(), daysAgo))) return false;
      }
    }

    // Type filter
    if (filters.type !== "all" && m.maintenance_type !== filters.type) return false;

    // Category filter
    if (filters.category !== "all" && m.service_category !== filters.category) return false;

    // Status filter
    if (filters.status !== "all" && m.status !== filters.status) return false;

    return matchesSearch && matchesVehicle;
  });

  const handleEdit = (maintenance: Maintenance) => {
    setEditingMaintenance(maintenance);
    setFormOpen(true);
  };

  const handleDeleteClick = (id: string) => {
    setDeletingId(id);
    setDeleteDialogOpen(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const hasNoData = maintenances.length === 0;
  const hasNoResults = filteredMaintenances.length === 0 && !hasNoData;

  return (
    // AQUI ESTÁ A CORREÇÃO DE LAYOUT: p-8 pt-6
    <div className="flex-1 space-y-4 p-8 pt-6">
      {/* Top-Level Tabs */}
      <Tabs value={activeMainTab} onValueChange={setActiveMainTab}>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <TabsList className="h-11">
            <TabsTrigger value="maintenance" className="flex items-center gap-2 px-4 py-2 text-sm">
              <Wrench className="h-4 w-4" />
              Manutenções
            </TabsTrigger>
            <TabsTrigger value="tires" className="flex items-center gap-2 px-4 py-2 text-sm">
              <CircleDot className="h-4 w-4" />
              Pneus
            </TabsTrigger>
          </TabsList>
        </div>

        {/* ====== ABA MANUTENÇÕES ====== */}
        <TabsContent value="maintenance" className="mt-4 space-y-4">
          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
                <Wrench className="h-6 w-6 sm:h-8 sm:w-8" />
                Manutenções
              </h1>
              <p className="text-muted-foreground text-sm sm:text-base">Controle de manutenções preventivas e corretivas</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setConfigDialogOpen(true)}>
                <Settings className="h-4 w-4 mr-2" />
                Configurar Alertas
              </Button>
              <Button onClick={() => setFormOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Nova Manutenção
              </Button>
            </div>
          </div>

          {/* Stats Cards */}
          <MaintenanceStats
            totalCost={totalCost}
            monthCost={monthCost}
            scheduledCount={scheduledCount}
            overdueCount={overdueCount}
            activeCount={activeCount}
            upcomingCount={upcomingCount}
            previousMonthCost={previousMonthCost}
            previousOverdueCount={previousOverdueCount}
            activeFilter={statsFilter}
            onFilterChange={handleStatsFilterChange}
          />

          {/* Main Content */}
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-4">
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <div className="flex flex-col gap-4">
                  {/* Sub-Tabs and Search */}
                  <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                    <TabsList>
                      <TabsTrigger value="history" className="flex items-center gap-2">
                        <History className="h-4 w-4" />
                        <span className="hidden sm:inline">Histórico</span>
                      </TabsTrigger>
                      <TabsTrigger value="scheduled" className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        <span className="hidden sm:inline">Agendadas</span>
                        {scheduledCount > 0 && (
                          <Badge variant="secondary" className="ml-1">
                            {scheduledCount}
                          </Badge>
                        )}
                      </TabsTrigger>
                    </TabsList>

                    <div className="flex gap-2 w-full sm:w-auto">
                      <div className="relative flex-1 sm:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Buscar..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="pl-9"
                        />
                      </div>
                      <Select value={vehicleFilter} onValueChange={setVehicleFilter}>
                        <SelectTrigger className="w-[120px] sm:w-[140px]">
                          <SelectValue placeholder="Veículo" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos</SelectItem>
                          {vehicles.map((v) => (
                            <SelectItem key={v.id} value={v.id}>
                              {v.plate}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Advanced Filters */}
                  <MaintenanceFilters
                    filters={filters}
                    onFilterChange={handleFilterChange}
                    onClearFilters={clearFilters}
                    serviceCategories={SERVICE_CATEGORIES}
                  />
                </div>

                {/* Content */}
                <TabsContent value="history" className="mt-4">
                  {hasNoData ? (
                    <MaintenanceEmptyState type="no-data" onAction={() => setFormOpen(true)} />
                  ) : hasNoResults ? (
                    <MaintenanceEmptyState type="no-results" />
                  ) : (
                    <>
                      <MaintenanceTable
                        data={filteredMaintenances}
                        onEdit={handleEdit}
                        onDelete={handleDeleteClick}
                        emptyIcon={Wrench}
                        emptyMessage="Nenhuma manutenção encontrada"
                        serviceCategories={SERVICE_CATEGORIES}
                      />
                      <div className="md:hidden space-y-3">
                        {filteredMaintenances.map((m) => (
                          <MaintenanceCard
                            key={m.id}
                            maintenance={m}
                            onEdit={handleEdit}
                            onDelete={handleDeleteClick}
                            serviceCategories={SERVICE_CATEGORIES}
                          />
                        ))}
                      </div>
                    </>
                  )}
                </TabsContent>

                <TabsContent value="scheduled" className="mt-4">
                  {filteredMaintenances.length === 0 ? (
                    <MaintenanceEmptyState type="no-scheduled" onAction={() => setFormOpen(true)} />
                  ) : (
                    <>
                      <MaintenanceTable
                        data={filteredMaintenances}
                        onEdit={handleEdit}
                        onDelete={handleDeleteClick}
                        emptyIcon={Calendar}
                        emptyMessage="Nenhuma manutenção agendada"
                        serviceCategories={SERVICE_CATEGORIES}
                      />
                      <div className="md:hidden space-y-3">
                        {filteredMaintenances.map((m) => (
                          <MaintenanceCard
                            key={m.id}
                            maintenance={m}
                            onEdit={handleEdit}
                            onDelete={handleDeleteClick}
                            serviceCategories={SERVICE_CATEGORIES}
                          />
                        ))}
                      </div>
                    </>
                  )}
                </TabsContent>
              </Tabs>
            </div>

            {/* Alerts Sidebar */}
            <div className="lg:col-span-1">
              <MaintenanceAlerts onRefresh={fetchData} />
            </div>
          </div>
        </TabsContent>

        {/* ====== ABA PNEUS ====== */}
        <TabsContent value="tires" className="mt-4">
          <TireManagementSection />
        </TabsContent>
      </Tabs>

      {/* Form Dialog */}
      <MaintenanceForm
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setEditingMaintenance(null);
        }}
        maintenance={editingMaintenance}
        onSuccess={fetchData}
      />

      {/* Schedule Config Dialog */}
      <MaintenanceScheduleConfig open={configDialogOpen} onOpenChange={setConfigDialogOpen} />

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir manutenção?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A manutenção será permanentemente removida do sistema.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
