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
    const { original_cte_id, cancellation_reason, substitute_cte_key } = await req.json();

    console.log('CT-e Anulação request:', { original_cte_id, cancellation_reason });

    // Validate required fields
    if (!original_cte_id) {
      throw new Error('ID do CT-e original é obrigatório');
    }

    if (!cancellation_reason || cancellation_reason.length < 15) {
      throw new Error('Motivo da anulação deve ter no mínimo 15 caracteres');
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

    // Get original CT-e document
    const { data: originalCTe, error: cteError } = await supabaseClient
      .from('cte_documents')
      .select('*')
      .eq('id', original_cte_id)
      .eq('company_id', companyId)
      .single();

    if (cteError || !originalCTe) {
      throw new Error('CT-e original não encontrado');
    }

    // Validate CT-e status
    if (originalCTe.status !== 'authorized') {
      throw new Error('Apenas CT-e autorizados podem ser anulados');
    }

    // Validate 24-hour window
    const emissionDate = new Date(originalCTe.emission_date);
    const now = new Date();
    const hoursDiff = (now.getTime() - emissionDate.getTime()) / (1000 * 60 * 60);

    if (hoursDiff > 24) {
      throw new Error('CT-e só pode ser anulado em até 24 horas após a emissão');
    }

    // Validate substitute CT-e key if provided
    if (substitute_cte_key) {
      const cleanKey = substitute_cte_key.replace(/\D/g, '');
      if (cleanKey.length !== 44) {
        throw new Error('Chave do CT-e substituto deve ter 44 dígitos');
      }
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

    // Create anulação record
    const { data: anulacaoDoc, error: anulacaoError } = await supabaseClient
      .from('cte_anulacao_documents')
      .insert({
        original_cte_id: original_cte_id,
        company_id: companyId,
        user_id: user.id,
        cancellation_reason: cancellation_reason,
        substitute_cte_key: substitute_cte_key || null,
        serie: originalCTe.series,
        sender_name: originalCTe.sender_name,
        sender_document: originalCTe.sender_document,
        sender_address: originalCTe.sender_address,
        recipient_name: originalCTe.recipient_name,
        recipient_document: originalCTe.recipient_document,
        recipient_address: originalCTe.recipient_address,
        freight_value: originalCTe.freight_value,
        status: 'processing',
      })
      .select()
      .single();

    if (anulacaoError) {
      throw new Error(`Erro ao criar registro de anulação: ${anulacaoError.message}`);
    }

    // Call Nuvem Fiscal API to cancel/annul CT-e
    const nuvemFiscalPayload = {
      justificativa: cancellation_reason,
      ...(substitute_cte_key ? { chave_cte_substituto: substitute_cte_key.replace(/\D/g, '') } : {}),
    };

    console.log('Calling Nuvem Fiscal anulação:', nuvemFiscalPayload);

    const nuvemFiscalResponse = await fetch(
      `https://api.nuvemfiscal.com.br/cte/${originalCTe.nuvem_fiscal_id}/cancelamento`,
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
      
      // Update anulação status to rejected
      await supabaseClient
        .from('cte_anulacao_documents')
        .update({ 
          status: 'rejected',
          updated_at: new Date().toISOString(),
        })
        .eq('id', anulacaoDoc.id);

      // Log audit
      await logFiscalAudit(supabaseClient, {
        company_id: companyId!,
        user_id: userId!,
        document_type: 'cte_anulacao',
        document_id: anulacaoDoc.id,
        action: 'anulacao',
        action_status: 'error',
        request_payload: nuvemFiscalPayload,
        response_payload: nuvemFiscalData,
        error_message: errorMessage,
      });

      throw new Error(`Erro na API Nuvem Fiscal: ${errorMessage}`);
    }

    console.log('Nuvem Fiscal anulação response:', nuvemFiscalData);

    // Update anulação document with response
    await supabaseClient
      .from('cte_anulacao_documents')
      .update({
        nuvem_fiscal_id: nuvemFiscalData.id,
        cte_number: nuvemFiscalData.numero?.toString(),
        cte_key: nuvemFiscalData.chave,
        status: nuvemFiscalData.status === 'autorizado' ? 'authorized' : (nuvemFiscalData.status || 'processing'),
        emission_date: nuvemFiscalData.data_emissao ? new Date(nuvemFiscalData.data_emissao).toISOString() : new Date().toISOString(),
        authorization_date: nuvemFiscalData.data_autorizacao ? new Date(nuvemFiscalData.data_autorizacao).toISOString() : null,
        xml_content: nuvemFiscalData.xml,
        pdf_url: nuvemFiscalData.url_pdf || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', anulacaoDoc.id);

    // Update original CT-e status to cancelled
    await supabaseClient
      .from('cte_documents')
      .update({
        status: 'cancelled',
        cancellation_date: new Date().toISOString(),
        cancellation_reason: cancellation_reason,
        updated_at: new Date().toISOString(),
      })
      .eq('id', original_cte_id);

    // Log successful audit
    await logFiscalAudit(supabaseClient, {
      company_id: companyId!,
      user_id: userId!,
      document_type: 'cte_anulacao',
      document_id: anulacaoDoc.id,
      document_key: nuvemFiscalData.chave,
      document_number: nuvemFiscalData.numero?.toString(),
      action: 'anulacao',
      action_status: 'success',
      request_payload: nuvemFiscalPayload,
      response_payload: nuvemFiscalData,
    });

    return new Response(
      JSON.stringify({
        success: true,
        cte_anulacao: {
          id: anulacaoDoc.id,
          cte_number: nuvemFiscalData.numero,
          cte_key: nuvemFiscalData.chave,
          status: nuvemFiscalData.status || 'processing',
          original_cte_id: original_cte_id,
          original_cte_number: originalCTe.cte_number,
        },
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error: any) {
    console.error('Error in cte-anulacao function:', error);

    // Log error audit if we have context
    if (companyId && userId) {
      await logFiscalAudit(supabaseClient, {
        company_id: companyId,
        user_id: userId,
        document_type: 'cte_anulacao',
        document_id: 'unknown',
        action: 'anulacao',
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
