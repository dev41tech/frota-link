import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { DOMParser } from 'https://deno.land/x/deno_dom@v0.1.38/deno-dom-wasm.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const MAX_PAYLOAD_SIZE = 2 * 1024 * 1024
const MAX_SUBMISSIONS_PER_HOUR = 10

// --- XML Parsing helpers ---

function getTextContent(element: any, tagName: string): string {
  if (!element) return ''
  const tag = element.getElementsByTagName(tagName)[0]
  return tag?.textContent?.trim() || ''
}

function getNumericContent(element: any, tagName: string): number {
  const text = getTextContent(element, tagName)
  return text ? parseFloat(text) : 0
}

function parseNFeXml(xmlContent: string) {
  const parser = new DOMParser()
  const doc = parser.parseFromString(xmlContent, 'text/html')
  if (!doc) return null

  const infNFe = doc.getElementsByTagName('infNFe')[0]
  if (!infNFe) return null

  let accessKey = (infNFe.getAttribute('Id') || '').replace(/^NFe/, '')
  if (!accessKey || accessKey.length !== 44) {
    accessKey = getTextContent(doc as any, 'chNFe')
  }

  const ide = doc.getElementsByTagName('ide')[0]
  const emit = doc.getElementsByTagName('emit')[0]
  const dest = doc.getElementsByTagName('dest')[0]
  const total = doc.getElementsByTagName('total')[0]
  const icmsTot = total ? total.getElementsByTagName('ICMSTot')[0] : null
  const transp = doc.getElementsByTagName('transp')[0]
  const vol = transp ? transp.getElementsByTagName('vol')[0] : null
  const enderEmit = emit ? emit.getElementsByTagName('enderEmit')[0] : null
  const enderDest = dest ? dest.getElementsByTagName('enderDest')[0] : null

  return {
    accessKey,
    nfeNumber: getTextContent(ide, 'nNF'),
    emitter: {
      name: getTextContent(emit, 'xNome'),
      cnpj: getTextContent(emit, 'CNPJ'),
      ie: getTextContent(emit, 'IE'),
      city: getTextContent(enderEmit, 'xMun'),
      state: getTextContent(enderEmit, 'UF'),
      address: {
        logradouro: getTextContent(enderEmit, 'xLgr'),
        numero: getTextContent(enderEmit, 'nro'),
        complemento: getTextContent(enderEmit, 'xCpl'),
        bairro: getTextContent(enderEmit, 'xBairro'),
        cidade: getTextContent(enderEmit, 'xMun'),
        uf: getTextContent(enderEmit, 'UF'),
        cep: getTextContent(enderEmit, 'CEP'),
      },
    },
    recipient: {
      name: getTextContent(dest, 'xNome'),
      document: getTextContent(dest, 'CNPJ') || getTextContent(dest, 'CPF'),
      ie: getTextContent(dest, 'IE'),
      city: getTextContent(enderDest, 'xMun'),
      state: getTextContent(enderDest, 'UF'),
    },
    totalValue: getNumericContent(icmsTot, 'vNF'),
    totalProducts: getNumericContent(icmsTot, 'vProd'),
    totalWeight: getNumericContent(vol, 'pesoB'),
    cargoDescription: getTextContent(doc.getElementsByTagName('infAdFisco')[0] || doc.getElementsByTagName('det')[0]?.getElementsByTagName('prod')[0], 'xProd') || 'Mercadoria',
  }
}

// --- Token resolution ---

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

// --- Simulator fallback ---

async function getDistanceFromGoogle(originCity: string, originState: string, destCity: string, destState: string): Promise<number | null> {
  const apiKey = Deno.env.get('Maps_API_KEY')
  if (!apiKey) {
    console.warn('Maps_API_KEY not configured, skipping distance calculation')
    return null
  }

  try {
    const origin = encodeURIComponent(`${originCity}, ${originState}, Brasil`)
    const destination = encodeURIComponent(`${destCity}, ${destState}, Brasil`)
    const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${origin}&destinations=${destination}&key=${apiKey}`

    const response = await fetch(url)
    if (!response.ok) {
      console.error('Google Maps API error:', response.status)
      return null
    }

    const data = await response.json()
    const element = data.rows?.[0]?.elements?.[0]
    if (element?.status === 'OK' && element.distance?.value) {
      return Math.round(element.distance.value / 1000) // meters to km
    }

    console.warn('Google Maps returned no distance:', element?.status)
    return null
  } catch (err) {
    console.error('Error fetching distance from Google:', err)
    return null
  }
}

async function calculateSimulatorFallback(
  supabase: any,
  companyId: string,
  parsed: any
): Promise<{ freightValue: number; details: any } | null> {
  try {
    // 0. Get company pricing settings
    const { data: settings } = await supabase
      .from('freight_pricing_settings')
      .select('*')
      .eq('company_id', companyId)
      .maybeSingle()

    // 1. Get distance via Google Maps
    const distanceKm = await getDistanceFromGoogle(
      parsed.emitter.city, parsed.emitter.state,
      parsed.recipient.city, parsed.recipient.state
    )

    if (!distanceKm || distanceKm <= 0) {
      console.log('Could not determine distance, skipping simulator fallback')
      return null
    }

    // 2. Get average fleet consumption (filter outliers < 15 km/l)
    let fleetAvg: number | null = null
    const { data: vehicles } = await supabase
      .from('vehicles')
      .select('actual_consumption')
      .eq('company_id', companyId)
      .gt('actual_consumption', 0)
      .lt('actual_consumption', 15)

    if (vehicles && vehicles.length > 0) {
      fleetAvg = vehicles.reduce((sum: number, v: any) => sum + v.actual_consumption, 0) / vehicles.length
    }

    // 3. Get average diesel price (last 30 days)
    let fuelAvg: number | null = null
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const { data: fuelData } = await supabase
      .from('fuel_expenses')
      .select('price_per_liter')
      .eq('company_id', companyId)
      .gt('price_per_liter', 0)
      .gte('date', thirtyDaysAgo)

    if (fuelData && fuelData.length > 0) {
      fuelAvg = fuelData.reduce((sum: number, f: any) => sum + f.price_per_liter, 0) / fuelData.length
    }

    // 4. Use settings > fleet data > defaults
    const avgConsumption = settings?.avg_consumption_kml || fleetAvg || 2.5
    const avgDieselPrice = settings?.avg_diesel_price || fuelAvg || 6.29
    const axles = settings?.default_axles || 7
    const tollPerAxleKm = settings?.toll_cost_per_axle_km || 0.11
    const margin = (settings?.profit_margin || 30) / 100
    const commission = (settings?.driver_commission || 12) / 100
    const totalDeductions = margin + commission

    // 5. Calculate costs (same formula as Simulator page)
    const fuelCost = (distanceKm / avgConsumption) * avgDieselPrice
    const estimatedToll = distanceKm * axles * tollPerAxleKm
    const operationalCost = fuelCost + estimatedToll
    const suggestedFreight = totalDeductions >= 1
      ? operationalCost * 2
      : operationalCost / (1 - totalDeductions)

    const freightValue = Math.round(suggestedFreight * 100) / 100

    return {
      freightValue,
      details: {
        distance_km: distanceKm,
        avg_consumption_kml: Math.round(avgConsumption * 100) / 100,
        avg_diesel_price: Math.round(avgDieselPrice * 100) / 100,
        fuel_cost: Math.round(fuelCost * 100) / 100,
        estimated_toll: Math.round(estimatedToll * 100) / 100,
        margin_applied: margin,
        driver_commission: commission,
        total_deductions: totalDeductions,
        axles,
        toll_per_axle_km: tollPerAxleKm,
      },
    }
  } catch (err) {
    console.error('Simulator fallback error:', err)
    return null
  }
}

// --- Main handler ---

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const contentLength = parseInt(req.headers.get('content-length') || '0')
    if (contentLength > MAX_PAYLOAD_SIZE) {
      return new Response(JSON.stringify({ error: 'Payload excede limite de 2MB' }), {
        status: 413, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const body = await req.json()
    const { xml_content, vehicle_type_requested, customer_notes, manual_weight } = body

    if (!xml_content) {
      return new Response(JSON.stringify({ error: 'XML é obrigatório' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (xml_content.length > MAX_PAYLOAD_SIZE) {
      return new Response(JSON.stringify({ error: 'XML excede limite de 2MB' }), {
        status: 413, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const tokenData = await resolveToken(supabase, body)

    if (!tokenData || !tokenData.is_active) {
      return new Response(JSON.stringify({ error: 'Token inválido ou inativo' }), {
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

    if ((count || 0) >= MAX_SUBMISSIONS_PER_HOUR) {
      return new Response(JSON.stringify({ error: 'Limite de submissões por hora atingido. Tente novamente mais tarde.' }), {
        status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const parsed = parseNFeXml(xml_content)
    if (!parsed) {
      return new Response(JSON.stringify({ error: 'Não foi possível processar o XML da NF-e. Verifique o arquivo.' }), {
        status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Apply manual weight if XML has no weight
    if (parsed.totalWeight <= 0 && manual_weight && manual_weight > 0) {
      parsed.totalWeight = manual_weight
    }

    // If weight is still 0, return error asking for manual input
    if (parsed.totalWeight <= 0) {
      return new Response(JSON.stringify({
        error: 'weight_required',
        message: 'O XML não contém informação de peso. Informe o peso manualmente.',
        parsed_data: parsed,
      }), {
        status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Find best freight rate
    const { data: rates } = await supabase
      .from('freight_rates')
      .select('*')
      .eq('company_id', tokenData.company_id)
      .eq('is_active', true)
      .lte('min_weight_kg', parsed.totalWeight || 0)
      .gte('max_weight_kg', parsed.totalWeight || 0)

    let bestRate = null
    let freightValue = 0
    let estimationSource: string | null = null
    let estimationDetails: any = null

    if (rates && rates.length > 0) {
      // Try exact UF match, then partial match — NO blind fallback
      bestRate = rates.find((r: any) =>
        r.origin_state === parsed.emitter.state && r.destination_state === parsed.recipient.state
      ) || rates.find((r: any) =>
        (r.origin_state === parsed.emitter.state || !r.origin_state) &&
        (r.destination_state === parsed.recipient.state || !r.destination_state)
      )
    }

    if (bestRate) {
      // Calculate using freight table
      const calculatedValue = (parsed.totalWeight || 0) * bestRate.rate_per_kg
      freightValue = Math.max(calculatedValue, bestRate.minimum_freight)
    } else {
      // FALLBACK: Simulator-based estimation (no matching rate found)
      console.log('No matching freight rate, using simulator fallback for company:', tokenData.company_id)
      const fallback = await calculateSimulatorFallback(supabase, tokenData.company_id, parsed)
      if (fallback) {
        freightValue = fallback.freightValue
        estimationSource = 'simulator'
        estimationDetails = fallback.details
      }
    }

    // Return calculated data WITHOUT inserting into database
    // The INSERT will happen only when the customer approves via customer-portal-approve
    const responsePayload: any = {
      parsed_data: parsed,
      freight_value: freightValue,
      has_rate: !!bestRate,
      freight_rate_id: bestRate?.id || null,
      vehicle_type_requested: vehicle_type_requested || null,
      customer_notes: customer_notes || null,
    }

    if (estimationSource) {
      responsePayload.estimation_source = estimationSource
      responsePayload.estimation_details = estimationDetails
    }

    return new Response(JSON.stringify(responsePayload), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('Error:', error)
    return new Response(JSON.stringify({ error: 'Erro interno do servidor' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
