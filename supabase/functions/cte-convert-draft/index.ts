import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
  );

  try {
    const { draftId } = await req.json();

    if (!draftId) {
      throw new Error('ID do rascunho é obrigatório');
    }

    console.log('Converting draft CT-e to production:', draftId);

    // Get user from JWT
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      throw new Error('Não autorizado');
    }

    // Get user's company_id from profiles
    const { data: userProfile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('company_id')
      .eq('id', user.id)
      .single();

    if (profileError || !userProfile?.company_id) {
      throw new Error('Empresa do usuário não encontrada');
    }

    const companyId = userProfile.company_id;

    // Fetch the draft CT-e
    const { data: draftCte, error: draftError } = await supabaseClient
      .from('cte_documents')
      .select('*')
      .eq('id', draftId)
      .eq('company_id', companyId)
      .eq('is_draft', true)
      .single();

    if (draftError || !draftCte) {
      throw new Error('Rascunho não encontrado ou já foi convertido');
    }

    if (draftCte.status !== 'authorized') {
      throw new Error('Somente rascunhos autorizados em homologação podem ser convertidos');
    }

    // Check if already converted
    const { data: existingConversion } = await supabaseClient
      .from('cte_documents')
      .select('id, cte_number')
      .eq('draft_converted_from', draftId)
      .maybeSingle();

    if (existingConversion) {
      throw new Error(`Este rascunho já foi convertido para o CT-e ${existingConversion.cte_number}`);
    }

    // Return the draft data for the wizard to use
    // The actual emission will be done through the regular cte-issue endpoint
    return new Response(
      JSON.stringify({
        success: true,
        draftData: {
          id: draftCte.id,
          operationType: draftCte.operation_type,
          sender: draftCte.sender_full,
          recipient: draftCte.recipient_full,
          senderAddress: draftCte.sender_address,
          recipientAddress: draftCte.recipient_address,
          senderDocument: draftCte.sender_document,
          recipientDocument: draftCte.recipient_document,
          senderName: draftCte.sender_name,
          recipientName: draftCte.recipient_name,
          cargoInfo: draftCte.cargo_info,
          vehicleInfo: draftCte.vehicle_info,
          driverInfo: draftCte.driver_info,
          taxInfo: draftCte.tax_info,
          freightValue: draftCte.freight_value,
          cfop: draftCte.cfop,
          linkedDocuments: draftCte.linked_documents,
          notes: draftCte.notes,
          journeyId: draftCte.journey_id,
        },
        message: 'Dados do rascunho carregados. Confirme para emitir em produção.',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error: any) {
    console.error('Error in cte-convert-draft function:', error);

    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
