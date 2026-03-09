import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface DriverData {
  id: string;
  name: string;
  cpf: string;
  company_id: string;
  auth_user_id: string;
  can_add_revenue: boolean;
  can_start_journey: boolean;
  can_auto_close_journey: boolean;
  can_create_journey_without_approval: boolean;
  assignedVehicles: {
    id: string;
    plate: string;
    model: string;
    brand: string;
  }[];
}

export function useDriverAuth() {
  const [driver, setDriver] = useState<DriverData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDriver, setIsDriver] = useState(false);

  useEffect(() => {
    checkDriverAuth();
  }, []);

  const checkDriverAuth = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        setLoading(false);
        return;
      }

      // Buscar dados do motorista por auth_user_id
      let { data: driverData, error: driverError } = await supabase
        .from('drivers')
        .select('id, name, cpf, company_id, email, auth_user_id, can_add_revenue, can_start_journey, can_auto_close_journey, can_create_journey_without_approval')
        .eq('auth_user_id', user.id)
        .maybeSingle();

      // Fallback: Se não encontrou por auth_user_id, tentar por email
      if (!driverData && user.email) {
        const { data: driverByEmail } = await supabase
          .from('drivers')
          .select('id, name, cpf, company_id, email, auth_user_id, can_add_revenue, can_start_journey, can_auto_close_journey, can_create_journey_without_approval')
          .eq('email', user.email)
          .maybeSingle();

        if (driverByEmail) {
          // Auto-vincular: atualizar auth_user_id automaticamente
          await supabase
            .from('drivers')
            .update({ auth_user_id: user.id })
            .eq('id', driverByEmail.id);

          driverData = driverByEmail;
          console.log('Motorista auto-vinculado por email:', user.email);
        }
      }

      if (!driverData) {
        setIsDriver(false);
        setLoading(false);
        return;
      }

      // Buscar veículos vinculados
      const { data: vehiclesData, error: vehiclesError } = await supabase
        .from('driver_vehicles')
        .select(`
          vehicle_id,
          vehicles:vehicle_id (
            id,
            plate,
            model,
            brand
          )
        `)
        .eq('driver_id', driverData.id)
        .eq('status', 'active');

      if (vehiclesError) {
        console.error('Erro ao buscar veículos:', vehiclesError);
      }

      console.log('Veículos encontrados:', vehiclesData);

      const assignedVehicles = vehiclesData?.map(v => ({
        id: v.vehicles.id,
        plate: v.vehicles.plate,
        model: v.vehicles.model,
        brand: v.vehicles.brand
      })) || [];

      console.log('Veículos atribuídos:', assignedVehicles);

      setDriver({
        ...driverData,
        auth_user_id: driverData.auth_user_id || user.id,
        can_add_revenue: driverData.can_add_revenue ?? false,
        can_start_journey: driverData.can_start_journey ?? true,
        can_auto_close_journey: driverData.can_auto_close_journey ?? false,
        can_create_journey_without_approval: driverData.can_create_journey_without_approval ?? false,
        assignedVehicles
      });
      setIsDriver(true);
    } catch (error) {
      console.error('Erro ao verificar autenticação do motorista:', error);
    } finally {
      setLoading(false);
    }
  };

  return { driver, isDriver, loading, refreshDriver: checkDriverAuth };
}
