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

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const { cteId, reason = 'Cancelamento solicitado pelo usuário' } = await req.json();

    console.log('[cte-cancel] Starting cancellation for:', cteId);

    // Get user from JWT
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    // Get CT-e document
    const { data: cte, error: cteError } = await supabaseClient
      .from('cte_documents')
      .select('*')
      .eq('id', cteId)
      .single();

    if (cteError || !cte) {
      throw new Error('CT-e not found');
    }

    if (!cte.nuvem_fiscal_id) {
      throw new Error('CT-e não foi emitido ainda');
    }

    if (cte.status === 'cancelled') {
      throw new Error('CT-e já está cancelado');
    }

    // Determine API URL based on environment
    const environment = cte.environment || 'homologacao';
    const baseUrl = environment === 'producao' 
      ? 'https://api.nuvemfiscal.com.br'
      : 'https://api.sandbox.nuvemfiscal.com.br';

    console.log('[cte-cancel] Using API:', baseUrl, 'environment:', environment);
    console.log('[cte-cancel] Cancelling nuvem_fiscal_id:', cte.nuvem_fiscal_id);

    // Cancel CT-e in Nuvem Fiscal
    const cancelUrl = `${baseUrl}/cte/${cte.nuvem_fiscal_id}/cancelamento`;
    console.log('[cte-cancel] POST to:', cancelUrl);

    const response = await fetch(cancelUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('NUVEM_FISCAL_TOKEN')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        justificativa: reason,
      }),
    });

    // Safely read the response body
    const responseText = await response.text();
    console.log('[cte-cancel] Response status:', response.status);
    console.log('[cte-cancel] Response body:', responseText.substring(0, 500));

    let data: any = null;
    try {
      data = JSON.parse(responseText);
    } catch {
      // Response is not JSON
      console.error('[cte-cancel] Non-JSON response:', responseText);
      throw new Error(`Erro na API Nuvem Fiscal: ${responseText.substring(0, 200)}`);
    }

    if (!response.ok) {
      console.error('[cte-cancel] Nuvem Fiscal error:', data);
      const errorMsg = data?.error?.message || data?.message || data?.error || 'Erro desconhecido';
      throw new Error(`Erro ao cancelar CT-e: ${errorMsg}`);
    }

    // Update CT-e status in database
    const { error: updateError } = await supabaseClient
      .from('cte_documents')
      .update({
        status: 'cancelled',
        cancellation_date: new Date().toISOString(),
        cancellation_reason: reason,
        updated_at: new Date().toISOString(),
      })
      .eq('id', cteId);

    if (updateError) {
      console.error('[cte-cancel] Error updating CT-e status:', updateError);
    }

    console.log('[cte-cancel] CT-e cancelled successfully');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'CT-e cancelado com sucesso',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('[cte-cancel] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 200, // Return 200 to avoid client-side parsing issues
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
