import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useMultiTenant } from "@/hooks/useMultiTenant";
import { useAuth } from "@/hooks/useAuth";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

interface Driver {
  id: string;
  name: string;
}

export function CreateAnnouncementDialog({ open, onOpenChange, onCreated }: Props) {
  const { currentCompany } = useMultiTenant();
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [priority, setPriority] = useState("normal");
  const [targetType, setTargetType] = useState("all");
  const [selectedDrivers, setSelectedDrivers] = useState<string[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (open && currentCompany?.id) {
      supabase
        .from("drivers")
        .select("id, name")
        .eq("company_id", currentCompany.id)
        .eq("status", "active")
        .order("name")
        .then(({ data }) => setDrivers(data || []));
    }
  }, [open, currentCompany?.id]);

  const handleSubmit = async () => {
    if (!title.trim() || !message.trim() || !currentCompany?.id || !user?.id) return;
    if (targetType === "specific" && selectedDrivers.length === 0) {
      toast.error("Selecione pelo menos um motorista.");
      return;
    }

    setSending(true);
    try {
      const { data: ann, error } = await supabase
        .from("announcements")
        .insert({
          company_id: currentCompany.id,
          user_id: user.id,
          title: title.trim(),
          message: message.trim(),
          priority,
          target_type: targetType,
        })
        .select("id")
        .single();

      if (error) throw error;

      if (targetType === "specific" && ann) {
        const targets = selectedDrivers.map((dId) => ({
          announcement_id: ann.id,
          driver_id: dId,
        }));
        const { error: tErr } = await supabase.from("announcement_targets").insert(targets);
        if (tErr) throw tErr;
      }

      // Reset form
      setTitle("");
      setMessage("");
      setPriority("normal");
      setTargetType("all");
      setSelectedDrivers([]);
      onCreated();
    } catch (err: any) {
      toast.error("Erro ao enviar aviso: " + err.message);
    } finally {
      setSending(false);
    }
  };

  const toggleDriver = (id: string) => {
    setSelectedDrivers((prev) =>
      prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Novo Aviso</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Título</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Nova política de abastecimento"
              maxLength={100}
            />
          </div>

          <div>
            <Label>Mensagem</Label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Escreva o comunicado..."
              rows={4}
              className="resize-none"
            />
          </div>

          <div>
            <Label>Prioridade</Label>
            <RadioGroup value={priority} onValueChange={setPriority} className="flex gap-4 mt-1">
              <div className="flex items-center gap-2">
                <RadioGroupItem value="normal" id="p-normal" />
                <Label htmlFor="p-normal" className="font-normal cursor-pointer">Normal</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="urgent" id="p-urgent" />
                <Label htmlFor="p-urgent" className="font-normal cursor-pointer text-destructive">Urgente</Label>
              </div>
            </RadioGroup>
          </div>

          <div>
            <Label>Destinatários</Label>
            <RadioGroup value={targetType} onValueChange={setTargetType} className="flex gap-4 mt-1">
              <div className="flex items-center gap-2">
                <RadioGroupItem value="all" id="t-all" />
                <Label htmlFor="t-all" className="font-normal cursor-pointer">Todos os motoristas</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="specific" id="t-specific" />
                <Label htmlFor="t-specific" className="font-normal cursor-pointer">Selecionar</Label>
              </div>
            </RadioGroup>
          </div>

          {targetType === "specific" && (
            <ScrollArea className="max-h-40 border rounded-md p-2">
              {drivers.length === 0 ? (
                <p className="text-sm text-muted-foreground p-2">Nenhum motorista ativo.</p>
              ) : (
                <div className="space-y-2">
                  {drivers.map((d) => (
                    <label key={d.id} className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 p-1 rounded">
                      <Checkbox
                        checked={selectedDrivers.includes(d.id)}
                        onCheckedChange={() => toggleDriver(d.id)}
                      />
                      <span className="text-sm">{d.name}</span>
                    </label>
                  ))}
                </div>
              )}
            </ScrollArea>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={sending || !title.trim() || !message.trim()}>
            {sending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
            Enviar Aviso
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
