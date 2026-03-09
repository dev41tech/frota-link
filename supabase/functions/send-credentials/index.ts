import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface SendCredentialsRequest {
  email: string;
  full_name: string;
  company_name: string;
  temporary_password: string;
  login_url: string;
  created_by: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      email, 
      full_name, 
      company_name, 
      temporary_password, 
      login_url,
      created_by 
    }: SendCredentialsRequest = await req.json();

    console.log(`Sending credentials email to ${email} for company ${company_name}`);

    const emailResponse = await resend.emails.send({
      from: "Frota Link <onboarding@resend.dev>",
      to: [email],
      subject: `Bem-vindo ao Frota Link - ${company_name}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Bem-vindo ao Frota Link</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              background-color: #f8f9fa;
              padding: 20px;
            }
            .container {
              background-color: white;
              padding: 40px;
              border-radius: 12px;
              box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            }
            .header {
              text-align: center;
              border-bottom: 2px solid #3b82f6;
              padding-bottom: 20px;
              margin-bottom: 30px;
            }
            .logo {
              background: linear-gradient(135deg, #3b82f6, #1d4ed8);
              color: white;
              padding: 12px 24px;
              border-radius: 8px;
              display: inline-block;
              font-weight: bold;
              font-size: 24px;
              margin-bottom: 10px;
            }
            .credentials-box {
              background-color: #f1f5f9;
              border: 2px solid #3b82f6;
              border-radius: 8px;
              padding: 20px;
              margin: 20px 0;
            }
            .credential-item {
              margin: 10px 0;
              padding: 8px 0;
              border-bottom: 1px solid #e2e8f0;
            }
            .credential-item:last-child {
              border-bottom: none;
            }
            .credential-label {
              font-weight: bold;
              color: #1e40af;
            }
            .credential-value {
              font-family: 'Courier New', monospace;
              background-color: #ffffff;
              padding: 8px 12px;
              border-radius: 4px;
              margin-top: 5px;
              border: 1px solid #d1d5db;
              word-break: break-all;
            }
            .login-button {
              display: inline-block;
              background: linear-gradient(135deg, #3b82f6, #1d4ed8);
              color: white;
              padding: 15px 30px;
              text-decoration: none;
              border-radius: 8px;
              font-weight: bold;
              text-align: center;
              margin: 20px 0;
              box-shadow: 0 4px 6px rgba(59, 130, 246, 0.3);
            }
            .warning {
              background-color: #fef3c7;
              border: 2px solid #f59e0b;
              border-radius: 8px;
              padding: 15px;
              margin: 20px 0;
              color: #92400e;
            }
            .warning strong {
              color: #b45309;
            }
            .footer {
              margin-top: 30px;
              padding-top: 20px;
              border-top: 1px solid #e2e8f0;
              text-align: center;
              color: #6b7280;
              font-size: 14px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="logo">🚛 Frota Link</div>
              <h1 style="margin: 0; color: #1e40af;">Bem-vindo ao Sistema!</h1>
              <p style="margin: 5px 0 0 0; color: #6b7280;">Sistema de Gestão de Frotas</p>
            </div>

            <p>Olá, <strong>${full_name}</strong>!</p>
            
            <p>Você foi cadastrado(a) no sistema Frota Link para a empresa <strong>${company_name}</strong>. 
            Suas credenciais de acesso foram criadas por <strong>${created_by}</strong>.</p>

            <div class="credentials-box">
              <h3 style="margin-top: 0; color: #1e40af;">📋 Suas Credenciais de Acesso</h3>
              
              <div class="credential-item">
                <div class="credential-label">👤 Email de Login:</div>
                <div class="credential-value">${email}</div>
              </div>
              
              <div class="credential-item">
                <div class="credential-label">🔐 Senha Temporária:</div>
                <div class="credential-value">${temporary_password}</div>
              </div>
              
              <div class="credential-item">
                <div class="credential-label">🏢 Empresa:</div>
                <div class="credential-value">${company_name}</div>
              </div>
            </div>

            <div style="text-align: center;">
              <a href="${login_url}" class="login-button">
                🚀 Acessar o Sistema
              </a>
            </div>

            <div class="warning">
              <strong>⚠️ IMPORTANTE - SEGURANÇA:</strong>
              <ul style="margin: 10px 0;">
                <li><strong>Primeira obrigação:</strong> Você será obrigado(a) a alterar sua senha no primeiro login</li>
                <li><strong>Não compartilhe:</strong> Mantenha suas credenciais em segurança</li>
                <li><strong>Senha temporária:</strong> Esta senha expira após o primeiro uso</li>
                <li><strong>Problemas de acesso:</strong> Entre em contato com o administrador do sistema</li>
              </ul>
            </div>

            <h3 style="color: #1e40af;">📚 Próximos Passos:</h3>
            <ol>
              <li>Clique no botão "Acessar o Sistema" acima</li>
              <li>Faça login com seu email e senha temporária</li>
              <li>Defina uma nova senha segura quando solicitado</li>
              <li>Explore as funcionalidades do sistema</li>
            </ol>

            <div class="footer">
              <p><strong>Frota Link</strong> - Sistema de Gestão de Frotas</p>
              <p>Este é um email automático. Em caso de dúvidas, entre em contato com o administrador.</p>
              <p style="font-size: 12px; margin-top: 15px;">
                Se você não esperava receber este email, entre em contato conosco imediatamente.
              </p>
            </div>
          </div>
        </body>
        </html>
      `,
    });

    console.log("Credentials email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ 
      success: true, 
      messageId: emailResponse.data?.id 
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-credentials function:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);