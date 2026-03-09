import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Fetching Nuvem Fiscal companies...');

    const response = await fetch('https://api.nuvemfiscal.com.br/empresas', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('NUVEM_FISCAL_TOKEN')}`,
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();
    console.log('Nuvem Fiscal response:', data);

    if (!response.ok) {
      console.error('Nuvem Fiscal API error:', data);
      throw new Error(`Nuvem Fiscal API error: ${data.message || 'Unknown error'}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        companies: data.data || data || [],
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in nuvem-fiscal-companies function:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        success: false,
        companies: [],
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});