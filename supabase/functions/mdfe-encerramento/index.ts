import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
    const { mdfe_id, uf_encerramento, codigo_municipio_encerramento, municipio_encerramento } = await req.json();

    console.log('MDF-e Encerramento request:', { mdfe_id, uf_encerramento, municipio_encerramento });

    // Validate required fields
    if (!mdfe_id) {
      throw new Error('ID do MDF-e é obrigatório');
    }

    if (!uf_encerramento || !codigo_municipio_encerramento) {
      throw new Error('UF e município de encerramento são obrigatórios');
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

    // Get MDF-e document
    const { data: mdfeDoc, error: mdfeError } = await supabaseClient
      .from('mdfe_documents')
      .select('*')
      .eq('id', mdfe_id)
      .eq('company_id', companyId)
      .single();

    if (mdfeError || !mdfeDoc) {
      throw new Error('MDF-e não encontrado');
    }

    // Validate MDF-e status
    if (mdfeDoc.status !== 'authorized') {
      throw new Error('Apenas MDF-e autorizados podem ser encerrados');
    }

    if (!mdfeDoc.nuvem_fiscal_id) {
      throw new Error('MDF-e não possui ID da Nuvem Fiscal');
    }

    // Build Nuvem Fiscal payload
    const nuvemFiscalPayload = {
      uf: uf_encerramento,
      c_mun: codigo_municipio_encerramento,
    };

    console.log('Calling Nuvem Fiscal encerramento:', nuvemFiscalPayload);

    const nuvemFiscalResponse = await fetch(
      `https://api.nuvemfiscal.com.br/mdfe/${mdfeDoc.nuvem_fiscal_id}/encerramento`,
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
        document_type: 'mdfe',
        document_id: mdfe_id,
        document_key: mdfeDoc.mdfe_key,
        document_number: mdfeDoc.mdfe_number,
        action: 'encerramento',
        action_status: 'error',
        request_payload: nuvemFiscalPayload,
        response_payload: nuvemFiscalData,
        error_message: errorMessage,
      });

      throw new Error(`Erro na API Nuvem Fiscal: ${errorMessage}`);
    }

    console.log('Nuvem Fiscal encerramento response:', nuvemFiscalData);

    // Update MDF-e document
    await supabaseClient
      .from('mdfe_documents')
      .update({
        status: 'closed',
        closure_date: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', mdfe_id);

    // Log successful audit
    await logFiscalAudit(supabaseClient, {
      company_id: companyId!,
      user_id: userId!,
      document_type: 'mdfe',
      document_id: mdfe_id,
      document_key: mdfeDoc.mdfe_key,
      document_number: mdfeDoc.mdfe_number,
      action: 'encerramento',
      action_status: 'success',
      request_payload: nuvemFiscalPayload,
      response_payload: nuvemFiscalData,
    });

    return new Response(
      JSON.stringify({
        success: true,
        encerramento: {
          mdfe_id: mdfe_id,
          mdfe_number: mdfeDoc.mdfe_number,
          mdfe_key: mdfeDoc.mdfe_key,
          protocolo: nuvemFiscalData.protocolo,
          data_encerramento: nuvemFiscalData.data_evento || new Date().toISOString(),
          uf: uf_encerramento,
          municipio: municipio_encerramento,
        },
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error: any) {
    console.error('Error in mdfe-encerramento function:', error);

    // Log error audit if we have context
    if (companyId && userId) {
      await logFiscalAudit(supabaseClient, {
        company_id: companyId,
        user_id: userId,
        document_type: 'mdfe',
        document_id: 'unknown',
        action: 'encerramento',
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
