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

    // Get auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Token de autenticação não fornecido');
    }

    // Verify user is master
    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authError || !user) {
      throw new Error('Usuário não autenticado');
    }

    // Check if user is master
    const { data: userRole, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'master')
      .maybeSingle();

    if (roleError || !userRole) {
      throw new Error('Acesso negado. Apenas usuários master podem cancelar cobranças.');
    }

    const { invoice_id, cancel_in_asaas = true, soft_delete = false } = await req.json();

    if (!invoice_id) {
      throw new Error('invoice_id é obrigatório');
    }

    // Fetch invoice
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select('*')
      .eq('id', invoice_id)
      .single();

    if (invoiceError || !invoice) {
      throw new Error('Fatura não encontrada');
    }

    if (invoice.status === 'paid') {
      throw new Error('Não é possível cancelar uma fatura já paga');
    }

    // Cancel in Asaas if requested and has payment ID
    if (cancel_in_asaas && invoice.asaas_payment_id) {
      const asaasBaseUrl = 'https://api.asaas.com/v3';
      
      const asaasResponse = await fetch(`${asaasBaseUrl}/payments/${invoice.asaas_payment_id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'access_token': ASAAS_API_KEY,
        },
      });

      if (!asaasResponse.ok) {
        const asaasResult = await asaasResponse.json();
        console.error('Asaas cancel error:', asaasResult);
        // Continue anyway to update local status
      } else {
        console.log(`Payment ${invoice.asaas_payment_id} cancelled in Asaas`);
      }
    }

    // Update invoice status
    const updateData: Record<string, any> = {
      status: 'cancelled',
      updated_at: new Date().toISOString(),
    };

    if (soft_delete) {
      updateData.deleted_at = new Date().toISOString();
    }

    const { error: updateError } = await supabase
      .from('invoices')
      .update(updateData)
      .eq('id', invoice_id);

    if (updateError) {
      throw new Error('Erro ao atualizar fatura: ' + updateError.message);
    }

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Cobrança cancelada com sucesso',
      invoice_id,
      cancelled_in_asaas: cancel_in_asaas && !!invoice.asaas_payment_id,
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
