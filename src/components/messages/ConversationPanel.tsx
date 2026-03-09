import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useMultiTenant } from '@/hooks/useMultiTenant';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Send, Truck, MapPin, MessageSquare } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

interface Message {
  id: string;
  message: string;
  isFromDriver: boolean;
  createdAt: string;
}

interface DriverInfo {
  id: string;
  name: string;
  vehicles: { plate: string; model: string }[];
  activeJourney: { journeyNumber: string; origin: string; destination: string } | null;
}

interface ConversationPanelProps {
  driverId: string;
  driverName: string;
}

export function ConversationPanel({ driverId, driverName }: ConversationPanelProps) {
  const { currentCompany } = useMultiTenant();
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [driverInfo, setDriverInfo] = useState<DriverInfo | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    setTimeout(() => {
      scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const fetchMessages = async () => {
    if (!currentCompany?.id || !driverId) return;

    try {
      const { data, error } = await supabase
        .from('driver_messages')
        .select('id, message, is_from_driver, created_at')
        .eq('company_id', currentCompany.id)
        .eq('driver_id', driverId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('[ConversationPanel] Error fetching messages:', error);
        return;
      }

      setMessages(
        data?.map((msg) => ({
          id: msg.id,
          message: msg.message,
          isFromDriver: msg.is_from_driver,
          createdAt: msg.created_at,
        })) || []
      );

      scrollToBottom();
    } catch (err) {
      console.error('[ConversationPanel] Exception:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchDriverInfo = async () => {
    if (!currentCompany?.id || !driverId) return;

    try {
      // Get driver with vehicles
      const { data: driver, error: driverError } = await supabase
        .from('drivers')
        .select(`
          id,
          name,
          driver_vehicles (
            vehicle_id,
            status,
            vehicles:vehicle_id (
              plate,
              model
            )
          )
        `)
        .eq('id', driverId)
        .single();

      if (driverError) {
        console.error('[ConversationPanel] Error fetching driver:', driverError);
        return;
      }

      // Get active journey
      const { data: journey } = await supabase
        .from('journeys')
        .select('journey_number, origin, destination')
        .eq('driver_id', driverId)
        .eq('status', 'in_progress')
        .maybeSingle();

      const vehicles = driver?.driver_vehicles
        ?.filter((dv: any) => dv.status === 'active' && dv.vehicles)
        .map((dv: any) => ({
          plate: dv.vehicles.plate,
          model: dv.vehicles.model || '',
        })) || [];

      setDriverInfo({
        id: driver?.id,
        name: driver?.name,
        vehicles,
        activeJourney: journey ? {
          journeyNumber: journey.journey_number,
          origin: journey.origin,
          destination: journey.destination,
        } : null,
      });
    } catch (err) {
      console.error('[ConversationPanel] Exception fetching driver info:', err);
    }
  };

  const markAsRead = async () => {
    if (!currentCompany?.id || !driverId) return;

    try {
      await supabase
        .from('driver_messages')
        .update({ read_at: new Date().toISOString() })
        .eq('company_id', currentCompany.id)
        .eq('driver_id', driverId)
        .eq('is_from_driver', true)
        .is('read_at', null);
    } catch (err) {
      console.error('[ConversationPanel] Error marking as read:', err);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !currentCompany?.id || !user?.id || !driverId) return;

    setIsSending(true);

    try {
      const { error } = await supabase.from('driver_messages').insert({
        company_id: currentCompany.id,
        driver_id: driverId,
        user_id: user.id,
        message: newMessage.trim(),
        is_from_driver: false,
      });

      if (error) {
        toast.error('Erro ao enviar mensagem');
        console.error('[ConversationPanel] Error sending:', error);
        return;
      }

      setNewMessage('');
      inputRef.current?.focus();
    } catch (err) {
      toast.error('Erro ao enviar mensagem');
      console.error('[ConversationPanel] Exception sending:', err);
    } finally {
      setIsSending(false);
    }
  };

  useEffect(() => {
    setIsLoading(true);
    setMessages([]);
    fetchMessages();
    fetchDriverInfo();
    markAsRead();

    if (!currentCompany?.id || !driverId) return;

    // Subscribe to realtime updates
    const channel = supabase
      .channel(`conversation-${driverId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'driver_messages',
          filter: `driver_id=eq.${driverId}`,
        },
        (payload) => {
          const newMsg = payload.new as any;
          setMessages((prev) => [
            ...prev,
            {
              id: newMsg.id,
              message: newMsg.message,
              isFromDriver: newMsg.is_from_driver,
              createdAt: newMsg.created_at,
            },
          ]);
          scrollToBottom();
          
          // Mark as read if from driver
          if (newMsg.is_from_driver) {
            markAsRead();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [driverId, currentCompany?.id]);

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <div className="p-4 border-b border-border">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-48 mt-2" />
        </div>
        <div className="flex-1 p-4 space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className={cn("flex", i % 2 === 0 && "justify-end")}>
              <Skeleton className="h-16 w-48 rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header with driver info */}
      <div className="p-4 border-b border-border bg-muted/30">
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10">
            <AvatarFallback className="bg-primary/10 text-primary">
              {driverName.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold">{driverName}</h3>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              {driverInfo?.vehicles.map((v) => (
                <Badge key={v.plate} variant="secondary" className="text-xs">
                  <Truck className="h-3 w-3 mr-1" />
                  {v.plate}
                </Badge>
              ))}
              {driverInfo?.activeJourney && (
                <Badge variant="outline" className="text-xs">
                  <MapPin className="h-3 w-3 mr-1" />
                  {driverInfo.activeJourney.origin} → {driverInfo.activeJourney.destination}
                </Badge>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {messages.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <MessageSquare className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Nenhuma mensagem ainda</p>
              <p className="text-xs mt-1">Envie uma mensagem para iniciar a conversa</p>
            </div>
          ) : (
            messages.map((msg, index) => {
              const showDate =
                index === 0 ||
                format(new Date(msg.createdAt), 'yyyy-MM-dd') !==
                  format(new Date(messages[index - 1].createdAt), 'yyyy-MM-dd');

              return (
                <div key={msg.id}>
                  {showDate && (
                    <div className="flex justify-center mb-4">
                      <span className="text-xs text-muted-foreground bg-muted px-3 py-1 rounded-full">
                        {format(new Date(msg.createdAt), "d 'de' MMMM", { locale: ptBR })}
                      </span>
                    </div>
                  )}
                  <div
                    className={cn(
                      "flex",
                      msg.isFromDriver ? "justify-start" : "justify-end"
                    )}
                  >
                    <div
                      className={cn(
                        "max-w-[75%] rounded-2xl px-4 py-2",
                        msg.isFromDriver
                          ? "bg-muted rounded-bl-md"
                          : "bg-primary text-primary-foreground rounded-br-md"
                      )}
                    >
                      <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                      <p
                        className={cn(
                          "text-xs mt-1",
                          msg.isFromDriver ? "text-muted-foreground" : "text-primary-foreground/70"
                        )}
                      >
                        {format(new Date(msg.createdAt), 'HH:mm')}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={scrollRef} />
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="p-4 border-t border-border">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex gap-2"
        >
          <Input
            ref={inputRef}
            placeholder="Digite sua mensagem..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            disabled={isSending}
            className="flex-1"
          />
          <Button type="submit" disabled={isSending || !newMessage.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}
