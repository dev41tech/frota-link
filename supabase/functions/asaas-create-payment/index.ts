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

    const { company_id, billing_type = 'BOLETO', due_date, value, description } = await req.json();

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

    const asaasBaseUrl = 'https://api.asaas.com/v3';
    
    // Calculate due date if not provided
    let paymentDueDate = due_date;
    if (!paymentDueDate) {
      const today = new Date();
      const dueDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 7);
      paymentDueDate = dueDay.toISOString().split('T')[0];
    }

    const paymentValue = value || company.subscription_plan?.monthly_price || 0;
    const paymentDescription = description || `Mensalidade ${company.subscription_plan?.name || 'Plano'} - ${company.name}`;

    const paymentData = {
      customer: company.asaas_customer_id,
      billingType: billing_type, // BOLETO, PIX, CREDIT_CARD
      value: paymentValue,
      dueDate: paymentDueDate,
      description: paymentDescription,
      externalReference: company.id,
    };

    const asaasResponse = await fetch(`${asaasBaseUrl}/payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'access_token': ASAAS_API_KEY,
      },
      body: JSON.stringify(paymentData),
    });

    const asaasResult = await asaasResponse.json();

    if (!asaasResponse.ok) {
      console.error('Asaas error:', asaasResult);
      throw new Error(asaasResult.errors?.[0]?.description || 'Erro ao criar cobrança no Asaas');
    }

    // Create invoice record
    const billingPeriodStart = paymentDueDate;
    const billingPeriodEnd = new Date(new Date(paymentDueDate).setMonth(new Date(paymentDueDate).getMonth() + 1)).toISOString().split('T')[0];

    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .insert({
        company_id: company.id,
        plan_id: company.subscription_plan?.id || company.subscription_plan_id,
        amount: paymentValue,
        due_date: paymentDueDate,
        billing_period_start: billingPeriodStart,
        billing_period_end: billingPeriodEnd,
        status: 'pending',
        asaas_payment_id: asaasResult.id,
        asaas_invoice_url: asaasResult.invoiceUrl || asaasResult.bankSlipUrl,
        payment_method: billing_type.toLowerCase(),
        asaas_customer_id: company.asaas_customer_id,
        billing_kind: 'one_time',
      })
      .select()
      .single();

    if (invoiceError) {
      console.error('Error creating invoice:', invoiceError);
    }

    return new Response(JSON.stringify({ 
      success: true, 
      payment_id: asaasResult.id,
      invoice_url: asaasResult.invoiceUrl,
      bank_slip_url: asaasResult.bankSlipUrl,
      pix_qr_code: asaasResult.pixQrCode,
      due_date: paymentDueDate,
      invoice_id: invoice?.id,
      message: 'Cobrança criada com sucesso'
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