import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DocumentLookupRequest {
  accessKey: string;
  documentType?: 'nfe' | 'cte';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const { accessKey, documentType } = await req.json() as DocumentLookupRequest;

    console.log(`[Lookup] Starting lookup for key: ${accessKey}`);

    // Validate access key format
    if (!/^\d{44}$/.test(accessKey)) {
      throw new Error('Chave de acesso inválida. Deve ter 44 dígitos numéricos.');
    }

    // Detect document type from key if not provided
    const detectedType = documentType || detectDocumentTypeFromKey(accessKey);
    console.log(`[Lookup] Document type: ${detectedType}`);

    // Get user's company
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('company_id')
      .eq('user_id', user.id)
      .single();

    if (!profile?.company_id) {
      throw new Error('Usuário sem empresa associada');
    }

    // Fetch from Nuvem Fiscal API
    const nuvemFiscalToken = Deno.env.get('NUVEM_FISCAL_TOKEN');
    if (!nuvemFiscalToken) {
      throw new Error('Token da Nuvem Fiscal não configurado');
    }

    const endpoint = detectedType === 'nfe' 
      ? `https://api.nuvemfiscal.com.br/nfe/${accessKey}`
      : `https://api.nuvemfiscal.com.br/cte/${accessKey}`;

    console.log(`[Lookup] Fetching from: ${endpoint}`);

    const response = await fetch(endpoint, {
      headers: {
        'Authorization': `Bearer ${nuvemFiscalToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Lookup] API Error: ${response.status} - ${errorText}`);
      
      if (response.status === 404) {
        throw new Error('Documento não encontrado na SEFAZ');
      }
      throw new Error(`Erro ao consultar SEFAZ: ${response.status}`);
    }

    const documentData = await response.json();
    console.log(`[Lookup] Document fetched successfully`);

    // Extract XML
    const rawXml = documentData.xml || documentData.xml_completo || '';
    
    if (!rawXml) {
      throw new Error('XML não disponível no documento');
    }

    // Parse XML data
    const parsedData = detectedType === 'nfe' 
      ? parseNFeData(rawXml, documentData)
      : parseCTeData(rawXml, documentData);

    // Log the lookup in audit table
    await supabaseClient
      .from('fiscal_document_lookups')
      .insert({
        user_id: user.id,
        company_id: profile.company_id,
        access_key: accessKey,
        document_type: detectedType,
        success: true,
        raw_xml: rawXml,
        parsed_data: parsedData,
      });

    console.log(`[Lookup] Success - Audit log created`);

    return new Response(
      JSON.stringify({
        success: true,
        documentType: detectedType,
        rawXml,
        parsedData,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[Lookup] Error:', error.message);
    
    // Try to log failed lookup
    try {
      const supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        {
          global: {
            headers: { Authorization: req.headers.get('Authorization')! },
          },
        }
      );

      const { data: { user } } = await supabaseClient.auth.getUser();
      if (user) {
        const { data: profile } = await supabaseClient
          .from('profiles')
          .select('company_id')
          .eq('user_id', user.id)
          .single();

        if (profile?.company_id) {
          const { accessKey } = await req.json() as DocumentLookupRequest;
          await supabaseClient
            .from('fiscal_document_lookups')
            .insert({
              user_id: user.id,
              company_id: profile.company_id,
              access_key: accessKey,
              document_type: detectDocumentTypeFromKey(accessKey),
              success: false,
              error_message: error.message,
            });
        }
      }
    } catch (logError) {
      console.error('[Lookup] Failed to log error:', logError);
    }

    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

function detectDocumentTypeFromKey(key: string): 'nfe' | 'cte' {
  // Position 20-21 (mod) in access key indicates document type
  // 55 = NF-e, 57 = CT-e
  const mod = key.substring(20, 22);
  return mod === '57' ? 'cte' : 'nfe';
}

function parseNFeData(xml: string, apiData: any) {
  // Extract data from NF-e
  const infNFe = apiData.nfe?.infNFe || {};
  const emit = infNFe.emit || {};
  const dest = infNFe.dest || {};
  const total = infNFe.total?.ICMSTot || {};
  const transp = infNFe.transp || {};

  const emitterAddress = emit.enderEmit || {};
  const recipientAddress = dest.enderDest || {};

  return {
    emitter: {
      cnpj: emit.CNPJ || '',
      razaoSocial: emit.xNome || '',
      ie: emit.IE || '',
      endereco: {
        logradouro: emitterAddress.xLgr || '',
        numero: emitterAddress.nro || '',
        complemento: emitterAddress.xCpl || '',
        bairro: emitterAddress.xBairro || '',
        municipio: emitterAddress.xMun || '',
        uf: emitterAddress.UF || '',
        cep: emitterAddress.CEP || '',
      },
      uf: emitterAddress.UF || '',
      municipio: emitterAddress.xMun || '',
    },
    recipient: {
      document: dest.CNPJ || dest.CPF || '',
      nome: dest.xNome || '',
      endereco: {
        logradouro: recipientAddress.xLgr || '',
        numero: recipientAddress.nro || '',
        complemento: recipientAddress.xCpl || '',
        bairro: recipientAddress.xBairro || '',
        municipio: recipientAddress.xMun || '',
        uf: recipientAddress.UF || '',
        cep: recipientAddress.CEP || '',
      },
      uf: recipientAddress.UF || '',
      municipio: recipientAddress.xMun || '',
    },
    values: {
      total: parseFloat(total.vNF || '0'),
      icms: parseFloat(total.vICMS || '0'),
    },
    items: (infNFe.det || []).map((item: any) => ({
      descricao: item.prod?.xProd || '',
      quantidade: parseFloat(item.prod?.qCom || '0'),
      valor: parseFloat(item.prod?.vProd || '0'),
    })),
    cfop: infNFe.det?.[0]?.prod?.CFOP || '',
    accessKey: infNFe.Id?.replace('NFe', '') || '',
    suggestedOperationType: 'normal' as const,
    transport: {
      modal: transp.modFrete || '0',
      placa: transp.veicTransp?.placa || '',
    },
  };
}

function parseCTeData(xml: string, apiData: any) {
  // Extract data from CT-e
  const infCte = apiData.cte?.infCte || {};
  const emit = infCte.emit || {};
  const rem = infCte.rem || {};
  const dest = infCte.dest || {};
  const vPrest = infCte.vPrest || {};
  const imp = infCte.imp?.ICMS || {};

  const emitterAddress = emit.enderEmit || {};
  const remAddress = rem.enderReme || {};
  const destAddress = dest.enderDest || {};

  const isSubcontratacao = infCte.ide?.tpCTe === '3';
  const isRedespacho = infCte.ide?.tpServ === '2';

  return {
    emitter: {
      cnpj: emit.CNPJ || '',
      razaoSocial: emit.xNome || '',
      ie: emit.IE || '',
      endereco: {
        logradouro: emitterAddress.xLgr || '',
        numero: emitterAddress.nro || '',
        complemento: emitterAddress.xCpl || '',
        bairro: emitterAddress.xBairro || '',
        municipio: emitterAddress.xMun || '',
        uf: emitterAddress.UF || '',
        cep: emitterAddress.CEP || '',
      },
      uf: emitterAddress.UF || '',
      municipio: emitterAddress.xMun || '',
    },
    recipient: {
      document: dest.CNPJ || dest.CPF || '',
      nome: dest.xNome || '',
      endereco: {
        logradouro: destAddress.xLgr || '',
        numero: destAddress.nro || '',
        complemento: destAddress.xCpl || '',
        bairro: destAddress.xBairro || '',
        municipio: destAddress.xMun || '',
        uf: destAddress.UF || '',
        cep: destAddress.CEP || '',
      },
      uf: destAddress.UF || '',
      municipio: destAddress.xMun || '',
    },
    remetente: {
      document: rem.CNPJ || rem.CPF || '',
      nome: rem.xNome || '',
      endereco: {
        logradouro: remAddress.xLgr || '',
        numero: remAddress.nro || '',
        complemento: remAddress.xCpl || '',
        bairro: remAddress.xBairro || '',
        municipio: remAddress.xMun || '',
        uf: remAddress.UF || '',
        cep: remAddress.CEP || '',
      },
    },
    values: {
      total: parseFloat(vPrest.vTPrest || '0'),
      freight: parseFloat(vPrest.vRec || '0'),
      icms: parseFloat(imp.ICMS00?.vICMS || imp.ICMS20?.vICMS || '0'),
    },
    transport: {
      modal: infCte.ide?.modal || '1',
      tipoServico: infCte.ide?.tpServ || '0',
      rntrc: infCte.infCTeNorm?.infModal?.rodoviario?.RNTRC || '',
      placa: infCte.infCTeNorm?.infModal?.rodoviario?.veic?.placa || '',
    },
    cfop: infCte.ide?.CFOP || '',
    accessKey: infCte.Id?.replace('CTe', '') || '',
    suggestedOperationType: isSubcontratacao ? 'subcontratacao' : isRedespacho ? 'redespacho' : 'normal',
  };
}
