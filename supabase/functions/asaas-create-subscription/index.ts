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

    const { company_id, billing_type = 'BOLETO', next_due_date, value, vehicle_count } = await req.json();

    if (!company_id) {
      throw new Error('company_id é obrigatório');
    }

    // Fetch company data with plan
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select(`
        *,
        subscription_plan:subscription_plans(id, name, monthly_price, price_per_vehicle)
      `)
      .eq('id', company_id)
      .single();

    if (companyError || !company) {
      throw new Error('Empresa não encontrada');
    }

    if (!company.asaas_customer_id) {
      throw new Error('Empresa não possui cliente cadastrado no Asaas. Crie o cliente primeiro.');
    }

    if (!company.subscription_plan) {
      throw new Error('Empresa não possui plano de assinatura');
    }

    // Check if subscription already exists
    if (company.asaas_subscription_id) {
      return new Response(JSON.stringify({ 
        success: true, 
        subscription_id: company.asaas_subscription_id,
        message: 'Assinatura já existe no Asaas' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const asaasBaseUrl = 'https://api.asaas.com/v3';
    
    // Calculate next due date (if not provided, use next month's day 10)
    let dueDate = next_due_date;
    if (!dueDate) {
      const today = new Date();
      const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 10);
      dueDate = nextMonth.toISOString().split('T')[0];
    }

    // Use provided value or calculate from price_per_vehicle * vehicle_count
    const pricePerVehicle = company.subscription_plan.price_per_vehicle || company.subscription_plan.monthly_price;
    const vehicleCountToUse = vehicle_count || 1;
    const subscriptionValue = value || (pricePerVehicle * vehicleCountToUse);

    const subscriptionData = {
      customer: company.asaas_customer_id,
      billingType: billing_type, // BOLETO, PIX, CREDIT_CARD
      value: subscriptionValue,
      nextDueDate: dueDate,
      cycle: 'MONTHLY',
      description: `Assinatura ${company.subscription_plan.name} - ${vehicleCountToUse} placas - ${company.name}`,
      externalReference: company.id,
    };

    const asaasResponse = await fetch(`${asaasBaseUrl}/subscriptions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'access_token': ASAAS_API_KEY,
      },
      body: JSON.stringify(subscriptionData),
    });

    const asaasResult = await asaasResponse.json();

    if (!asaasResponse.ok) {
      console.error('Asaas error:', asaasResult);
      throw new Error(asaasResult.errors?.[0]?.description || 'Erro ao criar assinatura no Asaas');
    }

    // Update company with Asaas subscription ID
    const { error: updateError } = await supabase
      .from('companies')
      .update({ 
        asaas_subscription_id: asaasResult.id,
        subscription_status: 'active',
        next_billing_date: dueDate
      })
      .eq('id', company_id);

    if (updateError) {
      console.error('Error updating company:', updateError);
      throw new Error('Erro ao atualizar empresa com dados da assinatura');
    }

    return new Response(JSON.stringify({ 
      success: true, 
      subscription_id: asaasResult.id,
      next_due_date: dueDate,
      message: 'Assinatura criada com sucesso no Asaas'
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