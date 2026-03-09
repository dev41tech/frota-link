import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { useMultiTenant } from "@/hooks/useMultiTenant";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import {
  CircleDot,
  MoreHorizontal,
  Link2,
  Unlink,
  RotateCcw,
  Package,
  Car,
  Loader2,
  History,
  RefreshCw,
  Search,
  X,
  ArrowLeftRight,
  Trash2,
  Wrench,
  DollarSign,
} from "lucide-react";
import { TireVehicleAssignment } from "./TireVehicleAssignment";
import { TireAlertsPanel } from "./TireAlertsPanel";
import { TireHistoryDialog } from "./TireHistoryDialog";
import { TireReplacementDialog } from "./TireReplacementDialog";
import { TireRotationWizard } from "./TireRotationWizard";

interface Tire {
  id: string;
  serial_number: string;
  brand: string | null;
  model: string | null;
  size: string | null;
  status: string | null;
  current_vehicle_id: string | null;
  current_position: string | null;
  installation_km: number | null;
  tread_depth_mm: number | null;
  purchase_date: string | null;
  cost: number | null;
  total_km: number | null;
  life_count?: number | null;
}

interface Vehicle {
  id: string;
  plate: string;
  model: string;
}

function TireLifeBadge({ lifeCount }: { lifeCount: number | null | undefined }) {
  const count = lifeCount || 0;
  if (count === 0) return <Badge className="bg-green-600 text-white text-[10px]">Novo</Badge>;
  if (count === 1) return <Badge className="bg-blue-600 text-white text-[10px]">1º Recape</Badge>;
  return <Badge className="bg-amber-500 text-white text-[10px]">2º+ Recape</Badge>;
}

function formatCPK(cost: number | null, totalKm: number | null): string {
  if (!cost || !totalKm || totalKm === 0) return "-";
  return `R$ ${(cost / totalKm).toFixed(2).replace(".", ",")}/km`;
}

export function TireManagementSection() {
  const { user } = useAuth();
  const { currentCompany } = useMultiTenant();
  const [loading, setLoading] = useState(true);
  const [tires, setTires] = useState<Tire[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [activeTab, setActiveTab] = useState("stock");
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedTire, setSelectedTire] = useState<Tire | null>(null);
  const [unlinkDialogOpen, setUnlinkDialogOpen] = useState(false);
  const [unlinkingTireId, setUnlinkingTireId] = useState<string | null>(null);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [historyTireId, setHistoryTireId] = useState<string | null>(null);
  const [historyTireName, setHistoryTireName] = useState<string>("");
  const [replacementDialogOpen, setReplacementDialogOpen] = useState(false);
  const [replacementData, setReplacementData] = useState<{
    tireId: string | null;
    vehicleId: string | null;
    position: string | null;
    vehiclePlate: string;
  }>({ tireId: null, vehicleId: null, position: null, vehiclePlate: "" });
  const [rotationWizardOpen, setRotationWizardOpen] = useState(false);
  const [rotationVehicleId, setRotationVehicleId] = useState("");
  const [rotationVehiclePlate, setRotationVehiclePlate] = useState("");

  // Filter states
  const [searchTerm, setSearchTerm] = useState("");
  const [brandFilter, setBrandFilter] = useState("all");
  const [sizeFilter, setSizeFilter] = useState("all");

  useEffect(() => {
    if (user && currentCompany?.id) {
      fetchData();
    }
  }, [user, currentCompany?.id]);

  const fetchData = async () => {
    if (!currentCompany?.id) return;
    setLoading(true);

    try {
      const [tiresRes, vehiclesRes] = await Promise.all([
        supabase
          .from("tire_assets")
          .select("*")
          .eq("company_id", currentCompany.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("vehicles")
          .select("id, plate, model")
          .eq("company_id", currentCompany.id)
          .order("plate"),
      ]);

      if (tiresRes.data) setTires(tiresRes.data as Tire[]);
      if (vehiclesRes.data) setVehicles(vehiclesRes.data);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  };

  // Summary stats
  const stats = useMemo(() => {
    const inStock = tires.filter(t => t.status === "in_stock").length;
    const installed = tires.filter(t => t.status === "installed").length;
    const recapping = tires.filter(t => t.status === "recapping").length;
    const discarded = tires.filter(t => t.status === "discarded").length;
    const withKm = tires.filter(t => (t.total_km || 0) > 0 && (t.cost || 0) > 0);
    const totalCost = withKm.reduce((s, t) => s + (t.cost || 0), 0);
    const totalKm = withKm.reduce((s, t) => s + (t.total_km || 0), 0);
    const avgCpk = totalKm > 0 ? totalCost / totalKm : 0;
    return { inStock, installed, recapping, discarded, avgCpk };
  }, [tires]);

  // Filter options
  const brands = useMemo(() => [...new Set(tires.map(t => t.brand).filter(Boolean) as string[])].sort(), [tires]);
  const sizes = useMemo(() => [...new Set(tires.map(t => t.size).filter(Boolean) as string[])].sort(), [tires]);

  const filterTires = (list: Tire[]) => {
    return list.filter(t => {
      const search = searchTerm.toLowerCase();
      if (search) {
        const vehicle = vehicles.find(v => v.id === t.current_vehicle_id);
        const matchSearch =
          (t.brand || "").toLowerCase().includes(search) ||
          (t.model || "").toLowerCase().includes(search) ||
          t.serial_number.toLowerCase().includes(search) ||
          (vehicle?.plate || "").toLowerCase().includes(search);
        if (!matchSearch) return false;
      }
      if (brandFilter !== "all" && t.brand !== brandFilter) return false;
      if (sizeFilter !== "all" && t.size !== sizeFilter) return false;
      return true;
    });
  };

  const hasActiveFilters = searchTerm || brandFilter !== "all" || sizeFilter !== "all";

  const clearFilters = () => {
    setSearchTerm("");
    setBrandFilter("all");
    setSizeFilter("all");
  };

  const handleAssignClick = (tire: Tire) => {
    setSelectedTire(tire);
    setAssignDialogOpen(true);
  };

  const handleUnlinkClick = (tireId: string) => {
    setUnlinkingTireId(tireId);
    setUnlinkDialogOpen(true);
  };

  const handleUnlink = async () => {
    if (!unlinkingTireId || !user || !currentCompany) return;

    try {
      const tire = tires.find(t => t.id === unlinkingTireId);
      if (!tire) return;

      const vehicle = vehicles.find(v => v.id === tire.current_vehicle_id);
      const vehiclePlate = vehicle?.plate || "";

      let currentKm = 0;
      if (tire.current_vehicle_id) {
        const { data: fuelData } = await supabase
          .from("fuel_expenses")
          .select("odometer")
          .eq("vehicle_id", tire.current_vehicle_id)
          .order("date", { ascending: false })
          .limit(1)
          .single();
        currentKm = fuelData?.odometer || 0;
      }

      const installationKm = tire.installation_km || 0;
      const previousTotalKm = tire.total_km || 0;
      const kmDriven = currentKm - installationKm;
      const newTotalKm = previousTotalKm + (kmDriven > 0 ? kmDriven : 0);

      const { error } = await supabase
        .from("tire_assets")
        .update({
          current_vehicle_id: null,
          current_position: null,
          installation_km: null,
          status: "in_stock",
          total_km: newTotalKm,
        })
        .eq("id", unlinkingTireId);

      if (error) throw error;

      await supabase.from("tire_history").insert({
        company_id: currentCompany.id,
        tire_id: unlinkingTireId,
        vehicle_id: tire.current_vehicle_id,
        vehicle_plate: vehiclePlate,
        action: "unlink",
        position: tire.current_position,
        km_at_action: currentKm,
        km_driven: kmDriven > 0 ? kmDriven : 0,
        notes: null,
        user_id: user.id,
      });

      toast.success("Pneu desvinculado com sucesso!");
      fetchData();
    } catch (error: any) {
      console.error("Error unlinking tire:", error);
      toast.error("Erro ao desvincular pneu");
    } finally {
      setUnlinkDialogOpen(false);
      setUnlinkingTireId(null);
    }
  };

  const handleRegisterRotation = async (tireId: string, vehicleId: string) => {
    if (!user || !currentCompany) return;
    
    try {
      const { data: fuelData } = await supabase
        .from("fuel_expenses")
        .select("odometer")
        .eq("vehicle_id", vehicleId)
        .order("date", { ascending: false })
        .limit(1)
        .single();

      const currentKm = fuelData?.odometer || 0;

      const tire = tires.find(t => t.id === tireId);
      const vehicle = vehicles.find(v => v.id === vehicleId);
      const vehiclePlate = vehicle?.plate || "";
      const installationKm = tire?.installation_km || 0;
      const kmDriven = currentKm - installationKm;

      const { error } = await supabase
        .from("tire_assets")
        .update({
          last_rotation_km: currentKm,
          last_rotation_date: new Date().toISOString().split("T")[0],
          installation_km: currentKm,
        })
        .eq("id", tireId);

      if (error) throw error;

      await supabase.from("tire_history").insert({
        company_id: currentCompany.id,
        tire_id: tireId,
        vehicle_id: vehicleId,
        vehicle_plate: vehiclePlate,
        action: "rotation",
        position: tire?.current_position || null,
        km_at_action: currentKm,
        km_driven: kmDriven > 0 ? kmDriven : 0,
        notes: null,
        user_id: user.id,
      });

      toast.success("Rodízio registrado com sucesso!");
      fetchData();
    } catch (error: any) {
      console.error("Error registering rotation:", error);
      toast.error("Erro ao registrar rodízio");
    }
  };

  const handleOpenHistory = (tire: Tire) => {
    setHistoryTireId(tire.id);
    setHistoryTireName(`${tire.brand} ${tire.model} - ${tire.size} (SN: ${tire.serial_number})`);
    setHistoryDialogOpen(true);
  };

  const handleOpenReplacement = (tireId: string, vehicleId: string) => {
    const tire = tires.find(t => t.id === tireId);
    const vehicle = vehicles.find(v => v.id === vehicleId);
    setReplacementData({
      tireId,
      vehicleId,
      position: tire?.current_position || null,
      vehiclePlate: vehicle?.plate || "",
    });
    setReplacementDialogOpen(true);
  };

  const handleOpenRotationWizard = (vehicleId: string) => {
    const vehicle = vehicles.find(v => v.id === vehicleId);
    setRotationVehicleId(vehicleId);
    setRotationVehiclePlate(vehicle?.plate || "");
    setRotationWizardOpen(true);
  };

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case "installed":
        return <Badge className="bg-green-500">Instalado</Badge>;
      case "in_stock":
        return <Badge variant="secondary">Em Estoque</Badge>;
      case "recapping":
        return <Badge className="bg-blue-500">Em Recape</Badge>;
      case "maintenance":
        return <Badge className="bg-amber-500">Manutenção</Badge>;
      case "discarded":
        return <Badge variant="destructive">Descartado</Badge>;
      default:
        return <Badge variant="outline">{status || "N/A"}</Badge>;
    }
  };

  const stockTires = tires.filter((t) => t.status === "in_stock" || (!t.current_vehicle_id && t.status !== "installed"));
  const inUseTires = tires.filter((t) => t.status === "installed" && t.current_vehicle_id);

  const filteredStockTires = useMemo(() => filterTires(stockTires), [stockTires, searchTerm, brandFilter, sizeFilter, vehicles]);
  const filteredInUseTires = useMemo(() => filterTires(inUseTires), [inUseTires, searchTerm, brandFilter, sizeFilter, vehicles]);

  // Group filtered in-use tires by vehicle
  const tiresByVehicle = filteredInUseTires.reduce((acc, tire) => {
    const vehicleId = tire.current_vehicle_id!;
    if (!acc[vehicleId]) acc[vehicleId] = [];
    acc[vehicleId].push(tire);
    return acc;
  }, {} as Record<string, Tire[]>);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-muted p-2.5">
              <Package className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Em Estoque</p>
              <p className="text-2xl font-bold">{stats.inStock}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-green-500/10 p-2.5">
              <Car className="h-5 w-5 text-green-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Instalados</p>
              <p className="text-2xl font-bold">{stats.installed}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-blue-500/10 p-2.5">
              <Wrench className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Em Recape</p>
              <p className="text-2xl font-bold">{stats.recapping}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-destructive/10 p-2.5">
              <Trash2 className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Descartados</p>
              <p className="text-2xl font-bold">{stats.discarded}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-amber-500/10 p-2.5">
              <DollarSign className="h-5 w-5 text-amber-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">CPK Médio</p>
              <p className="text-2xl font-bold">
                {stats.avgCpk > 0 ? `R$ ${stats.avgCpk.toFixed(2).replace(".", ",")}` : "-"}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Main Content - Full Width */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CircleDot className="h-5 w-5" />
            Gestão de Pneus
            <Badge variant="secondary" className="ml-2">
              {tires.length} pneus
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Search & Filters */}
          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar marca, modelo, série, placa..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              {brands.length > 0 && (
                <Select value={brandFilter} onValueChange={setBrandFilter}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="Marca" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas Marcas</SelectItem>
                    {brands.map(b => (
                      <SelectItem key={b} value={b}>{b}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {sizes.length > 0 && (
                <Select value={sizeFilter} onValueChange={setSizeFilter}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="Medida" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas Medidas</SelectItem>
                    {sizes.map(s => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="h-10">
                  <X className="h-4 w-4 mr-1" />
                  Limpar
                </Button>
              )}
            </div>
              </div>

              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="mb-4">
                  <TabsTrigger value="stock" className="flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    Em Estoque ({filteredStockTires.length})
                  </TabsTrigger>
                  <TabsTrigger value="vehicles" className="flex items-center gap-2">
                    <Car className="h-4 w-4" />
                    Em Veículos ({filteredInUseTires.length})
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="stock">
                  {filteredStockTires.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p>{hasActiveFilters ? "Nenhum pneu corresponde aos filtros" : "Nenhum pneu em estoque"}</p>
                      {hasActiveFilters ? (
                        <Button variant="link" onClick={clearFilters}>Limpar filtros</Button>
                      ) : (
                        <p className="text-sm">Adicione pneus no menu Almoxarifado</p>
                      )}
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="min-w-[180px]">Marca/Modelo</TableHead>
                          <TableHead>Medida</TableHead>
                          <TableHead>Nº Série</TableHead>
                          <TableHead>Vida</TableHead>
                          <TableHead className="text-right">KM Total</TableHead>
                          <TableHead className="text-right">CPK</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="w-[120px]">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredStockTires.map((tire) => (
                          <TableRow key={tire.id}>
                            <TableCell className="font-medium">
                              {tire.brand} {tire.model}
                            </TableCell>
                            <TableCell>{tire.size || "-"}</TableCell>
                            <TableCell className="text-muted-foreground text-sm">
                              {tire.serial_number}
                            </TableCell>
                            <TableCell>
                              <TireLifeBadge lifeCount={tire.life_count} />
                            </TableCell>
                            <TableCell className="text-right">
                              {(tire.total_km || 0).toLocaleString()} km
                            </TableCell>
                            <TableCell className="text-right text-sm">
                              {formatCPK(tire.cost, tire.total_km)}
                            </TableCell>
                            <TableCell>{getStatusBadge(tire.status)}</TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleAssignClick(tire)}
                                >
                                  <Link2 className="h-4 w-4 mr-1" />
                                  Vincular
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => handleOpenHistory(tire)}
                                  title="Ver histórico"
                                >
                                  <History className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </TabsContent>

                <TabsContent value="vehicles">
                  {Object.keys(tiresByVehicle).length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Car className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p>{hasActiveFilters ? "Nenhum pneu corresponde aos filtros" : "Nenhum pneu vinculado a veículos"}</p>
                      {hasActiveFilters ? (
                        <Button variant="link" onClick={clearFilters}>Limpar filtros</Button>
                      ) : (
                        <p className="text-sm">Vincule pneus do estoque aos veículos</p>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {Object.entries(tiresByVehicle).map(([vehicleId, vehicleTires]) => {
                        const vehicle = vehicles.find((v) => v.id === vehicleId);
                        return (
                          <div key={vehicleId} className="bg-muted/30 rounded-lg p-4">
                            <div className="flex items-center gap-3 mb-4">
                              <Car className="h-5 w-5 text-muted-foreground" />
                              <span className="font-semibold text-base">{vehicle?.plate}</span>
                              <span className="text-muted-foreground text-sm">
                                {vehicle?.model}
                              </span>
                              <div className="ml-auto flex items-center gap-2">
                                <Badge variant="secondary">
                                  {vehicleTires.length} pneus
                                </Badge>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleOpenRotationWizard(vehicleId)}
                                  title="Rodízio Visual"
                                >
                                  <ArrowLeftRight className="h-4 w-4 mr-1" />
                                  Rodízio Visual
                                </Button>
                              </div>
                            </div>
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Posição</TableHead>
                                  <TableHead className="min-w-[180px]">Marca/Modelo</TableHead>
                                  <TableHead>Medida</TableHead>
                                  <TableHead>Vida</TableHead>
                                  <TableHead className="text-right">KM Instalação</TableHead>
                                  <TableHead className="text-right">CPK</TableHead>
                                  <TableHead className="w-[100px]">Ações</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {vehicleTires.map((tire) => (
                                  <TableRow key={tire.id}>
                                    <TableCell>
                                      <Badge variant="outline">{tire.current_position}</Badge>
                                    </TableCell>
                                    <TableCell className="font-medium">
                                      {tire.brand} {tire.model}
                                    </TableCell>
                                    <TableCell>{tire.size || "-"}</TableCell>
                                    <TableCell>
                                      <TireLifeBadge lifeCount={tire.life_count} />
                                    </TableCell>
                                    <TableCell className="text-right">
                                      {tire.installation_km?.toLocaleString() || "-"} km
                                    </TableCell>
                                    <TableCell className="text-right text-sm">
                                      {formatCPK(tire.cost, tire.total_km)}
                                    </TableCell>
                                    <TableCell>
                                      <div className="flex gap-1">
                                        <DropdownMenu>
                                          <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon">
                                              <MoreHorizontal className="h-4 w-4" />
                                            </Button>
                                          </DropdownMenuTrigger>
                                          <DropdownMenuContent align="end">
                                            <DropdownMenuItem
                                              onClick={() =>
                                                handleRegisterRotation(tire.id, vehicleId)
                                              }
                                            >
                                              <RotateCcw className="h-4 w-4 mr-2" />
                                              Registrar Rodízio
                                            </DropdownMenuItem>
                                            <DropdownMenuItem
                                              onClick={() => handleOpenReplacement(tire.id, vehicleId)}
                                            >
                                              <RefreshCw className="h-4 w-4 mr-2" />
                                              Substituir Pneu
                                            </DropdownMenuItem>
                                            <DropdownMenuItem
                                              onClick={() => handleOpenHistory(tire)}
                                            >
                                              <History className="h-4 w-4 mr-2" />
                                              Ver Histórico
                                            </DropdownMenuItem>
                                            <DropdownMenuItem
                                              onClick={() => handleUnlinkClick(tire.id)}
                                              className="text-destructive"
                                            >
                                              <Unlink className="h-4 w-4 mr-2" />
                                              Desvincular
                                            </DropdownMenuItem>
                                          </DropdownMenuContent>
                                        </DropdownMenu>
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

      {/* Tire Alerts - Full Width Below */}
      <TireAlertsPanel
        onRegisterRotation={handleRegisterRotation}
        onRegisterReplacement={handleOpenReplacement}
      />

      {/* Assignment Dialog */}
      <TireVehicleAssignment
        open={assignDialogOpen}
        onOpenChange={setAssignDialogOpen}
        tire={selectedTire}
        onSuccess={fetchData}
      />

      {/* Unlink Confirmation */}
      <AlertDialog open={unlinkDialogOpen} onOpenChange={setUnlinkDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desvincular pneu?</AlertDialogTitle>
            <AlertDialogDescription>
              O pneu será removido do veículo e voltará para o estoque.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleUnlink}>Desvincular</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* History Dialog */}
      <TireHistoryDialog
        open={historyDialogOpen}
        onOpenChange={setHistoryDialogOpen}
        tireId={historyTireId}
        tireName={historyTireName}
      />

      {/* Replacement Dialog */}
      <TireReplacementDialog
        open={replacementDialogOpen}
        onOpenChange={setReplacementDialogOpen}
        oldTireId={replacementData.tireId}
        vehicleId={replacementData.vehicleId}
        position={replacementData.position}
        vehiclePlate={replacementData.vehiclePlate}
        onSuccess={fetchData}
      />

      {/* Rotation Wizard */}
      <TireRotationWizard
        open={rotationWizardOpen}
        onOpenChange={setRotationWizardOpen}
        vehicleId={rotationVehicleId}
        vehiclePlate={rotationVehiclePlate}
        onSuccess={fetchData}
      />
    </div>
  );
}
