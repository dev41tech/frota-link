import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const MAX_APPROVALS_PER_HOUR = 10

// Resolve token from UUID token or company_slug + short_code
async function resolveToken(supabase: any, body: any) {
  const { token, company_slug, short_code } = body

  if (company_slug && short_code) {
    const { data } = await supabase
      .from('customer_portal_tokens')
      .select('id, company_id, party_id, is_active, expires_at')
      .eq('short_code', short_code)
      .single()

    if (!data) return null

    const { data: company } = await supabase
      .from('companies')
      .select('slug')
      .eq('id', data.company_id)
      .single()

    if (company?.slug !== company_slug) return null
    return data
  }

  if (token) {
    const { data } = await supabase
      .from('customer_portal_tokens')
      .select('id, company_id, party_id, is_active, expires_at')
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
    const body = await req.json()
    const { parsed_data, freight_value, freight_rate_id, vehicle_type_requested, customer_notes, estimation_source, estimation_details } = body

    if (!parsed_data || freight_value === undefined || freight_value === null) {
      return new Response(JSON.stringify({ error: 'Dados da cotação são obrigatórios' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const tokenData = await resolveToken(supabase, body)

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

    // Rate limiting
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const { count } = await supabase
      .from('freight_requests')
      .select('id', { count: 'exact', head: true })
      .eq('token_id', tokenData.id)
      .gte('created_at', oneHourAgo)

    if ((count || 0) >= MAX_APPROVALS_PER_HOUR) {
      return new Response(JSON.stringify({ error: 'Limite de aprovações por hora atingido. Tente novamente mais tarde.' }), {
        status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // INSERT the freight request now (only happens after customer approves)
    const { data: request, error: insertError } = await supabase
      .from('freight_requests')
      .insert({
        company_id: tokenData.company_id,
        party_id: tokenData.party_id,
        token_id: tokenData.id,
        status: 'pending',
        approved_at: new Date().toISOString(),
        nfe_xml_data: parsed_data,
        nfe_access_key: parsed_data.accessKey,
        nfe_number: parsed_data.nfeNumber,
        origin_city: parsed_data.emitter?.city,
        origin_state: parsed_data.emitter?.state,
        destination_city: parsed_data.recipient?.city,
        destination_state: parsed_data.recipient?.state,
        cargo_weight_kg: parsed_data.totalWeight,
        cargo_value: parsed_data.totalValue,
        cargo_description: parsed_data.cargoDescription,
        vehicle_type_requested: vehicle_type_requested || null,
        freight_value: freight_value,
        freight_rate_id: freight_rate_id || null,
        customer_notes: customer_notes || null,
      })
      .select()
      .single()

    if (insertError) {
      console.error('Insert error:', insertError)
      return new Response(JSON.stringify({ error: 'Erro ao criar solicitação' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    return new Response(JSON.stringify({
      success: true,
      request_id: request.id,
      request_number: request.request_number,
      message: 'Solicitação aprovada com sucesso',
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('Error:', error)
    return new Response(JSON.stringify({ error: 'Erro interno' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
