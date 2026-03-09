import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  // Handle CORS preflight
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

    // Extract base64 content (remove data:image/... prefix if present)
    const base64Content = imageBase64.includes(',') 
      ? imageBase64.split(',')[1] 
      : imageBase64;

    console.log("Processing odometer image...");

    // Call Gemini Vision via Lovable AI Gateway
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
            content: `Você é um especialista em leitura de hodômetros de veículos. 
Sua tarefa é analisar fotos de painéis de veículos e identificar o valor do hodômetro (quilometragem total).

INSTRUÇÕES:
1. Identifique o display do hodômetro na imagem
2. Leia o valor numérico exibido
3. Retorne APENAS um JSON no formato: {"km": 123456}
4. Se não conseguir ler o hodômetro, retorne: {"km": null, "reason": "motivo"}
5. Ignore decimais - arredonde para baixo
6. O valor deve ser um número inteiro em quilômetros

IMPORTANTE: Retorne APENAS o JSON, sem texto adicional.`
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Analise esta foto do painel do veículo e identifique o valor do hodômetro (km total)."
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
        max_tokens: 150,
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI Gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ success: false, error: 'Rate limit exceeded. Try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ success: false, error: 'AI service error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiResponse = await response.json();
    console.log("AI Response:", JSON.stringify(aiResponse));

    const content = aiResponse.choices?.[0]?.message?.content || "";
    console.log("Raw AI content:", content);

    // Parse the JSON response from AI
    let parsedResult: { km: number | null; reason?: string };
    
    try {
      // Try to extract JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*?\}/);
      if (jsonMatch) {
        parsedResult = JSON.parse(jsonMatch[0]);
      } else {
        // Try parsing the entire content as JSON
        parsedResult = JSON.parse(content.trim());
      }
    } catch (parseError) {
      console.error("Failed to parse AI response:", parseError);
      // Try to extract just the number
      const numberMatch = content.match(/(\d{1,7})/);
      if (numberMatch) {
        parsedResult = { km: parseInt(numberMatch[1], 10) };
      } else {
        parsedResult = { km: null, reason: "Could not parse AI response" };
      }
    }

    const odometer = parsedResult.km;
    const success = odometer !== null && odometer > 0;

    console.log("Parsed odometer:", odometer, "Success:", success);

    return new Response(
      JSON.stringify({
        success,
        odometer: success ? odometer : null,
        confidence: success ? 0.85 : 0,
        raw_response: content,
        reason: parsedResult.reason || null
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error("Error in read-odometer:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
        odometer: null
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
