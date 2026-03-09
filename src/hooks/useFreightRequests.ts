import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useMultiTenant } from '@/hooks/useMultiTenant';
import { useStaffAccess } from '@/hooks/useStaffAccess';
import { useToast } from '@/hooks/use-toast';

export interface FreightRequest {
  id: string;
  company_id: string;
  party_id: string;
  token_id: string;
  status: string;
  request_number: string | null;
  nfe_xml_data: any;
  nfe_access_key: string | null;
  nfe_number: string | null;
  origin_city: string | null;
  origin_state: string | null;
  destination_city: string | null;
  destination_state: string | null;
  cargo_weight_kg: number | null;
  cargo_value: number | null;
  cargo_description: string | null;
  vehicle_type_requested: string | null;
  freight_value: number | null;
  freight_rate_id: string | null;
  customer_notes: string | null;
  operator_notes: string | null;
  approved_at: string | null;
  journey_id: string | null;
  cte_document_id: string | null;
  vehicle_id: string | null;
  driver_id: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  party_name?: string;
  vehicle_plate?: string;
  driver_name?: string;
  // Collection fields
  collection_address?: string | null;
  collection_date?: string | null;
  collection_notes?: string | null;
  approved_by_operator_at?: string | null;
}

export function useFreightRequests() {
  const { user } = useAuth();
  const { currentCompany } = useMultiTenant();
  const { staffContext } = useStaffAccess();
  const { toast } = useToast();
  const [requests, setRequests] = useState<FreightRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const companyId = staffContext?.company_id || currentCompany?.id;

  const fetchRequests = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('freight_requests')
        .select(`
          *,
          parties:party_id (name),
          vehicles:vehicle_id (plate),
          drivers:driver_id (name)
        `)
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const mapped = (data || []).map((r: any) => ({
        ...r,
        party_name: r.parties?.name || 'Cliente desconhecido',
        vehicle_plate: r.vehicles?.plate || null,
        driver_name: r.drivers?.name || null,
      }));

      setRequests(mapped);
    } catch (err: any) {
      toast({ title: 'Erro ao carregar solicitações', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [companyId, toast]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const updateRequestStatus = async (requestId: string, status: string, extraFields?: Record<string, any>) => {
    try {
      const { error } = await supabase
        .from('freight_requests')
        .update({ status, ...extraFields })
        .eq('id', requestId);

      if (error) throw error;
      await fetchRequests();
      return true;
    } catch (err: any) {
      toast({ title: 'Erro ao atualizar solicitação', description: err.message, variant: 'destructive' });
      return false;
    }
  };

  const startOperation = async (
    requestId: string,
    vehicleId: string,
    driverId: string,
    request: FreightRequest
  ) => {
    if (!companyId || !user) return false;
    try {
      const originStr = request.collection_address || [request.origin_city, request.origin_state].filter(Boolean).join(' - ');
      const destStr = [request.destination_city, request.destination_state].filter(Boolean).join(' - ');
      const startDate = request.collection_date || new Date().toISOString();
      const journeyNumber = `FR-${Date.now().toString(36).toUpperCase()}`;

      // 1. Create journey
      const { data: journey, error: journeyError } = await supabase
        .from('journeys')
        .insert({
          company_id: companyId,
          user_id: user.id,
          vehicle_id: vehicleId,
          driver_id: driverId,
          origin: originStr,
          destination: destStr,
          freight_value: request.freight_value || 0,
          status: 'planned',
          start_date: startDate,
          journey_number: journeyNumber,
          customer_id: request.party_id,
        })
        .select('id')
        .single();

      if (journeyError) throw journeyError;

      // 2. Create journey leg
      await supabase.from('journey_legs').insert({
        journey_id: journey.id,
        company_id: companyId,
        origin: originStr,
        destination: destStr,
        leg_number: 1,
      });

      // 3. Update freight request
      const { error: updateError } = await supabase
        .from('freight_requests')
        .update({
          status: 'in_operation',
          vehicle_id: vehicleId,
          driver_id: driverId,
          journey_id: journey.id,
        })
        .eq('id', requestId);

      if (updateError) throw updateError;

      // 4. Notificar motorista via chat
      const collectionInfo = request.collection_address || originStr;
      const dateInfo = request.collection_date
        ? new Date(request.collection_date).toLocaleString('pt-BR')
        : 'A definir';

      const notificationMessage = [
        '🚛 Nova jornada criada para você!',
        '',
        `📋 Jornada: ${journeyNumber}`,
        `📍 Coleta: ${collectionInfo}`,
        `📅 Prevista: ${dateInfo}`,
        `🏁 Destino: ${destStr}`,
        '',
        'Verifique os detalhes no seu painel.'
      ].join('\n');

      await supabase.from('driver_messages').insert({
        company_id: companyId,
        driver_id: driverId,
        message: notificationMessage,
        is_from_driver: false,
      });

      await fetchRequests();
      toast({ title: 'Operação iniciada', description: `Jornada criada com sucesso.` });
      return true;
    } catch (err: any) {
      toast({ title: 'Erro ao iniciar operação', description: err.message, variant: 'destructive' });
      return false;
    }
  };

  return {
    requests,
    loading,
    fetchRequests,
    updateRequestStatus,
    startOperation,
    companyId,
  };
}
