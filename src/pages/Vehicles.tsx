import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useMultiTenant } from "@/hooks/useMultiTenant";
import { usePlanFeatures } from "@/hooks/usePlanFeatures";
import { usePlanFeaturesContext } from "@/contexts/PlanFeaturesContext";
import { useVehicleCouplings } from "@/hooks/useVehicleCouplings";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Plus, Search, Loader2, Car, FileText, ShieldCheck, Download, AlertTriangle, Info, Truck, Container, Link2, Ban, Power, Lock } from "lucide-react";
import { UpgradePrompt } from "@/components/subscription/UpgradePrompt";
import { useToast } from "@/hooks/use-toast";
import { useVehicleConsumption } from "@/hooks/useVehicleConsumption";
import { inferAxleConfig } from "@/lib/vehicleUtils";

// Components
import { VehicleImport } from "@/components/vehicles/VehicleImport";
import { VehicleBulkUpdate } from "@/components/vehicles/VehicleBulkUpdate";
import { TrucksList } from "@/components/vehicles/TrucksList";
import { TrailersList } from "@/components/vehicles/TrailersList";
import { ActiveCouplingsList } from "@/components/vehicles/ActiveCouplingsList";
import { CouplingWizard } from "@/components/vehicles/CouplingWizard";
import FleetConsumptionOverview from "@/components/vehicles/FleetConsumptionOverview";
import FleetValuationOverview from "@/components/vehicles/FleetValuationOverview";
interface Vehicle {
  id: string;
  plate: string;
  model: string;
  brand: string;
  year: number;
  chassis: string;
  renavam: string;
  fuel_type: string;
  tank_capacity: number;
  avg_consumption: number;
  status: string;
  purchase_date: string;
  purchase_value: number;
  current_value: number;
  insurance_company: string;
  insurance_policy: string;
  insurance_expiry: string;
  vehicle_type?: string;
  trailer_type?: string;
  axle_count?: number;
  load_capacity?: number;
}

export default function Vehicles() {
  const { user } = useAuth();
  const { currentCompany } = useMultiTenant();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: consumptionData } = useVehicleConsumption();
  const { vehicleLimit, vehicleCount, isAtLimit } = usePlanFeatures();
  const { hasCouplingModule, planName } = usePlanFeaturesContext();
  
  // Coupling data
  const {
    activeCouplings,
    trucks,
    trailers,
    availableTrucks,
    availableTrailers,
    coupledTruckIds,
    coupledTrailerIds,
    loading: couplingsLoading,
    createCoupling,
    decouple,
    refetch: refetchCouplings
  } = useVehicleCouplings();

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [originalPlate, setOriginalPlate] = useState("");
  const [showPlateWarning, setShowPlateWarning] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("trucks");

  const [formData, setFormData] = useState({
    plate: "",
    model: "",
    brand: "",
    year: "",
    chassis: "",
    renavam: "",
    fuel_type: "diesel",
    tank_capacity: "",
    avg_consumption: "",
    status: "active",
    purchase_date: "",
    purchase_value: "",
    current_value: "",
    insurance_company: "",
    insurance_policy: "",
    insurance_expiry: "",
    vehicle_type: "truck",
    trailer_type: "",
    axle_count: "",
    load_capacity: "",
  });

  useEffect(() => {
    if (user && currentCompany?.id) {
      fetchVehicles();
    }
  }, [user, currentCompany?.id]);

  // Auto-open edit dialog from URL parameter
  useEffect(() => {
    const vehicleId = searchParams.get('id');
    if (vehicleId && vehicles.length > 0 && !loading) {
      const vehicle = vehicles.find(v => v.id === vehicleId);
      if (vehicle) {
        handleEdit(vehicle);
        searchParams.delete('id');
        setSearchParams(searchParams, { replace: true });
      }
    }
  }, [vehicles, loading, searchParams]);

  const fetchVehicles = async () => {
    try {
      const { data, error } = await supabase
        .from("vehicles")
        .select("*")
        .eq("company_id", currentCompany?.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setVehicles(data || []);
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // Track the last searched plate to avoid unnecessary lookups
  const [lastSearchedPlate, setLastSearchedPlate] = useState("");

  const lookupPlate = async (manual = false) => {
    const cleanPlate = formData.plate.replace(/[^a-zA-Z0-9]/g, "");

    if (cleanPlate.length < 7) {
      if (manual) {
        toast({ title: "Atenção", description: "Digite a placa completa.", variant: "destructive" });
      }
      return;
    }

    // Skip automatic lookup if already searched or if saving
    if (!manual && (cleanPlate === lastSearchedPlate || saving)) {
      return;
    }

    setLookupLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("smooth-processor", {
        body: { plate: cleanPlate },
      });

      if (error) {
        let msg = error.message;
        try {
          const body = await error.context.json();
          if (body && body.error) msg = body.error;
        } catch (e) {}
        throw new Error(msg);
      }

      if (!data || data.error) {
        throw new Error(data?.error || "Veículo não encontrado.");
      }

      if (data.marca) {
        let fipeValue = "";
        if (data.fipe_valor) {
          fipeValue = data.fipe_valor.replace("R$ ", "").replace(/\./g, "").replace(",", ".");
        }

        let fuel = "diesel";
        const apiFuel = (data.combustivel || "").toLowerCase();
        if (apiFuel.includes("flex") || apiFuel.includes("gasolina")) fuel = "gasoline";
        else if (apiFuel.includes("etanol")) fuel = "ethanol";
        else if (apiFuel.includes("eletrico")) fuel = "electric";

        // Infer axle count from model (e.g., "6X4" -> 3 axles)
        const modelStr = data.modelo || "";
        const axleConfig = inferAxleConfig(modelStr);
        const inferredAxles = axleConfig.totalAxles;

        setFormData((prev) => ({
          ...prev,
          brand: data.marca,
          model: data.modelo,
          year: data.ano,
          chassis: data.chassis || prev.chassis,
          renavam: data.renavam || prev.renavam,
          current_value: fipeValue || prev.current_value,
          fuel_type: fuel,
          axle_count: inferredAxles.toString(),
        }));

        setLastSearchedPlate(cleanPlate);

        const axleDescription = axleConfig.description ? ` (${axleConfig.description})` : "";
        toast({ 
          title: "Sucesso!", 
          description: `${data.marca} ${data.modelo}${axleDescription} - ${inferredAxles} eixos` 
        });
      }
    } catch (error: any) {
      console.error("Erro busca:", error);
      if (manual) {
        toast({
          title: "Falha na busca",
          description: error.message || "Erro ao conectar com o servidor.",
          variant: "destructive",
        });
      }
    } finally {
      setLookupLoading(false);
    }
  };

  const resetForm = () => {
    setLastSearchedPlate(""); // Clear to allow fresh lookup for new vehicles
    setFormData({
      plate: "",
      model: "",
      brand: "",
      year: "",
      chassis: "",
      renavam: "",
      fuel_type: "diesel",
      tank_capacity: "",
      avg_consumption: "",
      status: "active",
      purchase_date: "",
      purchase_value: "",
      current_value: "",
      insurance_company: "",
      insurance_policy: "",
      insurance_expiry: "",
      vehicle_type: activeTab === "trailers" ? "trailer" : "truck",
      trailer_type: "",
      axle_count: "",
      load_capacity: "",
    });
    setEditingVehicle(null);
  };

  const handleEdit = (vehicle: Vehicle) => {
    setEditingVehicle(vehicle);
    setOriginalPlate(vehicle.plate);
    setShowPlateWarning(false);
    
    // Sync lastSearchedPlate to prevent automatic lookup from overwriting existing data
    const cleanPlate = vehicle.plate.replace(/[^a-zA-Z0-9]/g, "");
    setLastSearchedPlate(cleanPlate);
    
    setFormData({
      plate: vehicle.plate,
      model: vehicle.model,
      brand: vehicle.brand || "",
      year: vehicle.year?.toString() || "",
      chassis: vehicle.chassis || "",
      renavam: vehicle.renavam || "",
      fuel_type: vehicle.fuel_type,
      tank_capacity: vehicle.tank_capacity?.toString() || "",
      avg_consumption: vehicle.avg_consumption?.toString() || "",
      status: vehicle.status,
      purchase_date: vehicle.purchase_date || "",
      purchase_value: vehicle.purchase_value?.toString() || "",
      current_value: vehicle.current_value?.toString() || "",
      insurance_company: vehicle.insurance_company || "",
      insurance_policy: vehicle.insurance_policy || "",
      insurance_expiry: vehicle.insurance_expiry || "",
      vehicle_type: vehicle.vehicle_type || "truck",
      trailer_type: vehicle.trailer_type || "",
      axle_count: vehicle.axle_count?.toString() || "",
      load_capacity: vehicle.load_capacity?.toString() || "",
    });
    setDialogOpen(true);
  };

  const handlePlateChange = (newPlate: string) => {
    const upperPlate = newPlate.toUpperCase();
    setFormData((prev) => ({ ...prev, plate: upperPlate }));
    
    // Show warning only when editing an existing vehicle and plate is different
    if (editingVehicle && originalPlate && upperPlate !== originalPlate) {
      setShowPlateWarning(true);
    } else {
      setShowPlateWarning(false);
    }
  };

  const handleInactivate = async (vehicle: Vehicle) => {
    try {
      const { error } = await supabase
        .from("vehicles")
        .update({ status: "inactive" })
        .eq("id", vehicle.id);

      if (error) throw error;
      
      toast({ 
        title: "Veículo inativado", 
        description: `O veículo ${vehicle.plate} foi inativado. O histórico foi mantido.` 
      });
      fetchVehicles();
      refetchCouplings();
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    }
  };

  const handleReactivate = async (vehicle: Vehicle) => {
    try {
      const { error } = await supabase
        .from("vehicles")
        .update({ status: "active" })
        .eq("id", vehicle.id);

      if (error) throw error;
      
      toast({ 
        title: "Veículo reativado", 
        description: `O veículo ${vehicle.plate} está ativo novamente.` 
      });
      fetchVehicles();
      refetchCouplings();
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const tankCapacity = parseFloat(formData.tank_capacity) || null;
      
      const vehicleData: any = {
        user_id: user?.id,
        company_id: currentCompany?.id,
        plate: formData.plate,
        model: formData.model,
        brand: formData.brand,
        year: parseInt(formData.year) || null,
        chassis: formData.chassis || null,
        renavam: formData.renavam || null,
        fuel_type: formData.fuel_type,
        tank_capacity: tankCapacity,
        avg_consumption: parseFloat(formData.avg_consumption) || null,
        status: formData.status,
        purchase_date: formData.purchase_date || null,
        purchase_value: parseFloat(formData.purchase_value) || null,
        current_value: parseFloat(formData.current_value) || null,
        insurance_company: formData.insurance_company || null,
        insurance_policy: formData.insurance_policy || null,
        insurance_expiry: formData.insurance_expiry || null,
        vehicle_type: formData.vehicle_type,
        trailer_type: formData.vehicle_type === "trailer" ? formData.trailer_type || null : null,
        axle_count: parseInt(formData.axle_count) || null,
        load_capacity: parseFloat(formData.load_capacity) || null,
      };

      if (editingVehicle) {
        // When updating, if tank_capacity is reduced, also ensure current_fuel_level is within bounds
        if (tankCapacity !== null) {
          const { data: currentVehicle } = await supabase
            .from("vehicles")
            .select("current_fuel_level")
            .eq("id", editingVehicle.id)
            .single();
          
          if (currentVehicle && currentVehicle.current_fuel_level > tankCapacity) {
            vehicleData.current_fuel_level = tankCapacity;
          }
        }
        
        const { error } = await supabase.from("vehicles").update(vehicleData).eq("id", editingVehicle.id);
        if (error) throw error;
        toast({ title: "Sucesso", description: "Veículo atualizado!" });
      } else {
        // For new vehicles, always set current_fuel_level to 0
        vehicleData.current_fuel_level = 0;
        const { error } = await supabase.from("vehicles").insert([vehicleData]);
        if (error) throw error;
        toast({ title: "Sucesso", description: "Veículo cadastrado!" });
      }

      setDialogOpen(false);
      resetForm();
      setShowPlateWarning(false);
      fetchVehicles();
      refetchCouplings();
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza?")) return;
    try {
      const { error } = await supabase.from("vehicles").delete().eq("id", id);
      if (error) throw error;
      toast({ title: "Sucesso", description: "Veículo excluído!" });
      fetchVehicles();
      refetchCouplings();
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    }
  };

  const exportVehicles = () => {
    const filteredVehicles = vehicles.filter(
      (v) =>
        v.plate.toLowerCase().includes(searchTerm.toLowerCase()) ||
        v.model.toLowerCase().includes(searchTerm.toLowerCase()),
    );
    
    const dataToExport = filteredVehicles.map((v) => ({
      Tipo: v.vehicle_type === "trailer" ? "Carreta" : "Cavalo",
      Modelo: v.model || "",
      Placa: v.plate || "",
      FIPE: v.current_value ? `R$ ${v.current_value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "",
    }));

    const headers = ["Tipo", "Modelo", "Placa", "FIPE"];
    const csvContent = [
      headers.join(";"),
      ...dataToExport.map((row) => [row.Tipo, row.Modelo, row.Placa, row.FIPE].join(";")),
    ].join("\n");

    const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `veiculos_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);

    toast({ title: "Exportado!", description: `${dataToExport.length} veículos exportados.` });
  };

  // Filter vehicles based on search
  const filteredTrucks = trucks.filter(
    (v) =>
      v.plate.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.model.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const filteredTrailers = trailers.filter(
    (v) =>
      v.plate.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.model.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  if (loading || couplingsLoading || !currentCompany?.id) return <div className="p-6">Carregando...</div>;

  return (
    <div className="p-6 space-y-6 animate-in fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Veículos</h1>
          <p className="text-muted-foreground">Gerencie cavalos, carretas e conjuntos da sua frota</p>
        </div>

        <div className="flex gap-2 w-full md:w-auto flex-wrap">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar placa ou modelo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
            />
          </div>

          <Button variant="outline" onClick={exportVehicles} disabled={vehicles.length === 0}>
            <Download className="h-4 w-4 mr-2" /> Exportar
          </Button>

          <VehicleImport onSuccess={() => { fetchVehicles(); refetchCouplings(); }} userId={user?.id} companyId={currentCompany?.id} />
          
          <VehicleBulkUpdate vehicles={vehicles} onSuccess={fetchVehicles} />

          {/* New Coupling Button */}
          <Button 
            variant="outline" 
            onClick={() => setWizardOpen(true)}
            disabled={!hasCouplingModule || availableTrucks.length === 0 || availableTrailers.length === 0}
            title={!hasCouplingModule ? "Módulo de Engates não habilitado" : undefined}
          >
            <Link2 className="h-4 w-4 mr-2" /> Novo Engate
            {!hasCouplingModule && <Lock className="h-3 w-3 ml-1" />}
          </Button>

          {/* New Vehicle Button */}
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-primary shadow-primary" onClick={resetForm}>
                <Plus className="h-4 w-4 mr-2" /> Novo
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingVehicle ? "Editar Veículo" : "Novo Veículo"}</DialogTitle>
                <DialogDescription>
                  Preencha os dados do veículo. Digite a placa e clique na lupa para buscar dados automáticos.
                </DialogDescription>
              </DialogHeader>

              {!editingVehicle && (
                <>
                  {isAtLimit ? (
                    <Alert variant="destructive" className="mb-4">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        <strong>Limite atingido.</strong> Você já possui {vehicleCount}/{vehicleLimit} veículos cadastrados.
                      </AlertDescription>
                    </Alert>
                  ) : (
                    <Alert className="mb-4">
                      <Info className="h-4 w-4" />
                      <AlertDescription>
                        Veículos: <strong>{vehicleCount}</strong> de <strong>{vehicleLimit === 999 ? 'Ilimitado' : vehicleLimit}</strong>
                      </AlertDescription>
                    </Alert>
                  )}
                </>
              )}

              <form onSubmit={handleSubmit}>
                <Tabs defaultValue="geral" className="w-full">
                  <TabsList className="grid w-full grid-cols-3 mb-4">
                    <TabsTrigger value="geral">
                      <Car className="w-4 h-4 mr-2" />
                      Geral
                    </TabsTrigger>
                    <TabsTrigger value="tecnico">
                      <FileText className="w-4 h-4 mr-2" />
                      Técnico
                    </TabsTrigger>
                    <TabsTrigger value="financeiro">
                      <ShieldCheck className="w-4 h-4 mr-2" />
                      Financeiro
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="geral" className="space-y-4">
                    {/* Vehicle Type Selection */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Tipo de Veículo *</Label>
                        <Select
                          value={formData.vehicle_type}
                          onValueChange={(val) => setFormData((prev) => ({ ...prev, vehicle_type: val }))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="truck">
                              <div className="flex items-center gap-2">
                                <Truck className="h-4 w-4" />
                                Cavalo (Caminhão Trator)
                              </div>
                            </SelectItem>
                            {hasCouplingModule && (
                              <SelectItem value="trailer">
                                <div className="flex items-center gap-2">
                                  <Container className="h-4 w-4" />
                                  Carreta (Reboque)
                                </div>
                              </SelectItem>
                            )}
                            <SelectItem value="rigid">
                              <div className="flex items-center gap-2">
                                <Car className="h-4 w-4" />
                                Truck (Caminhão Comum)
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {formData.vehicle_type === "trailer" && (
                        <div className="space-y-2">
                          <Label>Tipo de Carreta</Label>
                          <Select
                            value={formData.trailer_type}
                            onValueChange={(val) => setFormData((prev) => ({ ...prev, trailer_type: val }))}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="bau">Baú</SelectItem>
                              <SelectItem value="graneleira">Graneleira</SelectItem>
                              <SelectItem value="sider">Sider</SelectItem>
                              <SelectItem value="tanque">Tanque</SelectItem>
                              <SelectItem value="cegonha">Cegonha</SelectItem>
                              <SelectItem value="prancha">Prancha</SelectItem>
                              <SelectItem value="container">Porta-Container</SelectItem>
                              <SelectItem value="dolly">Carreta Dolly</SelectItem>
                              <SelectItem value="basculante">Basculante</SelectItem>
                              <SelectItem value="refrigerada">Refrigerada / Frigorífica</SelectItem>
                              <SelectItem value="silo">Silo</SelectItem>
                              <SelectItem value="boiadeira">Boiadeira</SelectItem>
                              <SelectItem value="canavieira">Canavieira</SelectItem>
                              <SelectItem value="florestal">Florestal / Porta-Toras</SelectItem>
                              <SelectItem value="gaiola">Gaiola</SelectItem>
                              <SelectItem value="extensiva">Extensiva</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>

                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2 relative">
                          <Label>Placa *</Label>
                          <div className="relative flex items-center">
                            <Input
                              value={formData.plate}
                              onChange={(e) => handlePlateChange(e.target.value)}
                              onBlur={() => lookupPlate(false)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  lookupPlate(true);
                                }
                              }}
                              placeholder="ABC1234"
                              maxLength={7}
                              required
                              disabled={lookupLoading}
                              className="pr-10"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                              onClick={() => lookupPlate(true)}
                              disabled={lookupLoading}
                            >
                              {lookupLoading ? (
                                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                              ) : (
                                <Search className="h-4 w-4 text-muted-foreground hover:text-primary transition-colors" />
                              )}
                            </Button>
                          </div>
                          <p className="text-[10px] text-muted-foreground">Tecle ENTER ou clique na lupa</p>
                        </div>

                        <div className="space-y-2">
                          <Label>Modelo *</Label>
                          <Input
                            value={formData.model}
                            onChange={(e) => setFormData((prev) => ({ ...prev, model: e.target.value }))}
                            required
                          />
                        </div>
                      </div>

                      {/* Plate change warning */}
                      {showPlateWarning && (
                        <Alert variant="destructive">
                          <AlertTriangle className="h-4 w-4" />
                          <AlertTitle>Atenção: Alteração de Placa</AlertTitle>
                          <AlertDescription className="text-sm">
                            Ao alterar a placa, todos os relatórios passados, multas e históricos de manutenção também serão atualizados para a nova placa. 
                            <strong> Se você trocou de veículo, use a função "Inativar" e cadastre um novo.</strong>
                          </AlertDescription>
                        </Alert>
                      )}
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>Marca</Label>
                        <Input
                          value={formData.brand}
                          onChange={(e) => setFormData((prev) => ({ ...prev, brand: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Ano</Label>
                        <Input
                          type="number"
                          value={formData.year}
                          onChange={(e) => setFormData((prev) => ({ ...prev, year: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Status</Label>
                        <Select
                          value={formData.status}
                          onValueChange={(val) => setFormData((prev) => ({ ...prev, status: val }))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="active">Ativo</SelectItem>
                            <SelectItem value="inactive">Inativo</SelectItem>
                            <SelectItem value="maintenance">Manutenção</SelectItem>
                            <SelectItem value="sold">Vendido</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="tecnico" className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Chassi</Label>
                        <Input
                          value={formData.chassis}
                          onChange={(e) => setFormData((prev) => ({ ...prev, chassis: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>RENAVAM</Label>
                        <Input
                          value={formData.renavam}
                          onChange={(e) => setFormData((prev) => ({ ...prev, renavam: e.target.value }))}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>Combustível</Label>
                        <Select
                          value={formData.fuel_type}
                          onValueChange={(val) => setFormData((prev) => ({ ...prev, fuel_type: val }))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="diesel">Diesel</SelectItem>
                            <SelectItem value="gasoline">Gasolina</SelectItem>
                            <SelectItem value="ethanol">Etanol</SelectItem>
                            <SelectItem value="hybrid">Híbrido</SelectItem>
                            <SelectItem value="electric">Elétrico</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Tanque (L)</Label>
                        <Input
                          type="number"
                          value={formData.tank_capacity}
                          onChange={(e) => setFormData((prev) => ({ ...prev, tank_capacity: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Média (km/l)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={formData.avg_consumption}
                          onChange={(e) => setFormData((prev) => ({ ...prev, avg_consumption: e.target.value }))}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Quantidade de Eixos</Label>
                        <Select
                          value={formData.axle_count}
                          onValueChange={(val) => setFormData((prev) => ({ ...prev, axle_count: val }))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione..." />
                          </SelectTrigger>
                          <SelectContent>
                            {formData.vehicle_type === "trailer" ? (
                              <>
                                <SelectItem value="2">2 eixos</SelectItem>
                                <SelectItem value="3">3 eixos</SelectItem>
                                <SelectItem value="4">4 eixos</SelectItem>
                                <SelectItem value="5">5 eixos</SelectItem>
                                <SelectItem value="6">6 eixos</SelectItem>
                              </>
                            ) : (
                              <>
                                <SelectItem value="2">2 eixos (4x2)</SelectItem>
                                <SelectItem value="3">3 eixos (6x2 / 6x4)</SelectItem>
                                <SelectItem value="4">4 eixos (8x4)</SelectItem>
                              </>
                            )}
                          </SelectContent>
                        </Select>
                        <p className="text-[10px] text-muted-foreground">
                          Inferido automaticamente pelo modelo. Ajuste se necessário.
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label>Capacidade de Carga (kg)</Label>
                        <Input
                          type="number"
                          value={formData.load_capacity}
                          onChange={(e) => setFormData((prev) => ({ ...prev, load_capacity: e.target.value }))}
                          placeholder="Ex: 25000"
                        />
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="financeiro" className="space-y-4">
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>Data Compra</Label>
                        <Input
                          type="date"
                          value={formData.purchase_date}
                          onChange={(e) => setFormData((prev) => ({ ...prev, purchase_date: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Valor Compra</Label>
                        <Input
                          type="number"
                          value={formData.purchase_value}
                          onChange={(e) => setFormData((prev) => ({ ...prev, purchase_value: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Valor FIPE (Atual)</Label>
                        <Input
                          type="number"
                          value={formData.current_value}
                          onChange={(e) => setFormData((prev) => ({ ...prev, current_value: e.target.value }))}
                        />
                      </div>
                    </div>
                    <div className="border-t pt-4 grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>Seguradora</Label>
                        <Input
                          value={formData.insurance_company}
                          onChange={(e) => setFormData((prev) => ({ ...prev, insurance_company: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Apólice</Label>
                        <Input
                          value={formData.insurance_policy}
                          onChange={(e) => setFormData((prev) => ({ ...prev, insurance_policy: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Vencimento</Label>
                        <Input
                          type="date"
                          value={formData.insurance_expiry}
                          onChange={(e) => setFormData((prev) => ({ ...prev, insurance_expiry: e.target.value }))}
                        />
                      </div>
                    </div>
                  </TabsContent>

                  <div className="flex justify-end space-x-3 mt-4 pt-4 border-t">
                    <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                      Cancelar
                    </Button>
                    <Button 
                      type="submit" 
                      className="bg-gradient-primary" 
                      disabled={saving || (!editingVehicle && isAtLimit)}
                    >
                      {saving ? "Salvando..." : editingVehicle ? "Atualizar" : "Cadastrar"}
                    </Button>
                  </div>
                </Tabs>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Fleet Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FleetConsumptionOverview />
        <FleetValuationOverview />
      </div>

      {/* Main Tabs for Trucks/Trailers/Couplings */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3 max-w-md">
          <TabsTrigger value="trucks" className="flex items-center gap-2">
            <Truck className="h-4 w-4" />
            <span className="hidden sm:inline">Cavalos</span>
            <Badge variant="secondary" className="ml-1">{trucks.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="trailers" className="flex items-center gap-2">
            <Container className="h-4 w-4" />
            <span className="hidden sm:inline">Carretas</span>
            <Badge variant="secondary" className="ml-1">{trailers.length}</Badge>
          </TabsTrigger>
          <TabsTrigger 
            value="couplings" 
            className="flex items-center gap-2"
            disabled={!hasCouplingModule}
          >
            <Link2 className="h-4 w-4" />
            <span className="hidden sm:inline">Engates</span>
            {hasCouplingModule ? (
              <Badge variant="secondary" className="ml-1">{activeCouplings.length}</Badge>
            ) : (
              <Lock className="h-3 w-3 text-muted-foreground" />
            )}
          </TabsTrigger>
        </TabsList>

        <Card className="shadow-card overflow-hidden mt-4">
          <CardContent className="p-0">
            <TabsContent value="trucks" className="m-0">
              <TrucksList
                trucks={filteredTrucks as any}
                activeCouplings={activeCouplings}
                coupledTruckIds={coupledTruckIds}
                onEdit={handleEdit}
                onViewCoupling={(coupling) => {
                  setActiveTab("couplings");
                }}
                onInactivate={handleInactivate}
                onReactivate={handleReactivate}
              />
            </TabsContent>

            <TabsContent value="trailers" className="m-0">
              <TrailersList
                trailers={filteredTrailers as any}
                activeCouplings={activeCouplings}
                coupledTrailerIds={coupledTrailerIds}
                onEdit={handleEdit}
                onInactivate={handleInactivate}
                onReactivate={handleReactivate}
              />
            </TabsContent>

            <TabsContent value="couplings" className="m-0 p-4">
              {hasCouplingModule ? (
                <ActiveCouplingsList
                  couplings={activeCouplings}
                  onDecouple={decouple}
                />
              ) : (
                <div className="p-6">
                  <UpgradePrompt
                    featureName="Gestão de Engates"
                    requiredPlan="Módulo Adicional"
                    currentPlan={planName}
                  />
                </div>
              )}
            </TabsContent>
          </CardContent>
        </Card>
      </Tabs>

      {/* Coupling Wizard */}
      <CouplingWizard
        isOpen={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onSubmit={createCoupling}
        availableTrucks={availableTrucks as any}
        availableTrailers={availableTrailers as any}
      />
    </div>
  );
}
