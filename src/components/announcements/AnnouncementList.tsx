import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useMultiTenant } from "@/hooks/useMultiTenant";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Plus, Bell, AlertTriangle, Users, CheckCircle2, Clock, Eye } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { CreateAnnouncementDialog } from "./CreateAnnouncementDialog";
import { AnnouncementReadStatus } from "./AnnouncementReadStatus";

interface Announcement {
  id: string;
  title: string;
  message: string;
  priority: string;
  target_type: string;
  created_at: string;
  user_id: string;
}

export function AnnouncementList() {
  const { currentCompany } = useMultiTenant();
  const { user } = useAuth();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const fetchAnnouncements = async () => {
    if (!currentCompany?.id) return;
    try {
      const { data, error } = await supabase
        .from("announcements")
        .select("*")
        .eq("company_id", currentCompany.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setAnnouncements(data || []);
    } catch (err: any) {
      console.error("Erro ao buscar avisos:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnnouncements();
  }, [currentCompany?.id]);

  const handleCreated = () => {
    setShowCreate(false);
    fetchAnnouncements();
    toast.success("Aviso enviado com sucesso!");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {announcements.length} aviso(s) enviado(s)
        </p>
        <Button onClick={() => setShowCreate(true)} size="sm">
          <Plus className="h-4 w-4 mr-1" />
          Novo Aviso
        </Button>
      </div>

      {announcements.length === 0 ? (
        <div className="text-center py-12">
          <Bell className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
          <h3 className="font-semibold text-foreground">Nenhum aviso enviado</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Envie comunicados oficiais para os motoristas.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {announcements.map((a) => (
            <Card key={a.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {a.priority === "urgent" ? (
                        <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
                      ) : (
                        <Bell className="h-4 w-4 text-primary shrink-0" />
                      )}
                      <h4 className="font-semibold text-sm truncate">{a.title}</h4>
                      {a.priority === "urgent" && (
                        <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                          Urgente
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                      {a.message}
                    </p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {format(new Date(a.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {a.target_type === "all" ? "Todos" : "Específicos"}
                      </span>
                    </div>
                  </div>
                  <Popover open={selectedId === a.id} onOpenChange={(open) => setSelectedId(open ? a.id : null)}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="shrink-0">
                        <Eye className="h-3.5 w-3.5 mr-1" />
                        Leituras
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-72 p-0" align="end">
                      <AnnouncementReadStatus
                        announcementId={a.id}
                        targetType={a.target_type}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <CreateAnnouncementDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        onCreated={handleCreated}
      />
    </div>
  );
}
