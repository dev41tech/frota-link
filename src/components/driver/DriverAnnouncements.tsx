import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useDriverAuth } from "@/hooks/useDriverAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

interface Announcement {
  id: string;
  title: string;
  message: string;
  priority: string;
  target_type: string;
  created_at: string;
}

export function DriverAnnouncements() {
  const { driver } = useDriverAuth();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState<string | null>(null);

  const fetchData = async () => {
    if (!driver) return;
    try {
      // Fetch announcements for this company
      const { data: allAnn, error } = await supabase
        .from("announcements")
        .select("*")
        .eq("company_id", driver.company_id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Filter: only "all" target or ones targeting this driver
      const { data: targets } = await supabase
        .from("announcement_targets")
        .select("announcement_id")
        .eq("driver_id", driver.id);

      const targetedIds = new Set(targets?.map((t) => t.announcement_id) || []);

      const visible = (allAnn || []).filter(
        (a) => a.target_type === "all" || targetedIds.has(a.id)
      );

      setAnnouncements(visible);

      // Fetch reads
      const { data: reads } = await supabase
        .from("announcement_reads")
        .select("announcement_id")
        .eq("driver_id", driver.id);

      setReadIds(new Set(reads?.map((r) => r.announcement_id) || []));
    } catch (err) {
      console.error("Erro ao buscar avisos:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [driver?.id]);

  const handleConfirm = async (announcementId: string) => {
    if (!driver) return;
    setConfirming(announcementId);
    try {
      const { error } = await supabase.from("announcement_reads").insert({
        announcement_id: announcementId,
        driver_id: driver.id,
      });

      if (error) {
        if (error.code === "23505") {
          // Already read
          setReadIds((prev) => new Set([...prev, announcementId]));
          return;
        }
        throw error;
      }

      setReadIds((prev) => new Set([...prev, announcementId]));
      toast.success("Leitura confirmada!");
    } catch (err: any) {
      toast.error("Erro: " + err.message);
    } finally {
      setConfirming(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (announcements.length === 0) {
    return (
      <div className="text-center py-12 px-4">
        <Bell className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
        <h3 className="font-semibold">Nenhum aviso</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Comunicados da gestão aparecerão aqui.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {announcements.map((a) => {
        const isRead = readIds.has(a.id);

        return (
          <Card
            key={a.id}
            className={`transition-all ${
              isRead ? "opacity-70" : "border-primary/30 shadow-sm"
            }`}
          >
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="shrink-0 mt-0.5">
                  {a.priority === "urgent" ? (
                    <AlertTriangle className="h-5 w-5 text-destructive" />
                  ) : (
                    <Bell className="h-5 w-5 text-primary" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-semibold text-sm">{a.title}</h4>
                    {a.priority === "urgent" && (
                      <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                        Urgente
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap mb-2">
                    {a.message}
                  </p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(a.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                    </span>
                    {isRead ? (
                      <span className="flex items-center gap-1 text-xs text-green-600">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Ciente
                      </span>
                    ) : (
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => handleConfirm(a.id)}
                        disabled={confirming === a.id}
                      >
                        {confirming === a.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                        ) : (
                          <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                        )}
                        Ciente
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
