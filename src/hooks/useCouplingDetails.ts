import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { CouplingInfo, VehicleExpenseBreakdown } from './useJourneyProfitDetails';

export function useCouplingDetails(couplingId: string | null, journeyId: string | null) {
  const [coupling, setCoupling] = useState<CouplingInfo | null>(null);
  const [expensesByVehicle, setExpensesByVehicle] = useState<VehicleExpenseBreakdown[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (couplingId && journeyId) {
      fetchCouplingDetails();
    } else {
      setCoupling(null);
      setExpensesByVehicle([]);
    }
  }, [couplingId, journeyId]);

  const fetchCouplingDetails = async () => {
    if (!couplingId || !journeyId) return;

    setLoading(true);
    try {
      // Buscar dados do coupling
      const { data: couplingData } = await (supabase as any)
        .from('vehicle_couplings')
        .select('id, truck_id, coupling_type')
        .eq('id', couplingId)
        .single();

      if (!couplingData) {
        setLoading(false);
        return;
      }

      // Buscar itens do coupling (carretas)
      const { data: couplingItems } = await (supabase as any)
        .from('vehicle_coupling_items')
        .select('trailer_id, position')
        .eq('coupling_id', couplingId);

      const trailerIds = (couplingItems || []).map((i: any) => i.trailer_id).filter(Boolean);

      // Buscar dados dos veículos (cavalo e carretas)
      const allVehicleIds = [couplingData.truck_id, ...trailerIds].filter(Boolean);
      
      const { data: vehiclesData } = await (supabase as any)
        .from('vehicles')
        .select('id, plate, model, vehicle_type')
        .in('id', allVehicleIds);

      const vehiclesMap = new Map<string, { id: string; plate: string; model: string | null; vehicle_type: string }>(
        (vehiclesData || []).map((v: any) => [v.id, v])
      );

      // Construir info do coupling
      const trailers = (couplingItems || [])
        .filter((i: any) => i.trailer_id)
        .map((item: any) => {
          const trailer = vehiclesMap.get(item.trailer_id);
          return {
            id: item.trailer_id,
            plate: trailer?.plate || '-',
            model: trailer?.model || null,
            position: item.position || 1,
          };
        })
        .sort((a: any, b: any) => a.position - b.position);

      const couplingInfo: CouplingInfo = {
        id: couplingData.id,
        type: couplingData.coupling_type || 'simple',
        trailers,
      };

      setCoupling(couplingInfo);

      // Buscar despesas da jornada agrupadas por vehicle_id
      const { data: expensesData } = await (supabase as any)
        .from('expenses')
        .select('vehicle_id, amount, category')
        .eq('journey_id', journeyId);

      // Buscar combustível da jornada
      const { data: fuelData } = await (supabase as any)
        .from('fuel_expenses')
        .select('vehicle_id, total_amount')
        .eq('journey_id', journeyId);

      // Agrupar despesas por veículo
      const vehicleExpenses = new Map<string, { fuel: number; toll: number; maintenance: number; other: number }>();

      // Inicializar todos os veículos do conjunto
      allVehicleIds.forEach((vid: string) => {
        vehicleExpenses.set(vid, { fuel: 0, toll: 0, maintenance: 0, other: 0 });
      });

      // Processar despesas - manutenção vai para o veículo específico
      (expensesData || []).forEach((exp: any) => {
        const vid = exp.vehicle_id || couplingData.truck_id; // Sem veículo = cavalo
        const current = vehicleExpenses.get(vid) || { fuel: 0, toll: 0, maintenance: 0, other: 0 };
        
        const category = (exp.category || '').toLowerCase();
        if (category.includes('pedágio') || category.includes('pedagio')) {
          // Pedágio 100% para o cavalo
          const truckCurrent = vehicleExpenses.get(couplingData.truck_id) || { fuel: 0, toll: 0, maintenance: 0, other: 0 };
          truckCurrent.toll += exp.amount || 0;
          vehicleExpenses.set(couplingData.truck_id, truckCurrent);
        } else if (category.includes('manutenção') || category.includes('manutencao') || category.includes('pneu') || category.includes('borracharia')) {
          current.maintenance += exp.amount || 0;
          vehicleExpenses.set(vid, current);
        } else {
          current.other += exp.amount || 0;
          vehicleExpenses.set(vid, current);
        }
      });

      // Combustível 100% para o cavalo
      (fuelData || []).forEach((f: any) => {
        const truckCurrent = vehicleExpenses.get(couplingData.truck_id) || { fuel: 0, toll: 0, maintenance: 0, other: 0 };
        truckCurrent.fuel += f.total_amount || 0;
        vehicleExpenses.set(couplingData.truck_id, truckCurrent);
      });

      // Construir breakdown por veículo
      const breakdowns: VehicleExpenseBreakdown[] = [];

      // Adicionar cavalo primeiro
      const truckData = vehiclesMap.get(couplingData.truck_id);
      const truckExpenses = vehicleExpenses.get(couplingData.truck_id) || { fuel: 0, toll: 0, maintenance: 0, other: 0 };
      breakdowns.push({
        vehicleId: couplingData.truck_id,
        vehiclePlate: truckData?.plate || '-',
        vehicleType: 'truck',
        fuel: truckExpenses.fuel,
        toll: truckExpenses.toll,
        maintenance: truckExpenses.maintenance,
        other: truckExpenses.other,
        total: truckExpenses.fuel + truckExpenses.toll + truckExpenses.maintenance + truckExpenses.other,
      });

      // Adicionar carretas
      trailers.forEach((trailer: any) => {
        const trailerExpenses = vehicleExpenses.get(trailer.id) || { fuel: 0, toll: 0, maintenance: 0, other: 0 };
        breakdowns.push({
          vehicleId: trailer.id,
          vehiclePlate: trailer.plate,
          vehicleType: 'trailer',
          fuel: trailerExpenses.fuel,
          toll: trailerExpenses.toll,
          maintenance: trailerExpenses.maintenance,
          other: trailerExpenses.other,
          total: trailerExpenses.fuel + trailerExpenses.toll + trailerExpenses.maintenance + trailerExpenses.other,
        });
      });

      setExpensesByVehicle(breakdowns);
    } catch (error) {
      console.error('Error fetching coupling details:', error);
    } finally {
      setLoading(false);
    }
  };

  return { coupling, expensesByVehicle, loading, refetch: fetchCouplingDetails };
}
