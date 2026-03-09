import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Ambiente de Produção
const NUVEM_FISCAL_BASE_URL = 'https://api.nuvemfiscal.com.br';
const NUVEM_FISCAL_AUTH_URL = 'https://auth.nuvemfiscal.com.br/oauth/token';

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

// Function to register company in Nuvem Fiscal
async function registerCompanyInNuvemFiscal(
  token: string,
  cnpj: string,
  razaoSocial: string,
  endereco?: { logradouro?: string; numero?: string; bairro?: string; codigoMunicipio?: string; cidade?: string; uf?: string; cep?: string }
): Promise<string> {
  const cleanCnpj = cnpj.replace(/\D/g, '');
  
  console.log('Checking if company exists in Nuvem Fiscal:', cleanCnpj);
  
  // First, check if company already exists
  const searchUrl = `${NUVEM_FISCAL_BASE_URL}/empresas/${cleanCnpj}`;
  const searchResponse = await fetch(searchUrl, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  console.log('Company search response:', searchResponse.status);

  if (searchResponse.ok) {
    const { data: searchData } = await safeJsonParse(searchResponse);
    console.log('Company found in Nuvem Fiscal:', searchData);
    // Company exists - return CNPJ as the identifier (Nuvem Fiscal uses CNPJ for API calls)
    return cleanCnpj;
  }

  // Company doesn't exist (404) - create it
  console.log('Company not found, creating new company in Nuvem Fiscal...');

  const createPayload = {
    cpf_cnpj: cleanCnpj,
    nome_razao_social: razaoSocial,
    nome_fantasia: razaoSocial,
    email: 'fiscal@frotalink.com.br',
    endereco: {
      logradouro: endereco?.logradouro || 'Rua Principal',
      numero: endereco?.numero || 'S/N',
      bairro: endereco?.bairro || 'Centro',
      codigo_municipio: endereco?.codigoMunicipio || '4106902',
      cidade: endereco?.cidade || 'Curitiba',
      uf: endereco?.uf || 'PR',
      cep: (endereco?.cep || '80000000').replace(/\D/g, ''),
    },
  };

  console.log('Creating company with payload:', JSON.stringify(createPayload));

  const createResponse = await fetch(`${NUVEM_FISCAL_BASE_URL}/empresas`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(createPayload),
  });

  console.log('Create company response:', createResponse.status);
  const { data: createData } = await safeJsonParse(createResponse);
  console.log('Create company data:', JSON.stringify(createData));

  if (!createResponse.ok) {
    const createDataObj = createData as { error?: { code?: string; message?: string }; message?: string };
    
    // Check if company already exists (422 - common response)
    if (createResponse.status === 422) {
      const errorMsg = createDataObj?.error?.message || createDataObj?.message || '';
      if (errorMsg.toLowerCase().includes('já cadastrad') || errorMsg.toLowerCase().includes('already')) {
        console.log('Company already exists (422), proceeding with CNPJ');
        return cleanCnpj;
      }
    }
    
    // Check for duplicate error in response body
    const errorStr = JSON.stringify(createData).toLowerCase();
    if (errorStr.includes('already exists') || errorStr.includes('já existe') || errorStr.includes('já cadastrad')) {
      console.log('Company already exists (race condition), using CNPJ');
      return cleanCnpj;
    }
    
    const errorMessage = createDataObj?.error?.message || createDataObj?.message || JSON.stringify(createData);
    console.error('Failed to create company:', errorMessage);
    throw new Error(`Erro ao cadastrar empresa na Nuvem Fiscal: ${errorMessage}`);
  }

  console.log('Company created successfully in Nuvem Fiscal');
  return cleanCnpj;
}

// Function to configure CT-e settings for a company
async function configureCTeSettings(token: string, cnpj: string): Promise<void> {
  const cleanCnpj = cnpj.replace(/\D/g, '');
  const cteConfigUrl = `${NUVEM_FISCAL_BASE_URL}/empresas/${cleanCnpj}/cte`;
  
  console.log('Configuring CT-e settings for company:', cleanCnpj);

  const cteConfigResponse = await fetch(cteConfigUrl, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ambiente: 'homologacao',
      CRT: 3,
    }),
  });

  if (!cteConfigResponse.ok) {
    const { data } = await safeJsonParse(cteConfigResponse);
    console.warn('Failed to configure CT-e settings:', data);
    // Non-fatal - continue anyway
  } else {
    console.log('CT-e settings configured successfully');
  }
}

async function uploadCertificateToNuvemFiscal(params: {
  token: string;
  nuvemFiscalCompanyId: string;
  cleanCert: string;
  cleanPassword: string;
}): Promise<{ response: Response; data: unknown; text: string | null }>
{
  const { token, nuvemFiscalCompanyId, cleanCert, cleanPassword } = params;
  const certUrl = `${NUVEM_FISCAL_BASE_URL}/empresas/${nuvemFiscalCompanyId}/certificado`;

  console.log('>>> Uploading certificate to:', certUrl);

  const response = await fetch(certUrl, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      certificado: cleanCert,
      password: cleanPassword,
    }),
  });

  console.log('Nuvem Fiscal certificate status:', response.status, response.statusText);

  const { data, text } = await safeJsonParse(response);
  console.log('Nuvem Fiscal certificate response:', data);
  return { response, data, text };
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

    const { companyId, fileName, fileContent, password } = await req.json();

    if (!companyId) {
      throw new Error('Empresa não informada.');
    }

    // Get user from JWT
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    // Get company data for registration
    const { data: company, error: companyError } = await supabaseClient
      .from('companies')
      .select('cnpj, name, address, city, state, zip_code')
      .eq('id', companyId)
      .single();

    if (companyError || !company) {
      throw new Error('Empresa não encontrada no sistema.');
    }

    // Get OAuth Access Token
    const token = await getNuvemFiscalAccessToken();

    // Get or create cte_settings
    let settings: { id: string; nuvem_fiscal_company_id: string | null } | null = null;
    
    const { data: existingSettings, error: settingsError } = await supabaseClient
      .from('cte_settings')
      .select('id, nuvem_fiscal_company_id')
      .eq('company_id', companyId)
      .maybeSingle();

    if (settingsError) {
      console.error('Error loading cte_settings:', settingsError);
    }

    settings = existingSettings;

    // If no settings or no nuvem_fiscal_company_id, register company first
    let nuvemFiscalCompanyId = settings?.nuvem_fiscal_company_id;
    
    if (!nuvemFiscalCompanyId) {
      console.log('No nuvem_fiscal_company_id found, registering company in Nuvem Fiscal...');
      
      // Register company in Nuvem Fiscal
      nuvemFiscalCompanyId = await registerCompanyInNuvemFiscal(
        token,
        company.cnpj,
        company.name,
        {
          logradouro: company.address,
          cidade: company.city,
          uf: company.state,
          cep: company.zip_code,
        }
      );

      // Configure CT-e settings
      await configureCTeSettings(token, company.cnpj);

      // Save or update cte_settings
      if (settings) {
        const { error: updateError } = await supabaseClient
          .from('cte_settings')
          .update({
            nuvem_fiscal_company_id: nuvemFiscalCompanyId,
            updated_at: new Date().toISOString(),
          })
          .eq('id', settings.id);

        if (updateError) {
          console.error('Error updating cte_settings:', updateError);
        } else {
          console.log('Updated cte_settings with nuvem_fiscal_company_id:', nuvemFiscalCompanyId);
        }
      } else {
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
        } else {
          console.log('Created cte_settings with nuvem_fiscal_company_id:', nuvemFiscalCompanyId);
        }
        
        // Fetch the newly created settings
        const { data: newSettings } = await supabaseClient
          .from('cte_settings')
          .select('id, nuvem_fiscal_company_id')
          .eq('company_id', companyId)
          .maybeSingle();
        
        settings = newSettings;
      }
    }

    console.log('Using nuvem_fiscal_company_id:', nuvemFiscalCompanyId);

    // Upload certificate to Nuvem Fiscal
    console.log('Uploading certificate to Nuvem Fiscal...');

    // Clean base64 header if present
    const rawCert = String(fileContent);
    const cleanCert = rawCert.replace(/^data:.*,/, '');
    
    // Ensure password is a pure string
    const cleanPassword = String(password);

    // Safe debug logs
    console.log('Tamanho da senha:', cleanPassword.length);
    console.log('Inicio do Certificado:', cleanCert.substring(0, 20));

     let certAttempt = await uploadCertificateToNuvemFiscal({
       token,
       nuvemFiscalCompanyId,
       cleanCert,
       cleanPassword,
     });

     // If EmpresaNotFound happens, try to auto-register company and retry once
     if (
       !certAttempt.response.ok &&
       (certAttempt.data as any)?.error?.code === 'EmpresaNotFound'
     ) {
       console.warn('EmpresaNotFound during certificate upload. Attempting to register company and retry.');

       const registeredCompanyId = await registerCompanyInNuvemFiscal(
         token,
         company.cnpj,
         company.name,
         {
           logradouro: company.address,
           cidade: company.city,
           uf: company.state,
           cep: company.zip_code,
         }
       );

       // Persist best-effort so next calls don't repeat
       if (settings?.id) {
         const { error: updateError } = await supabaseClient
           .from('cte_settings')
           .update({
             nuvem_fiscal_company_id: registeredCompanyId,
             updated_at: new Date().toISOString(),
           })
           .eq('id', settings.id);
         if (updateError) console.error('Error updating cte_settings after auto-register:', updateError);
       }

       // Small wait to avoid eventual consistency issues
       await new Promise((r) => setTimeout(r, 600));

       nuvemFiscalCompanyId = registeredCompanyId;
       certAttempt = await uploadCertificateToNuvemFiscal({
         token,
         nuvemFiscalCompanyId,
         cleanCert,
         cleanPassword,
       });
     }

     const { response, data, text } = certAttempt;

     if (text) {
       console.error('Nuvem Fiscal certificate returned non-JSON:', text.substring(0, 200));

       if (response.status === 401 || response.status === 403) {
         throw new Error('Erro de autenticação com a API fiscal. Contate o suporte técnico.');
       }

       throw new Error('Erro ao enviar certificado.');
     }

     if (!response.ok) {
       const errDataObj = data as { message?: string; error?: { code?: string; message?: string } };

       // Handle EmpresaNotFound after retry: show the real reason
       if (errDataObj?.error?.code === 'EmpresaNotFound') {
         throw new Error(errDataObj?.error?.message || 'Empresa não cadastrada na Nuvem Fiscal.');
       }

      // Detect schema/property error
      if (errDataObj?.error?.code === 'InvalidJsonProperty') {
        throw new Error(`Erro de schema na API: ${errDataObj.error.message}. Contate o suporte.`);
      }

      if (response.status === 401 || response.status === 403) {
        throw new Error('Erro de autenticação com a API fiscal. Contate o suporte técnico.');
      }

      // Check for real password errors
      const errorStr = JSON.stringify(data).toLowerCase();
      if (
        errorStr.includes('invalid password') || 
        errorStr.includes('wrong password') ||
        errorStr.includes('senha incorreta') ||
        errorStr.includes('incorrect password')
      ) {
        throw new Error('Senha do certificado incorreta. Verifique e tente novamente.');
      }

      // Extract error message properly
      const msg = errDataObj?.error?.message || errDataObj?.message || JSON.stringify(data);
      throw new Error(`Erro ao enviar certificado: ${msg}`);
    }

    const cert = data as { id?: string; validade?: string };

    // Save certificate info to database
    const expiresAt = cert.validade
      ? new Date(cert.validade).toISOString()
      : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();

    const uploadedAt = new Date().toISOString();

    const { error: dbError } = await supabaseClient
      .from('digital_certificates')
      .insert({
        company_id: companyId,
        certificate_name: fileName,
        nuvem_fiscal_certificate_id: cert.id ?? null,
        expires_at: expiresAt,
        uploaded_at: uploadedAt,
        status: 'active',
        user_id: user.id,
      });

    if (dbError) {
      console.error('Error saving certificate to database:', dbError);
      throw new Error('Certificado enviado, mas falhou ao salvar no sistema.');
    }

    // Update settings with certificate metadata (best-effort)
    if (settings?.id) {
      const { error: updateSettingsError } = await supabaseClient
        .from('cte_settings')
        .update({
          certificate_name: fileName,
          certificate_expires_at: expiresAt,
          updated_at: uploadedAt,
        })
        .eq('id', settings.id);

      if (updateSettingsError) {
        console.error('Error updating cte_settings certificate fields:', updateSettingsError);
        // non-fatal
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Certificate uploaded successfully',
        certificateId: cert.id ?? null,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in certificate-upload function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});