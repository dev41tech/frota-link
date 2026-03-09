import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Send, Loader2, MessageSquare, HeadphonesIcon, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, isSameDay, isToday, isYesterday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useDriverAuth } from "@/hooks/useDriverAuth";

interface Message {
  id: string;
  message: string;
  is_from_driver: boolean;
  created_at: string;
}

export function DriverChat() {
  const { driver } = useDriverAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Função para formatar a data do separador (Hoje, Ontem, ou DD/MM)
  const formatMessageDate = (dateString: string) => {
    const date = new Date(dateString);
    if (isToday(date)) return "Hoje";
    if (isYesterday(date)) return "Ontem";
    return format(date, "dd 'de' MMMM", { locale: ptBR });
  };

  // Rola suavemente para o fim
  const scrollToBottom = (smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "auto" });
  };

  useEffect(() => {
    if (driver) {
      fetchMessages();

      const channel = supabase
        .channel("driver-messages")
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "driver_messages",
            filter: `driver_id=eq.${driver.id}`,
          },
          (payload) => {
            const newMsg = payload.new as Message;
            // Evita duplicidade (caso o insert local já tenha adicionado)
            setMessages((prev) => {
              if (prev.some((msg) => msg.id === newMsg.id)) return prev;
              return [...prev, newMsg];
            });
            // Pequeno delay para garantir que o DOM atualizou antes de rolar
            setTimeout(() => scrollToBottom(true), 100);
          },
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [driver]);

  const fetchMessages = async () => {
    if (!driver) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("driver_messages")
        .select("*")
        .eq("driver_id", driver.id)
        .order("created_at", { ascending: true });

      if (error) throw error;
      setMessages(data || []);
      setTimeout(() => scrollToBottom(false), 100); // Scroll imediato ao carregar
    } catch (error: any) {
      console.error("Erro:", error);
      toast.error("Não foi possível carregar o chat");
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !driver) return;

    const messageContent = newMessage.trim();
    setNewMessage(""); // Limpa input imediatamente para UX rápida
    setSending(true);

    try {
      const { error } = await supabase.from("driver_messages").insert({
        company_id: driver.company_id,
        driver_id: driver.id,
        message: messageContent,
        is_from_driver: true,
      });

      if (error) throw error;
      // O realtime cuidará de atualizar a lista
    } catch (error: any) {
      toast.error("Erro ao enviar: " + error.message);
      setNewMessage(messageContent); // Devolve o texto em caso de erro
    } finally {
      setSending(false);
    }
  };

  return (
    // Altura responsiva calculada para caber na tela sem scroll duplo
    <Card className="flex flex-col h-[calc(100vh-180px)] min-h-[500px] border-none shadow-md overflow-hidden bg-[#e5e5e5]">
      {" "}
      {/* Fundo cinza estilo WhatsApp */}
      {/* CABEÇALHO */}
      <CardHeader className="bg-white border-b px-4 py-3 flex-shrink-0 z-10 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="bg-blue-100 p-2.5 rounded-full border border-blue-200">
            <HeadphonesIcon className="h-5 w-5 text-blue-600" />
          </div>
          <div className="flex-1">
            <CardTitle className="text-base font-bold text-gray-800">Central de Operações</CardTitle>
            <div className="flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
              </span>
              <p className="text-xs text-gray-500 font-medium">Online agora</p>
            </div>
          </div>
        </div>
      </CardHeader>
      {/* ÁREA DE MENSAGENS */}
      <CardContent
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#efe7dd] bg-opacity-50" // Cor de fundo suave
        style={{ backgroundImage: "radial-gradient(#cbd5e1 1px, transparent 1px)", backgroundSize: "20px 20px" }} // Padrão sutil de fundo
      >
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 opacity-70">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            <p className="text-sm font-medium text-gray-500">Conectando à central...</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-6">
            <div className="bg-white p-4 rounded-full shadow-sm mb-3">
              <MessageSquare className="h-8 w-8 text-blue-300" />
            </div>
            <h3 className="font-semibold text-gray-700">Comece a conversa</h3>
            <p className="text-sm text-gray-500 mt-1 max-w-[200px]">
              Envie uma mensagem para falar com o suporte ou gestor da frota.
            </p>
          </div>
        ) : (
          messages.map((msg, index) => {
            // Lógica para mostrar a data apenas quando muda o dia
            const showDate =
              index === 0 || !isSameDay(new Date(msg.created_at), new Date(messages[index - 1].created_at));

            return (
              <div key={msg.id} className="space-y-4">
                {/* Separador de Data */}
                {showDate && (
                  <div className="flex justify-center sticky top-0 z-0 my-4">
                    <span className="text-[10px] font-bold text-gray-500 bg-white/90 shadow-sm border px-3 py-1 rounded-full uppercase tracking-wide backdrop-blur-sm">
                      {formatMessageDate(msg.created_at)}
                    </span>
                  </div>
                )}

                {/* Balão da Mensagem */}
                <div
                  className={`flex ${msg.is_from_driver ? "justify-end" : "justify-start"} animate-in fade-in slide-in-from-bottom-2 duration-300`}
                >
                  <div
                    className={`max-w-[85%] md:max-w-[70%] rounded-2xl px-4 py-2 shadow-sm text-sm relative group ${
                      msg.is_from_driver
                        ? "bg-blue-600 text-white rounded-tr-none" // Estilo Motorista (Azul)
                        : "bg-white text-gray-800 border border-gray-100 rounded-tl-none" // Estilo Central (Branco)
                    }`}
                  >
                    {/* Nome (opcional, bom para grupos) */}
                    {!msg.is_from_driver && <p className="text-[10px] font-bold text-orange-600 mb-0.5">Central</p>}

                    <p className="leading-relaxed whitespace-pre-wrap break-words text-[15px]">{msg.message}</p>

                    <div
                      className={`flex items-center justify-end gap-1 mt-1 ${msg.is_from_driver ? "text-blue-100" : "text-gray-400"}`}
                    >
                      <span className="text-[10px]">{format(new Date(msg.created_at), "HH:mm")}</span>
                      {/* Check de leitura simulado para mensagens do motorista */}
                      {msg.is_from_driver && <CheckDoubleIcon className="h-3 w-3 opacity-80" />}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} className="h-1" />
      </CardContent>
      {/* ÁREA DE INPUT */}
      <div className="p-3 bg-white border-t flex items-end gap-2 flex-shrink-0">
        <form
          onSubmit={handleSendMessage}
          className="flex-1 flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-3xl px-4 py-1.5 focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-400 transition-all"
        >
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Digite sua mensagem..."
            disabled={sending}
            className="flex-1 border-none bg-transparent shadow-none focus-visible:ring-0 h-10 px-0 placeholder:text-gray-400"
            autoComplete="off"
          />
        </form>

        <Button
          onClick={handleSendMessage}
          disabled={sending || !newMessage.trim()}
          size="icon"
          className={`h-12 w-12 rounded-full shadow-md shrink-0 transition-all duration-200 ${
            !newMessage.trim()
              ? "bg-gray-200 text-gray-400 cursor-not-allowed hover:bg-gray-200"
              : "bg-blue-600 hover:bg-blue-700 hover:scale-105 active:scale-95 text-white"
          }`}
        >
          {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5 ml-0.5" />}
        </Button>
      </div>
    </Card>
  );
}

// Ícone auxiliar de check duplo
function CheckDoubleIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18 6L7 17l-5-5" />
      <path d="m22 10-7.5 7.5L13 16" />
    </svg>
  );
}
