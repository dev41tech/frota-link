import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('AI Chat request received:', {
      method: req.method,
      timestamp: new Date().toISOString(),
      hasApiKey: !!openAIApiKey
    });

    // Validate request method
    if (req.method !== 'POST') {
      console.warn('Invalid method:', req.method);
      return new Response(
        JSON.stringify({ success: false, error: 'Method not allowed' }),
        { 
          status: 405, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Check API key configuration
    if (!openAIApiKey) {
      console.error('OPENAI_API_KEY not configured');
      throw new Error('OPENAI_API_KEY não configurada');
    }

    // Validate content type
    const contentType = req.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      return new Response(
        JSON.stringify({ success: false, error: 'Content-Type must be application/json' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const body = await req.json();
    const { message, context } = body;

    console.log('Processing message:', {
      messageLength: message?.length,
      hasContext: !!context,
      timestamp: new Date().toISOString()
    });

    // Input validation
    if (!message || typeof message !== 'string') {
      console.warn('Invalid message input:', typeof message);
      return new Response(
        JSON.stringify({ success: false, error: 'Message is required and must be a string' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Sanitize and validate message
    const sanitizedMessage = message
      .replace(/[<>]/g, '') // Remove potential HTML/XML tags
      .slice(0, 4000); // Limit message length

    if (sanitizedMessage.length < 1) {
      console.warn('Message empty after sanitization');
      return new Response(
        JSON.stringify({ success: false, error: 'Message cannot be empty after sanitization' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Validate and sanitize context
    const sanitizedContext = context && typeof context === 'string' 
      ? context.slice(0, 2000) 
      : '';

    console.log('Message sanitized successfully');

    const systemPrompt = `Você é um assistente especializado em gestão de transporte e frota de veículos. 
Você ajuda usuários a gerenciar veículos, motoristas, viagens, despesas, combustível e relatórios.

Contexto do sistema:
${sanitizedContext || 'Nenhum contexto específico fornecido'}

Instruções:
- Seja útil e direto nas respostas
- Use conhecimento específico sobre gestão de frota
- Forneça sugestões práticas e acionáveis
- Se não souber algo específico do sistema, seja honesto sobre isso
- Mantenha as respostas claras e organizadas`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: sanitizedMessage }
        ],
        max_tokens: 1000,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('OpenAI API Error:', {
        status: response.status,
        error: errorData,
        timestamp: new Date().toISOString()
      });
      throw new Error(`OpenAI API Error: ${errorData.error?.message || 'Erro desconhecido'}`);
    }

    const data = await response.json();
    
    if (!data.choices?.[0]?.message?.content) {
      console.error('Invalid OpenAI response structure:', data);
      throw new Error('Resposta inválida da OpenAI');
    }

    const generatedText = data.choices[0].message.content;

    console.log('AI response generated successfully:', {
      responseLength: generatedText.length,
      timestamp: new Date().toISOString()
    });

    return new Response(JSON.stringify({ 
      success: true, 
      response: generatedText 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in ai-chat function:', {
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
    
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message || 'Erro ao processar sua mensagem. Tente novamente.' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});