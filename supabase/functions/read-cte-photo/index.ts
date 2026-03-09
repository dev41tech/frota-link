import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { imageBase64 } = await req.json();

    if (!imageBase64) {
      return new Response(
        JSON.stringify({ success: false, error: 'imageBase64 is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY not configured");
      return new Response(
        JSON.stringify({ success: false, error: 'AI service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const base64Content = imageBase64.includes(',')
      ? imageBase64.split(',')[1]
      : imageBase64;

    console.log("Processing CT-e photo...");

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
            content: `Você é um especialista em leitura de documentos fiscais de transporte brasileiro.
Sua tarefa é analisar fotos de CT-e (Conhecimento de Transporte Eletrônico) ou DACTE (Documento Auxiliar do CT-e) e extrair informações de rota.

INSTRUÇÕES:
1. Identifique o documento CT-e/DACTE na imagem
2. Extraia as seguintes informações:
   - origin: Cidade/UF de INÍCIO da prestação do serviço (município de início)
   - destination: Cidade/UF de TÉRMINO da prestação do serviço (município de término)
   - cte_number: Número do CT-e (se visível)
   - sender_name: Nome do remetente (se visível)
   - recipient_name: Nome do destinatário (se visível)
3. Retorne APENAS um JSON no formato:
   {"origin": "Cidade/UF", "destination": "Cidade/UF", "cte_number": "123456", "sender_name": "...", "recipient_name": "..."}
4. Se não conseguir ler algum campo, coloque null
5. Se não conseguir identificar o documento, retorne: {"origin": null, "destination": null, "reason": "motivo"}
6. Para origin e destination, use o formato "Cidade/UF" (ex: "São Paulo/SP", "Curitiba/PR")

DICAS:
- O campo "Início da Prestação" ou "Município de origem" indica a origem
- O campo "Término da Prestação" ou "Município de destino" indica o destino
- O remetente geralmente está no campo "Remetente" e o destinatário em "Destinatário"
- O número do CT-e está no cabeçalho do documento

IMPORTANTE: Retorne APENAS o JSON, sem texto adicional.`
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Analise este documento CT-e/DACTE e extraia a origem, destino, número do CT-e, remetente e destinatário."
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:image/jpeg;base64,${base64Content}`
                }
              }
            ]
          }
        ],
        max_tokens: 300,
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI Gateway error:", response.status, errorText);

      if (response.status === 429) {
        return new Response(
          JSON.stringify({ success: false, error: 'Limite de requisições excedido. Tente novamente em instantes.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (response.status === 402) {
        return new Response(
          JSON.stringify({ success: false, error: 'Créditos de IA esgotados.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: false, error: 'Erro no serviço de IA' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiResponse = await response.json();
    console.log("AI Response:", JSON.stringify(aiResponse));

    const content = aiResponse.choices?.[0]?.message?.content || "";
    console.log("Raw AI content:", content);

    let parsedResult: {
      origin: string | null;
      destination: string | null;
      cte_number?: string | null;
      sender_name?: string | null;
      recipient_name?: string | null;
      reason?: string;
    };

    try {
      const jsonMatch = content.match(/\{[\s\S]*?\}/);
      if (jsonMatch) {
        parsedResult = JSON.parse(jsonMatch[0]);
      } else {
        parsedResult = JSON.parse(content.trim());
      }
    } catch (parseError) {
      console.error("Failed to parse AI response:", parseError);
      parsedResult = { origin: null, destination: null, reason: "Não foi possível interpretar a resposta da IA" };
    }

    const success = parsedResult.origin !== null && parsedResult.destination !== null;

    console.log("Parsed CT-e:", parsedResult, "Success:", success);

    return new Response(
      JSON.stringify({
        success,
        origin: parsedResult.origin || null,
        destination: parsedResult.destination || null,
        cte_number: parsedResult.cte_number || null,
        sender_name: parsedResult.sender_name || null,
        recipient_name: parsedResult.recipient_name || null,
        confidence: success ? 0.85 : 0,
        reason: parsedResult.reason || null,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error("Error in read-cte-photo:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
