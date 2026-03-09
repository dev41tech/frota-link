import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Driver {
  id: string;
  name: string;
  cnh: string;
  cnh_expiry: string;
  email: string;
  company_id: string;
}

interface Company {
  id: string;
  name: string;
  email: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Data de hoje + 30 dias
    const today = new Date();
    const in30Days = new Date(today);
    in30Days.setDate(today.getDate() + 30);

    console.log(`Checking CNH expiry between ${today.toISOString()} and ${in30Days.toISOString()}`);

    // Buscar motoristas com CNH vencendo nos próximos 30 dias
    const { data: drivers, error: driversError } = await supabase
      .from("drivers")
      .select("id, name, cnh, cnh_expiry, email, company_id")
      .eq("status", "active")
      .not("cnh_expiry", "is", null)
      .gte("cnh_expiry", today.toISOString().split("T")[0])
      .lte("cnh_expiry", in30Days.toISOString().split("T")[0]);

    if (driversError) {
      console.error("Error fetching drivers:", driversError);
      throw driversError;
    }

    console.log(`Found ${drivers?.length || 0} drivers with expiring CNH`);

    if (!drivers || drivers.length === 0) {
      return new Response(
        JSON.stringify({ message: "No drivers with expiring CNH found", count: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // Buscar informações das empresas
    const companyIds = [...new Set(drivers.map((d) => d.company_id))];
    const { data: companies } = await supabase
      .from("companies")
      .select("id, name, email")
      .in("id", companyIds);

    const companyMap = new Map(companies?.map((c) => [c.id, c]) || []);

    // Agrupar motoristas por empresa
    const driversByCompany = drivers.reduce((acc, driver) => {
      if (!acc[driver.company_id]) {
        acc[driver.company_id] = [];
      }
      acc[driver.company_id].push(driver);
      return acc;
    }, {} as Record<string, Driver[]>);

    let emailsSent = 0;
    let emailsFailed = 0;

    // Enviar email para cada empresa
    for (const [companyId, companyDrivers] of Object.entries(driversByCompany)) {
      const company = companyMap.get(companyId);
      if (!company || !company.email) {
        console.warn(`Company ${companyId} not found or has no email`);
        continue;
      }

      const driversList = companyDrivers
        .map((d) => {
          const daysUntilExpiry = Math.ceil(
            (new Date(d.cnh_expiry).getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
          );
          return `
            <tr>
              <td style="padding: 8px; border-bottom: 1px solid #ddd;">${d.name}</td>
              <td style="padding: 8px; border-bottom: 1px solid #ddd;">${d.cnh}</td>
              <td style="padding: 8px; border-bottom: 1px solid #ddd;">${new Date(d.cnh_expiry).toLocaleDateString("pt-BR")}</td>
              <td style="padding: 8px; border-bottom: 1px solid #ddd; color: ${daysUntilExpiry <= 7 ? "#ef4444" : "#f59e0b"};">
                ${daysUntilExpiry} ${daysUntilExpiry === 1 ? "dia" : "dias"}
              </td>
            </tr>
          `;
        })
        .join("");

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>Alerta de CNH Vencendo</title>
        </head>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 16px; margin-bottom: 20px;">
            <h2 style="color: #991b1b; margin: 0 0 8px 0;">⚠️ Alerta: CNH Vencendo</h2>
            <p style="color: #7f1d1d; margin: 0;">Há motoristas com CNH vencendo nos próximos 30 dias</p>
          </div>
          
          <p>Olá, <strong>${company.name}</strong></p>
          
          <p>Os seguintes motoristas precisam renovar a CNH:</p>
          
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <thead>
              <tr style="background-color: #f3f4f6;">
                <th style="padding: 12px 8px; text-align: left; border-bottom: 2px solid #ddd;">Motorista</th>
                <th style="padding: 12px 8px; text-align: left; border-bottom: 2px solid #ddd;">CNH</th>
                <th style="padding: 12px 8px; text-align: left; border-bottom: 2px solid #ddd;">Vencimento</th>
                <th style="padding: 12px 8px; text-align: left; border-bottom: 2px solid #ddd;">Dias Restantes</th>
              </tr>
            </thead>
            <tbody>
              ${driversList}
            </tbody>
          </table>
          
          <div style="background-color: #f0f9ff; border-left: 4px solid #3b82f6; padding: 16px; margin-top: 20px;">
            <p style="margin: 0; color: #1e40af;">
              <strong>⚡ Ação Necessária:</strong> Entre em contato com os motoristas para agendar a renovação da CNH.
            </p>
          </div>
          
          <p style="margin-top: 20px; color: #6b7280; font-size: 14px;">
            Este é um email automático do sistema Frota Link.<br>
            Para gerenciar seus motoristas, acesse o painel administrativo.
          </p>
        </body>
        </html>
      `;

      try {
        const emailResponse = await resend.emails.send({
          from: "Frota Link <onboarding@resend.dev>",
          to: [company.email],
          subject: `⚠️ Alerta: ${companyDrivers.length} CNH${companyDrivers.length > 1 ? "s" : ""} vencendo`,
          html,
        });

        console.log(`Email sent to ${company.email}:`, emailResponse);
        emailsSent++;
      } catch (error) {
        console.error(`Error sending email to ${company.email}:`, error);
        emailsFailed++;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        driversChecked: drivers.length,
        emailsSent,
        emailsFailed,
        message: `Checked ${drivers.length} drivers, sent ${emailsSent} emails`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error: any) {
    console.error("Error in check-cnh-expiry function:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
