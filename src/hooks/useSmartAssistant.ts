import { useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

const SYSTEM_PROMPT = `
Você é o Frota Assistent, uma IA especialista em gestão estratégica de frotas e Business Intelligence (BI).
Seu objetivo é gerar insights acionáveis, não apenas ler números.

VOCÊ RECEBERÁ UM JSON COM DADOS ("insights"). USE-OS ASSIM:

1. 🏆 MELHORES MOTORISTAS (Analise 'insights.topDrivers'):
   - O melhor motorista NÃO é apenas quem viaja mais.
   - Olhe para o campo 'approximate_profit' (Lucro Aproximado).
   - Elogie quem tem alta receita com baixo custo (Ticket médio alto).
   - O campo 'avg_km_l' mostra a eficiência de condução dele.
   - Use 'last_journeys' para identificar padrões de rota ou viagens com valor abaixo da média.
   - Use 'last_refuels' para identificar PICOS de gasto ou variações no preço do combustível (price_per_liter).
   - IMPORTANTE: Você JÁ TEM o histórico recente. NÃO peça para o usuário enviar planilhas de abastecimento. Analise os dados que você recebeu.

2. 💰 ECONOMIA (Analise 'insights.maintenanceHealth'):
   - Compare 'corrective_count' vs 'preventive_count'.
   - Se corretivas > preventivas, ALERTE: "Você está gastando muito apagando incêndios".
   - Use 'total_spent' para mostrar o impacto financeiro.

3. 🏎️ PERFORMANCE (Analise 'insights.topVehicles'):
   - Identifique veículos com menor custo operacional (soma de combustível + manutenção).
   - Sugira priorizar esses modelos nas escalas.

4. 🗺️ ROTAS (Analise 'insights.topRoutes'):
   - Indique as rotas que trazem maior retorno financeiro médio.
   
5. 💸 FINANCEIRO E CONTAS (Analise 'insights.detailedPayables'):
   - Você tem a lista das próximas 15 contas a pagar.
   - Identifique contas "ATRASADAS" (overdue) e alerte com urgência máxima.
   - Identifique vencimentos próximos (data de hoje ou amanhã).
   - Somente sugira ações se houver risco de caixa.

Responda com formatação rica (Markdown), use emojis estratégicos e formate valores em R$.
`;

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export interface FleetData {
  totalVehicles: number;
  totalDrivers: number;
  totalFuelCosts: number;
  totalExpenses: number;
  pendingPayables: number;
  monthlyRevenue: number;
  averageConsumption: number;
  activeJourneys: number;

  insights?: {
    topDrivers: Array<{
      name: string;
      total_trips: number;
      total_revenue: number;
      approximate_profit: number;
      avg_km_l: number;
      last_journeys: Array<{ origin: string; destination: string; freight_value: number; end_date: string }>;
      last_refuels: Array<{ date: string; liters: number; total_amount: number; price_per_liter: number }>;
      last_expenses: Array<{ category: string; description: string; amount: number; date_formatted: string }>;
    }>;

    frequent_routes: Array<{
      route_name: string;
      count: number;
      avg_rev: number;
    }>;

    topVehicles: Array<{
      plate: string;
      model: string;
      km_per_liter: number;
      fuel_cost_30d: number;
      maintenance_cost_30d: number;
    }>;
    topRoutes: Array<{ route_name: string; trips_count: number; avg_revenue: number }>;
    detailedPayables: Array<{
      description: string;
      amount: number;
      date_formatted: string;
      category: string;
      status: string;
    }>;

    maintenanceHealth: { preventive_count: number; corrective_count: number; total_spent: number };
  };

  // Extended data for savings analysis
  maintenance?: {
    totalSpentMonth: number;
    totalSpentYear: number;
    overdueCount: number;
    upcomingCount: number;
    topCategories: Array<{ category: string; amount: number }>;
    laborVsParts?: { labor: number; parts: number };
    preventiveVsCorrective?: { preventive: number; corrective: number };
    topProviders?: Array<{ name: string; totalSpent: number }>;
    avgCostPerVehicle?: number;
  };

  vehicleConsumption?: {
    bestVehicle: { plate: string; consumption: number } | null;
    worstVehicle: { plate: string; consumption: number } | null;
    belowTarget: number;
    aboveTarget: number;
    potentialSavings: number;
  };

  driverPerformance?: {
    topDriver: { name: string; profit: number; margin: number } | null;
    worstDriver: { name: string; profit: number; margin: number } | null;
    avgCompletionRate: number;
    avgMargin: number;
  };

  profitability?: {
    totalProfit: number;
    avgMargin: number;
    profitPerKm: number;
    completedJourneys: number;
    totalDistance: number;
  };

  comparison?: {
    revenueChange: number;
    expenseChange: number;
    fuelChange: number;
    consumptionChange: number;
  };

  alerts?: {
    cnhExpiringSoon: number;
    maintenanceOverdue: number;
    vehiclesCritical: number;
  };

  // === NEW EXTENDED DATA ===

  // Route analysis
  routes?: {
    topProfitableRoutes: Array<{
      origin: string;
      destination: string;
      count: number;
      avgRevenue: number;
      avgMargin: number;
    }>;
    avgJourneyDuration: number; // in hours
    avgDistancePerJourney: number;
    totalAdvances: number;
    totalCommissions: number;
  };

  // Detailed expense breakdown
  expenseBreakdown?: {
    byCategory: Array<{ category: string; amount: number; percentage: number }>;
    directVsIndirect: { direct: number; indirect: number };
    topSuppliers: Array<{ name: string; amount: number }>;
    avgExpensePerJourney: number;
  };

  // Detailed fuel analysis
  fuelAnalysis?: {
    avgPricePerLiter: number;
    priceVariation: { min: number; max: number; avg: number };
    totalLiters: number;
    costPerKm: number;
    topStations?: Array<{ name: string; avgPrice: number; totalSpent: number }>;
  };

  // Detailed fleet information
  fleetDetails?: {
    avgAge: number;
    byFuelType: Array<{ type: string; count: number }>;
    byBrand: Array<{ brand: string; count: number }>;
    insuranceExpiring: Array<{ plate: string; expiryDate: string }>;
    totalFleetValue: number;
    vehicleUtilization: Array<{
      plate: string;
      journeysCount: number;
      totalKm: number;
      status: "ocioso" | "normal" | "intensivo";
    }>;
  };

  // Cash flow
  cashFlow?: {
    nextPayables: Array<{
      description: string;
      amount: number;
      dueDate: string;
      category: string;
    }>;
    totalDueNext7Days: number;
    totalDueNext30Days: number;
    overduePayables: number;
  };

  // Performance history
  performanceHistory?: {
    last3Months: Array<{
      month: string;
      revenue: number;
      expenses: number;
      profit: number;
      fuelCost: number;
    }>;
    revenueGrowthTrend: "crescendo" | "estável" | "caindo";
  };
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/smart-assistant`;

export function useSmartAssistant() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const addMessage = useCallback((role: "user" | "assistant", content: string) => {
    const newMessage: Message = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      role,
      content,
    };
    setMessages((prev) => [...prev, newMessage]);
    return newMessage.id;
  }, []);

  const updateLastAssistantMessage = useCallback((content: string) => {
    setMessages((prev) => {
      const lastIndex = prev.length - 1;
      if (lastIndex >= 0 && prev[lastIndex].role === "assistant") {
        const updated = [...prev];
        updated[lastIndex] = { ...updated[lastIndex], content };
        return updated;
      }
      return prev;
    });
  }, []);

  const streamChat = useCallback(
    async (userMessage: string, fleetData: FleetData | null, onDelta: (delta: string) => void, onDone: () => void) => {
      // Get session for auth
      const {
        data: { session },
      } = await supabase.auth.getSession();

      // Prepare messages for API (convert to API format)
      // --- INÍCIO DA ALTERAÇÃO ---

      // 1. Transforma os dados da frota em Texto para a IA ler
      // Se fleetData for nulo, envia string vazia para não quebrar
      const contextString = fleetData ? JSON.stringify(fleetData, null, 2) : "Dados ainda carregando...";

      // 2. Cria a mensagem MESTRA (Prompt + Dados)
      const systemMessage = {
        role: "system",
        content: `${SYSTEM_PROMPT}\n\n--- DADOS DETALHADOS DA FROTA (JSON) ---\n${contextString}`,
      };

      // 3. Monta o array: [Sistema] + [Histórico] + [Pergunta do Usuário]
      // O 'as any' é usado aqui porque o tipo Message original pode não ter 'system', mas a API aceita.
      const apiMessages = [
        systemMessage,
        ...messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        { role: "user", content: userMessage },
      ] as any[];

      // --- FIM DA ALTERAÇÃO ---

      const controller = new AbortController();
      abortControllerRef.current = controller;

      const response = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: apiMessages,
          fleetData,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Erro ${response.status}`);
      }

      if (!response.body) {
        throw new Error("Stream não disponível");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";
      let streamDone = false;

      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;

        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") {
            streamDone = true;
            break;
          }

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) onDelta(content);
          } catch {
            // Incomplete JSON, put back and wait
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }

      // Final flush
      if (textBuffer.trim()) {
        for (let raw of textBuffer.split("\n")) {
          if (!raw) continue;
          if (raw.endsWith("\r")) raw = raw.slice(0, -1);
          if (raw.startsWith(":") || raw.trim() === "") continue;
          if (!raw.startsWith("data: ")) continue;
          const jsonStr = raw.slice(6).trim();
          if (jsonStr === "[DONE]") continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) onDelta(content);
          } catch {
            /* ignore */
          }
        }
      }

      onDone();
    },
    [messages],
  );

  const sendMessage = useCallback(
    async (userMessage: string, fleetData: FleetData | null) => {
      if (!userMessage.trim()) return;

      setError(null);
      setIsLoading(true);

      // Add user message
      addMessage("user", userMessage);

      // Add empty assistant message that we'll stream into
      let assistantContent = "";
      addMessage("assistant", "");

      try {
        await streamChat(
          userMessage,
          fleetData,
          (delta) => {
            assistantContent += delta;
            updateLastAssistantMessage(assistantContent);
          },
          () => {
            setIsLoading(false);
          },
        );
      } catch (err) {
        console.error("Smart assistant error:", err);
        const errorMessage = err instanceof Error ? err.message : "Erro ao processar mensagem";
        setError(errorMessage);
        updateLastAssistantMessage(`Desculpe, ocorreu um erro: ${errorMessage}. Tente novamente.`);
        setIsLoading(false);
      }
    },
    [addMessage, streamChat, updateLastAssistantMessage],
  );

  const cancelStream = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  const setInitialMessages = useCallback((initialMessages: Message[]) => {
    setMessages(initialMessages);
  }, []);

  return {
    messages,
    isLoading,
    error,
    sendMessage,
    cancelStream,
    clearMessages,
    setInitialMessages,
    addMessage,
  };
}
