import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Ambiente de Produção
const NUVEM_FISCAL_BASE_URL = 'https://api.nuvemfiscal.com.br';
const NUVEM_FISCAL_AUTH_URL = 'https://auth.nuvemfiscal.com.br/oauth/token';

// Helper function for safe JSON parsing
const safeJsonParse = async (response: Response): Promise<{ data: unknown; text: string | null }> => {
  const text = await response.text();
  try {
    return { data: JSON.parse(text), text: null };
  } catch {
    return { data: null, text };
  }
};

// Function to get OAuth Access Token from client_id/client_secret
async function getNuvemFiscalAccessToken(): Promise<string> {
  const clientId = Deno.env.get('NUVEM_FISCAL_CLIENT_ID') ?? '';
  const clientSecret = Deno.env.get('NUVEM_FISCAL_CLIENT_SECRET') ?? '';

  if (!clientId || !clientSecret) {
    console.error('OAuth credentials missing:', { 
      hasClientId: !!clientId, 
      hasClientSecret: !!clientSecret 
    });
    throw new Error('Credenciais Nuvem Fiscal não configuradas. Configure NUVEM_FISCAL_CLIENT_ID e NUVEM_FISCAL_CLIENT_SECRET.');
  }

  console.log('Requesting OAuth token from Nuvem Fiscal...');

  const tokenResponse = await fetch(NUVEM_FISCAL_AUTH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
      scope: 'empresa cte mdfe',
    }),
  });

  console.log('OAuth token response status:', tokenResponse.status);

  if (!tokenResponse.ok) {
    const errorText = await tokenResponse.text();
    console.error('OAuth token request failed:', {
      status: tokenResponse.status,
      statusText: tokenResponse.statusText,
      body: errorText.substring(0, 500),
    });
    
    if (tokenResponse.status === 401) {
      throw new Error('Credenciais Nuvem Fiscal inválidas. Verifique client_id e client_secret.');
    }
    
    throw new Error(`Erro ao obter token OAuth: ${tokenResponse.status} - ${errorText.substring(0, 200)}`);
  }

  const tokenData = await tokenResponse.json();
  
  if (!tokenData.access_token) {
    console.error('OAuth response missing access_token:', tokenData);
    throw new Error('Resposta OAuth inválida: access_token não encontrado.');
  }

  console.log('OAuth token obtained successfully, expires_in:', tokenData.expires_in);
  return tokenData.access_token;
}

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

    const { companyId, cnpj, razaoSocial, endereco, certificateContent, certificatePassword } = await req.json();

    // Get user from JWT
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    // Get OAuth Access Token
    const token = await getNuvemFiscalAccessToken();

    console.log('Registering company in Nuvem Fiscal:', { cnpj, razaoSocial, baseUrl: NUVEM_FISCAL_BASE_URL });

    // Format CNPJ - remove non-numeric characters
    const cleanCnpj = cnpj.replace(/\D/g, '');

    // First, check if company already exists in Nuvem Fiscal
    const searchUrl = `${NUVEM_FISCAL_BASE_URL}/empresas?cpf_cnpj=${cleanCnpj}`;
    console.log('>>> Fetching Nuvem Fiscal API (search):', { url: searchUrl, method: 'GET' });

    const searchResponse = await fetch(searchUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    let nuvemFiscalCompanyId: string | null = null;

    console.log('<<< Nuvem Fiscal search response:', { 
      status: searchResponse.status, 
      statusText: searchResponse.statusText 
    });

    if (searchResponse.ok) {
      const { data: searchData, text: searchText } = await safeJsonParse(searchResponse);
      
      if (searchText) {
        console.error('Nuvem Fiscal search returned non-JSON:', searchText.substring(0, 500));
      } else {
        console.log('Nuvem Fiscal search response data:', JSON.stringify(searchData));
        const searchResult = searchData as { data?: Array<{ id?: string; company_id?: string; cpf_cnpj?: string }> };
        if (searchResult.data && searchResult.data.length > 0) {
          // Company already exists - only accept explicit id or company_id (NO fallback here)
          const firstItem = searchResult.data[0];
          const extractedId = firstItem.id || firstItem.company_id;
          if (extractedId) {
            nuvemFiscalCompanyId = extractedId;
            console.log('Company already exists in Nuvem Fiscal, extracted ID:', nuvemFiscalCompanyId);
          } else {
            // No explicit ID found - force creation flow which has robust recovery
            console.log('API retornou empresa mas sem id/company_id, forçando fluxo de criação para recuperação robusta');
          }
        }
      }
    } else {
      const { data: errorData, text: errorText } = await safeJsonParse(searchResponse);
      console.error('=== Nuvem Fiscal search FAILED ===');
      console.error('Status:', searchResponse.status, searchResponse.statusText);
      console.error('Response body (text):', errorText?.substring(0, 500));
      console.error('Response body (parsed):', errorData);
      
      // Check for authentication errors
      if (searchResponse.status === 401 || searchResponse.status === 403) {
        throw new Error(`Erro de autenticação com a API fiscal (${searchResponse.status}). Verifique as credenciais. Detalhes: ${errorText || JSON.stringify(errorData)}`);
      }
    }

    // If company doesn't exist, create it
    if (!nuvemFiscalCompanyId) {
      console.log('Creating new company in Nuvem Fiscal...');

      const createPayload: Record<string, unknown> = {
        cpf_cnpj: cleanCnpj,
        nome_razao_social: razaoSocial,
        nome_fantasia: razaoSocial,
        email: 'teste@frotalink.com.br', // Email fixo para Sandbox
      };

      // Add address - always include with fallback values for required fields
      createPayload.endereco = {
        logradouro: endereco?.logradouro || 'Rua Teste',
        numero: endereco?.numero || 'S/N',
        bairro: endereco?.bairro || 'Centro',
        codigo_municipio: endereco?.codigoMunicipio || '4106902', // Curitiba como fallback
        cidade: endereco?.cidade || 'Curitiba',
        uf: endereco?.uf || 'PR',
        cep: endereco?.cep?.replace(/\D/g, '') || '80000000',
      };

      const createUrl = `${NUVEM_FISCAL_BASE_URL}/empresas`;
      console.log('>>> Fetching Nuvem Fiscal API (create):', { url: createUrl, method: 'POST', payload: createPayload });

      const createResponse = await fetch(createUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(createPayload),
      });

      console.log('<<< Nuvem Fiscal create response:', { 
        status: createResponse.status, 
        statusText: createResponse.statusText 
      });

      const { data: createData, text: createText } = await safeJsonParse(createResponse);

      if (createText) {
        console.error('=== Nuvem Fiscal create FAILED (non-JSON) ===');
        console.error('Response body:', createText.substring(0, 500));
        
        if (createResponse.status === 401 || createResponse.status === 403) {
          throw new Error(`Erro de autenticação com a API fiscal (${createResponse.status}). Detalhes: ${createText.substring(0, 200)}`);
        }
        throw new Error('Erro ao registrar empresa. Tente novamente ou contate o suporte.');
      }

      console.log('Nuvem Fiscal create response data:', createData);

      if (!createResponse.ok) {
        console.error('=== Nuvem Fiscal create FAILED ===');
        console.error('Response data:', createData);
        
        // Check if company already exists - if so, fetch existing company ID
        const errorStr = JSON.stringify(createData).toLowerCase();
        if (errorStr.includes('empresaalreadyexists') || errorStr.includes('already exists') || errorStr.includes('já existe') || errorStr.includes('cpf_cnpj')) {
          console.log('Company already exists in Nuvem Fiscal, fetching existing ID...');

          // Limpeza do CNPJ: remove pontos, traços e barras
          const cpf_cnpj = String((createPayload as Record<string, unknown>).cpf_cnpj ?? cleanCnpj);
          const cnpjLimpo = cpf_cnpj.replace(/\D/g, '');

          // Busca correta via GET /empresas/{cnpjLimpo}
          const fetchExistingUrl = `${NUVEM_FISCAL_BASE_URL}/empresas/${cnpjLimpo}`;
          console.log('Tentando recuperar empresa via GET:', fetchExistingUrl);

          const existingResponse = await fetch(fetchExistingUrl, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          });

          const { data: existingData, text: existingText } = await safeJsonParse(existingResponse);
          console.log('Resposta da busca:', existingText ?? JSON.stringify(existingData));

          if (!existingResponse.ok) {
            throw new Error(
              `Erro ao buscar empresa existente: ${existingResponse.status} - ${existingText ?? JSON.stringify(existingData)}`
            );
          }

          // Resiliência: se encontrar, pega o id e segue o fluxo normal
          const existingId = (existingData as { id?: string; company_id?: string })?.id ||
            (existingData as { id?: string; company_id?: string })?.company_id;

          if (!existingId) {
            // Alguns endpoints retornam o objeto sem id/company_id; como fallback, usamos o identificador numérico (cnpjLimpo)
            console.log('Empresa encontrada, mas sem id/company_id no payload; usando cnpjLimpo como identificador:', cnpjLimpo);
            nuvemFiscalCompanyId = cnpjLimpo;
          } else {
            nuvemFiscalCompanyId = existingId;
            console.log('Recovered existing company ID:', nuvemFiscalCompanyId);
          }
        } else {
          throw new Error(`Erro ao registrar empresa: ${JSON.stringify(createData, null, 2)}`);
        }
        } else {
          // Sucesso na criação - tentar extrair id ou company_id
          const createResult = createData as { id?: string; company_id?: string; cpf_cnpj?: string };
          const extractedId = createResult.id || createResult.company_id;
          
          if (extractedId) {
            nuvemFiscalCompanyId = extractedId;
            console.log('Company created in Nuvem Fiscal with ID:', nuvemFiscalCompanyId);
          } else {
            // API retornou 200 OK mas sem id/company_id - usar cpf_cnpj como identificador
            const cnpjFromResponse = createResult.cpf_cnpj || cleanCnpj;
            nuvemFiscalCompanyId = cnpjFromResponse.replace(/\D/g, '');
            console.log('Company created but no id in response; using cpf_cnpj as identifier:', nuvemFiscalCompanyId);
          }
        }
    }

    // Validate we have a valid nuvemFiscalCompanyId before saving
    if (!nuvemFiscalCompanyId) {
      throw new Error('Não foi possível obter o ID da empresa na Nuvem Fiscal. Verifique se o CNPJ está correto e tente novamente.');
    }

    console.log('Saving nuvemFiscalCompanyId to database:', nuvemFiscalCompanyId);

    // Save/update settings in database
    const { data: existingSettings } = await supabaseClient
      .from('cte_settings')
      .select('id')
      .eq('company_id', companyId)
      .maybeSingle();

    if (existingSettings) {
      // Update existing settings
      const { error: updateError } = await supabaseClient
        .from('cte_settings')
        .update({
          nuvem_fiscal_company_id: nuvemFiscalCompanyId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingSettings.id);

      if (updateError) {
        console.error('Error updating cte_settings:', updateError);
        throw new Error(`Erro ao atualizar configurações fiscais: ${JSON.stringify(updateError)}`);
      }
      console.log('Updated cte_settings with nuvem_fiscal_company_id:', nuvemFiscalCompanyId);
    } else {
      // Create new settings
      const { error: insertError } = await supabaseClient
        .from('cte_settings')
        .insert({
          company_id: companyId,
          nuvem_fiscal_company_id: nuvemFiscalCompanyId,
          environment: 'homologacao',
          default_series: '1',
          auto_emit_enabled: false,
          user_id: user.id,
        });

      if (insertError) {
        console.error('Error creating cte_settings:', insertError);
        throw new Error(`Erro ao criar configurações fiscais: ${JSON.stringify(insertError)}`);
      }
      console.log('Created cte_settings with nuvem_fiscal_company_id:', nuvemFiscalCompanyId);
    }

    // If certificate content is provided, upload it (after saving settings to guarantee idempotency)
    if (certificateContent && certificatePassword && nuvemFiscalCompanyId) {
      console.log('Uploading certificate to Nuvem Fiscal...');

      // Clean base64 header if present (e.g. data:application/x-pkcs12;base64,....)
      const rawCert = String(certificateContent);
      const cleanCert = rawCert.replace(/^data:.*,/, '');

      // Ensure password is a pure string (no trim/encoding)
      const cleanPassword = String(certificatePassword);

      // Safe debug logs (do NOT log the password itself)
      console.log('Tamanho da senha:', cleanPassword.length);
      console.log('Inicio do Certificado:', cleanCert.substring(0, 20));
      
      // Detect hidden whitespace without modifying the password
      const hasEdgeWhitespace = cleanPassword.length !== cleanPassword.trim().length;
      console.log('Senha tem espaços nas bordas:', hasEdgeWhitespace);

      const certUrl = `${NUVEM_FISCAL_BASE_URL}/empresas/${nuvemFiscalCompanyId}/certificado`;
      console.log('>>> Fetching Nuvem Fiscal API (certificate):', { url: certUrl, method: 'PUT' });

      const certResponse = await fetch(certUrl, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          certificado: cleanCert,
          password: cleanPassword,  // CORRIGIDO: API espera 'password' e não 'senha'
        }),
      });

      console.log('<<< Nuvem Fiscal certificate response:', {
        status: certResponse.status,
        statusText: certResponse.statusText
      });

      const { data: certData, text: certText } = await safeJsonParse(certResponse);

      if (certText) {
        console.error('=== Nuvem Fiscal certificate FAILED (non-JSON) ===');
        console.error('Response body:', certText.substring(0, 500));

        if (certResponse.status === 401 || certResponse.status === 403) {
          throw new Error(`Erro de autenticação com a API fiscal (${certResponse.status}). Detalhes: ${certText.substring(0, 200)}`);
        }

        if (certResponse.status === 400) {
          throw new Error('Certificado inválido ou senha incorreta. Verifique os dados e tente novamente.');
        }
      } else {
        console.log('Nuvem Fiscal certificate response data:', certData);

        if (!certResponse.ok) {
          console.error('=== Nuvem Fiscal certificate FAILED ===');
          console.error('Response data:', certData);
          const errorMsg = JSON.stringify(certData, null, 2);
          const certDataObj = certData as { error?: { code?: string; message?: string } };

          // Detect schema/property error first (don't mask as password error)
          if (certDataObj?.error?.code === 'InvalidJsonProperty') {
            throw new Error(`Erro de schema na API: ${certDataObj.error.message}. Contate o suporte.`);
          }

          // Check for real password errors
          const errorLower = errorMsg.toLowerCase();
          if (
            errorLower.includes('invalid password') || 
            errorLower.includes('wrong password') ||
            errorLower.includes('senha incorreta') ||
            errorLower.includes('incorrect password')
          ) {
            throw new Error('Senha do certificado incorreta. Verifique e tente novamente.');
          }
          
          if (errorLower.includes('expirado') || errorLower.includes('expired')) {
            throw new Error('O certificado digital está expirado.');
          }

          throw new Error(`Erro ao enviar certificado: ${errorMsg}`);
        }
      }
    }

    // Configure CT-e settings via PUT /empresas/{cpf_cnpj}/cte
    console.log('Configuring CT-e settings in Nuvem Fiscal...');
    
    const cteConfigUrl = `${NUVEM_FISCAL_BASE_URL}/empresas/${cleanCnpj}/cte`;
    console.log('>>> Fetching Nuvem Fiscal API (CT-e config):', { url: cteConfigUrl, method: 'PUT' });

    const cteConfigPayload = {
      ambiente: 'homologacao',
      CRT: 3, // Regime Normal (1=Simples Nacional, 2=Simples Excesso, 3=Normal)
    };

    const cteConfigResponse = await fetch(cteConfigUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(cteConfigPayload),
    });

    console.log('<<< Nuvem Fiscal CT-e config response:', {
      status: cteConfigResponse.status,
      statusText: cteConfigResponse.statusText
    });

    const { data: cteConfigData, text: cteConfigText } = await safeJsonParse(cteConfigResponse);

    if (cteConfigText) {
      console.warn('Nuvem Fiscal CT-e config returned non-JSON:', cteConfigText.substring(0, 500));
    } else {
      console.log('Nuvem Fiscal CT-e config response data:', cteConfigData);
    }

    if (!cteConfigResponse.ok) {
      console.error('=== Nuvem Fiscal CT-e config FAILED ===');
      console.error('Response data:', cteConfigData || cteConfigText);
      // Don't throw - this is not critical, the user can try again
      console.warn('CT-e configuration failed but continuing. User may need to reconfigure.');
    } else {
      console.log('CT-e settings configured successfully in Nuvem Fiscal');
    }

    return new Response(
      JSON.stringify({
        success: true,
        nuvemFiscalCompanyId,
        message: 'Company registered successfully in Nuvem Fiscal',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('=== ERROR in nuvem-fiscal-register-company ===');
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: error.stack?.substring(0, 500) 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
