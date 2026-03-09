import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface AlertData {
  company_id: string
  alert_type: string
  severity: 'low' | 'medium' | 'high'
  title: string
  description: string
  metadata?: any
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    console.log('🔍 Starting fuel alerts monitoring...')

    const alerts: AlertData[] = []

    // 1. Buscar todas as empresas ativas
    const { data: companies, error: companiesError } = await supabase
      .from('companies')
      .select('id, name, default_target_consumption, consumption_alert_threshold')
      .eq('status', 'active')

    if (companiesError) {
      console.error('Error fetching companies:', companiesError)
      throw companiesError
    }

    console.log(`📊 Monitoring ${companies?.length || 0} companies`)

    for (const company of companies || []) {
      console.log(`\n🏢 Checking company: ${company.name} (${company.id})`)

      // 2. ALERTA DE CONSUMO CRÍTICO
      const { data: vehicles, error: vehiclesError } = await supabase
        .from('vehicles')
        .select('id, plate, model, actual_consumption, target_consumption, consumption_last_updated, current_fuel_level, tank_capacity')
        .eq('company_id', company.id)
        .eq('status', 'active')

      if (vehiclesError) {
        console.error('Error fetching vehicles:', vehiclesError)
        continue
      }

      for (const vehicle of vehicles || []) {
        const targetConsumption = vehicle.target_consumption || company.default_target_consumption || 3.5
        const threshold = company.consumption_alert_threshold || 15

        // Alerta de consumo crítico (15% abaixo da meta)
        if (vehicle.actual_consumption && targetConsumption) {
          const variance = ((vehicle.actual_consumption - targetConsumption) / targetConsumption) * 100
          
          if (variance < -threshold) {
            // Verificar se já existe alerta ativo para este veículo
            const { data: existingAlert } = await supabase
              .from('system_alerts')
              .select('id')
              .eq('company_id', company.id)
              .eq('alert_type', 'critical_consumption')
              .eq('status', 'active')
              .contains('metadata', { vehicle_id: vehicle.id })
              .single()

            if (!existingAlert) {
              alerts.push({
                company_id: company.id,
                alert_type: 'critical_consumption',
                severity: 'high',
                title: `Consumo Crítico: ${vehicle.plate}`,
                description: `O veículo ${vehicle.plate} (${vehicle.model}) está com consumo ${Math.abs(variance).toFixed(1)}% abaixo da meta. Consumo atual: ${vehicle.actual_consumption.toFixed(2)} km/l | Meta: ${targetConsumption.toFixed(2)} km/l`,
                metadata: {
                  vehicle_id: vehicle.id,
                  vehicle_plate: vehicle.plate,
                  actual_consumption: vehicle.actual_consumption,
                  target_consumption: targetConsumption,
                  variance_percent: variance
                }
              })
              console.log(`⚠️ Critical consumption alert for ${vehicle.plate}: ${variance.toFixed(1)}%`)
            }
          }
        }

        // 3. ALERTA DE TANQUE BAIXO (< 25%)
        if (vehicle.current_fuel_level !== null && vehicle.tank_capacity) {
          const fuelPercent = (vehicle.current_fuel_level / vehicle.tank_capacity) * 100
          
          if (fuelPercent < 25 && fuelPercent > 0) {
            const { data: existingAlert } = await supabase
              .from('system_alerts')
              .select('id')
              .eq('company_id', company.id)
              .eq('alert_type', 'low_fuel')
              .eq('status', 'active')
              .contains('metadata', { vehicle_id: vehicle.id })
              .single()

            if (!existingAlert) {
              // Calcular autonomia estimada
              const estimatedRange = vehicle.actual_consumption 
                ? vehicle.current_fuel_level * vehicle.actual_consumption 
                : 0

              alerts.push({
                company_id: company.id,
                alert_type: 'low_fuel',
                severity: fuelPercent < 15 ? 'high' : 'medium',
                title: `Combustível Baixo: ${vehicle.plate}`,
                description: `O veículo ${vehicle.plate} está com apenas ${fuelPercent.toFixed(1)}% de combustível (${vehicle.current_fuel_level.toFixed(1)}L de ${vehicle.tank_capacity}L). ${estimatedRange > 0 ? `Autonomia estimada: ${estimatedRange.toFixed(0)} km` : 'Abastecer em breve!'}`,
                metadata: {
                  vehicle_id: vehicle.id,
                  vehicle_plate: vehicle.plate,
                  current_fuel_level: vehicle.current_fuel_level,
                  tank_capacity: vehicle.tank_capacity,
                  fuel_percent: fuelPercent,
                  estimated_range: estimatedRange
                }
              })
              console.log(`⛽ Low fuel alert for ${vehicle.plate}: ${fuelPercent.toFixed(1)}%`)
            }
          }
        }
      }

      // 4. ALERTA DE HODÔMETRO PARADO (sem atualização há mais de 15 dias)
      const fifteenDaysAgo = new Date()
      fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15)

      const { data: staleVehicles, error: staleError } = await supabase
        .from('vehicles')
        .select('id, plate, model')
        .eq('company_id', company.id)
        .eq('status', 'active')
        .not('consumption_last_updated', 'is', null)
        .lt('consumption_last_updated', fifteenDaysAgo.toISOString())

      if (!staleError) {
        for (const vehicle of staleVehicles || []) {
          const { data: existingAlert } = await supabase
            .from('system_alerts')
            .select('id')
            .eq('company_id', company.id)
            .eq('alert_type', 'stale_odometer')
            .eq('status', 'active')
            .contains('metadata', { vehicle_id: vehicle.id })
            .single()

          if (!existingAlert) {
            alerts.push({
              company_id: company.id,
              alert_type: 'stale_odometer',
              severity: 'low',
              title: `Hodômetro Parado: ${vehicle.plate}`,
              description: `O veículo ${vehicle.plate} (${vehicle.model}) não teve atualização de hodômetro nos últimos 15 dias. Verifique se está em uso.`,
              metadata: {
                vehicle_id: vehicle.id,
                vehicle_plate: vehicle.plate
              }
            })
            console.log(`📊 Stale odometer alert for ${vehicle.plate}`)
          }
        }
      }
    }

    // Inserir alertas no banco
    if (alerts.length > 0) {
      const { error: insertError } = await supabase
        .from('system_alerts')
        .insert(alerts)

      if (insertError) {
        console.error('Error inserting alerts:', insertError)
        throw insertError
      }

      console.log(`\n✅ Created ${alerts.length} new alerts`)
    } else {
      console.log('\n✅ No new alerts to create')
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        alerts_created: alerts.length,
        message: `Monitoring completed. Created ${alerts.length} alerts.`
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )
  } catch (error) {
    console.error('Error in fuel-alerts-monitor:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})
