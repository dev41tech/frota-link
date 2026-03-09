import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ASAAS_API_KEY = Deno.env.get('ASAAS_API_KEY');
    if (!ASAAS_API_KEY) {
      throw new Error('ASAAS_API_KEY não configurada');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { company_id } = await req.json();

    if (!company_id) {
      throw new Error('company_id é obrigatório');
    }

    // Fetch company data
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select('*')
      .eq('id', company_id)
      .single();

    if (companyError || !company) {
      throw new Error('Empresa não encontrada');
    }

    // Check if customer already exists in Asaas
    if (company.asaas_customer_id) {
      return new Response(JSON.stringify({ 
        success: true, 
        customer_id: company.asaas_customer_id,
        message: 'Cliente já cadastrado no Asaas' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create customer in Asaas
    const asaasBaseUrl = 'https://api.asaas.com/v3';
    
    const customerData = {
      name: company.name,
      cpfCnpj: company.cnpj.replace(/\D/g, ''),
      email: company.billing_email || company.email,
      phone: company.phone?.replace(/\D/g, ''),
      externalReference: company.id,
      notificationDisabled: false,
    };

    const asaasResponse = await fetch(`${asaasBaseUrl}/customers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'access_token': ASAAS_API_KEY,
      },
      body: JSON.stringify(customerData),
    });

    const asaasResult = await asaasResponse.json();

    if (!asaasResponse.ok) {
      console.error('Asaas error:', asaasResult);
      throw new Error(asaasResult.errors?.[0]?.description || 'Erro ao criar cliente no Asaas');
    }

    // Update company with Asaas customer ID
    const { error: updateError } = await supabase
      .from('companies')
      .update({ 
        asaas_customer_id: asaasResult.id,
        billing_email: customerData.email,
        billing_cpf_cnpj: customerData.cpfCnpj
      })
      .eq('id', company_id);

    if (updateError) {
      console.error('Error updating company:', updateError);
      throw new Error('Erro ao atualizar empresa com dados do Asaas');
    }

    return new Response(JSON.stringify({ 
      success: true, 
      customer_id: asaasResult.id,
      message: 'Cliente criado com sucesso no Asaas'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});