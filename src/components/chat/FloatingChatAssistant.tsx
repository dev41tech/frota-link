import { useState, useEffect, useRef, useCallback } from "react";
import {
  MessageCircle,
  X,
  Send,
  Plus,
  Calendar,
  Truck,
  DollarSign,
  FileText,
  Fuel,
  Trash2,
  Minus,
  RefreshCw,
  StopCircle,
  MapPin,
  Paperclip,
  CalendarClock,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useMultiTenant } from "@/hooks/useMultiTenant";
import { usePlanFeaturesContext } from "@/contexts/PlanFeaturesContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { useExpenseCategories } from "@/hooks/useExpenseCategories";
import { useRevenueCategories } from "@/hooks/useRevenueCategories";
import * as LucideIcons from "lucide-react";

// --- Tipos ---
type Vehicle = { id: string; plate: string; model: string; brand: string; status?: string };
type Driver = { id: string; name: string; cnh?: string; status?: string };

interface Message {
  id: string;
  content: string | JSX.Element;
  type: "user" | "assistant" | "system";
  timestamp: Date;
}

interface FlowState {
  type: "idle" | "journey_start" | "journey_end" | "expense" | "revenue" | "fuel" | "xml_decision" | "payable";
  step: number;
  data: Record<string, any>;
}

interface ActiveJourney {
  id: string;
  journey_number: string;
  origin: string;
  destination: string;
}

interface QuickAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  action: string;
  perm?: string;
}

export default function FloatingChatAssistant() {
  const { hasCopilot, isLoading: isPlanLoading } = usePlanFeaturesContext();

  // --- Estados ---
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState("");

  const [flowState, setFlowState] = useState<FlowState>({ type: "idle", step: 0, data: {} });
  const flowStateRef = useRef(flowState);

  const [loading, setLoading] = useState(false);
  const [activeJourney, setActiveJourney] = useState<ActiveJourney | null>(null);
  const [activeCount, setActiveCount] = useState(0);

  // --- Refs & Hooks ---
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { userProfile, currentCompany, hasPermission } = useMultiTenant();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { data: expenseCategories = [] } = useExpenseCategories(undefined, true);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { data: revenueCategories = [] } = useRevenueCategories(true);

  // --- Callbacks ---
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    flowStateRef.current = flowState;
  }, [flowState]);

  const addMessage = (content: string | JSX.Element, type: "user" | "assistant" | "system") => {
    const message: Message = {
      id: `msg_${Date.now()}_${Math.random()}`,
      content,
      type,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, message]);
  };

  const addWelcomeMessage = useCallback(() => {
    const userName = userProfile?.full_name?.split(" ")[0] || "usuário";
    const welcomeMessage: Message = {
      id: "welcome",
      content: `Olá, ${userName}! 👋\n\nSou seu assistente operacional. Posso controlar toda a sua frota por aqui.\n\nO que vamos fazer agora?`,
      type: "assistant",
      timestamp: new Date(),
    };
    setMessages([welcomeMessage]);
  }, [userProfile?.full_name]);

  const fetchActiveJourney = useCallback(async () => {
    if (!currentCompany?.id) return;

    const { data } = await supabase
      .from("journeys")
      .select("id, journey_number, origin, destination")
      .eq("company_id", currentCompany.id)
      .eq("status", "in_progress")
      .order("start_date", { ascending: false });

    if (data && data.length > 0) {
      setActiveJourney(data[0]);
      setActiveCount(data.length);
    } else {
      setActiveJourney(null);
      setActiveCount(0);
    }
  }, [currentCompany?.id]);

  useEffect(() => {
    if (isOpen && messages.length === 0) {
      addWelcomeMessage();
    }
  }, [isOpen, messages.length, addWelcomeMessage]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading, scrollToBottom]);

  useEffect(() => {
    if (currentCompany?.id) {
      fetchActiveJourney();
    }
  }, [currentCompany?.id, fetchActiveJourney]);

  // --- 1. FUNÇÕES BÁSICAS DE UI (HANDLERS SIMPLES) ---

  const handleClearChat = () => {
    setMessages([]);
    setFlowState({ type: "idle", step: 0, data: {} });
    addWelcomeMessage();
  };

  const handleCancelFlow = () => {
    setFlowState({ type: "idle", step: 0, data: {} });
    addMessage("❌ Operação cancelada. Voltei para o início.", "system");
  };

  const finalizeTransaction = (title: string, desc: string) => {
    addMessage(`✅ ${title}\n${desc}`, "assistant");
    toast({ title, description: desc });
    setFlowState({ type: "idle", step: 0, data: {} });
  };

  // --- 2. FUNÇÕES DE COMMIT (BANCO DE DADOS) ---

  const commitFuel = async (d: any) => {
    const total = d.liters * d.pricePerLiter;
    const { error } = await supabase.from("fuel_expenses").insert({
      user_id: userProfile?.user_id,
      company_id: currentCompany?.id,
      vehicle_id: d.vehicle?.id,
      journey_id: d.journeyId,
      liters: d.liters,
      price_per_liter: d.pricePerLiter,
      total_amount: total,
      odometer: d.odometer,
      date: new Date().toISOString(),
      payment_method: "card",
    });
    if (error) throw error;
    finalizeTransaction("Abastecimento registrado!", `R$ ${total.toFixed(2)}`);
  };

  const commitExpense = async (d: any) => {
    const attachment = d.fileUrl || null;
    const { error } = await supabase.from("accounts_payable").insert({
      user_id: userProfile?.user_id,
      company_id: currentCompany?.id,
      journey_id: d.journeyId,
      category: d.category.name,
      category_id: d.category.id,
      is_direct: d.category.classification === "direct",
      amount: d.amount,
      description: d.description,
      due_date: new Date().toISOString(),
      status: "pending",
      attachment_url: attachment,
    });
    if (error) throw error;
    finalizeTransaction("Despesa registrada!", `R$ ${d.amount.toFixed(2)}`);
  };

  const commitRevenue = async (d: any, jId?: string | null) => {
    const { error } = await supabase.from("revenue").insert({
      user_id: userProfile?.user_id,
      company_id: currentCompany?.id,
      journey_id: jId || d.journeyId,
      category: "Frete",
      amount: d.amount,
      description: d.description,
      date: new Date().toISOString(),
      status: "received",
    });
    if (error) throw error;
    finalizeTransaction("Receita registrada!", `R$ ${d.amount.toFixed(2)}`);
  };

  const commitPayable = async (d: any) => {
    const { error } = await supabase.from("accounts_payable").insert({
      user_id: userProfile?.user_id,
      company_id: currentCompany?.id,
      description: d.description,
      amount: d.amount,
      due_date: d.dueDate.toISOString(),
      category_id: d.category.id,
      category: d.category.name,
      status: "pending",
      attachment_url: d.fileUrl,
    });
    if (error) {
      console.error("Erro Supabase:", error);
      addMessage("Erro ao salvar conta.", "system");
      return;
    }
    finalizeTransaction("Conta agendada!", `Vencimento: ${d.dueDate.toLocaleDateString("pt-BR")}`);
  };

  const createJourney = async (d: any) => {
    const { data, error } = await supabase
      .from("journeys")
      .insert({
        user_id: userProfile?.user_id,
        company_id: currentCompany?.id,
        vehicle_id: d.vehicle.id,
        driver_id: d.driver.id,
        origin: d.origin,
        destination: d.destination,
        start_km: d.start_km,
        status: "in_progress",
        journey_number: `J${Date.now()}`,
      })
      .select()
      .single();

    if (error) return addMessage("Erro ao criar jornada.", "system");

    addMessage(
      <div className="space-y-2">
        <p>
          ✅ <strong>Jornada Iniciada!</strong>
        </p>
        <div className="text-xs bg-muted p-2 rounded flex flex-col gap-1">
          <span className="font-bold">{d.vehicle.plate}</span>
          <span>
            {d.origin} ➔ {d.destination}
          </span>
          <span>Saída: {d.start_km} km</span>
        </div>
        <div className="flex gap-2 mt-2 flex-wrap">
          <Button
            size="sm"
            className="bg-green-600 hover:bg-green-700 h-7 text-xs flex-1"
            onClick={() => {
              if (d.amount) {
                setFlowState({
                  type: "revenue",
                  step: 2,
                  data: { linkedJourney: data, amount: d.amount, description: d.description },
                });
                addMessage(
                  `✅ Valor mantido.\n📝 Confirma a descrição "${d.description}"? (Digite outra ou envie para confirmar)`,
                  "assistant",
                );
              } else {
                setFlowState({ type: "revenue", step: 1, data: { linkedJourney: data } });
                addMessage(`💰 Lançar receita para jornada ${data.journey_number}.\nDigite o valor (R$):`, "assistant");
              }
            }}
          >
            Lançar Frete
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            onClick={() => startExpenseFlow({ linkedJourney: data })}
          >
            <FileText className="w-3 h-3 mr-1" /> Despesa
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            onClick={() => startFuelFlow({ vehicle: d.vehicle, linkedJourney: data })}
          >
            <Fuel className="w-3 h-3 mr-1" /> Abastecer
          </Button>
        </div>
      </div>,
      "assistant",
    );
    await fetchActiveJourney();
  };

  const endJourney = async (d: any, endKm: number) => {
    const distance = endKm - d.journey.start_km;
    const { error } = await supabase
      .from("journeys")
      .update({
        end_km: endKm,
        end_date: new Date().toISOString(),
        status: "completed",
        distance,
      })
      .eq("id", d.journey.id);

    if (error) return addMessage("Erro ao encerrar.", "system");
    addMessage(`🏁 Jornada encerrada!\nDistância: ${distance} km percorridos.`, "assistant");
    setFlowState({ type: "idle", step: 0, data: {} });
    setActiveJourney(null);
  };

  // --- CORREÇÃO AQUI: Função askJourneyLink Refatorada ---
  const askJourneyLink = (data: any, type: "fuel" | "expense" | "revenue") => {
    const commit = async (journeyId: string | null) => {
      setLoading(true); // Bloqueia e mostra loading
      try {
        console.log("Tentando vincular/salvar...", { type, data, journeyId });

        if (type === "fuel") await commitFuel({ ...data, journeyId });
        if (type === "expense") await commitExpense({ ...data, journeyId });
        if (type === "revenue") await commitRevenue({ ...data, journeyId });

        // Se chegar aqui, deu certo (o commit chama o finalizeTransaction)
      } catch (error: any) {
        console.error("Erro no askJourneyLink:", error);
        addMessage(`❌ Ocorreu um erro ao salvar: ${error.message || "Erro desconhecido"}`, "system");
        toast({
          title: "Erro ao salvar",
          description: "Verifique o console para mais detalhes.",
          variant: "destructive",
        });
      } finally {
        setLoading(false); // Libera o loading
      }
    };

    if (!activeJourney) {
      commit(null); // Salva avulso se não tiver jornada ativa
      return;
    }

    addMessage(
      <div className="space-y-2">
        <p>
          Vincular à jornada ativa <strong>{activeJourney.journey_number}</strong>?
        </p>
        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={() => commit(activeJourney.id)}
            disabled={loading} // Evita clique duplo
          >
            Sim, vincular
          </Button>
          <Button size="sm" variant="outline" onClick={() => commit(null)} disabled={loading}>
            Não, avulso
          </Button>
        </div>
      </div>,
      "assistant",
    );
  };

  // --- 3. FUNÇÕES DE INÍCIO DE FLUXO (START) ---

  const startExpenseFlow = (initialData = {}) => {
    if (!expenseCategories.length) return addMessage("Nenhuma categoria cadastrada.", "system");
    setFlowState({ type: "expense", step: 1, data: initialData });
    const hasAmount = (initialData as any).amount !== undefined;
    addMessage(
      <div>
        <p className="mb-2">📝 Qual o tipo da despesa?</p>
        <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto">
          {expenseCategories.map((c: any) => {
            const Icon = (LucideIcons as any)[c.icon] || LucideIcons.FileText;
            return (
              <Button
                key={c.id}
                variant="outline"
                size="sm"
                style={{ borderColor: c.color, color: c.color }}
                onClick={() => {
                  if (hasAmount) {
                    const dataComplete = { ...initialData, category: c };
                    askJourneyLink(dataComplete, "expense");
                  } else {
                    setFlowState((p) => ({ ...p, step: 2, data: { ...p.data, category: c } }));
                    addMessage(`✅ Categoria: ${c.name}\n💰 Qual o valor? (R$)`, "assistant");
                  }
                }}
              >
                <Icon className="w-3 h-3 mr-1" /> {c.name}
              </Button>
            );
          })}
        </div>
      </div>,
      "assistant",
    );
  };

  const startRevenueFlow = () => {
    setFlowState({ type: "revenue", step: 1, data: {} });
    addMessage("💰 Nova receita.\nDigite o valor recebido (R$):", "assistant");
  };

  const startFuelFlow = async (initialData = {}) => {
    if ((initialData as any).vehicle) {
      setFlowState({ type: "fuel", step: 2, data: initialData });
      const plate = (initialData as any).vehicle.plate;
      addMessage(`⛽ Abastecendo ${plate}.\n🛢️ Quantos litros?`, "assistant");
      return;
    }
    setLoading(true);
    const { data: vehicles } = await supabase
      .from("vehicles")
      .select("*")
      .eq("status", "active")
      .eq("company_id", currentCompany?.id);
    setFlowState({ type: "fuel", step: 1, data: initialData });
    addMessage(
      <div>
        <p className="mb-2">⛽ Qual veículo foi abastecido?</p>
        <div className="flex flex-wrap gap-2">
          {vehicles?.map((v: any) => (
            <Button
              key={v.id}
              variant="outline"
              size="sm"
              onClick={() => {
                setFlowState((p) => ({ ...p, step: 2, data: { ...p.data, vehicle: v } }));
                addMessage(`✅ Veículo: ${v.plate}\n🛢️ Quantos litros?`, "assistant");
              }}
            >
              {v.plate}
            </Button>
          ))}
        </div>
      </div>,
      "assistant",
    );
    setLoading(false);
  };

  const selectVehicle = async (vehicle: Vehicle) => {
    setLoading(true);
    const { data: drivers } = await supabase
      .from("drivers")
      .select("*")
      .eq("status", "active")
      .eq("company_id", currentCompany?.id);
    const { data: lastJourney } = await supabase
      .from("journeys")
      .select("end_km")
      .eq("vehicle_id", vehicle.id)
      .eq("status", "completed")
      .order("end_date", { ascending: false })
      .limit(1)
      .maybeSingle();
    const suggestedKm = lastJourney?.end_km || 0;

    setFlowState((p) => ({ ...p, step: 2, data: { ...p.data, vehicle, suggestedKm } }));

    addMessage(
      <div>
        <p className="mb-2">✅ Veículo: {vehicle.plate}. Agora o motorista:</p>
        <div className="flex flex-wrap gap-2">
          {drivers?.map((d: any) => (
            <Button
              key={d.id}
              variant="outline"
              size="sm"
              onClick={() => {
                setFlowState((prev) => {
                  const updatedData: any = { ...prev.data, driver: d, suggestedKm };
                  if (updatedData.origin && updatedData.destination) {
                    setTimeout(
                      () =>
                        addMessage(
                          <div>
                            <p>✅ Motorista: {d.name}</p>
                            <p>
                              ✅ De: {updatedData.origin} ➔ Para: {updatedData.destination}
                            </p>
                            <p className="mt-2">🔢 Qual o KM inicial?</p>
                            {suggestedKm > 0 && (
                              <Button
                                variant="secondary"
                                size="sm"
                                className="mt-2 h-7"
                                onClick={() => {
                                  addMessage(suggestedKm.toString(), "user");
                                  handleFlowStep(suggestedKm.toString());
                                }}
                              >
                                Usar último: {suggestedKm} km
                              </Button>
                            )}
                          </div>,
                          "assistant",
                        ),
                      0,
                    );
                    return { ...prev, step: 5, data: updatedData };
                  }
                  setTimeout(() => addMessage(`✅ Motorista: ${d.name}\n📍 Digite a origem:`, "assistant"), 0);
                  return { ...prev, step: 3, data: updatedData };
                });
              }}
            >
              {d.name}
            </Button>
          ))}
        </div>
      </div>,
      "assistant",
    );
    setLoading(false);
  };

  const startJourneyFlow = async (initialData = {}) => {
    setLoading(true);
    const actualData = (initialData as any).xmlData
      ? { ...(initialData as any).xmlData, ...(initialData as any) }
      : initialData;
    const { data: vehicles } = await supabase
      .from("vehicles")
      .select("*")
      .eq("status", "active")
      .eq("company_id", currentCompany?.id);

    if (!vehicles?.length) {
      addMessage("Nenhum veículo ativo encontrado.", "system");
      setLoading(false);
      return;
    }

    setFlowState({ type: "journey_start", step: 1, data: actualData });
    addMessage(
      <div>
        <p className="mb-2">Vamos iniciar! 🚛 Selecione o veículo:</p>
        <div className="flex flex-wrap gap-2">
          {vehicles.map((v: any) => (
            <Button key={v.id} variant="outline" size="sm" onClick={() => selectVehicle(v)}>
              {v.plate} - {v.model}
            </Button>
          ))}
        </div>
      </div>,
      "assistant",
    );
    setLoading(false);
  };

  const startPayableFlow = () => {
    setFlowState({ type: "payable", step: 1, data: {} });
    addMessage("📅 Nova Conta a Pagar.\n📝 Qual a descrição? (Ex: Boleto Internet)", "assistant");
  };

  const endJourneyFlow = async () => {
    setLoading(true);
    const { data: journeys } = await supabase
      .from("journeys")
      .select("*, vehicles!inner(*), drivers!inner(*)")
      .eq("company_id", currentCompany?.id)
      .eq("status", "in_progress");

    if (!journeys?.length) {
      addMessage("Nenhuma jornada em andamento para encerrar.", "system");
      setLoading(false);
      return;
    }

    setFlowState({ type: "journey_end", step: 1, data: {} });
    addMessage(
      <div>
        <p className="mb-2">Qual jornada deseja encerrar?</p>
        <div className="flex flex-col gap-2">
          {journeys.map((j: any) => (
            <Button
              key={j.id}
              variant="secondary"
              className="justify-start h-auto py-2"
              onClick={() => {
                setFlowState((p) => ({ ...p, step: 2, data: { journey: j } }));
                addMessage(`✅ Jornada selecionada: ${j.vehicles.plate}.\n🔢 Digite o KM final?`, "assistant");
              }}
            >
              <div className="text-left">
                <div className="font-bold flex items-center gap-2">
                  <Truck className="w-3 h-3" /> {j.vehicles.plate}
                </div>
                <div className="text-xs opacity-70">
                  {j.origin} ➔ {j.destination}
                </div>
              </div>
            </Button>
          ))}
        </div>
      </div>,
      "assistant",
    );
    setLoading(false);
  };

  const listActiveJourneys = async () => {
    setLoading(true);
    const { data: journeys } = await supabase
      .from("journeys")
      .select("*, vehicles(plate, model), drivers(name)")
      .eq("company_id", currentCompany?.id)
      .eq("status", "in_progress");

    if (!journeys || journeys.length === 0) {
      addMessage("Não há nenhuma jornada ativa no momento.", "assistant");
    } else {
      addMessage(
        <div className="space-y-2">
          <p>
            📋 <strong>Jornadas em Andamento:</strong>
          </p>
          {journeys.map((j: any) => (
            <div key={j.id} className="bg-secondary/50 p-2.5 rounded-lg border text-left text-sm shadow-sm">
              <div className="flex justify-between font-bold mb-1">
                <span className="flex items-center gap-1">
                  <Truck className="w-3 h-3" /> {j.vehicles?.plate}
                </span>
                <span className="text-xs font-normal bg-primary/10 px-1.5 py-0.5 rounded">{j.drivers?.name}</span>
              </div>
              <div className="text-xs text-muted-foreground mb-3 flex items-center gap-1">
                <MapPin className="w-3 h-3" /> {j.origin} ➔ {j.destination}
              </div>
              <div className="flex gap-1.5 flex-wrap">
                <Button
                  size="icon"
                  variant="outline"
                  className="h-7 w-7"
                  onClick={() => startFuelFlow({ vehicle: j.vehicles, linkedJourney: j })}
                >
                  <Fuel className="w-3.5 h-3.5" />
                </Button>
                <Button
                  size="icon"
                  variant="outline"
                  className="h-7 w-7"
                  onClick={() => startExpenseFlow({ linkedJourney: j })}
                >
                  <FileText className="w-3.5 h-3.5" />
                </Button>
                <Button
                  size="icon"
                  variant="outline"
                  className="h-7 w-7"
                  onClick={() => {
                    setFlowState({ type: "revenue", step: 1, data: { linkedJourney: j } });
                    addMessage(`💰 Lançar receita para ${j.vehicles.plate}.\nDigite o valor (R$):`, "assistant");
                  }}
                >
                  <DollarSign className="w-3.5 h-3.5" />
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  className="h-7 text-xs ml-auto px-2"
                  onClick={() => {
                    setFlowState({ type: "journey_end", step: 2, data: { journey: j } });
                    addMessage(`🏁 Encerrar jornada ${j.vehicles.plate}.\n🔢 Qual o KM final?`, "assistant");
                  }}
                >
                  Encerrar
                </Button>
              </div>
            </div>
          ))}
        </div>,
        "assistant",
      );
    }
    setLoading(false);
  };

  // --- 4. FLUXO DE CONTROLE (PROCESSAMENTO) ---

  const handleFlowStep = async (message: string) => {
    const { type, step, data } = flowStateRef.current;
    const parseMoney = (v: string) => parseFloat(v.replace(/[^\d,.-]/g, "").replace(",", "."));
    const parseKm = (v: string) => parseInt(v.replace(/\D/g, ""));

    switch (type) {
      case "xml_decision":
        addMessage("Por favor, selecione uma opção nos botões acima ou clique em Cancelar.", "system");
        break;

      case "payable":
        if (step === 1) {
          setFlowState((p) => ({ ...p, step: 2, data: { ...p.data, description: message } }));
          addMessage(`📝 Descrição: "${message}".\n💰 Qual o valor do boleto/conta?`, "assistant");
        } else if (step === 2) {
          const val = parseMoney(message);
          if (!val) return addMessage("Valor inválido.", "system");
          setFlowState((p) => ({ ...p, step: 3, data: { ...p.data, amount: val } }));
          addMessage(
            <div>
              <p>💰 Valor: R$ {val.toLocaleString("pt-BR")}.</p>
              <p className="mb-2">📅 Qual a data de vencimento?</p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    addMessage("Hoje", "user");
                    handleFlowStep("Hoje");
                  }}
                >
                  Hoje
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    addMessage("Amanhã", "user");
                    handleFlowStep("Amanhã");
                  }}
                >
                  Amanhã
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Ou digite ex: 25/05</p>
            </div>,
            "assistant",
          );
        } else if (step === 3) {
          const date = parseDateInput(message);
          if (!date) return addMessage("Data inválida. Tente DD/MM (ex: 15/02).", "system");
          setFlowState((p) => ({ ...p, step: 4, data: { ...p.data, dueDate: date } }));
          addMessage(
            <div>
              <p>📅 Vencimento: {date.toLocaleDateString("pt-BR")}.</p>
              <p className="mb-2">📂 Qual a categoria?</p>
              <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto">
                {expenseCategories.map((c: any) => (
                  <Button
                    key={c.id}
                    variant="outline"
                    size="sm"
                    style={{ borderColor: c.color, color: c.color }}
                    onClick={() => commitPayable({ ...data, dueDate: date, category: c })}
                  >
                    {c.name}
                  </Button>
                ))}
              </div>
            </div>,
            "assistant",
          );
        }
        break;

      case "journey_start":
        if (step === 3) {
          setFlowState((p) => ({ ...p, step: 4, data: { ...p.data, origin: message } }));
          addMessage(`✅ Origem: ${message}\n📍 Qual o destino?`, "assistant");
        } else if (step === 4) {
          setFlowState((p) => ({ ...p, step: 5, data: { ...p.data, destination: message } }));
          const suggestedKm = data.suggestedKm || 0;
          addMessage(
            <div>
              <p>✅ Destino: {message}</p>
              <p>🔢 Qual o KM inicial?</p>
              {suggestedKm > 0 && (
                <Button
                  variant="secondary"
                  size="sm"
                  className="mt-2 h-7"
                  onClick={() => {
                    addMessage(suggestedKm.toString(), "user");
                    handleFlowStep(suggestedKm.toString());
                  }}
                >
                  Usar último: {suggestedKm} km
                </Button>
              )}
            </div>,
            "assistant",
          );
        } else if (step === 5) {
          const startKm = parseKm(message);
          if (isNaN(startKm)) return addMessage("Digite um número válido para o KM.", "system");
          await createJourney({ ...data, start_km: startKm } as any);
        }
        break;

      case "journey_end":
        if (step === 2) {
          const endKm = parseKm(message);
          if (isNaN(endKm)) return addMessage("Digite um número válido.", "system");
          if (endKm <= data.journey.start_km)
            return addMessage(`O KM deve ser maior que ${data.journey.start_km}.`, "system");
          await endJourney({ journey: data.journey }, endKm);
        }
        break;

      case "fuel":
        if (step === 2) {
          const liters = parseMoney(message);
          if (!liters) return addMessage("Valor inválido.", "system");
          setFlowState((p) => ({ ...p, step: 3, data: { ...p.data, liters } }));
          addMessage(`⛽ ${liters}L registrados.\n💲 Qual o valor por litro?`, "assistant");
        } else if (step === 3) {
          const price = parseMoney(message);
          if (!price) return addMessage("Preço inválido.", "system");
          setFlowState((p) => ({ ...p, step: 4, data: { ...p.data, pricePerLiter: price } }));
          addMessage(`💲 R$ ${price}/L.\n🔢 Qual o KM atual?`, "assistant");
        } else if (step === 4) {
          const odo = parseKm(message);
          if (data.linkedJourney) {
            await commitFuel({ ...data, odometer: odo, journeyId: data.linkedJourney.id });
          } else {
            // AQUI TAMBÉM CHAMA A FUNÇÃO ATUALIZADA
            askJourneyLink({ ...data, odometer: odo }, "fuel");
          }
        }
        break;

      case "expense":
        if (step === 2) {
          const val = parseMoney(message);
          if (!val) return addMessage("Valor inválido.", "system");
          setFlowState((p) => ({ ...p, step: 3, data: { ...p.data, amount: val } }));
          addMessage(`💰 R$ ${val.toLocaleString("pt-BR")}.\n📝 Digite uma descrição (ou "pular"):`, "assistant");
        } else if (step === 3) {
          const desc = message.toLowerCase() === "pular" ? `Despesa - ${data.category.name}` : message;
          if (data.linkedJourney) {
            await commitExpense({ ...data, amount: data.amount, description: desc, journeyId: data.linkedJourney.id });
          } else {
            // AQUI TAMBÉM CHAMA A FUNÇÃO ATUALIZADA
            askJourneyLink({ ...data, amount: data.amount, description: desc }, "expense");
          }
        }
        break;

      case "revenue":
        if (step === 1) {
          const val = parseMoney(message);
          if (!val) return addMessage("Valor inválido.", "system");
          setFlowState((p) => ({ ...p, step: 2, data: { ...p.data, amount: val } }));
          addMessage(`💰 R$ ${val.toLocaleString("pt-BR")}.\n📝 Descrição/Cliente:`, "assistant");
        } else if (step === 2) {
          const input = message.trim();
          const lowerInput = input.toLowerCase();
          const confirmationWords = ["sim", "s", "ok", "confirmo", "confirmar", "pode", "yes", "isso", "tá", "ta"];
          const isConfirmation = confirmationWords.includes(lowerInput) || input === "";
          const finalDesc = isConfirmation && data.description ? data.description : input;

          if (!finalDesc) return addMessage("Descrição obrigatória.", "system");

          if (data.linkedJourney) {
            await commitRevenue({ amount: data.amount, description: finalDesc }, data.linkedJourney.id);
          } else {
            // AQUI TAMBÉM CHAMA A FUNÇÃO ATUALIZADA
            askJourneyLink({ ...data, description: finalDesc }, "revenue");
          }
        }
        break;
    }
  };

  const parseDateInput = (input: string): Date | null => {
    const lower = input.toLowerCase().trim();
    const today = new Date();
    if (lower === "hoje") return today;
    if (lower === "amanhã" || lower === "amanha") {
      const tmr = new Date(today);
      tmr.setDate(tmr.getDate() + 1);
      return tmr;
    }
    const parts = lower.split("/");
    if (parts.length >= 2) {
      const day = parseInt(parts[0]);
      const month = parseInt(parts[1]) - 1;
      const year = parts[2] ? parseInt(parts[2]) : today.getFullYear();
      if (!isNaN(day) && !isNaN(month)) return new Date(year, month, day);
    }
    return null;
  };

  const sendAIMessage = async (message: string) => {
    setLoading(true);
    const assistantMsgId = `msg_${Date.now()}_${Math.random()}`;
    let assistantContent = "";
    setMessages((prev) => [...prev, { id: assistantMsgId, content: "", type: "assistant", timestamp: new Date() }]);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/smart-assistant`;
      const response = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages: [{ role: "user", content: message }] }),
      });

      if (!response.ok || !response.body) throw new Error("Erro na IA");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });
        let newlineIndex;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);
          if (line.startsWith("data: ")) {
            const jsonStr = line.slice(6).trim();
            if (jsonStr === "[DONE]") break;
            try {
              const content = JSON.parse(jsonStr).choices?.[0]?.delta?.content;
              if (content) {
                assistantContent += content;
                setMessages((prev) =>
                  prev.map((m) => (m.id === assistantMsgId ? { ...m, content: assistantContent } : m)),
                );
              }
            } catch {}
          }
        }
      }
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsgId ? { ...m, content: "Desculpe, não consegui processar isso agora." } : m,
        ),
      );
    } finally {
      setLoading(false);
    }
  };

  const handleInitialCommand = async (message: string) => {
    const msg = message.toLowerCase().trim();
    const has = (re: RegExp) => re.test(msg);

    if (["cancelar", "sair", "parar", "voltar"].includes(msg)) {
      handleCancelFlow();
      return;
    }

    if (has(/\b(ajuda|help|o que voc[eê] faz)\b/)) {
      addMessage(
        "🤖 Sou seu copiloto de frota. Posso iniciar jornadas, lançar despesas, contas a pagar e ler XMLs.",
        "assistant",
      );
      return;
    }

    if (has(/\b(iniciar|começar|abrir)\b.*\bjornada\b/)) return startJourneyFlow();
    if (has(/\b(encerrar|fechar|finalizar)\b.*\bjornada\b/)) return endJourneyFlow();
    if (has(/\b(listar|ver|quais|minhas)\b.*\bjornada(s)?\b/)) return listActiveJourneys();
    if (has(/\b(abastec|combust)\b/)) return startFuelFlow();
    if (has(/\b(conta|boleto|pagar)\b/)) return startPayableFlow();
    if (has(/\b(lançar|nova|inserir)\b.*\breceita\b/) || msg === "lançar receita") return startRevenueFlow();
    if (has(/\b(lançar|nova|inserir)\b.*\bdespesa\b/) || msg === "lançar despesa") return startExpenseFlow();

    await sendAIMessage(message);
  };

  const processMessage = async (message: string) => {
    setLoading(true);
    try {
      if (flowStateRef.current.type === "idle") {
        await handleInitialCommand(message);
      } else {
        await handleFlowStep(message);
      }
    } catch (error) {
      console.error("Error processing message:", error);
      addMessage("Ops! Ocorreu um erro inesperado.", "system");
      setFlowState({ type: "idle", step: 0, data: {} });
    } finally {
      setLoading(false);
    }
  };

  const handleQuickAction = (action: string) => {
    addMessage(action, "user");
    processMessage(action);
  };

  const handleSendMessage = () => {
    if (!inputMessage.trim()) return;
    addMessage(inputMessage, "user");
    processMessage(inputMessage);
    setInputMessage("");
  };

  // --- 5. UPLOAD DE ARQUIVOS (PARSERS E HANDLERS) ---

  const parseXML = (text: string) => {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(text, "text/xml");
    if (xmlDoc.getElementsByTagName("parsererror").length > 0) throw new Error("Erro ao ler XML");

    let description = "";
    let amount = 0;
    let invoice_number = "";
    let origin = "";
    let destination = "";

    const cteInf = xmlDoc.getElementsByTagName("infCte")[0];
    const nfeInf = xmlDoc.getElementsByTagName("infNFe")[0];
    const valorServico = xmlDoc.getElementsByTagName("ValorServicos")[0]?.textContent;

    if (cteInf) {
      const ide = cteInf.getElementsByTagName("ide")[0];
      const vPrest = cteInf.getElementsByTagName("vPrest")[0];
      const emit = cteInf.getElementsByTagName("emit")[0];
      invoice_number = ide?.getElementsByTagName("nCT")[0]?.textContent || "";
      amount = parseFloat(vPrest?.getElementsByTagName("vTPrest")[0]?.textContent || "0");
      const emitterName = emit?.getElementsByTagName("xNome")[0]?.textContent || "";
      const xMunIni = ide?.getElementsByTagName("xMunIni")[0]?.textContent;
      const xMunFim = ide?.getElementsByTagName("xMunFim")[0]?.textContent;
      if (xMunIni) origin = xMunIni;
      if (xMunFim) destination = xMunFim;
      description = `CT-e ${invoice_number} - ${emitterName}`;
    } else if (nfeInf) {
      const ide = nfeInf.getElementsByTagName("ide")[0];
      const total = nfeInf.getElementsByTagName("total")[0];
      const emit = nfeInf.getElementsByTagName("emit")[0];
      const dest = nfeInf.getElementsByTagName("dest")[0];
      invoice_number = ide?.getElementsByTagName("nNF")[0]?.textContent || "";
      amount = parseFloat(total?.getElementsByTagName("vNF")[0]?.textContent || "0");
      const emitterName = emit?.getElementsByTagName("xNome")[0]?.textContent || "";
      const xMunDest = dest?.getElementsByTagName("enderDest")[0]?.getElementsByTagName("xMun")[0]?.textContent;
      if (xMunDest) destination = xMunDest;
      description = `NF-e ${invoice_number} - ${emitterName}`;
    } else if (valorServico) {
      amount = parseFloat(valorServico);
      description = "NFS-e Importada";
    }
    return { description, amount, invoice_number, origin, destination };
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    addMessage(`📎 Arquivo: ${file.name}`, "user");
    setLoading(true);

    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${currentCompany?.id}/${Date.now()}.${fileExt}`;
      let publicUrl = null;

      const { error: uploadError } = await supabase.storage.from("finance").upload(fileName, file);
      if (!uploadError) {
        const { data } = supabase.storage.from("finance").getPublicUrl(fileName);
        publicUrl = data.publicUrl;
      }

      const isPdf = file.name.toLowerCase().endsWith(".pdf") || file.type === "application/pdf";
      const isXml = file.name.toLowerCase().endsWith(".xml") || file.type.includes("xml");

      if (isPdf) {
        const suggestedDesc = file.name.replace(".pdf", "").replace(".PDF", "");
        setFlowState({ type: "payable", step: 2, data: { description: suggestedDesc, fileUrl: publicUrl } });
        addMessage(
          <div>
            <p>
              📑 <strong>Boleto/PDF Identificado!</strong>
            </p>
            <div className="text-xs bg-muted p-2 rounded my-2">
              <p>
                <strong>Descrição:</strong> {suggestedDesc}
              </p>
              <p className="text-muted-foreground mt-1">O arquivo será anexado automaticamente.</p>
            </div>
            <p>💰 Qual o valor total a pagar?</p>
          </div>,
          "assistant",
        );
        return;
      }

      if (isXml) {
        const text = await file.text();
        const xmlDataRaw = parseXML(text);
        const xmlData = { ...xmlDataRaw, fileUrl: publicUrl };

        setFlowState({ type: "xml_decision", step: 1, data: xmlData });

        addMessage(
          <div>
            <p>
              📄 <strong>XML Lido com Sucesso!</strong>
            </p>
            <div className="text-xs bg-muted p-2 rounded my-2">
              <p>
                <strong>Desc:</strong> {xmlData.description}
              </p>
              <p>
                <strong>Valor:</strong> R$ {xmlData.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </p>
            </div>
            <p className="mb-2">Como deseja processar?</p>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                className="bg-green-600 hover:bg-green-700 h-8 flex-1"
                onClick={() => {
                  setFlowState({ type: "revenue", step: 2, data: xmlData });
                  addMessage(`💰 Selecionado: Receita.\nConfirma a descrição "${xmlData.description}"?`, "assistant");
                }}
              >
                <DollarSign className="w-3 h-3 mr-1" /> Receita
              </Button>
              <Button
                size="sm"
                variant="default"
                className="bg-blue-600 hover:bg-blue-700 h-8 flex-1"
                onClick={() => startJourneyFlow({ xmlData })}
              >
                <Truck className="w-3 h-3 mr-1" /> Nova Jornada
              </Button>
              <Button size="sm" variant="destructive" className="h-8 flex-1" onClick={() => startExpenseFlow(xmlData)}>
                <FileText className="w-3 h-3 mr-1" /> Despesa
              </Button>
            </div>
          </div>,
          "assistant",
        );
      } else {
        addMessage("❌ Formato não reconhecido automaticamente. Envie XML ou PDF.", "system");
      }
    } catch (error) {
      console.error(error);
      addMessage("❌ Erro ao ler arquivo.", "system");
      setFlowState({ type: "idle", step: 0, data: {} });
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // --- 6. RENDER (RETURN) ---

  const quickActions: QuickAction[] = [
    { id: "start_journey", label: "Abrir Jornada", icon: <Plus className="w-4 h-4" />, action: "iniciar jornada" },
    { id: "add_payable", label: "Conta a Pagar", icon: <CalendarClock className="w-4 h-4" />, action: "nova conta" },
    {
      id: "end_journey",
      label: "Encerrar Jornada",
      icon: <Calendar className="w-4 h-4" />,
      action: "encerrar jornada",
    },
    { id: "list_journeys", label: "Ativas", icon: <Truck className="w-4 h-4" />, action: "ver jornadas ativas" },
    { id: "add_fuel", label: "Abastecer", icon: <Fuel className="w-4 h-4" />, action: "abastecer" },
    { id: "add_expense", label: "Despesa", icon: <FileText className="w-4 h-4" />, action: "nova despesa" },
    { id: "add_revenue", label: "Receita", icon: <DollarSign className="w-4 h-4" />, action: "nova receita" },
  ];

  if (!isOpen) {
    return (
      <Button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 rounded-full shadow-xl h-14 w-14 hover:scale-110 transition-transform duration-200 bg-primary text-primary-foreground"
      >
        <MessageCircle className="w-6 h-6" />
      </Button>
    );
  }

  return (
    <div
      className={`fixed bottom-6 right-6 z-50 flex flex-col transition-all duration-300 ease-in-out ${isMinimized ? "w-72" : "w-full sm:w-[400px] max-w-[calc(100vw-2rem)]"}`}
    >
      <Card className="shadow-2xl overflow-hidden border-primary/20 flex flex-col bg-background/95 backdrop-blur-sm h-[600px] max-h-[80vh]">
        <div
          className="flex items-center justify-between p-3 border-b bg-primary text-primary-foreground select-none cursor-pointer"
          onClick={() => !isMinimized && setIsMinimized(true)}
        >
          <div className="flex items-center gap-2">
            <MessageCircle className="w-5 h-5" />
            <div>
              <h3 className="font-semibold text-sm leading-none">Assistente</h3>
              {!isMinimized && activeCount > 0 && (
                <span className="text-[10px] opacity-90">
                  {activeCount > 1 ? `${activeCount} viagens ativas` : `Em viagem: ${activeJourney?.journey_number}`}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1">
            {isMinimized ? (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 hover:bg-primary-foreground/20 text-primary-foreground"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsMinimized(false);
                }}
              >
                <RefreshCw className="w-3 h-3" />
              </Button>
            ) : (
              <>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 hover:bg-primary-foreground/20 text-primary-foreground"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleClearChat();
                        }}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Limpar conversa</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 hover:bg-primary-foreground/20 text-primary-foreground"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsMinimized(true);
                  }}
                >
                  <Minus className="w-3 h-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 hover:bg-primary-foreground/20 text-primary-foreground"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsOpen(false);
                  }}
                >
                  <X className="w-3 h-3" />
                </Button>
              </>
            )}
          </div>
        </div>

        {!isMinimized && (
          <>
            <ScrollArea className="flex-1 p-4 bg-muted/10">
              <div className="flex flex-col gap-3">
                {messages.map((msg) => (
                  <div key={msg.id} className={`flex ${msg.type === "user" ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[90%] p-3 rounded-2xl text-sm shadow-sm ${msg.type === "user" ? "bg-primary text-primary-foreground rounded-tr-none" : msg.type === "system" ? "bg-muted text-muted-foreground border text-xs text-center w-full" : "bg-card text-card-foreground border rounded-tl-none"}`}
                    >
                      {typeof msg.content === "string" ? (
                        <div className="whitespace-pre-wrap leading-relaxed">{msg.content}</div>
                      ) : (
                        msg.content
                      )}
                    </div>
                  </div>
                ))}
                {loading && (
                  <div className="flex justify-start">
                    <div className="bg-card border p-3 rounded-2xl rounded-tl-none flex gap-1 items-center shadow-sm">
                      <span className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                      <span className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                      <span className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce"></span>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            <div className="p-3 bg-card border-t space-y-3">
              {flowState.type === "idle" ? (
                <ScrollArea className="w-full whitespace-nowrap pb-1">
                  <div className="flex gap-2 w-max px-1">
                    {quickActions.map((action) => (
                      <Button
                        key={action.id}
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs px-2 bg-background/50 backdrop-blur"
                        onClick={() => handleQuickAction(action.action)}
                      >
                        {action.icon}
                        <span className="ml-1.5">{action.label}</span>
                      </Button>
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <div className="flex items-center justify-between px-1">
                  <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                    {flowState.type === "journey_start" && "Iniciando Jornada..."}
                    {flowState.type === "fuel" && "Lançando Abastecimento..."}
                    {flowState.type === "expense" && "Lançando Despesa..."}
                    {flowState.type === "revenue" && "Lançando Receita..."}
                    {flowState.type === "xml_decision" && "Processando Arquivo..."}
                    {flowState.type === "payable" && "Nova Conta a Pagar..."}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs text-destructive hover:text-destructive"
                    onClick={handleCancelFlow}
                  >
                    <StopCircle className="w-3 h-3 mr-1" /> Cancelar
                  </Button>
                </div>
              )}

              <div className="flex gap-2">
                <input
                  type="file"
                  accept=".xml,.pdf"
                  className="hidden"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                />
                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 shrink-0"
                  title="Importar XML ou Boleto"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={loading || flowState.type !== "idle"}
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Paperclip className="w-4 h-4 text-muted-foreground" />
                  )}
                </Button>
                <Input
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  placeholder={flowState.type === "idle" ? "Digite algo..." : "Responda aqui..."}
                  onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                  disabled={loading}
                  className="flex-1 h-9 bg-muted/30 focus-visible:ring-1"
                  autoFocus
                />
                <Button
                  onClick={handleSendMessage}
                  disabled={!inputMessage.trim() || loading}
                  size="icon"
                  className="h-9 w-9 shrink-0"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
