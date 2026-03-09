import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useMultiTenant } from '@/hooks/useMultiTenant';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, User } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Conversation {
  driverId: string;
  driverName: string;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
  isFromDriver: boolean;
}

interface ConversationListProps {
  selectedDriverId: string | null;
  onSelectDriver: (driverId: string, driverName: string) => void;
}

export function ConversationList({ selectedDriverId, onSelectDriver }: ConversationListProps) {
  const { currentCompany } = useMultiTenant();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchConversations = async () => {
    if (!currentCompany?.id) return;

    try {
      // Get all messages with driver info
      const { data: messages, error } = await supabase
        .from('driver_messages')
        .select(`
          id,
          driver_id,
          message,
          created_at,
          is_from_driver,
          read_at,
          drivers:driver_id (
            id,
            name
          )
        `)
        .eq('company_id', currentCompany.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[ConversationList] Error:', error);
        return;
      }

      // Group by driver and get latest message + unread count
      const conversationMap = new Map<string, Conversation>();

      messages?.forEach((msg) => {
        if (!msg.driver_id || !msg.drivers) return;
        
        const driver = msg.drivers as { id: string; name: string };
        const existing = conversationMap.get(msg.driver_id);

        if (!existing) {
          conversationMap.set(msg.driver_id, {
            driverId: msg.driver_id,
            driverName: driver.name,
            lastMessage: msg.message,
            lastMessageAt: msg.created_at,
            unreadCount: msg.is_from_driver && !msg.read_at ? 1 : 0,
            isFromDriver: msg.is_from_driver,
          });
        } else {
          // Count unread
          if (msg.is_from_driver && !msg.read_at) {
            existing.unreadCount += 1;
          }
        }
      });

      // Convert to array and sort by unread first, then by date
      const sortedConversations = Array.from(conversationMap.values()).sort((a, b) => {
        if (a.unreadCount > 0 && b.unreadCount === 0) return -1;
        if (a.unreadCount === 0 && b.unreadCount > 0) return 1;
        return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();
      });

      setConversations(sortedConversations);
    } catch (err) {
      console.error('[ConversationList] Exception:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchConversations();

    if (!currentCompany?.id) return;

    // Subscribe to realtime updates
    const channel = supabase
      .channel('conversations-list')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'driver_messages',
          filter: `company_id=eq.${currentCompany.id}`,
        },
        () => {
          fetchConversations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentCompany?.id]);

  const filteredConversations = conversations.filter((conv) =>
    conv.driverName.toLowerCase().includes(search.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="p-4 space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-32" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="p-3 border-b border-border">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar motorista..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Conversations */}
      <ScrollArea className="flex-1">
        <div className="p-2">
          {filteredConversations.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <User className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Nenhuma conversa encontrada</p>
            </div>
          ) : (
            filteredConversations.map((conv) => (
              <button
                key={conv.driverId}
                onClick={() => onSelectDriver(conv.driverId, conv.driverName)}
                className={cn(
                  "w-full p-3 rounded-lg flex items-start gap-3 text-left transition-colors",
                  "hover:bg-muted/50",
                  selectedDriverId === conv.driverId && "bg-muted"
                )}
              >
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="bg-primary/10 text-primary">
                    {conv.driverName.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className={cn(
                      "font-medium truncate",
                      conv.unreadCount > 0 && "text-foreground"
                    )}>
                      {conv.driverName}
                    </span>
                    {conv.unreadCount > 0 && (
                      <Badge variant="default" className="h-5 min-w-5 px-1.5">
                        {conv.unreadCount}
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-2 mt-0.5">
                    <p className={cn(
                      "text-sm truncate",
                      conv.unreadCount > 0 
                        ? "text-foreground font-medium" 
                        : "text-muted-foreground"
                    )}>
                      {!conv.isFromDriver && "Você: "}
                      {conv.lastMessage}
                    </p>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDistanceToNow(new Date(conv.lastMessageAt), {
                        addSuffix: false,
                        locale: ptBR,
                      })}
                    </span>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
