import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ReceiptData {
  success: boolean;
  type: "fuel" | "expense";
  establishment_name: string | null;
  total_amount: number | null;
  liters: number | null;
  price_per_liter: number | null;
  payment_method: "cash" | "card" | "pix" | "credit" | null;
  category: string | null;
  confidence: number;
  reason?: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { imageBase64 } = await req.json();

    if (!imageBase64) {
      return new Response(
        JSON.stringify({ success: false, reason: "Imagem não fornecida" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY not configured");
      return new Response(
        JSON.stringify({ success: false, reason: "Configuração de IA não encontrada" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Processing receipt image...");

    // Call Lovable AI Gateway with Gemini Vision
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `Você é um especialista em leitura de notas fiscais e cupons brasileiros de transporte rodoviário.
Sua tarefa é analisar imagens de cupons fiscais e extrair informações estruturadas.

REGRAS IMPORTANTES:
1. Identifique se é um cupom de COMBUSTÍVEL (posto de gasolina, diesel, etanol) ou OUTRA DESPESA (alimentação, pedágio, hospedagem, manutenção, etc.)
2. Para combustível, SEMPRE tente identificar: litros abastecidos e preço por litro
3. Identifique a forma de pagamento: dinheiro (cash), cartão débito/crédito (card), PIX (pix), ou crédito (credit)
4. Para outras despesas, identifique a categoria: alimentação, pedágio, hospedagem, manutenção, borracharia, estacionamento, outros
5. Extraia o nome do estabelecimento quando visível
6. O valor total é OBRIGATÓRIO - se não conseguir ler, retorne success: false

FORMATO DE RESPOSTA (JSON apenas):
{
  "success": true,
  "type": "fuel" ou "expense",
  "establishment_name": "Nome do Posto ou Estabelecimento",
  "total_amount": 150.00,
  "liters": 25.5 (apenas para combustível, null para outros),
  "price_per_liter": 5.88 (apenas para combustível, null para outros),
  "payment_method": "cash" | "card" | "pix" | "credit",
  "category": "Combustível" | "Alimentação" | "Pedágio" | "Hospedagem" | "Manutenção" | "Borracharia" | "Estacionamento" | "Outros",
  "confidence": 0.95
}

Se NÃO conseguir ler a imagem ou extrair o valor total, retorne:
{
  "success": false,
  "reason": "Não foi possível identificar o valor total da nota"
}

Retorne APENAS o JSON, sem explicações adicionais.`
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Analise esta imagem de cupom fiscal e extraia as informações conforme as regras. Retorne apenas o JSON."
              },
              {
                type: "image_url",
                image_url: {
                  url: imageBase64.startsWith("data:") 
                    ? imageBase64 
                    : `data:image/jpeg;base64,${imageBase64}`
                }
              }
            ]
          }
        ],
        max_tokens: 1000,
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        console.error("Rate limit exceeded");
        return new Response(
          JSON.stringify({ success: false, reason: "Limite de requisições excedido, tente novamente em alguns segundos" }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        console.error("Payment required");
        return new Response(
          JSON.stringify({ success: false, reason: "Créditos de IA esgotados" }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI Gateway error:", response.status, errorText);
      return new Response(
        JSON.stringify({ success: false, reason: "Erro ao processar imagem" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiResponse = await response.json();
    console.log("AI Response received");

    const content = aiResponse.choices?.[0]?.message?.content;
    if (!content) {
      console.error("No content in AI response");
      return new Response(
        JSON.stringify({ success: false, reason: "Resposta vazia da IA" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse the JSON from AI response
    let receiptData: ReceiptData;
    try {
      // Clean up potential markdown formatting
      let cleanContent = content.trim();
      if (cleanContent.startsWith("```json")) {
        cleanContent = cleanContent.replace(/^```json\s*/, "").replace(/\s*```$/, "");
      } else if (cleanContent.startsWith("```")) {
        cleanContent = cleanContent.replace(/^```\s*/, "").replace(/\s*```$/, "");
      }
      
      receiptData = JSON.parse(cleanContent);
      console.log("Parsed receipt data:", receiptData);
    } catch (parseError) {
      console.error("Failed to parse AI response:", content);
      return new Response(
        JSON.stringify({ 
          success: false, 
          reason: "Não foi possível interpretar a nota. Tente uma foto mais nítida." 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate and normalize the response
    if (receiptData.success === false) {
      return new Response(
        JSON.stringify(receiptData),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Normalize payment method to match database constraints
    if (receiptData.payment_method === "credit") {
      receiptData.payment_method = "card";
    }

    // Ensure required fields
    const normalizedData: ReceiptData = {
      success: true,
      type: receiptData.type === "fuel" ? "fuel" : "expense",
      establishment_name: receiptData.establishment_name || null,
      total_amount: typeof receiptData.total_amount === "number" ? receiptData.total_amount : null,
      liters: receiptData.type === "fuel" && typeof receiptData.liters === "number" ? receiptData.liters : null,
      price_per_liter: receiptData.type === "fuel" && typeof receiptData.price_per_liter === "number" ? receiptData.price_per_liter : null,
      payment_method: ["cash", "card", "pix"].includes(receiptData.payment_method || "") 
        ? receiptData.payment_method as "cash" | "card" | "pix"
        : "card",
      category: receiptData.category || (receiptData.type === "fuel" ? "Combustível" : "Outros"),
      confidence: typeof receiptData.confidence === "number" ? receiptData.confidence : 0.8,
    };

    // Final validation
    if (!normalizedData.total_amount || normalizedData.total_amount <= 0) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          reason: "Não foi possível identificar o valor total" 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Returning normalized data:", normalizedData);

    return new Response(
      JSON.stringify(normalizedData),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error processing receipt:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        reason: error instanceof Error ? error.message : "Erro interno" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
