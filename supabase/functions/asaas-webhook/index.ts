import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Handle health check requests (empty body or GET)
    if (req.method === 'GET') {
      console.log('Health check request received');
      return new Response(JSON.stringify({ status: 'ok', message: 'Webhook endpoint is active' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Parse request body with robust error handling
    let webhook;
    try {
      const body = await req.text();
      
      // Handle empty body (health checks from Asaas)
      if (!body || body.trim() === '') {
        console.log('Empty body received - treating as health check');
        return new Response(JSON.stringify({ received: true, message: 'Empty body - health check' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      webhook = JSON.parse(body);
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      // Return 200 to avoid Asaas retrying
      return new Response(JSON.stringify({ received: true, error: 'Invalid JSON format' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Webhook received:', JSON.stringify(webhook));

    const { event, payment } = webhook;

    // If no event or payment data, just acknowledge
    if (!event || !payment) {
      console.log('No event or payment data in webhook');
      return new Response(JSON.stringify({ received: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Processing event: ${event} for payment: ${payment.id}`);

    // Find invoice by Asaas payment ID
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select('*')
      .eq('asaas_payment_id', payment.id)
      .maybeSingle();

    if (invoiceError) {
      console.error('Error fetching invoice:', invoiceError);
    }

    // If invoice not found by payment ID, try to find by external reference (company_id)
    let companyId = payment.externalReference;
    
    if (!invoice && companyId) {
      console.log(`Invoice not found by payment ID, trying company ID: ${companyId}`);
      
      // This might be a new payment from a subscription
      const { data: company, error: companyError } = await supabase
        .from('companies')
        .select('id, subscription_plan_id')
        .eq('id', companyId)
        .maybeSingle();

      if (companyError) {
        console.error('Error fetching company:', companyError);
      }

      if (company && company.subscription_plan_id) {
        // Create new invoice record (upsert to avoid duplicates)
        const { data: newInvoice, error: createError } = await supabase
          .from('invoices')
          .upsert({
            company_id: company.id,
            plan_id: company.subscription_plan_id,
            amount: payment.value,
            due_date: payment.dueDate,
            billing_period_start: payment.dueDate,
            billing_period_end: new Date(new Date(payment.dueDate).setMonth(new Date(payment.dueDate).getMonth() + 1)).toISOString().split('T')[0],
            status: 'pending',
            asaas_payment_id: payment.id,
            asaas_invoice_url: payment.invoiceUrl || payment.bankSlipUrl,
            payment_method: payment.billingType?.toLowerCase(),
            asaas_customer_id: payment.customer,
            billing_kind: 'subscription',
          }, { onConflict: 'asaas_payment_id', ignoreDuplicates: false })
          .select()
          .single();

        if (createError) {
          console.error('Error creating invoice:', createError);
        } else {
          console.log('New invoice created:', newInvoice.id);
        }
      }
    }

    // Handle different webhook events
    switch (event) {
      case 'PAYMENT_RECEIVED':
      case 'PAYMENT_CONFIRMED':
        console.log(`Payment received/confirmed for payment ${payment.id}`);
        
        if (invoice || companyId) {
          const updateData = {
            status: 'paid',
            paid_date: new Date().toISOString(),
          };

          if (invoice) {
            const { error: updateError } = await supabase
              .from('invoices')
              .update(updateData)
              .eq('id', invoice.id);
            
            if (updateError) {
              console.error('Error updating invoice:', updateError);
            } else {
              console.log(`Invoice ${invoice.id} marked as paid`);
            }
          }

          // Update company subscription status
          const targetCompanyId = invoice?.company_id || companyId;
          if (targetCompanyId) {
            const { error: companyUpdateError } = await supabase
              .from('companies')
              .update({ subscription_status: 'active' })
              .eq('id', targetCompanyId);
            
            if (companyUpdateError) {
              console.error('Error updating company status:', companyUpdateError);
            } else {
              console.log(`Company ${targetCompanyId} subscription status set to active`);
            }
          }
        }
        break;

      case 'PAYMENT_OVERDUE':
        console.log(`Payment overdue for payment ${payment.id}`);
        
        if (invoice) {
          const { error: updateError } = await supabase
            .from('invoices')
            .update({ status: 'overdue' })
            .eq('id', invoice.id);

          if (updateError) {
            console.error('Error updating invoice to overdue:', updateError);
          }

          // Update company subscription status
          const { error: companyUpdateError } = await supabase
            .from('companies')
            .update({ subscription_status: 'overdue' })
            .eq('id', invoice.company_id);

          if (companyUpdateError) {
            console.error('Error updating company status to overdue:', companyUpdateError);
          }
        }
        break;

      case 'PAYMENT_DELETED':
      case 'PAYMENT_REFUNDED':
        console.log(`Payment deleted/refunded for payment ${payment.id}`);
        
        if (invoice) {
          const { error: updateError } = await supabase
            .from('invoices')
            .update({ status: 'cancelled' })
            .eq('id', invoice.id);

          if (updateError) {
            console.error('Error updating invoice to cancelled:', updateError);
          }
        }
        break;

      case 'PAYMENT_CREATED':
        console.log(`New payment created: ${payment.id}`);
        
        if (invoice) {
          const { error: updateError } = await supabase
            .from('invoices')
            .update({ 
              asaas_invoice_url: payment.invoiceUrl || payment.bankSlipUrl,
              payment_method: payment.billingType?.toLowerCase()
            })
            .eq('id', invoice.id);

          if (updateError) {
            console.error('Error updating invoice URL:', updateError);
          }
        }
        break;

      default:
        console.log('Unhandled event type:', event);
    }

    return new Response(JSON.stringify({ received: true, event, paymentId: payment.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Webhook error:', error.message, error.stack);
    // Always return 200 to prevent Asaas from retrying
    return new Response(JSON.stringify({ 
      received: true,
      error: error.message 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});