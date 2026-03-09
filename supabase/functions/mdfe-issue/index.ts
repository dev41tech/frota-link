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
  let mdfeDocId: string | null = null;

  try {
    const {
      series = '1',
      uf_carregamento,
      municipio_carregamento,
      codigo_municipio_carregamento,
      uf_descarregamento,
      municipios_descarregamento,
      cte_keys = [],
      nfe_keys = [],
      vehicle_plate,
      vehicle_renavam,
      vehicle_uf,
      vehicle_tara,
      vehicle_rntrc,
      driver_name,
      driver_cpf,
      data_viagem,
      total_peso,
      total_valor,
      seguro_responsavel,
      seguro_cnpj,
      seguro_apolice,
      seguro_averbacao,
      ciot,
    } = await req.json();

    console.log('MDF-e Issue request:', { uf_carregamento, uf_descarregamento, cte_keys: cte_keys.length });

    // Validate required fields
    if (!uf_carregamento) {
      throw new Error('UF de carregamento é obrigatório');
    }

    if (!uf_descarregamento || !Array.isArray(uf_descarregamento) || uf_descarregamento.length === 0) {
      throw new Error('UF de descarregamento é obrigatório');
    }

    if (cte_keys.length === 0 && nfe_keys.length === 0) {
      throw new Error('Pelo menos um CT-e ou NF-e deve ser vinculado');
    }

    if (!vehicle_plate) {
      throw new Error('Placa do veículo é obrigatória');
    }

    if (!driver_name || !driver_cpf) {
      throw new Error('Dados do motorista são obrigatórios');
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

    // Get company settings
    const { data: settings, error: settingsError } = await supabaseClient
      .from('cte_settings')
      .select('*')
      .eq('company_id', companyId)
      .single();

    if (settingsError || !settings) {
      throw new Error('Configurações fiscais não encontradas. Configure o emissor fiscal primeiro.');
    }

    // Verify certificate is valid
    const { data: certificate, error: certError } = await supabaseClient
      .from('digital_certificates')
      .select('*')
      .eq('company_id', companyId)
      .eq('status', 'active')
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    if (certError || !certificate) {
      throw new Error('Certificado digital válido não encontrado');
    }

    // Validate CT-e keys
    for (const key of cte_keys) {
      const cleanKey = key.replace(/\D/g, '');
      if (cleanKey.length !== 44) {
        throw new Error(`Chave de CT-e inválida: ${key}. Deve ter 44 dígitos.`);
      }
    }

    // Validate NF-e keys
    for (const key of nfe_keys) {
      const cleanKey = key.replace(/\D/g, '');
      if (cleanKey.length !== 44) {
        throw new Error(`Chave de NF-e inválida: ${key}. Deve ter 44 dígitos.`);
      }
    }

    // Create MDF-e document record
    const { data: mdfeDoc, error: docError } = await supabaseClient
      .from('mdfe_documents')
      .insert({
        company_id: companyId,
        user_id: user.id,
        serie: series,
        uf_start: uf_carregamento,
        uf_end: uf_descarregamento[uf_descarregamento.length - 1],
        vehicle_plate: vehicle_plate.toUpperCase().replace(/[^A-Z0-9]/g, ''),
        driver_cpf: driver_cpf.replace(/\D/g, ''),
        driver_name: driver_name,
        total_value: total_valor || 0,
        total_weight: total_peso || 0,
        status: 'processing',
      })
      .select()
      .single();

    if (docError) {
      throw new Error(`Erro ao criar documento MDF-e: ${docError.message}`);
    }

    mdfeDocId = mdfeDoc.id;

    // Link CT-es to MDF-e
    if (cte_keys.length > 0) {
      const cteLinks = cte_keys.map((key: string) => ({
        mdfe_id: mdfeDoc.id,
        cte_key: key.replace(/\D/g, ''),
      }));

      await supabaseClient.from('mdfe_cte_links').insert(cteLinks);
    }

    // Build Nuvem Fiscal payload
    const nuvemFiscalPayload = {
      ambiente: settings.environment === 'producao' ? 1 : 2,
      empresa: { cpf_cnpj: settings.nuvem_fiscal_company_id },
      serie: parseInt(series) || 1,
      numero: null, // Auto-generate
      
      // Modal rodoviário
      modal: 1,
      tipo_emitente: 1, // Prestador de serviço de transporte
      tipo_transportador: 1, // ETC
      
      // UF inicial e final
      uf_ini: uf_carregamento,
      uf_fim: uf_descarregamento[uf_descarregamento.length - 1],

      // Municípios de carregamento
      inf_mun_carrega: [{
        c_mun_carrega: codigo_municipio_carregamento,
        x_mun_carrega: municipio_carregamento,
      }],

      // Percurso (UFs intermediárias)
      inf_percurso: uf_descarregamento.slice(0, -1).map((uf: string) => ({
        uf_per: uf,
      })),

      // Municípios de descarregamento com documentos
      inf_mun_descarga: municipios_descarregamento.map((mun: any) => ({
        c_mun_descarga: mun.codigo,
        x_mun_descarga: mun.nome,
        inf_cte: cte_keys
          .filter((k: string) => !mun.cte_keys || mun.cte_keys.includes(k))
          .map((key: string) => ({
            ch_cte: key.replace(/\D/g, ''),
          })),
        inf_nfe: nfe_keys
          .filter((k: string) => !mun.nfe_keys || mun.nfe_keys.includes(k))
          .map((key: string) => ({
            ch_nfe: key.replace(/\D/g, ''),
          })),
      })),

      // Veículo de tração
      inf_modal: {
        rodo: {
          inf_antt: {
            rntrc: vehicle_rntrc,
            ...(ciot ? { inf_ciot: [{ ciot: ciot }] } : {}),
          },
          veiculo_tracao: {
            placa: vehicle_plate.toUpperCase().replace(/[^A-Z0-9]/g, ''),
            renavam: vehicle_renavam,
            tara: vehicle_tara || 0,
            uf: vehicle_uf,
            condutor: [{
              x_nome: driver_name,
              cpf: driver_cpf.replace(/\D/g, ''),
            }],
          },
        },
      },

      // Totais
      tot: {
        q_cte: cte_keys.length,
        q_nfe: nfe_keys.length,
        v_carga: total_valor || 0,
        c_unid: '01', // KG
        q_carga: total_peso || 0,
      },

      // Seguro (opcional)
      ...(seguro_responsavel ? {
        seg: [{
          inf_resp: {
            resp_seg: seguro_responsavel,
            ...(seguro_cnpj ? { cnpj: seguro_cnpj.replace(/\D/g, '') } : {}),
          },
          ...(seguro_apolice ? {
            inf_seg: {
              x_seg: 'SEGURO DE CARGA',
              n_apol: seguro_apolice,
            },
          } : {}),
          ...(seguro_averbacao ? { n_aver: seguro_averbacao } : {}),
        }],
      } : {}),
    };

    console.log('Sending to Nuvem Fiscal MDF-e:', JSON.stringify(nuvemFiscalPayload, null, 2));

    // Call Nuvem Fiscal API (Produção)
    const nuvemFiscalResponse = await fetch('https://api.nuvemfiscal.com.br/mdfe', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('NUVEM_FISCAL_TOKEN')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(nuvemFiscalPayload),
    });

    const nuvemFiscalData = await nuvemFiscalResponse.json();

    if (!nuvemFiscalResponse.ok) {
      console.error('Nuvem Fiscal API error:', nuvemFiscalData);
      
      const errorMessage = nuvemFiscalData.message || 
        nuvemFiscalData.error?.message || 
        (nuvemFiscalData.mensagens ? nuvemFiscalData.mensagens.map((m: any) => m.mensagem).join('; ') : 'Erro desconhecido');
      
      // Update MDF-e status to rejected
      await supabaseClient
        .from('mdfe_documents')
        .update({ 
          status: 'rejected',
          updated_at: new Date().toISOString(),
        })
        .eq('id', mdfeDoc.id);

      // Log audit
      await logFiscalAudit(supabaseClient, {
        company_id: companyId!,
        user_id: userId!,
        document_type: 'mdfe',
        document_id: mdfeDoc.id,
        action: 'emit',
        action_status: 'error',
        request_payload: nuvemFiscalPayload,
        response_payload: nuvemFiscalData,
        error_message: errorMessage,
      });

      throw new Error(`Erro na API Nuvem Fiscal: ${errorMessage}`);
    }

    console.log('Nuvem Fiscal MDF-e response:', nuvemFiscalData);

    // Update MDF-e document with response
    await supabaseClient
      .from('mdfe_documents')
      .update({
        nuvem_fiscal_id: nuvemFiscalData.id,
        mdfe_number: nuvemFiscalData.numero?.toString(),
        mdfe_key: nuvemFiscalData.chave,
        status: nuvemFiscalData.status === 'autorizado' ? 'authorized' : (nuvemFiscalData.status || 'processing'),
        emission_date: nuvemFiscalData.data_emissao ? new Date(nuvemFiscalData.data_emissao).toISOString() : new Date().toISOString(),
        xml_content: nuvemFiscalData.xml,
        pdf_url: nuvemFiscalData.url_pdf || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', mdfeDoc.id);

    // Log successful audit
    await logFiscalAudit(supabaseClient, {
      company_id: companyId!,
      user_id: userId!,
      document_type: 'mdfe',
      document_id: mdfeDoc.id,
      document_key: nuvemFiscalData.chave,
      document_number: nuvemFiscalData.numero?.toString(),
      action: 'emit',
      action_status: 'success',
      request_payload: nuvemFiscalPayload,
      response_payload: nuvemFiscalData,
    });

    return new Response(
      JSON.stringify({
        success: true,
        mdfe: {
          id: mdfeDoc.id,
          mdfe_number: nuvemFiscalData.numero,
          mdfe_key: nuvemFiscalData.chave,
          status: nuvemFiscalData.status || 'processing',
          emission_date: nuvemFiscalData.data_emissao,
          xml_content: nuvemFiscalData.xml,
          pdf_url: nuvemFiscalData.url_pdf || null,
          cte_count: cte_keys.length,
          nfe_count: nfe_keys.length,
        },
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error: any) {
    console.error('Error in mdfe-issue function:', error);

    // Log error audit if we have context
    if (companyId && userId) {
      await logFiscalAudit(supabaseClient, {
        company_id: companyId,
        user_id: userId,
        document_type: 'mdfe',
        document_id: mdfeDocId || 'unknown',
        action: 'emit',
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
