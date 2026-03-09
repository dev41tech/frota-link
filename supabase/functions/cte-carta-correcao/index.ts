import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Campos permitidos para correção conforme SEFAZ
const ALLOWED_CORRECTION_GROUPS = [
  'infCte/compl',
  'infCte/infCarga',
  'infCte/vPrest',
  'infCte/infDoc',
];

// Log de auditoria fiscal
async function logFiscalAudit(
  supabaseClient: any,
  data: {
    company_id: string;
    user_id: string;
    document_type: string;
    document_id: string;
    document_key?: string;
    document_number?: string;
    action: string;
    action_status: string;
    request_payload?: any;
    response_payload?: any;
    error_message?: string;
  }
) {
  try {
    await supabaseClient.from('fiscal_audit_logs').insert({
      ...data,
      created_at: new Date().toISOString()
    });
  } catch (err) {
    console.error('Failed to log audit:', err);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
  );

  let companyId: string | null = null;
  let userId: string | null = null;

  try {
    const { cte_id, corrections } = await req.json();

    console.log('CT-e Carta de Correção request:', { cte_id, corrections });

    // Validate required fields
    if (!cte_id) {
      throw new Error('ID do CT-e é obrigatório');
    }

    if (!corrections || !Array.isArray(corrections) || corrections.length === 0) {
      throw new Error('Pelo menos uma correção deve ser informada');
    }

    if (corrections.length > 20) {
      throw new Error('Máximo de 20 correções por carta de correção');
    }

    // Validate each correction
    for (const correction of corrections) {
      if (!correction.grupo || !correction.campo || !correction.valor) {
        throw new Error('Cada correção deve ter grupo, campo e valor');
      }
      
      // Check if group is allowed (simplified check)
      const groupValid = ALLOWED_CORRECTION_GROUPS.some(g => correction.grupo.startsWith(g));
      if (!groupValid) {
        throw new Error(`Grupo de correção não permitido: ${correction.grupo}. Grupos permitidos: ${ALLOWED_CORRECTION_GROUPS.join(', ')}`);
      }
    }

    // Get user from JWT
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      throw new Error('Não autorizado');
    }
    userId = user.id;

    // Get user's company_id from profiles
    const { data: userProfile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('company_id')
      .eq('id', user.id)
      .single();

    if (profileError || !userProfile?.company_id) {
      throw new Error('Empresa do usuário não encontrada');
    }
    companyId = userProfile.company_id;

    // Get CT-e document
    const { data: cteDoc, error: cteError } = await supabaseClient
      .from('cte_documents')
      .select('*')
      .eq('id', cte_id)
      .eq('company_id', companyId)
      .single();

    if (cteError || !cteDoc) {
      throw new Error('CT-e não encontrado');
    }

    // Validate CT-e status
    if (cteDoc.status !== 'authorized') {
      throw new Error('Carta de correção só pode ser emitida para CT-e autorizado');
    }

    if (!cteDoc.nuvem_fiscal_id) {
      throw new Error('CT-e não possui ID da Nuvem Fiscal');
    }

    // Get company settings
    const { data: settings, error: settingsError } = await supabaseClient
      .from('cte_settings')
      .select('*')
      .eq('company_id', companyId)
      .single();

    if (settingsError || !settings) {
      throw new Error('Configurações de CT-e não encontradas');
    }

    // Build Nuvem Fiscal payload
    const nuvemFiscalPayload = {
      correcoes: corrections.map((c: any, index: number) => ({
        grupo_alterado: c.grupo,
        campo_alterado: c.campo,
        valor_alterado: c.valor,
        numero_item: index + 1,
      })),
    };

    console.log('Calling Nuvem Fiscal carta de correção:', nuvemFiscalPayload);

    const nuvemFiscalResponse = await fetch(
      `https://api.nuvemfiscal.com.br/cte/${cteDoc.nuvem_fiscal_id}/carta-correcao`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${Deno.env.get('NUVEM_FISCAL_TOKEN')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(nuvemFiscalPayload),
      }
    );

    const nuvemFiscalData = await nuvemFiscalResponse.json();

    if (!nuvemFiscalResponse.ok) {
      console.error('Nuvem Fiscal API error:', nuvemFiscalData);
      
      const errorMessage = nuvemFiscalData.message || 
        nuvemFiscalData.error?.message || 
        (nuvemFiscalData.mensagens ? nuvemFiscalData.mensagens.map((m: any) => m.mensagem).join('; ') : 'Erro desconhecido');

      // Log audit
      await logFiscalAudit(supabaseClient, {
        company_id: companyId!,
        user_id: userId!,
        document_type: 'cte',
        document_id: cte_id,
        document_key: cteDoc.cte_key,
        document_number: cteDoc.cte_number,
        action: 'carta_correcao',
        action_status: 'error',
        request_payload: nuvemFiscalPayload,
        response_payload: nuvemFiscalData,
        error_message: errorMessage,
      });

      throw new Error(`Erro na API Nuvem Fiscal: ${errorMessage}`);
    }

    console.log('Nuvem Fiscal carta de correção response:', nuvemFiscalData);

    // Log successful audit
    await logFiscalAudit(supabaseClient, {
      company_id: companyId!,
      user_id: userId!,
      document_type: 'cte',
      document_id: cte_id,
      document_key: cteDoc.cte_key,
      document_number: cteDoc.cte_number,
      action: 'carta_correcao',
      action_status: 'success',
      request_payload: nuvemFiscalPayload,
      response_payload: nuvemFiscalData,
    });

    return new Response(
      JSON.stringify({
        success: true,
        carta_correcao: {
          cte_id: cte_id,
          cte_number: cteDoc.cte_number,
          cte_key: cteDoc.cte_key,
          protocolo: nuvemFiscalData.protocolo,
          data_evento: nuvemFiscalData.data_evento,
          status: nuvemFiscalData.status,
          xml: nuvemFiscalData.xml,
        },
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error: any) {
    console.error('Error in cte-carta-correcao function:', error);

    // Log error audit if we have context
    if (companyId && userId) {
      await logFiscalAudit(supabaseClient, {
        company_id: companyId,
        user_id: userId,
        document_type: 'cte',
        document_id: 'unknown',
        action: 'carta_correcao',
        action_status: 'error',
        error_message: error.message,
      });
    }

    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
