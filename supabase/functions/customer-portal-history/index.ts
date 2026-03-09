import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Resolve token from UUID token or company_slug + short_code
async function resolveToken(supabase: any, params: URLSearchParams) {
  const token = params.get('token')
  const companySlug = params.get('company_slug')
  const shortCode = params.get('short_code')

  if (companySlug && shortCode) {
    const { data } = await supabase
      .from('customer_portal_tokens')
      .select('id, party_id, company_id, is_active, expires_at')
      .eq('short_code', shortCode)
      .single()

    if (!data) return null

    const { data: company } = await supabase
      .from('companies')
      .select('slug')
      .eq('id', data.company_id)
      .single()

    if (company?.slug !== companySlug) return null
    return data
  }

  if (token) {
    const { data } = await supabase
      .from('customer_portal_tokens')
      .select('id, party_id, is_active, expires_at')
      .eq('token', token)
      .single()
    return data
  }

  return null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const tokenData = await resolveToken(supabase, url.searchParams)

    if (!tokenData || !tokenData.is_active) {
      return new Response(JSON.stringify({ error: 'Token inválido' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (tokenData.expires_at && new Date(tokenData.expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: 'Token expirado' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const { data: requests, error } = await supabase
      .from('freight_requests')
      .select('id, request_number, status, origin_city, origin_state, destination_city, destination_state, cargo_weight_kg, cargo_value, freight_value, nfe_number, created_at, approved_at, approved_by_operator_at, collection_date, collection_address, collection_notes, driver_id')
      .eq('party_id', tokenData.party_id)
      .eq('token_id', tokenData.id)
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) {
      return new Response(JSON.stringify({ error: 'Erro ao buscar histórico' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Resolve driver names
    const driverIds = (requests || []).filter(r => r.driver_id).map(r => r.driver_id)
    let driverMap: Record<string, string> = {}
    if (driverIds.length > 0) {
      const { data: drivers } = await supabase
        .from('drivers')
        .select('id, name')
        .in('id', driverIds)
      if (drivers) {
        driverMap = Object.fromEntries(drivers.map(d => [d.id, d.name]))
      }
    }

    const enrichedRequests = (requests || []).map(r => ({
      ...r,
      driver_name: r.driver_id ? (driverMap[r.driver_id] || null) : null,
    }))

    return new Response(JSON.stringify({ requests: enrichedRequests }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Erro interno' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
