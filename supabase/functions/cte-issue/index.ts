import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const NUVEM_FISCAL_BASE_URL = "https://api.nuvemfiscal.com.br";
const NUVEM_FISCAL_AUTH_URL = "https://auth.nuvemfiscal.com.br/oauth/token";

const CTE_ISSUE_BUILD = "BUILD: V5.1 - SANITIZE + SMART WAIT";

const safeJsonParse = async (response: Response): Promise<{ data: any; text: string | null }> => {
  const text = await response.text();
  try {
    return { data: JSON.parse(text), text: null };
  } catch {
    return { data: null, text };
  }
};

// *** FUNÇÃO DE LIMPEZA (ESSENCIAL PARA NÃO DAR ERRO NA SEFAZ) ***
function sanitizeText(text: string | null | undefined, maxLength: number = 60): string {
  if (!text) return "";
  let clean = text.trim().replace(/\s+/g, " ");
  if (clean.length === 0) return "NAO INFORMADO";
  if (clean.length > maxLength) clean = clean.substring(0, maxLength);
  return clean;
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
    throw new Error(`Erro Auth Nuvem Fiscal: ${tokenResponse.status} - ${txt}`);
  }
  return (await tokenResponse.json()).access_token;
}

async function autoConfigureCompany(token: string, cnpj: string, ambiente: string) {
  console.log(`[Auto-Setup] Configurando CT-e para CNPJ ${cnpj}...`);
  const url = `${NUVEM_FISCAL_BASE_URL}/empresas/${cnpj}/cte`;
  await fetch(url, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ ambiente: ambiente }),
  });
}

function mapTipoServico(t: string): number {
  if (t === "subcontratacao") return 1;
  if (t === "redespacho") return 2;
  if (t === "redespacho_intermediario") return 3;
  return 0;
}
function mapUnidadeMedida(u: string): string {
  const un = u?.toLowerCase() || "";
  if (un.includes("kg") || un.includes("quilo")) return "01";
  if (un.includes("ton")) return "02";
  if (un.includes("litro")) return "03";
  if (un.includes("m3") || un.includes("cubico")) return "04";
  return "00";
}
function mapTomador(t: string): number {
  if (t === "remetente") return 0;
  if (t === "expedidor") return 1;
  if (t === "recebedor") return 2;
  if (t === "destinatario") return 3;
  return 4;
}
function getCodigoUF(uf: string): number {
  const codigos: Record<string, number> = {
    AC: 12,
    AL: 27,
    AM: 13,
    AP: 16,
    BA: 29,
    CE: 23,
    DF: 53,
    ES: 32,
    GO: 52,
    MA: 21,
    MG: 31,
    MS: 50,
    MT: 51,
    PA: 15,
    PB: 25,
    PE: 26,
    PI: 22,
    PR: 41,
    RJ: 33,
    RN: 24,
    RO: 11,
    RR: 14,
    RS: 43,
    SC: 42,
    SE: 28,
    SP: 35,
    TO: 17,
  };
  return codigos[uf?.toUpperCase()] || 41;
}
function getCodigoMunicipio(cidade: string, uf: string, fallback?: string): string {
  if (fallback && fallback.length === 7) return fallback;
  const list: Record<string, string> = {
    CURITIBA: "4106902",
    "SAO PAULO": "3550308",
    "RIO DE JANEIRO": "3304557",
    "PORTO ALEGRE": "4314902",
    "BELO HORIZONTE": "3106200",
    FLORIANOPOLIS: "4205407",
  };
  const key = sanitizeText(cidade)
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (list[key]) return list[key];
  if (uf === "PR") return "4106902";
  if (uf === "SC") return "4205407";
  if (uf === "RS") return "4314902";
  if (uf === "SP") return "3550308";
  return "4106902";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  console.log(`[cte-issue] INICIANDO EXECUCAO: ${CTE_ISSUE_BUILD}`);

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: req.headers.get("Authorization")! } },
  });

  let cteId = "";

  try {
    const body = await req.json();
    const {
      journeyId,
      createJourney,
      journeyData,
      series = "1",
      operation_type = "normal",
      is_draft = false,
      cfop,
      notes,
      sender_name,
      sender_document,
      sender_ie,
      sender_address,
      sender_address_data,
      recipient_name,
      recipient_document,
      recipient_ie,
      recipient_address,
      recipient_address_data,
      tomador_tipo = "remetente",
      cargo_natureza,
      cargo_peso_bruto,
      cargo_valor,
      cargo_quantidade,
      cargo_unidade,
      cargo_produto_predominante,
      vehicle_plate,
      vehicle_rntrc,
      vehicle_uf,
      freight_value,
      cst,
      icms_base_calculo,
      icms_aliquota,
      icms_valor,
      simples_nacional,
      linked_documents = [],
      document_number,
    } = body;

    // 1. Auth & Configs
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("Não autorizado");

    let { data: profile } = await supabase.from("profiles").select("company_id").eq("id", user.id).single();
    if (!profile?.company_id) {
      const { data: role } = await supabase.from("user_roles").select("company_id").eq("user_id", user.id).single();
      if (role) profile = { company_id: role.company_id };
    }
    if (!profile?.company_id) throw new Error("Empresa não encontrada.");
    const companyId = profile.company_id;

    const { data: company } = await supabase.from("companies").select("*").eq("id", companyId).single();
    const { data: settings } = await supabase.from("cte_settings").select("*").eq("company_id", companyId).single();

    if (!settings?.ie_emitente) throw new Error("IE do Emitente não configurada.");
    const senderAdd = sender_address_data || {};
    const recipientAdd = recipient_address_data || {};

    // 2. Jornada e DB
    let finalJourneyId = journeyId;
    if (createJourney && journeyData) {
      const { data: j } = await supabase
        .from("journeys")
        .insert({
          journey_number: journeyData.journeyNumber || `J-${Date.now()}`,
          origin: sender_address,
          destination: recipient_address,
          freight_value,
          freight_value,
          status: "planned",
          user_id: user.id,
          company_id: companyId,
        })
        .select()
        .single();
      if (j) finalJourneyId = j.id;
    }

    const cargoInfo = {
      natureza: sanitizeText(cargo_natureza || "MERCADORIA"),
      produto: sanitizeText(cargo_produto_predominante || cargo_natureza || "DIVERSOS"),
      peso: cargo_peso_bruto || 1,
      valor: cargo_valor || 1,
      qtd: cargo_quantidade || 1,
      und: cargo_unidade || "UN",
    };
    const taxInfo = {
      cst: cst || "00",
      vBC: icms_base_calculo || 0,
      pICMS: icms_aliquota || 0,
      vICMS: icms_valor || 0,
    };
    const ambiente = is_draft ? "homologacao" : settings.environment || "homologacao";

    const { data: doc, error: docErr } = await supabase
      .from("cte_documents")
      .insert({
        journey_id: finalJourneyId,
        series,
        cfop,
        operation_type,
        recipient_name,
        recipient_document,
        recipient_address,
        sender_name,
        sender_document,
        sender_address,
        freight_value,
        icms_value: icms_valor,
        status: "processing",
        environment: ambiente,
        is_draft,
        user_id: user.id,
        company_id: companyId,
        cargo_info: cargoInfo,
        vehicle_info: { rntrc: vehicle_rntrc || "00000000", placa: vehicle_plate },
        tax_info: taxInfo,
      })
      .select()
      .single();

    if (docErr) throw new Error(`Erro DB: ${docErr.message}`);
    cteId = doc.id;

    // 3. Buscar próximo número da série na tabela cte_series
    const { data: seriesData } = await supabase
      .from('cte_series')
      .select('id, next_number')
      .eq('company_id', companyId)
      .eq('series', series)
      .single();

    let nextNumber: number;
    
    if (seriesData) {
      // Série existe, usar o próximo número
      nextNumber = seriesData.next_number;
    } else {
      // Série não existe, verificar último número emitido para esta série
      const { data: lastCte } = await supabase
        .from('cte_documents')
        .select('cte_number')
        .eq('company_id', companyId)
        .eq('series', series)
        .not('cte_number', 'is', null)
        .order('cte_number', { ascending: false })
        .limit(1)
        .single();
      
      const lastNumber = lastCte?.cte_number ? parseInt(lastCte.cte_number) : 0;
      nextNumber = lastNumber + 1;
    }

    // Se foi passado um número específico, usar ele (para casos de continuidade manual)
    const finalNCT = document_number ? parseInt(document_number) : nextNumber;

    // 4. Payload Nuvem Fiscal

    const companyUF = company.state || "PR";
    const companyCityCode = getCodigoMunicipio(company.city || "CURITIBA", companyUF);
    const generatedCodeCT = Math.floor(Date.now() / 1000) % 100000000;

    const payload = {
      ambiente,
      infCte: {
        versao: "4.00",
        ide: {
          cUF: getCodigoUF(companyUF),
          cCT: generatedCodeCT.toString().padStart(8, "0"),
          CFOP: (cfop || "6352").replace(/\D/g, ""),
          natOp: "TRANSPORTE",
          mod: 57,
          serie: parseInt(series) || 1,
          nCT: finalNCT,
          dhEmi: new Date().toISOString(),
          tpImp: 1,
          tpEmis: 1,
          tpAmb: ambiente === "producao" ? 1 : 2,
          tpCTe: 0,
          procEmi: 0,
          verProc: "1.0",
          cMunEnv: companyCityCode,
          xMunEnv: sanitizeText(company.city || "CURITIBA"),
          UFEnv: companyUF,
          modal: "01",
          tpServ: mapTipoServico(operation_type),
          cMunIni: senderAdd.codigoIBGE || "4106902",
          xMunIni: sanitizeText(senderAdd.cidade || "CURITIBA"),
          UFIni: senderAdd.uf || "PR",
          cMunFim: recipientAdd.codigoIBGE || "4106902",
          xMunFim: sanitizeText(recipientAdd.cidade || "CURITIBA"),
          UFFim: recipientAdd.uf || "PR",
          retira: 1,
          indIEToma: 1,
          toma3: { toma: mapTomador(tomador_tipo) },
        },
        emit: {
          CNPJ: company.cnpj.replace(/\D/g, ""),
          IE: settings.ie_emitente.replace(/\D/g, ""),
          xNome: sanitizeText(company.name),
          xFant: sanitizeText(company.fantasy_name || company.name),
          enderEmit: {
            xLgr: sanitizeText(company.address || "RUA PRINCIPAL"),
            nro: "100",
            xBairro: "CENTRO",
            cMun: companyCityCode,
            xMun: sanitizeText(company.city || "CURITIBA"),
            CEP: (company.zip_code || "80000000").replace(/\D/g, ""),
            UF: companyUF,
          },
        },
        rem: {
          CNPJ: sender_document.length > 11 ? sender_document.replace(/\D/g, "") : undefined,
          CPF: sender_document.length <= 11 ? sender_document.replace(/\D/g, "") : undefined,
          IE: sender_ie || "ISENTO",
          xNome: sanitizeText(sender_name),
          enderReme: {
            xLgr: sanitizeText(senderAdd.logradouro || "Rua"),
            nro: sanitizeText(senderAdd.numero || "S/N"),
            xBairro: sanitizeText(senderAdd.bairro || "Centro"),
            cMun: senderAdd.codigoIBGE,
            xMun: sanitizeText(senderAdd.cidade),
            UF: senderAdd.uf,
            CEP: (senderAdd.cep || "").replace(/\D/g, ""),
          },
        },
        dest: {
          CNPJ: recipient_document.length > 11 ? recipient_document.replace(/\D/g, "") : undefined,
          CPF: recipient_document.length <= 11 ? recipient_document.replace(/\D/g, "") : undefined,
          IE: recipient_ie || "ISENTO",
          xNome: sanitizeText(recipient_name),
          enderDest: {
            xLgr: sanitizeText(recipientAdd.logradouro || "Rua"),
            nro: sanitizeText(recipientAdd.numero || "S/N"),
            xBairro: sanitizeText(recipientAdd.bairro || "Centro"),
            cMun: recipientAdd.codigoIBGE,
            xMun: sanitizeText(recipientAdd.cidade),
            UF: recipientAdd.uf,
            CEP: (recipientAdd.cep || "").replace(/\D/g, ""),
          },
        },
        vPrest: {
          vTPrest: freight_value,
          vRec: freight_value,
          Comp: [{ xNome: "Frete Valor", vComp: freight_value }],
        },
        imp: simples_nacional
          ? { ICMS: { ICMSSN: { CST: "90", indSN: 1 } } }
          : { ICMS: { ICMS90: { CST: "90", vBC: taxInfo.vBC, pICMS: taxInfo.pICMS, vICMS: taxInfo.vICMS } } },
        infCTeNorm: {
          infCarga: {
            vCarga: cargoInfo.valor,
            proPred: cargoInfo.produto,
            infQ: [{ cUnid: mapUnidadeMedida(cargoInfo.und), tpMed: "PESO BRUTO", qCarga: cargoInfo.peso }],
          },
          infDoc:
            linked_documents.length > 0
              ? {
                  infNFe: linked_documents
                    .filter((d: any) => d.type === "nfe")
                    .map((d: any) => ({ chave: d.key.replace(/\D/g, "") })),
                }
              : undefined,
          infModal: { versaoModal: "4.00", rodo: { RNTRC: vehicle_rntrc || "00000000" } },
        },
      },
    };

    console.log("PAYLOAD DEBUG:", JSON.stringify(payload, null, 2));

    const token = await getNuvemFiscalAccessToken();
    const cleanCNPJ = company.cnpj.replace(/\D/g, "");

    let resp = await fetch(`${NUVEM_FISCAL_BASE_URL}/cte`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    let { data: nfData } = await safeJsonParse(resp);

    // AUTO-CONFIGURAÇÃO RETRY
    if (!resp.ok) {
      const errStr = JSON.stringify(nfData);
      if (errStr.includes("Configuração de CT-e da empresa não encontrada") || errStr.includes("not found")) {
        await autoConfigureCompany(token, cleanCNPJ, ambiente);
        console.log("[Retry] Tentando emitir novamente...");
        resp = await fetch(`${NUVEM_FISCAL_BASE_URL}/cte`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const retryData = await safeJsonParse(resp);
        nfData = retryData.data;
      }
    }

    if (!resp.ok) {
      console.error("NF Error Final:", JSON.stringify(nfData, null, 2));
      let msg = "Erro na emissão";
      if (nfData?.error?.errors) msg = `Validation failed -> ${JSON.stringify(nfData.error.errors)}`;
      else if (nfData?.error?.message) msg = nfData.error.message;
      else if (nfData?.message) msg = nfData.message;

      await supabase.from("cte_documents").update({ status: "rejected", error_message: msg }).eq("id", cteId);
      throw new Error(msg);
    }

    // === ATUALIZAR CONTADOR DA SÉRIE ===
    // Incrementa o próximo número na tabela cte_series após emissão bem-sucedida
    if (seriesData) {
      await supabase
        .from('cte_series')
        .update({ next_number: finalNCT + 1 })
        .eq('id', seriesData.id);
    } else {
      // Criar registro da série se não existia
      await supabase
        .from('cte_series')
        .insert({
          company_id: companyId,
          series: series,
          next_number: finalNCT + 1,
          description: `Série ${series} - criada automaticamente`,
          is_active: true,
        });
    }
    console.log(`[cte-issue] Série ${series}: próximo número atualizado para ${finalNCT + 1}`);

    // === SALVAR DADOS DO CT-e ===
    await supabase
      .from("cte_documents")
      .update({
        nuvem_fiscal_id: nfData.id,
        status: "aguardando_sefaz",
        cte_key: nfData.chave,
        cte_number: nfData.numero?.toString() || finalNCT.toString(),
        xml_content: nfData.xml,
        pdf_url: nfData.url_pdf,
      })
      .eq("id", cteId);

    return new Response(JSON.stringify({ success: true, cte: nfData }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
