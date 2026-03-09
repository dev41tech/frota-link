import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useMultiTenant } from "@/hooks/useMultiTenant";
import { CheckCircle2, Clock, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Props {
  announcementId: string;
  targetType: string;
}

interface ReadInfo {
  driverId: string;
  driverName: string;
  readAt: string | null;
}

export function AnnouncementReadStatus({ announcementId, targetType }: Props) {
  const { currentCompany } = useMultiTenant();
  const [reads, setReads] = useState<ReadInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReadStatus();
  }, [announcementId]);

  const fetchReadStatus = async () => {
    if (!currentCompany?.id) return;

    try {
      // Get all target drivers
      let targetDriverIds: string[] = [];

      if (targetType === "specific") {
        const { data: targets } = await supabase
          .from("announcement_targets")
          .select("driver_id")
          .eq("announcement_id", announcementId);
        targetDriverIds = targets?.map((t) => t.driver_id) || [];
      } else {
        const { data: allDrivers } = await supabase
          .from("drivers")
          .select("id")
          .eq("company_id", currentCompany.id)
          .eq("status", "active");
        targetDriverIds = allDrivers?.map((d) => d.id) || [];
      }

      // Get reads
      const { data: readData } = await supabase
        .from("announcement_reads")
        .select("driver_id, read_at")
        .eq("announcement_id", announcementId);

      const readMap = new Map(readData?.map((r) => [r.driver_id, r.read_at]) || []);

      // Get driver names
      if (targetDriverIds.length > 0) {
        const { data: drivers } = await supabase
          .from("drivers")
          .select("id, name")
          .in("id", targetDriverIds);

        const result: ReadInfo[] = (drivers || []).map((d) => ({
          driverId: d.id,
          driverName: d.name,
          readAt: readMap.get(d.id) || null,
        }));

        // Sort: unread first, then by name
        result.sort((a, b) => {
          if (!a.readAt && b.readAt) return -1;
          if (a.readAt && !b.readAt) return 1;
          return a.driverName.localeCompare(b.driverName);
        });

        setReads(result);
      }
    } catch (err) {
      console.error("Erro ao buscar status de leitura:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-4">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const readCount = reads.filter((r) => r.readAt).length;

  return (
    <div>
      <div className="px-3 py-2 border-b bg-muted/30">
        <p className="text-xs font-semibold text-muted-foreground">
          {readCount}/{reads.length} confirmaram leitura
        </p>
      </div>
      <div className="max-h-60 overflow-y-auto">
        {reads.length === 0 ? (
          <p className="text-sm text-muted-foreground p-3">Nenhum destinatário.</p>
        ) : (
          reads.map((r) => (
            <div
              key={r.driverId}
              className="flex items-center justify-between px-3 py-2 border-b last:border-0"
            >
              <span className="text-sm truncate flex-1">{r.driverName}</span>
              {r.readAt ? (
                <span className="flex items-center gap-1 text-xs text-green-600">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {format(new Date(r.readAt), "dd/MM HH:mm", { locale: ptBR })}
                </span>
              ) : (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  Pendente
                </span>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
