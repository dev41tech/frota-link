import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const token = url.searchParams.get('token')
    const companySlug = url.searchParams.get('company_slug')
    const shortCode = url.searchParams.get('short_code')

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    let tokenData: any = null
    let tokenError: any = null

    if (companySlug && shortCode) {
      // Friendly URL: resolve by company slug + short_code
      const { data, error } = await supabase
        .from('customer_portal_tokens')
        .select('id, company_id, party_id, is_active, expires_at, short_code')
        .eq('short_code', shortCode)
        .single()

      if (!error && data) {
        // Verify company slug matches
        const { data: company } = await supabase
          .from('companies')
          .select('slug')
          .eq('id', data.company_id)
          .single()

        if (company?.slug === companySlug) {
          tokenData = data
        } else {
          tokenError = 'Slug inválido'
        }
      } else {
        tokenError = error
      }
    } else if (token) {
      // Legacy UUID token
      const { data, error } = await supabase
        .from('customer_portal_tokens')
        .select('id, company_id, party_id, is_active, expires_at')
        .eq('token', token)
        .single()
      tokenData = data
      tokenError = error
    } else {
      return new Response(JSON.stringify({ error: 'Token é obrigatório' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (tokenError || !tokenData) {
      return new Response(JSON.stringify({ error: 'Token inválido' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (!tokenData.is_active) {
      return new Response(JSON.stringify({ error: 'Token desativado' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (tokenData.expires_at && new Date(tokenData.expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: 'Token expirado' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Get party info
    const { data: party } = await supabase
      .from('parties')
      .select('id, name, document')
      .eq('id', tokenData.party_id)
      .single()

    // Get company info
    const { data: company } = await supabase
      .from('companies')
      .select('id, name, cnpj')
      .eq('id', tokenData.company_id)
      .single()

    // Update last_accessed_at
    await supabase
      .from('customer_portal_tokens')
      .update({ last_accessed_at: new Date().toISOString() })
      .eq('id', tokenData.id)

    return new Response(JSON.stringify({
      valid: true,
      token_id: tokenData.id,
      company_id: tokenData.company_id,
      party: {
        id: party?.id,
        name: party?.name,
        document: party?.document,
      },
      company: {
        name: company?.name,
        cnpj: company?.cnpj,
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Erro interno' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
