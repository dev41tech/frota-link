import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const NUVEM_FISCAL_BASE_URL = "https://api.nuvemfiscal.com.br";
const NUVEM_FISCAL_AUTH_URL = "https://auth.nuvemfiscal.com.br/oauth/token";

// Configurações de Retry (até 30 segundos - limite seguro para edge functions)
const MAX_RETRIES = 6;
const RETRY_DELAY_MS = 5000;

async function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getNuvemFiscalAccessToken(): Promise<string> {
  const clientId = Deno.env.get("NUVEM_FISCAL_CLIENT_ID");
  const clientSecret = Deno.env.get("NUVEM_FISCAL_CLIENT_SECRET");
  if (!clientId || !clientSecret) throw new Error("Credenciais Nuvem Fiscal ausentes.");

  const tokenResponse = await fetch(NUVEM_FISCAL_AUTH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
      scope: "empresa cte mdfe",
    }),
  });

  if (!tokenResponse.ok) {
    const txt = await tokenResponse.text();
    throw new Error(`Erro Token Nuvem Fiscal: ${tokenResponse.status} - ${txt}`);
  }
  return (await tokenResponse.json()).access_token;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  console.log(`[cte-download V22] Iniciando...`);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Header Authorization ausente.");

    const supabaseClient = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
      global: { headers: { Authorization: authHeader } },
    });

    let body: any = {};
    try {
      if (req.method !== "GET") body = await req.json();
    } catch (e) {
      console.log("[cte-download] Erro ao parsear body:", e);
    }

    const url = new URL(req.url);
    const pathParts = url.pathname.split("/");
    const pathId = pathParts[pathParts.length - 1].length > 20 ? pathParts[pathParts.length - 1] : null;

    const document_id =
      body.document_id ||
      body.id ||
      body.cteId ||
      url.searchParams.get("document_id") ||
      url.searchParams.get("id") ||
      pathId;

    const type = body.type || url.searchParams.get("type") || "pdf";

    if (!document_id) {
      console.log("[cte-download] ID do documento não fornecido");
      return new Response(
        JSON.stringify({ success: false, error: "ID do documento não fornecido." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[cte-download] Buscando documento: ${document_id}`);

    const { data: doc, error: docErr } = await supabaseClient
      .from("cte_documents")
      .select("nuvem_fiscal_id, cte_number, status")
      .eq("id", document_id)
      .single();

    if (docErr || !doc) {
      console.log("[cte-download] Documento não encontrado:", docErr);
      return new Response(
        JSON.stringify({ success: false, error: "Documento não encontrado." }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!doc.nuvem_fiscal_id) {
      console.log(`[cte-download] Documento não autorizado. Status: ${doc.status}`);
      return new Response(
        JSON.stringify({ 
          success: false, 
          status: "not_authorized",
          error: `Documento ainda não foi autorizado (Status: ${doc.status}). Não é possível baixar o PDF.` 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const nfToken = await getNuvemFiscalAccessToken();
    const endpoint = type === "xml" ? "xml" : "pdf";
    const downloadUrl = `${NUVEM_FISCAL_BASE_URL}/cte/${doc.nuvem_fiscal_id}/${endpoint}`;

    console.log(`[cte-download] Baixando ${endpoint} de: ${downloadUrl}`);

    // === LOOP DE ESPERA ===
    let resp: Response | null = null;
    let attempts = 0;
    let success = false;

    while (attempts < MAX_RETRIES && !success) {
      attempts++;
      console.log(`[cte-download] Tentativa ${attempts}/${MAX_RETRIES}...`);

      resp = await fetch(downloadUrl, {
        method: "GET",
        headers: { Authorization: `Bearer ${nfToken}` },
      });

      if (resp.ok) {
        success = true;
        console.log(`[cte-download] Download bem-sucedido na tentativa ${attempts}`);
      } else {
        const errorText = await resp.text();
        console.log(`[cte-download] Erro na tentativa ${attempts}: ${errorText.substring(0, 200)}`);
        
        if (errorText.includes("EventoDfeXmlNotFound") || errorText.includes("Xml não disponível") || errorText.includes("not found")) {
          if (attempts < MAX_RETRIES) {
            console.log(`[cte-download] Arquivo ainda não disponível, aguardando ${RETRY_DELAY_MS}ms...`);
            await delay(RETRY_DELAY_MS);
          }
        } else {
          // Erro diferente, não vale a pena tentar novamente
          return new Response(
            JSON.stringify({ success: false, error: `Erro da API Nuvem Fiscal: ${errorText.substring(0, 200)}` }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
    }

    if (!success || !resp) {
      console.log("[cte-download] Todas as tentativas esgotadas");
      return new Response(
        JSON.stringify({
          success: false,
          status: "processing",
          error: "O CT-e ainda está sendo processado pela SEFAZ. Por favor, aguarde 1-2 minutos e tente novamente.",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // === SUCESSO ===
    if (doc.status !== "authorized") {
      await supabaseClient.from("cte_documents").update({ status: "authorized" }).eq("id", document_id);
    }

    const fileBuffer = await resp.arrayBuffer();
    const filename = `cte-${doc.cte_number || "doc"}.${type}`;
    
    console.log(`[cte-download] Sucesso! Enviando ${fileBuffer.byteLength} bytes como ${filename}`);

    // Converter ArrayBuffer para array de números para JSON
    const contentArray = Array.from(new Uint8Array(fileBuffer));
    
    return new Response(
      JSON.stringify({
        success: true,
        content: contentArray,
        filename: filename,
        contentType: type === "pdf" ? "application/pdf" : "application/xml",
        size: fileBuffer.byteLength,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("[cte-download] ERRO:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || "Erro interno ao baixar CT-e" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
