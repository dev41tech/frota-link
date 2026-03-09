import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Resend } from 'npm:resend@4.0.0';

const resend = new Resend(Deno.env.get('RESEND_API_KEY'));

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const threeDaysFromNow = new Date(today);
    threeDaysFromNow.setDate(today.getDate() + 3);
    
    const oneDayAgo = new Date(today);
    oneDayAgo.setDate(today.getDate() - 1);

    // Buscar contas a vencer em 3 dias
    const { data: dueInThreeDays } = await supabaseClient
      .from('accounts_payable')
      .select(`
        *,
        companies!inner(name, email),
        profiles!inner(full_name, email)
      `)
      .eq('status', 'pending')
      .gte('due_date', threeDaysFromNow.toISOString().split('T')[0])
      .lt('due_date', new Date(threeDaysFromNow.getTime() + 86400000).toISOString().split('T')[0]);

    // Buscar contas que vencem hoje
    const { data: dueToday } = await supabaseClient
      .from('accounts_payable')
      .select(`
        *,
        companies!inner(name, email),
        profiles!inner(full_name, email)
      `)
      .eq('status', 'pending')
      .eq('due_date', today.toISOString().split('T')[0]);

    // Buscar contas vencidas há 1 dia
    const { data: overdue } = await supabaseClient
      .from('accounts_payable')
      .select(`
        *,
        companies!inner(name, email),
        profiles!inner(full_name, email)
      `)
      .eq('status', 'pending')
      .eq('due_date', oneDayAgo.toISOString().split('T')[0]);

    const notifications = [];

    // Enviar alertas para contas que vencem em 3 dias
    if (dueInThreeDays && dueInThreeDays.length > 0) {
      for (const account of dueInThreeDays) {
        const companyEmail = account.companies?.email || account.profiles?.email;
        if (!companyEmail) continue;

        try {
          await resend.emails.send({
            from: 'FleetPro <noreply@resend.dev>',
            to: [companyEmail],
            subject: '⚠️ Conta a Pagar vence em 3 dias',
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #f59e0b;">⚠️ Lembrete: Conta vence em breve</h2>
                <p>A seguinte conta a pagar vence em 3 dias:</p>
                <div style="background: #f9fafb; padding: 15px; border-radius: 8px; margin: 20px 0;">
                  <p><strong>Descrição:</strong> ${account.description}</p>
                  <p><strong>Fornecedor:</strong> ${account.supplier || 'Não informado'}</p>
                  <p><strong>Valor:</strong> R$ ${Number(account.amount).toFixed(2)}</p>
                  <p><strong>Vencimento:</strong> ${new Date(account.due_date).toLocaleDateString('pt-BR')}</p>
                </div>
                <p>Não esqueça de efetuar o pagamento para evitar multas e juros.</p>
                <p style="color: #6b7280; font-size: 12px; margin-top: 30px;">
                  Esta é uma notificação automática do FleetPro.
                </p>
              </div>
            `,
          });
          notifications.push({ type: 'warning', account: account.id });
        } catch (error) {
          console.error('Error sending warning email:', error);
        }
      }
    }

    // Enviar alertas para contas que vencem hoje
    if (dueToday && dueToday.length > 0) {
      for (const account of dueToday) {
        const companyEmail = account.companies?.email || account.profiles?.email;
        if (!companyEmail) continue;

        try {
          await resend.emails.send({
            from: 'FleetPro <noreply@resend.dev>',
            to: [companyEmail],
            subject: '🚨 Conta a Pagar vence HOJE',
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #ef4444;">🚨 URGENTE: Conta vence hoje!</h2>
                <p>A seguinte conta a pagar vence <strong>HOJE</strong>:</p>
                <div style="background: #fef2f2; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ef4444;">
                  <p><strong>Descrição:</strong> ${account.description}</p>
                  <p><strong>Fornecedor:</strong> ${account.supplier || 'Não informado'}</p>
                  <p><strong>Valor:</strong> R$ ${Number(account.amount).toFixed(2)}</p>
                  <p><strong>Vencimento:</strong> ${new Date(account.due_date).toLocaleDateString('pt-BR')}</p>
                </div>
                <p style="color: #ef4444; font-weight: bold;">
                  Efetue o pagamento hoje para evitar multas e juros!
                </p>
                <p style="color: #6b7280; font-size: 12px; margin-top: 30px;">
                  Esta é uma notificação automática do FleetPro.
                </p>
              </div>
            `,
          });
          notifications.push({ type: 'urgent', account: account.id });
        } catch (error) {
          console.error('Error sending urgent email:', error);
        }
      }
    }

    // Enviar alertas para contas vencidas
    if (overdue && overdue.length > 0) {
      for (const account of overdue) {
        const companyEmail = account.companies?.email || account.profiles?.email;
        if (!companyEmail) continue;

        try {
          await resend.emails.send({
            from: 'FleetPro <noreply@resend.dev>',
            to: [companyEmail],
            subject: '❗ Conta a Pagar VENCIDA',
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #dc2626;">❗ ATENÇÃO: Conta vencida!</h2>
                <p>A seguinte conta a pagar está <strong>VENCIDA</strong>:</p>
                <div style="background: #fef2f2; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #dc2626;">
                  <p><strong>Descrição:</strong> ${account.description}</p>
                  <p><strong>Fornecedor:</strong> ${account.supplier || 'Não informado'}</p>
                  <p><strong>Valor:</strong> R$ ${Number(account.amount).toFixed(2)}</p>
                  <p><strong>Venceu em:</strong> ${new Date(account.due_date).toLocaleDateString('pt-BR')}</p>
                </div>
                <p style="color: #dc2626; font-weight: bold;">
                  Regularize o pagamento o quanto antes para evitar prejuízos!
                </p>
                <p style="color: #6b7280; font-size: 12px; margin-top: 30px;">
                  Esta é uma notificação automática do FleetPro.
                </p>
              </div>
            `,
          });
          notifications.push({ type: 'overdue', account: account.id });
        } catch (error) {
          console.error('Error sending overdue email:', error);
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        notifications: notifications.length,
        summary: {
          dueInThreeDays: dueInThreeDays?.length || 0,
          dueToday: dueToday?.length || 0,
          overdue: overdue?.length || 0,
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in notify-due-accounts function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
