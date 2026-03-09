import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useMultiTenant } from "@/hooks/useMultiTenant";
import { useToast } from "@/hooks/use-toast";

export interface Vehicle {
  id: string;
  plate: string;
  model: string;
  brand: string;
  year: number;
  status: string;
  vehicle_type: string;
  trailer_type?: string;
  axle_count?: number;
  load_capacity?: number;
}

export interface CouplingItem {
  id: string;
  trailer_id: string;
  position: number;
  trailer?: Vehicle;
}

export interface Coupling {
  id: string;
  company_id: string;
  truck_id: string;
  coupling_type: string;
  coupled_at: string;
  decoupled_at: string | null;
  coupled_by: string | null;
  decoupled_by: string | null;
  notes: string | null;
  truck?: Vehicle;
  items?: CouplingItem[];
}

export interface CouplingHistory {
  id: string;
  coupling_type: string;
  coupled_at: string;
  decoupled_at: string | null;
  trailers: Vehicle[];
  truck?: Vehicle;
}

export interface CreateCouplingInput {
  truck_id: string;
  coupling_type: string;
  trailer_ids: string[];
  notes?: string;
}

export function useVehicleCouplings() {
  const { user } = useAuth();
  const { currentCompany } = useMultiTenant();
  const { toast } = useToast();

  const [activeCouplings, setActiveCouplings] = useState<Coupling[]>([]);
  const [trucks, setTrucks] = useState<Vehicle[]>([]);
  const [trailers, setTrailers] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Get IDs of trucks that are currently coupled
  const coupledTruckIds = activeCouplings.map(c => c.truck_id);
  
  // Get IDs of trailers that are currently coupled
  const coupledTrailerIds = activeCouplings.flatMap(c => 
    c.items?.map(item => item.trailer_id) || []
  );

  // Available trucks (not coupled and active status)
  const availableTrucks = trucks.filter(
    t => !coupledTruckIds.includes(t.id) && t.status === 'active'
  );

  // Available trailers (not coupled and active status)
  const availableTrailers = trailers.filter(
    t => !coupledTrailerIds.includes(t.id) && t.status === 'active'
  );

  const fetchData = useCallback(async () => {
    if (!user || !currentCompany?.id) return;
    
    setLoading(true);
    setError(null);

    try {
      // Fetch all vehicles
      const { data: vehiclesData, error: vehiclesError } = await supabase
        .from("vehicles")
        .select("id, plate, model, brand, year, status, vehicle_type, trailer_type, axle_count, load_capacity")
        .eq("company_id", currentCompany.id)
        .order("plate");

      if (vehiclesError) throw vehiclesError;

      const allVehicles = (vehiclesData || []) as Vehicle[];
      setTrucks(allVehicles.filter(v => v.vehicle_type === 'truck' || v.vehicle_type === 'rigid' || !v.vehicle_type));
      setTrailers(allVehicles.filter(v => v.vehicle_type === 'trailer'));

      // Fetch active couplings with items
      const { data: couplingsData, error: couplingsError } = await supabase
        .from("vehicle_couplings")
        .select("*")
        .eq("company_id", currentCompany.id)
        .is("decoupled_at", null)
        .order("coupled_at", { ascending: false });

      if (couplingsError) throw couplingsError;

      // Fetch coupling items for active couplings
      if (couplingsData && couplingsData.length > 0) {
        const couplingIds = couplingsData.map(c => c.id);
        const { data: itemsData, error: itemsError } = await supabase
          .from("vehicle_coupling_items")
          .select("*")
          .in("coupling_id", couplingIds)
          .order("position");

        if (itemsError) throw itemsError;

        // Map items to couplings
        const couplingsWithItems = couplingsData.map(coupling => {
          const items = (itemsData || [])
            .filter(item => item.coupling_id === coupling.id)
            .map(item => ({
              ...item,
              trailer: allVehicles.find(v => v.id === item.trailer_id)
            }));
          
          return {
            ...coupling,
            truck: allVehicles.find(v => v.id === coupling.truck_id),
            items
          };
        });

        setActiveCouplings(couplingsWithItems);
      } else {
        setActiveCouplings([]);
      }

    } catch (err: any) {
      console.error("Error fetching coupling data:", err);
      setError(err);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os dados de engate.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }, [user, currentCompany?.id, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const createCoupling = async (input: CreateCouplingInput): Promise<boolean> => {
    if (!user || !currentCompany?.id) {
      toast({
        title: "Erro",
        description: "Usuário ou empresa não identificados.",
        variant: "destructive"
      });
      return false;
    }

    try {
      // Validate trailer count based on coupling type
      const requiredTrailers = input.coupling_type === 'simple' ? 1 : input.coupling_type === 'bitrem' ? 2 : 3;
      if (input.trailer_ids.length < 1) {
        throw new Error("Selecione pelo menos uma carreta.");
      }
      if (input.coupling_type === 'bitrem' && input.trailer_ids.length !== 2) {
        throw new Error("Bitrem requer exatamente 2 carretas.");
      }
      if (input.coupling_type === 'rodotrem' && input.trailer_ids.length < 3) {
        throw new Error("Rodotrem requer pelo menos 3 carretas.");
      }

      // Create coupling
      const { data: coupling, error: couplingError } = await supabase
        .from("vehicle_couplings")
        .insert({
          company_id: currentCompany.id,
          truck_id: input.truck_id,
          coupling_type: input.coupling_type,
          coupled_by: user.id,
          notes: input.notes || null
        })
        .select()
        .single();

      if (couplingError) throw couplingError;

      // Create coupling items
      const items = input.trailer_ids.map((trailer_id, index) => ({
        coupling_id: coupling.id,
        trailer_id,
        position: index + 1
      }));

      const { error: itemsError } = await supabase
        .from("vehicle_coupling_items")
        .insert(items);

      if (itemsError) throw itemsError;

      toast({
        title: "Sucesso",
        description: "Conjunto engatado com sucesso!"
      });

      await fetchData();
      return true;

    } catch (err: any) {
      console.error("Error creating coupling:", err);
      toast({
        title: "Erro",
        description: err.message || "Não foi possível criar o engate.",
        variant: "destructive"
      });
      return false;
    }
  };

  const decouple = async (couplingId: string): Promise<boolean> => {
    if (!user) {
      toast({
        title: "Erro",
        description: "Usuário não identificado.",
        variant: "destructive"
      });
      return false;
    }

    try {
      const { error } = await supabase
        .from("vehicle_couplings")
        .update({
          decoupled_at: new Date().toISOString(),
          decoupled_by: user.id
        })
        .eq("id", couplingId);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Veículos desengatados com sucesso!"
      });

      await fetchData();
      return true;

    } catch (err: any) {
      console.error("Error decoupling:", err);
      toast({
        title: "Erro",
        description: err.message || "Não foi possível desengatar os veículos.",
        variant: "destructive"
      });
      return false;
    }
  };

  const getCouplingHistory = async (vehicleId: string): Promise<CouplingHistory[]> => {
    if (!currentCompany?.id) return [];

    try {
      // Find vehicle to determine if it's a truck or trailer
      const vehicle = [...trucks, ...trailers].find(v => v.id === vehicleId);
      if (!vehicle) return [];

      let couplingsData: any[];

      if (vehicle.vehicle_type === 'trailer') {
        // Get couplings where this trailer was used
        const { data: itemsData, error: itemsError } = await supabase
          .from("vehicle_coupling_items")
          .select("coupling_id")
          .eq("trailer_id", vehicleId);

        if (itemsError) throw itemsError;

        const couplingIds = (itemsData || []).map(i => i.coupling_id);
        if (couplingIds.length === 0) return [];

        const { data, error } = await supabase
          .from("vehicle_couplings")
          .select("*")
          .in("id", couplingIds)
          .eq("company_id", currentCompany.id)
          .order("coupled_at", { ascending: false });

        if (error) throw error;
        couplingsData = data || [];
      } else {
        // Get couplings where this truck was used
        const { data, error } = await supabase
          .from("vehicle_couplings")
          .select("*")
          .eq("truck_id", vehicleId)
          .eq("company_id", currentCompany.id)
          .order("coupled_at", { ascending: false });

        if (error) throw error;
        couplingsData = data || [];
      }

      if (couplingsData.length === 0) return [];

      // Fetch all items for these couplings
      const couplingIds = couplingsData.map(c => c.id);
      const { data: allItems, error: itemsError } = await supabase
        .from("vehicle_coupling_items")
        .select("*")
        .in("coupling_id", couplingIds);

      if (itemsError) throw itemsError;

      // Fetch all vehicles involved
      const vehicleIds = new Set<string>();
      couplingsData.forEach(c => vehicleIds.add(c.truck_id));
      (allItems || []).forEach(i => vehicleIds.add(i.trailer_id));

      const { data: vehiclesData, error: vehiclesError } = await supabase
        .from("vehicles")
        .select("id, plate, model, brand, year, status, vehicle_type")
        .in("id", Array.from(vehicleIds));

      if (vehiclesError) throw vehiclesError;

      const vehiclesMap = new Map((vehiclesData || []).map(v => [v.id, v as Vehicle]));

      // Build history
      return couplingsData.map(coupling => {
        const items = (allItems || []).filter(i => i.coupling_id === coupling.id);
        const trailersList = items
          .sort((a, b) => a.position - b.position)
          .map(i => vehiclesMap.get(i.trailer_id))
          .filter(Boolean) as Vehicle[];

        return {
          id: coupling.id,
          coupling_type: coupling.coupling_type,
          coupled_at: coupling.coupled_at,
          decoupled_at: coupling.decoupled_at,
          trailers: trailersList,
          truck: vehiclesMap.get(coupling.truck_id)
        };
      });

    } catch (err: any) {
      console.error("Error fetching coupling history:", err);
      toast({
        title: "Erro",
        description: "Não foi possível carregar o histórico de engates.",
        variant: "destructive"
      });
      return [];
    }
  };

  // Fetch saved couplings
  const [savedCouplings, setSavedCouplings] = useState<any[]>([]);

  const fetchSavedCouplings = useCallback(async () => {
    if (!currentCompany?.id) return;

    try {
      const { data, error } = await supabase
        .from("saved_couplings")
        .select("*")
        .eq("company_id", currentCompany.id)
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setSavedCouplings(data || []);
    } catch (err) {
      console.error("Error fetching saved couplings:", err);
    }
  }, [currentCompany?.id]);

  useEffect(() => {
    fetchSavedCouplings();
  }, [fetchSavedCouplings]);

  const saveCouplingTemplate = async (
    name: string,
    truckId: string,
    couplingType: string,
    trailerIds: string[]
  ): Promise<boolean> => {
    if (!user || !currentCompany?.id) return false;

    try {
      const { error } = await supabase
        .from("saved_couplings")
        .insert({
          company_id: currentCompany.id,
          name,
          truck_id: truckId,
          coupling_type: couplingType,
          trailer_ids: trailerIds,
          created_by: user.id
        });

      if (error) throw error;

      await fetchSavedCouplings();
      return true;
    } catch (err) {
      console.error("Error saving coupling template:", err);
      return false;
    }
  };

  const deleteSavedCoupling = async (savedCouplingId: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from("saved_couplings")
        .update({ is_active: false })
        .eq("id", savedCouplingId);

      if (error) throw error;

      await fetchSavedCouplings();
      return true;
    } catch (err) {
      console.error("Error deleting saved coupling:", err);
      return false;
    }
  };

  // Get the latest coupling for a truck (after creation)
  const getLatestCouplingForTruck = async (truckId: string): Promise<string | null> => {
    if (!currentCompany?.id) return null;

    const { data } = await supabase
      .from("vehicle_couplings")
      .select("id")
      .eq("company_id", currentCompany.id)
      .eq("truck_id", truckId)
      .is("decoupled_at", null)
      .order("coupled_at", { ascending: false })
      .limit(1)
      .single();

    return data?.id || null;
  };

  return {
    activeCouplings,
    trucks,
    trailers,
    availableTrucks,
    availableTrailers,
    coupledTruckIds,
    coupledTrailerIds,
    savedCouplings,
    loading,
    error,
    createCoupling,
    decouple,
    getCouplingHistory,
    saveCouplingTemplate,
    deleteSavedCoupling,
    getLatestCouplingForTruck,
    refetch: fetchData,
    refetchSaved: fetchSavedCouplings
  };
}
