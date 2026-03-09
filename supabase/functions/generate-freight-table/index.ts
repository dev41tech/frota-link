import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BRAZILIAN_STATES = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA",
  "PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
];

const VEHICLE_TYPE_WEIGHT: Record<string, number> = {
  truck: 15000,
  carreta: 25000,
  van: 3000,
};
const DEFAULT_WEIGHT = 10000;

function extractUF(text: string | null): string | null {
  if (!text) return null;
  const upper = text.toUpperCase().trim();

  // Try regex: "São Paulo - SP", "Curitiba/PR", "Recife, PE"
  const match = upper.match(/[-\/,]\s*([A-Z]{2})\s*$/);
  if (match && BRAZILIAN_STATES.includes(match[1])) return match[1];

  // Fallback: find any known UF in the text (last occurrence wins)
  let found: string | null = null;
  for (const uf of BRAZILIAN_STATES) {
    if (upper.includes(uf)) found = uf;
  }
  return found;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { company_id, period_months = 6, target_margin = 0.2 } = await req.json();
    if (!company_id) {
      return new Response(JSON.stringify({ error: "company_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - period_months);
    const cutoff = cutoffDate.toISOString();

    // ---- STEP 1: Fetch journeys with vehicle info ----
    const { data: journeys } = await supabase
      .from("journeys")
      .select("id, origin, destination, freight_value, distance, vehicle_id, start_km, end_km")
      .eq("company_id", company_id)
      .eq("status", "completed")
      .gte("start_date", cutoff)
      .is("deleted_at", null);

    if (!journeys || journeys.length === 0) {
      return new Response(
        JSON.stringify({ cpk: 0, total_kms: 0, total_costs: 0, routes: [], message: "Nenhuma jornada completada encontrada no período." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch journey legs
    const journeyIds = journeys.map((j: any) => j.id);
    const { data: legs } = await supabase
      .from("journey_legs")
      .select("journey_id, origin, destination, freight_value, distance")
      .eq("company_id", company_id)
      .in("journey_id", journeyIds);

    // Fetch vehicles for weight hierarchy
    const vehicleIds = [...new Set(journeys.map((j: any) => j.vehicle_id).filter(Boolean))];
    let vehiclesMap: Record<string, any> = {};
    if (vehicleIds.length > 0) {
      const { data: vehicles } = await supabase
        .from("vehicles")
        .select("id, load_capacity, vehicle_type")
        .in("id", vehicleIds);
      if (vehicles) {
        for (const v of vehicles) {
          vehiclesMap[v.id] = v;
        }
      }
    }

    // Fetch freight_requests for real weight
    const { data: freightRequests } = await supabase
      .from("freight_requests")
      .select("journey_id, cargo_weight_kg")
      .eq("company_id", company_id)
      .in("journey_id", journeyIds)
      .not("cargo_weight_kg", "is", null);

    const frWeightMap: Record<string, number> = {};
    if (freightRequests) {
      for (const fr of freightRequests) {
        if (fr.journey_id && fr.cargo_weight_kg) {
          frWeightMap[fr.journey_id] = fr.cargo_weight_kg;
        }
      }
    }

    // ---- STEP 2: Build route data ----
    interface TripData {
      distance: number;
      freight_value: number;
      weight: number;
      weight_source: string;
    }

    const routeMap: Record<string, TripData[]> = {};

    const getWeight = (journeyId: string, vehicleId: string | null): { weight: number; source: string } => {
      // Priority 1: freight_request real weight
      if (frWeightMap[journeyId]) {
        return { weight: frWeightMap[journeyId], source: "real_weight" };
      }
      // Priority 2: vehicle load_capacity
      if (vehicleId && vehiclesMap[vehicleId]?.load_capacity) {
        return { weight: vehiclesMap[vehicleId].load_capacity, source: "vehicle_capacity" };
      }
      // Priority 3: default by vehicle type
      if (vehicleId && vehiclesMap[vehicleId]?.vehicle_type) {
        const vt = vehiclesMap[vehicleId].vehicle_type;
        return { weight: VEHICLE_TYPE_WEIGHT[vt] || DEFAULT_WEIGHT, source: "type_default" };
      }
      return { weight: DEFAULT_WEIGHT, source: "type_default" };
    };

    // Use legs when available, otherwise use journeys directly
    const journeysWithLegs = new Set((legs || []).map((l: any) => l.journey_id));

    // Process legs
    for (const leg of legs || []) {
      const originUF = extractUF(leg.origin);
      const destUF = extractUF(leg.destination);
      if (!originUF || !destUF || originUF === destUF) continue;
      if (!leg.distance || leg.distance <= 0) continue;

      const journey = journeys.find((j: any) => j.id === leg.journey_id);
      if (!journey) continue;

      const { weight, source } = getWeight(journey.id, journey.vehicle_id);
      const key = `${originUF}->${destUF}`;
      if (!routeMap[key]) routeMap[key] = [];
      routeMap[key].push({
        distance: leg.distance,
        freight_value: leg.freight_value || 0,
        weight,
        weight_source: source,
      });
    }

    // Process journeys without legs
    for (const j of journeys) {
      if (journeysWithLegs.has(j.id)) continue;
      const originUF = extractUF(j.origin);
      const destUF = extractUF(j.destination);
      if (!originUF || !destUF || originUF === destUF) continue;

      const dist = j.distance || (j.end_km && j.start_km ? j.end_km - j.start_km : 0);
      if (!dist || dist <= 0) continue;

      const { weight, source } = getWeight(j.id, j.vehicle_id);
      const key = `${originUF}->${destUF}`;
      if (!routeMap[key]) routeMap[key] = [];
      routeMap[key].push({
        distance: dist,
        freight_value: j.freight_value || 0,
        weight,
        weight_source: source,
      });
    }

    // ---- STEP 3: Calculate CPK ----
    // Total KMs from journeys
    let totalKms = 0;
    for (const j of journeys) {
      const dist = j.distance || (j.end_km && j.start_km ? j.end_km - j.start_km : 0);
      if (dist && dist > 0) totalKms += dist;
    }

    // Fetch costs
    const [fuelRes, expenseRes, apRes, maintRes] = await Promise.all([
      supabase.from("fuel_expenses").select("total_amount").eq("company_id", company_id).gte("date", cutoff).is("deleted_at", null).is("is_ignored", false),
      supabase.from("expenses").select("amount").eq("company_id", company_id).gte("date", cutoff).is("deleted_at", null).is("is_ignored", false),
      supabase.from("accounts_payable").select("amount").eq("company_id", company_id).eq("status", "paid").gte("due_date", cutoff).is("deleted_at", null),
      supabase.from("vehicle_maintenances").select("total_cost").eq("company_id", company_id).eq("status", "completed").gte("service_date", cutoff).is("deleted_at", null),
    ]);

    const totalFuel = (fuelRes.data || []).reduce((s: number, r: any) => s + (r.total_amount || 0), 0);
    const totalExpenses = (expenseRes.data || []).reduce((s: number, r: any) => s + (r.amount || 0), 0);
    const totalAP = (apRes.data || []).reduce((s: number, r: any) => s + (r.amount || 0), 0);
    const totalMaint = (maintRes.data || []).reduce((s: number, r: any) => s + (r.total_cost || 0), 0);

    const totalCosts = totalFuel + totalExpenses + totalAP + totalMaint;
    const cpk = totalKms > 0 ? totalCosts / totalKms : 0;

    // ---- STEP 4: Build route suggestions ----
    const routes = Object.entries(routeMap).map(([key, trips]) => {
      const [originState, destinationState] = key.split("->");
      const tripCount = trips.length;

      const medianDistance = median(trips.map((t) => t.distance));
      const medianWeight = median(trips.map((t) => t.weight));
      const medianFreight = median(trips.filter((t) => t.freight_value > 0).map((t) => t.freight_value));

      // Determine predominant weight source
      const sourceCounts: Record<string, number> = {};
      for (const t of trips) {
        sourceCounts[t.weight_source] = (sourceCounts[t.weight_source] || 0) + 1;
      }
      const weightSource = Object.entries(sourceCounts).sort((a, b) => b[1] - a[1])[0][0];

      // Cost-Plus calculation
      const routeCost = medianDistance * cpk;
      const idealValue = routeCost * (1 + target_margin);
      const ratePerKg = medianWeight > 0 ? idealValue / medianWeight : 0;

      // Confidence
      let confidence: string;
      if (tripCount >= 5) confidence = "high";
      else if (tripCount >= 3) confidence = "medium";
      else confidence = "low";

      return {
        origin_state: originState,
        destination_state: destinationState,
        trip_count: tripCount,
        median_distance: Math.round(medianDistance),
        median_weight: Math.round(medianWeight),
        weight_source: weightSource,
        median_freight_practiced: Math.round(medianFreight * 100) / 100,
        suggested_rate_per_kg: Math.round(ratePerKg * 100) / 100,
        suggested_minimum_freight: Math.round(idealValue * 100) / 100,
        confidence,
      };
    });

    // Sort by trip count desc
    routes.sort((a, b) => b.trip_count - a.trip_count);

    return new Response(
      JSON.stringify({
        cpk: Math.round(cpk * 100) / 100,
        total_kms: Math.round(totalKms),
        total_costs: Math.round(totalCosts * 100) / 100,
        routes,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("Error generating freight table:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
