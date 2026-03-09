import { useState, useEffect, useRef } from "react";

// --- IMPORTAÇÕES REAIS (Ative isto no seu projeto) ---
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useMultiTenant } from "@/hooks/useMultiTenant";
import { useSmartAssistant } from "@/hooks/useSmartAssistant";
import { FeatureGate } from "@/components/subscription/FeatureGate";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Bot,
  User,
  TrendingUp,
  CarFront,
  Users,
  ArrowRight,
  Loader2,
  LayoutDashboard,
  AlertCircle,
  Wallet,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// --- TIPAGEM (importada do hook) ---
import type { FleetData } from "@/hooks/useSmartAssistant";

// --- COMPONENTE VISUAL: BARRA DE PROGRESSO CLEAN ---
const MiniBarChart = ({
  label,
  value,
  max,
  colorClass,
  prefix = "",
}: {
  label: string;
  value: number;
  max: number;
  colorClass: string;
  prefix?: string;
}) => {
  const percent = Math.min((value / (max || 1)) * 100, 100);
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-xs items-end">
        <span className="text-muted-foreground font-medium">{label}</span>
        <span className="font-semibold text-foreground">
          {prefix}
          {value.toLocaleString("pt-BR")}
        </span>
      </div>
      <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${colorClass}`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
};

// --- HOOK DE DADOS EXPANDIDO (VERSÃO CORRIGIDA) ---
function useFleetMetrics(companyId: string | undefined) {
  const [data, setData] = useState<FleetData | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!companyId) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        // CORREÇÃO 1: 'as any' no nome da função para o TS não reclamar que ela "não existe"
        const { data: rpcData, error } = await supabase.rpc("get_fleet_dashboard_metrics" as any, {
          p_company_id: companyId,
        });

        if (error) throw error;

        // CORREÇÃO 2: 'as unknown as FleetData' força a conversão do tipo
        if (rpcData) {
          setData(rpcData as unknown as FleetData);
        }
      } catch (error: any) {
        console.error("Error fetching fleet metrics:", error);
        toast({
          title: "Erro ao carregar dados",
          description: "Não foi possível sincronizar os indicadores da frota.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [companyId, toast]);

  return { data, loading };
}

function ChatAssistantContent() {
  const { user } = useAuth();
  const { currentCompany } = useMultiTenant();
  const [inputMessage, setInputMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { data: fleetData, loading: isLoadingData } = useFleetMetrics(currentCompany?.id);

  const { messages, isLoading: isAIThinking, sendMessage } = useSmartAssistant();

  // Scroll automático
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isAIThinking]);

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputMessage(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  };

  const handleSendMessage = (text: string = inputMessage) => {
    if (!text.trim() || isAIThinking) return;

    // Aqui passamos o objeto turbinado para a IA
    sendMessage(text, fleetData as any);
    setInputMessage("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Renderização de conteúdo com segurança básica
  const renderContent = (text: string) => {
    return text.split("\n").map((line, i) => (
      <span key={i} className="block min-h-[1.5em] text-sm leading-relaxed">
        {line.split(/(\*\*.*?\*\*)/).map((part, j) =>
          part.startsWith("**") && part.endsWith("**") ? (
            <strong key={j} className="text-foreground font-semibold">
              {part.slice(2, -2)}
            </strong>
          ) : (
            part
          ),
        )}
      </span>
    ));
  };

  const suggestions = [
    {
      icon: TrendingUp,
      title: "Financeiro",
      questions: ["Qual o lucro líquido deste mês?", "Quanto gastei de combustível?"],
    },
    {
      icon: CarFront,
      title: "Operacional",
      questions: ["Qual veículo consome mais?", "Listar manutenções pendentes"],
    },
    {
      icon: Users,
      title: "Motoristas",
      questions: ["Qual motorista fez mais viagens?", "Ranking de economia"],
    },
  ];

  return (
    <div className="container mx-auto p-4 max-w-7xl h-[calc(100vh-2rem)] flex flex-col gap-6 bg-slate-50/50 dark:bg-zinc-950/50">
      {/* Header com Azul Padrão FrotaLink */}
      <div className="flex items-center justify-between shrink-0 mb-2 border-b border-blue-100/40 dark:border-blue-900/40 pb-4">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 text-white p-2 rounded-lg shadow-sm shadow-blue-200 dark:shadow-none">
            <LayoutDashboard className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-blue-950 dark:text-blue-50 tracking-tight">Frota Assistent</h1>
            <p className="text-sm text-blue-600/80 dark:text-blue-400 font-medium">Gestão Inteligente de Frota</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-0">
        {/* COLUNA ESQUERDA: DASHBOARD VISUAL (30%) */}
        <div className="lg:col-span-4 flex flex-col gap-4 overflow-y-auto pr-1">
          {/* Cartão de Resumo Financeiro */}
          <Card className="border border-blue-100 dark:border-blue-900 shadow-sm bg-white dark:bg-slate-900">
            <CardHeader className="pb-3 pt-5 px-5 border-b border-slate-50 dark:border-slate-800">
              <CardTitle className="text-sm font-semibold uppercase tracking-wider text-blue-600/90 dark:text-blue-400 flex items-center gap-2">
                <Wallet className="w-4 h-4" /> Resumo Financeiro (30d)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 pt-5 px-5">
              {isLoadingData ? (
                <div className="space-y-4 animate-pulse">
                  <div className="h-8 bg-slate-100 dark:bg-slate-800 rounded w-1/2" />
                  <div className="h-4 bg-slate-100 dark:bg-slate-800 rounded w-full" />
                </div>
              ) : fleetData ? (
                <>
                  <div className="space-y-1">
                    <span className="text-xs font-medium text-slate-500">Receita Total</span>
                    <div className="text-3xl font-bold text-blue-900 dark:text-blue-50 tracking-tight">
                      R$ {fleetData.monthlyRevenue.toLocaleString("pt-BR", { notation: "compact" })}
                    </div>
                  </div>

                  <div className="space-y-5">
                    <MiniBarChart
                      label="Combustível"
                      value={fleetData.totalFuelCosts}
                      max={fleetData.monthlyRevenue || 1}
                      colorClass="bg-amber-500"
                      prefix="R$ "
                    />
                    <MiniBarChart
                      label="Outras Despesas"
                      value={fleetData.totalExpenses}
                      max={fleetData.monthlyRevenue || 1}
                      colorClass="bg-rose-500"
                      prefix="R$ "
                    />
                  </div>
                </>
              ) : (
                <div className="text-center py-6 text-muted-foreground text-sm">Sem dados disponíveis</div>
              )}
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 gap-4">
            <Card className="border border-slate-100 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900 hover:border-blue-200 dark:hover:border-blue-800 transition-colors group">
              <CardContent className="p-5 flex flex-col justify-between h-full">
                <div className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2 group-hover:text-blue-600 transition-colors">
                  Veículos
                </div>
                <div className="flex justify-between items-end">
                  <span className="text-2xl font-bold text-slate-900 dark:text-slate-50">
                    {fleetData?.totalVehicles || 0}
                  </span>
                  <CarFront className="w-5 h-5 text-blue-200 dark:text-blue-900 group-hover:text-blue-500 transition-colors" />
                </div>
              </CardContent>
            </Card>
            <Card className="border border-slate-100 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900 hover:border-blue-200 dark:hover:border-blue-800 transition-colors group">
              <CardContent className="p-5 flex flex-col justify-between h-full">
                <div className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2 group-hover:text-blue-600 transition-colors">
                  Motoristas
                </div>
                <div className="flex justify-between items-end">
                  <span className="text-2xl font-bold text-slate-900 dark:text-slate-50">
                    {fleetData?.totalDrivers || 0}
                  </span>
                  <Users className="w-5 h-5 text-blue-200 dark:text-blue-900 group-hover:text-blue-500 transition-colors" />
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="border border-amber-100 bg-amber-50/50 dark:bg-amber-950/20 shadow-none">
            <CardContent className="p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-semibold text-amber-900 dark:text-amber-400">Pendências</p>
                <div className="text-xs text-amber-800/80 dark:text-amber-500/80">
                  <span className="font-bold">R$ {fleetData?.pendingPayables.toLocaleString("pt-BR")}</span> em contas a
                  pagar.
                </div>
                <button
                  className="text-xs font-medium text-amber-700 hover:text-amber-900 hover:underline flex items-center gap-1 mt-1"
                  onClick={() => handleSendMessage("Quais são as contas a pagar pendentes?")}
                >
                  Ver detalhes <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* COLUNA DIREITA: CHAT (70%) */}
        <div className="lg:col-span-8 flex flex-col h-full min-h-0">
          <Card className="flex flex-col h-full border border-blue-50 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900 overflow-hidden">
            {/* ÁREA DE MENSAGENS */}
            <ScrollArea className="flex-1 p-6">
              {messages.length === 0 ? (
                // ESTADO ZERO (CLEAN & BLUE)
                <div className="h-full flex flex-col items-center justify-center space-y-8 opacity-0 animate-in fade-in duration-700 fill-mode-forwards">
                  <div className="text-center space-y-3">
                    <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/20 rounded-xl flex items-center justify-center mx-auto mb-4 border border-blue-100 dark:border-blue-800">
                      <Bot className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Olá, como posso ajudar?</h3>
                    <p className="text-slate-500 max-w-sm mx-auto text-sm">
                      Selecione uma categoria abaixo para começar a análise da sua frota.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full max-w-2xl px-4">
                    {suggestions.map((group, idx) => (
                      <div key={idx} className="space-y-2 group">
                        <div className="flex items-center gap-2 text-xs font-semibold text-blue-600/70 dark:text-blue-400 uppercase tracking-wider px-1">
                          <group.icon className="w-3.5 h-3.5" />
                          {group.title}
                        </div>
                        <div className="flex flex-col gap-2">
                          {group.questions.map((q, qIdx) => (
                            <button
                              key={qIdx}
                              onClick={() => handleSendMessage(q)}
                              className="text-left text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/50 hover:bg-blue-50 hover:text-blue-700 dark:hover:bg-blue-900/30 dark:hover:text-blue-200 border border-slate-100 dark:border-slate-800 p-3 rounded-lg transition-all hover:shadow-sm hover:border-blue-100"
                            >
                              {q}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                // MENSAGENS (ESTILO BLUE)
                <div className="space-y-6 max-w-3xl mx-auto">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex gap-4 ${message.role === "user" ? "flex-row-reverse" : "flex-row"} animate-in slide-in-from-bottom-2`}
                    >
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-medium border ${
                          message.role === "user"
                            ? "bg-blue-600 text-white border-blue-600"
                            : "bg-white text-blue-600 border-blue-100"
                        }`}
                      >
                        {message.role === "user" ? <User className="w-4 h-4" /> : "AI"}
                      </div>

                      <div
                        className={`flex flex-col gap-1 max-w-[80%] ${message.role === "user" ? "items-end" : "items-start"}`}
                      >
                        <div
                          className={`rounded-2xl px-5 py-3 text-sm shadow-sm ${
                            message.role === "user"
                              ? "bg-blue-600 text-white rounded-tr-none"
                              : "bg-slate-50 border border-blue-50/50 text-slate-800 rounded-tl-none"
                          }`}
                        >
                          {renderContent(message.content)}
                        </div>
                      </div>
                    </div>
                  ))}

                  {isAIThinking && (
                    <div className="flex gap-4">
                      <div className="w-8 h-8 rounded-full bg-white border border-blue-100 flex items-center justify-center shrink-0">
                        <Bot className="w-4 h-4 text-blue-400 animate-pulse" />
                      </div>
                      <div className="bg-slate-50 rounded-2xl rounded-tl-none px-4 py-3 flex items-center gap-2 border border-slate-100">
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" />
                        <span className="text-xs text-slate-500 font-medium">Processando...</span>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </ScrollArea>

            {/* INPUT CLEAN BLUE */}
            <div className="p-4 bg-white border-t border-blue-50">
              <div className="max-w-3xl mx-auto relative flex items-end gap-2 bg-slate-50 p-2 rounded-2xl border border-slate-200 focus-within:border-blue-300 focus-within:ring-2 focus-within:ring-blue-50 focus-within:bg-white transition-all">
                <Textarea
                  ref={textareaRef}
                  placeholder="Digite sua pergunta..."
                  value={inputMessage}
                  onChange={handleInput}
                  onKeyDown={handleKeyDown}
                  disabled={isAIThinking}
                  className="min-h-[44px] max-h-[150px] bg-transparent border-0 focus-visible:ring-0 resize-none py-2.5 px-3 shadow-none scrollbar-hide text-sm placeholder:text-slate-400"
                  rows={1}
                />
                <Button
                  onClick={() => handleSendMessage()}
                  disabled={isAIThinking || !inputMessage.trim()}
                  size="icon"
                  className={`mb-0.5 h-9 w-9 rounded-xl transition-all duration-200 ${
                    inputMessage.trim()
                      ? "bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-200"
                      : "bg-slate-200 text-slate-400"
                  }`}
                >
                  {isAIThinking ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                </Button>
              </div>
              <div className="text-[10px] text-center text-slate-400 mt-3 font-medium flex items-center justify-center gap-1.5">
                <Sparkles className="w-3 h-3 text-blue-400" />
                Frota Assistent AI • Dados em tempo real
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

// Export with FeatureGate wrapper
export default function ChatAssistant() {
  return (
    <FeatureGate feature="ai">
      <ChatAssistantContent />
    </FeatureGate>
  );
}
