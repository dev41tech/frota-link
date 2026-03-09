import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `Você é o FleetBot, um assistente virtual especializado em gestão de frotas de veículos e transporte rodoviário.

## Personalidade
- Amigável, profissional e prestativo
- Use emojis moderadamente para tornar a conversa mais humanizada
- Dê respostas diretas e acionáveis
- Faça perguntas de acompanhamento quando apropriado
- Lembre-se do contexto da conversa

## Conhecimentos
- Gestão de frotas e veículos
- Controle de combustível e consumo
- Análise financeira de transportes
- Legislação de transporte (CT-e, MDF-e)
- Manutenção preventiva
- Gestão de motoristas
- Rotas e logística

## Capacidades de Análise de Economia
Você pode identificar oportunidades de economia analisando:

1. **Combustível**: Compare consumo real vs ideal
   - Calcule economia potencial se veículos ineficientes melhorassem
   - Sugira ações específicas (troca de pneus, calibragem, treinamento)
   - Identifique veículos que consomem muito acima da média
   - Analise preços por posto e sugira onde abastecer

2. **Manutenções**: Identifique custos evitáveis
   - Manutenções atrasadas = risco de quebra maior
   - Compare custo preventiva vs corretiva
   - Alerte sobre manutenções urgentes
   - Identifique fornecedores mais usados

3. **Rotas**: Otimize operação
   - Identifique rotas mais lucrativas
   - Sugira priorização de trechos rentáveis
   - Analise duração média e distâncias

4. **Motoristas**: Destaque melhores práticas
   - Quem economiza mais combustível?
   - Quem tem melhor margem de lucro?
   - Identifique padrões de sucesso

5. **Fluxo de Caixa**: Planejamento financeiro
   - Contas a vencer nos próximos 7/30 dias
   - Contas em atraso
   - Previsão de gastos

6. **Frota**: Gestão de ativos
   - Idade média da frota
   - Veículos ociosos vs sobrecarregados
   - Seguros vencendo
   - Valor total da frota

## Formato de Respostas
- Use **negrito** para destacar informações importantes
- Use listas com • para organizar informações
- Inclua números e métricas quando disponíveis
- Seja conciso mas completo
- SEMPRE forneça valores em R$ e percentuais específicos baseados nos dados reais
- Sempre ofereça próximos passos ou perguntas de acompanhamento

## Contexto da Frota
{fleet_context}

## Instruções Adicionais
- Se não tiver dados suficientes, seja honesto e sugira como obter
- Nunca invente números ou dados - use apenas os dados fornecidos
- Sempre considere o contexto brasileiro de transporte
- Valores monetários em R$ (Real brasileiro)
- Quando calcular economia potencial, explique a metodologia`;

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatPercent(value: number): string {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('pt-BR');
  } catch {
    return dateStr;
  }
}

function buildFleetContext(fleetData: any): string {
  if (!fleetData) {
    return "Nenhum dado específico da frota disponível no momento.";
  }

  let context = `
═══ VISÃO GERAL (últimos 30 dias) ═══
• Veículos: ${fleetData.totalVehicles || 0} unidades
• Motoristas ativos: ${fleetData.totalDrivers || 0}
• Jornadas em andamento: ${fleetData.activeJourneys || 0}
• Receita mensal: ${formatCurrency(fleetData.monthlyRevenue || 0)}
• Custos com combustível: ${formatCurrency(fleetData.totalFuelCosts || 0)}
• Outras despesas: ${formatCurrency(fleetData.totalExpenses || 0)}
• Contas pendentes: ${formatCurrency(fleetData.pendingPayables || 0)}
• Consumo médio da frota: ${(fleetData.averageConsumption || 0).toFixed(1)} km/L
`;

  // Profitability
  if (fleetData.profitability) {
    const p = fleetData.profitability;
    context += `
═══ LUCRATIVIDADE ═══
• Lucro total: ${formatCurrency(p.totalProfit || 0)}
• Margem média: ${(p.avgMargin || 0).toFixed(1)}%
• Lucro por km: ${formatCurrency(p.profitPerKm || 0)}/km
• Jornadas concluídas: ${p.completedJourneys || 0}
• Distância total: ${(p.totalDistance || 0).toLocaleString('pt-BR')} km
`;
  }

  // Route analysis (NEW)
  if (fleetData.routes) {
    const r = fleetData.routes;
    context += `
═══ ANÁLISE DE ROTAS ═══
• Duração média por jornada: ${(r.avgJourneyDuration || 0).toFixed(1)} horas
• Distância média por jornada: ${(r.avgDistancePerJourney || 0).toFixed(0)} km
• Total de adiantamentos pagos: ${formatCurrency(r.totalAdvances || 0)}
• Total de comissões pagas: ${formatCurrency(r.totalCommissions || 0)}`;
    
    if (r.topProfitableRoutes && r.topProfitableRoutes.length > 0) {
      context += `\n• Rotas mais lucrativas:`;
      r.topProfitableRoutes.slice(0, 5).forEach((route: any) => {
        context += `\n  - ${route.origin} → ${route.destination}: ${formatCurrency(route.avgRevenue)} média (${route.count} viagens)`;
      });
    }
    context += '\n';
  }

  // Expense breakdown (NEW)
  if (fleetData.expenseBreakdown) {
    const e = fleetData.expenseBreakdown;
    context += `
═══ BREAKDOWN DE DESPESAS ═══
• Despesas diretas: ${formatCurrency(e.directVsIndirect?.direct || 0)}
• Despesas indiretas: ${formatCurrency(e.directVsIndirect?.indirect || 0)}
• Média de despesa por jornada: ${formatCurrency(e.avgExpensePerJourney || 0)}`;
    
    if (e.byCategory && e.byCategory.length > 0) {
      context += `\n• Por categoria:`;
      e.byCategory.slice(0, 5).forEach((cat: any) => {
        context += `\n  - ${cat.category}: ${formatCurrency(cat.amount)} (${cat.percentage.toFixed(1)}%)`;
      });
    }
    
    if (e.topSuppliers && e.topSuppliers.length > 0) {
      context += `\n• Principais fornecedores:`;
      e.topSuppliers.slice(0, 3).forEach((sup: any) => {
        context += `\n  - ${sup.name}: ${formatCurrency(sup.amount)}`;
      });
    }
    context += '\n';
  }

  // Fuel analysis (NEW)
  if (fleetData.fuelAnalysis) {
    const f = fleetData.fuelAnalysis;
    context += `
═══ ANÁLISE DE COMBUSTÍVEL ═══
• Preço médio: R$ ${(f.avgPricePerLiter || 0).toFixed(2)}/L
• Variação de preço: R$ ${(f.priceVariation?.min || 0).toFixed(2)} a R$ ${(f.priceVariation?.max || 0).toFixed(2)}/L
• Total abastecido: ${(f.totalLiters || 0).toLocaleString('pt-BR')} litros
• Custo por km: ${formatCurrency(f.costPerKm || 0)}/km`;
    
    // Calculate potential savings
    if (f.priceVariation && f.totalLiters > 0) {
      const potentialSavings = (f.avgPricePerLiter - f.priceVariation.min) * f.totalLiters;
      if (potentialSavings > 0) {
        context += `\n• 💰 Economia potencial (usando preço mínimo): ${formatCurrency(potentialSavings)}`;
      }
    }
    
    if (f.topStations && f.topStations.length > 0) {
      context += `\n• Postos mais utilizados:`;
      f.topStations.forEach((station: any) => {
        context += `\n  - ${station.name}: R$ ${(station.avgPrice || 0).toFixed(2)}/L média, ${formatCurrency(station.totalSpent)} total`;
      });
    }
    context += '\n';
  }

  // Vehicle consumption analysis
  if (fleetData.vehicleConsumption) {
    const vc = fleetData.vehicleConsumption;
    context += `
═══ ANÁLISE DE CONSUMO POR VEÍCULO ═══`;
    if (vc.bestVehicle) {
      context += `
• 🏆 Melhor veículo: ${vc.bestVehicle.plate} (${vc.bestVehicle.consumption.toFixed(1)} km/L)`;
    }
    if (vc.worstVehicle) {
      context += `
• ⚠️ Pior veículo: ${vc.worstVehicle.plate} (${vc.worstVehicle.consumption.toFixed(1)} km/L)`;
    }
    context += `
• Veículos eficientes (acima da meta): ${vc.belowTarget || 0}
• Veículos ineficientes (abaixo da meta): ${vc.aboveTarget || 0}
• 💰 ECONOMIA POTENCIAL: ${formatCurrency(vc.potentialSavings || 0)}
  (se veículos ineficientes atingissem a média da frota)
`;
  }

  // Fleet details (NEW)
  if (fleetData.fleetDetails) {
    const fd = fleetData.fleetDetails;
    context += `
═══ DETALHES DA FROTA ═══
• Idade média: ${(fd.avgAge || 0).toFixed(1)} anos
• Valor total da frota: ${formatCurrency(fd.totalFleetValue || 0)}`;
    
    if (fd.byFuelType && fd.byFuelType.length > 0) {
      context += `\n• Por tipo de combustível: ${fd.byFuelType.map((f: any) => `${f.type} (${f.count})`).join(', ')}`;
    }
    
    if (fd.byBrand && fd.byBrand.length > 0) {
      context += `\n• Por marca: ${fd.byBrand.map((b: any) => `${b.brand} (${b.count})`).join(', ')}`;
    }
    
    if (fd.insuranceExpiring && fd.insuranceExpiring.length > 0) {
      context += `\n• 🚨 Seguros vencendo em 30 dias:`;
      fd.insuranceExpiring.forEach((v: any) => {
        context += `\n  - ${v.plate}: vence em ${formatDate(v.expiryDate)}`;
      });
    }
    
    if (fd.vehicleUtilization && fd.vehicleUtilization.length > 0) {
      const idleVehicles = fd.vehicleUtilization.filter((v: any) => v.status === 'ocioso');
      const intensiveVehicles = fd.vehicleUtilization.filter((v: any) => v.status === 'intensivo');
      
      if (idleVehicles.length > 0) {
        context += `\n• ⚠️ Veículos ociosos (0 jornadas): ${idleVehicles.map((v: any) => v.plate).join(', ')}`;
      }
      if (intensiveVehicles.length > 0) {
        context += `\n• Veículos intensivos (>10 jornadas): ${intensiveVehicles.map((v: any) => `${v.plate} (${v.journeysCount} jornadas)`).join(', ')}`;
      }
    }
    context += '\n';
  }

  // Maintenance
  if (fleetData.maintenance) {
    const m = fleetData.maintenance;
    context += `
═══ MANUTENÇÕES ═══
• Gasto este mês: ${formatCurrency(m.totalSpentMonth || 0)}
• Gasto no ano: ${formatCurrency(m.totalSpentYear || 0)}
• Custo médio por veículo: ${formatCurrency(m.avgCostPerVehicle || 0)}
• ⚠️ Manutenções atrasadas: ${m.overdueCount || 0}
• Próximas 30 dias: ${m.upcomingCount || 0}`;
    
    if (m.laborVsParts) {
      context += `\n• Mão de obra: ${formatCurrency(m.laborVsParts.labor || 0)} | Peças: ${formatCurrency(m.laborVsParts.parts || 0)}`;
    }
    
    if (m.preventiveVsCorrective) {
      const total = (m.preventiveVsCorrective.preventive || 0) + (m.preventiveVsCorrective.corrective || 0);
      const prevPercent = total > 0 ? ((m.preventiveVsCorrective.preventive / total) * 100).toFixed(0) : 0;
      context += `\n• Preventivas: ${formatCurrency(m.preventiveVsCorrective.preventive || 0)} (${prevPercent}%) | Corretivas: ${formatCurrency(m.preventiveVsCorrective.corrective || 0)}`;
    }
    
    if (m.topCategories && m.topCategories.length > 0) {
      context += `\n• Maiores gastos: ${m.topCategories.map((c: any) => `${c.category} (${formatCurrency(c.amount)})`).join(', ')}`;
    }
    
    if (m.topProviders && m.topProviders.length > 0) {
      context += `\n• Principais oficinas: ${m.topProviders.map((p: any) => `${p.name} (${formatCurrency(p.totalSpent)})`).join(', ')}`;
    }
    context += '\n';
  }

  // Cash flow (NEW)
  if (fleetData.cashFlow) {
    const cf = fleetData.cashFlow;
    context += `
═══ FLUXO DE CAIXA ═══
• Vencendo próximos 7 dias: ${formatCurrency(cf.totalDueNext7Days || 0)}
• Vencendo próximos 30 dias: ${formatCurrency(cf.totalDueNext30Days || 0)}
• 🚨 Contas em atraso: ${formatCurrency(cf.overduePayables || 0)}`;
    
    if (cf.nextPayables && cf.nextPayables.length > 0) {
      context += `\n• Próximas contas:`;
      cf.nextPayables.slice(0, 5).forEach((p: any) => {
        context += `\n  - ${p.description}: ${formatCurrency(p.amount)} (vence ${formatDate(p.dueDate)})`;
      });
    }
    context += '\n';
  }

  // Driver performance
  if (fleetData.driverPerformance) {
    const dp = fleetData.driverPerformance;
    context += `
═══ DESEMPENHO DOS MOTORISTAS ═══`;
    if (dp.topDriver) {
      context += `
• 🏆 Melhor motorista: ${dp.topDriver.name} (receita: ${formatCurrency(dp.topDriver.profit)})`;
    }
    if (dp.worstDriver) {
      context += `
• Necessita atenção: ${dp.worstDriver.name} (receita: ${formatCurrency(dp.worstDriver.profit)})`;
    }
    context += `
• Margem média: ${(dp.avgMargin || 0).toFixed(1)}%
`;
  }

  // Comparison
  if (fleetData.comparison) {
    const c = fleetData.comparison;
    context += `
═══ COMPARATIVO COM MÊS ANTERIOR ═══
• Receita: ${c.revenueChange >= 0 ? '↑' : '↓'} ${formatPercent(c.revenueChange)}
• Despesas: ${c.expenseChange >= 0 ? '↑' : '↓'} ${formatPercent(c.expenseChange)}
• Combustível: ${c.fuelChange >= 0 ? '↑' : '↓'} ${formatPercent(c.fuelChange)}
`;
  }

  // Performance history (NEW)
  if (fleetData.performanceHistory) {
    const ph = fleetData.performanceHistory;
    context += `
═══ TENDÊNCIA DE PERFORMANCE ═══
• Tendência de receita: ${ph.revenueGrowthTrend === 'crescendo' ? '📈 Crescendo' : ph.revenueGrowthTrend === 'caindo' ? '📉 Caindo' : '➡️ Estável'}`;
    
    if (ph.last3Months && ph.last3Months.length > 0) {
      context += `\n• Últimos meses:`;
      ph.last3Months.forEach((m: any) => {
        context += `\n  - ${m.month}: Receita ${formatCurrency(m.revenue)}`;
      });
    }
    context += '\n';
  }

  // Alerts
  if (fleetData.alerts) {
    const a = fleetData.alerts;
    const hasAlerts = a.cnhExpiringSoon > 0 || a.maintenanceOverdue > 0 || a.vehiclesCritical > 0;
    if (hasAlerts) {
      context += `
═══ ⚠️ ALERTAS ATIVOS ═══`;
      if (a.cnhExpiringSoon > 0) context += `\n• ${a.cnhExpiringSoon} CNH(s) vencendo em 30 dias`;
      if (a.maintenanceOverdue > 0) context += `\n• ${a.maintenanceOverdue} manutenção(ões) atrasada(s)`;
      if (a.vehiclesCritical > 0) context += `\n• ${a.vehiclesCritical} veículo(s) em estado crítico de consumo`;
      context += '\n';
    }
  }

  return context;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, fleetData } = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "API key não configurada" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build comprehensive fleet context
    const fleetContext = buildFleetContext(fleetData);
    const systemPrompt = SYSTEM_PROMPT.replace("{fleet_context}", fleetContext);

    console.log("Smart assistant request:", {
      messagesCount: messages?.length,
      hasFleetData: !!fleetData,
      hasExtendedData: !!(fleetData?.routes || fleetData?.expenseBreakdown || fleetData?.fuelAnalysis),
      hasFleetDetails: !!fleetData?.fleetDetails,
      hasCashFlow: !!fleetData?.cashFlow,
      timestamp: new Date().toISOString()
    });

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Muitas requisições. Aguarde um momento e tente novamente." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos esgotados. Adicione créditos ao workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: "Erro ao processar sua mensagem" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Return streaming response
    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
    
  } catch (error) {
    console.error("Smart assistant error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
