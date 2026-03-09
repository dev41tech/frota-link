import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { originCity, originUf, destinations } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY não configurada");
      return new Response(JSON.stringify({ ufs: [], error: "API key not configured" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!originCity || !originUf || !destinations || destinations.length === 0) {
      console.log("Dados insuficientes para cálculo de rota");
      return new Response(JSON.stringify({ ufs: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const destList = destinations
      .filter((d: { city: string; uf: string }) => d.city && d.uf)
      .map((d: { city: string; uf: string }) => `${d.city} - ${d.uf}`)
      .join(", ");

    if (!destList) {
      return new Response(JSON.stringify({ ufs: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const destUfs = [...new Set(destinations.map((d: { uf: string }) => d.uf))];
    
    const prompt = `Você é um especialista em logística rodoviária brasileira. 
Dado um trajeto de frete que parte de ${originCity} - ${originUf} com destino(s) a ${destList}, 
liste APENAS as UFs (siglas de estados) intermediárias por onde o caminhão DEVE passar na ordem correta do trajeto.

Regras IMPORTANTES:
- NÃO inclua a UF de origem (${originUf})
- NÃO inclua as UFs de destino (${destUfs.join(', ')})
- Considere as principais rodovias federais (BRs) do Brasil
- Retorne APENAS as siglas das UFs intermediárias separadas por vírgula, na ordem do percurso
- Se não houver UFs intermediárias (origem e destino são estados vizinhos ou o mesmo estado), retorne "NENHUMA"

Exemplo de resposta correta: PR, SC
Outro exemplo: MG, BA

Responda APENAS com as siglas ou "NENHUMA":`;

    console.log("Consultando IA para rota:", { originCity, originUf, destList });

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "user", content: prompt }
        ],
        max_tokens: 100,
        temperature: 0.1
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Erro na API de IA:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ ufs: [], error: "Rate limit exceeded" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      return new Response(JSON.stringify({ ufs: [], error: "AI gateway error" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim() || "";
    
    console.log("Resposta da IA:", content);

    // Parse response
    let ufs: string[] = [];
    if (content && content.toUpperCase() !== "NENHUMA") {
      ufs = content
        .split(",")
        .map((uf: string) => uf.trim().toUpperCase())
        .filter((uf: string) => /^[A-Z]{2}$/.test(uf))
        // Remove origin and destination UFs just in case AI included them
        .filter((uf: string) => uf !== originUf && !destUfs.includes(uf));
    }

    console.log("UFs de percurso calculadas:", ufs);

    return new Response(JSON.stringify({ ufs }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Erro no cálculo de rota:", error);
    return new Response(JSON.stringify({ ufs: [], error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
