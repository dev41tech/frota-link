import { useState, useEffect } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useMultiTenant } from "@/hooks/useMultiTenant";
import { toast } from "sonner";
import { Plus, Building2, Check, ChevronsUpDown, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCNPJ } from "@/lib/maintenanceInvoiceParser";

export interface Workshop {
  id: string;
  name: string;
  cnpj: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  specialties: string[];
  rating: number | null;
  notes: string | null;
}

interface WorkshopSelectProps {
  value: string | null;
  onChange: (workshopId: string | null, workshop?: Workshop) => void;
  prefilledData?: Partial<Workshop>;
}

const SPECIALTIES = [
  { value: "oil_change", label: "Troca de Óleo" },
  { value: "tires", label: "Pneus" },
  { value: "brakes", label: "Freios" },
  { value: "electrical", label: "Elétrica" },
  { value: "suspension", label: "Suspensão" },
  { value: "engine", label: "Motor" },
  { value: "transmission", label: "Câmbio" },
  { value: "bodywork", label: "Funilaria" },
  { value: "general", label: "Geral" },
];

export function WorkshopSelect({ value, onChange, prefilledData }: WorkshopSelectProps) {
  const { user } = useAuth();
  const { currentCompany } = useMultiTenant();
  const [workshops, setWorkshops] = useState<Workshop[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<Partial<Workshop>>({
    name: "",
    cnpj: "",
    phone: "",
    email: "",
    address: "",
    city: "",
    state: "",
    specialties: [],
    rating: null,
    notes: "",
  });

  useEffect(() => {
    if (currentCompany?.id) {
      fetchWorkshops();
    }
  }, [currentCompany?.id]);

  useEffect(() => {
    if (prefilledData && dialogOpen) {
      setFormData({
        name: prefilledData.name || "",
        cnpj: prefilledData.cnpj || "",
        phone: prefilledData.phone || "",
        email: prefilledData.email || "",
        address: prefilledData.address || "",
        city: prefilledData.city || "",
        state: prefilledData.state || "",
        specialties: prefilledData.specialties || [],
        rating: prefilledData.rating || null,
        notes: prefilledData.notes || "",
      });
    }
  }, [prefilledData, dialogOpen]);

  const fetchWorkshops = async () => {
    if (!currentCompany?.id) return;

    try {
      const { data, error } = await supabase
        .from("workshops")
        .select("*")
        .eq("company_id", currentCompany.id)
        .eq("status", "active")
        .order("name");

      if (error) throw error;
      setWorkshops(data || []);
    } catch (error) {
      console.error("Error fetching workshops:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateWorkshop = async () => {
    if (!user || !currentCompany?.id || !formData.name) {
      toast.error("Preencha o nome da oficina");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        company_id: currentCompany.id,
        user_id: user.id,
        name: formData.name,
        cnpj: formData.cnpj?.replace(/\D/g, "") || null,
        phone: formData.phone || null,
        email: formData.email || null,
        address: formData.address || null,
        city: formData.city || null,
        state: formData.state || null,
        specialties: formData.specialties || [],
        rating: formData.rating || null,
        notes: formData.notes || null,
      };

      const { data, error } = await supabase
        .from("workshops")
        .insert(payload)
        .select()
        .single();

      if (error) throw error;

      toast.success("Oficina cadastrada com sucesso");
      setWorkshops([...workshops, data]);
      onChange(data.id, data);
      setDialogOpen(false);
      resetForm();
    } catch (error: any) {
      console.error("Error creating workshop:", error);
      toast.error(error.message || "Erro ao cadastrar oficina");
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      cnpj: "",
      phone: "",
      email: "",
      address: "",
      city: "",
      state: "",
      specialties: [],
      rating: null,
      notes: "",
    });
  };

  const selectedWorkshop = workshops.find((w) => w.id === value);

  const handleOpenNewWorkshop = () => {
    if (prefilledData) {
      setFormData({
        name: prefilledData.name || "",
        cnpj: prefilledData.cnpj || "",
        phone: prefilledData.phone || "",
        email: prefilledData.email || "",
        address: prefilledData.address || "",
        city: prefilledData.city || "",
        state: prefilledData.state || "",
        specialties: prefilledData.specialties || [],
        rating: null,
        notes: "",
      });
    } else {
      resetForm();
    }
    setDialogOpen(true);
  };

  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-2">
        <Building2 className="h-4 w-4" />
        Oficina / Fornecedor
      </Label>

      <div className="flex gap-2">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className="flex-1 justify-between"
              disabled={loading}
            >
              {selectedWorkshop ? (
                <span className="truncate">{selectedWorkshop.name}</span>
              ) : (
                <span className="text-muted-foreground">Selecione uma oficina...</span>
              )}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[300px] p-0" align="start">
            <Command>
              <CommandInput placeholder="Buscar oficina..." />
              <CommandList>
                <CommandEmpty>Nenhuma oficina encontrada.</CommandEmpty>
                <CommandGroup>
                  {workshops.map((workshop) => (
                    <CommandItem
                      key={workshop.id}
                      value={workshop.name}
                      onSelect={() => {
                        onChange(workshop.id, workshop);
                        setOpen(false);
                      }}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          value === workshop.id ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="truncate font-medium">{workshop.name}</p>
                        {workshop.city && (
                          <p className="text-xs text-muted-foreground">
                            {workshop.city} - {workshop.state}
                          </p>
                        )}
                      </div>
                      {workshop.rating && (
                        <div className="flex items-center gap-1 text-xs">
                          <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                          {workshop.rating}
                        </div>
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={handleOpenNewWorkshop}
          title="Nova oficina"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {/* Workshop Details */}
      {selectedWorkshop && (
        <div className="text-xs text-muted-foreground space-y-1 p-2 bg-muted/50 rounded">
          {selectedWorkshop.cnpj && (
            <p>CNPJ: {formatCNPJ(selectedWorkshop.cnpj)}</p>
          )}
          {selectedWorkshop.address && (
            <p>{selectedWorkshop.address}, {selectedWorkshop.city} - {selectedWorkshop.state}</p>
          )}
          {selectedWorkshop.specialties?.length > 0 && (
            <div className="flex gap-1 flex-wrap pt-1">
              {selectedWorkshop.specialties.map((s) => {
                const spec = SPECIALTIES.find(sp => sp.value === s);
                return (
                  <Badge key={s} variant="secondary" className="text-xs">
                    {spec?.label || s}
                  </Badge>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Create Workshop Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Nova Oficina
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-2">
                <Label htmlFor="workshop-name">Nome *</Label>
                <Input
                  id="workshop-name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Nome da oficina"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="workshop-cnpj">CNPJ</Label>
                <Input
                  id="workshop-cnpj"
                  value={formData.cnpj}
                  onChange={(e) => setFormData({ ...formData, cnpj: e.target.value })}
                  placeholder="00.000.000/0000-00"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="workshop-phone">Telefone</Label>
                <Input
                  id="workshop-phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="(00) 00000-0000"
                />
              </div>

              <div className="col-span-2 space-y-2">
                <Label htmlFor="workshop-email">Email</Label>
                <Input
                  id="workshop-email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="contato@oficina.com"
                />
              </div>

              <div className="col-span-2 space-y-2">
                <Label htmlFor="workshop-address">Endereço</Label>
                <Input
                  id="workshop-address"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Rua, número"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="workshop-city">Cidade</Label>
                <Input
                  id="workshop-city"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  placeholder="Cidade"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="workshop-state">UF</Label>
                <Input
                  id="workshop-state"
                  value={formData.state}
                  onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                  placeholder="SP"
                  maxLength={2}
                />
              </div>

              <div className="col-span-2 space-y-2">
                <Label>Especialidades</Label>
                <div className="flex flex-wrap gap-2">
                  {SPECIALTIES.map((spec) => (
                    <Badge
                      key={spec.value}
                      variant={formData.specialties?.includes(spec.value) ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() => {
                        const current = formData.specialties || [];
                        const updated = current.includes(spec.value)
                          ? current.filter((s) => s !== spec.value)
                          : [...current, spec.value];
                        setFormData({ ...formData, specialties: updated });
                      }}
                    >
                      {spec.label}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="col-span-2 space-y-2">
                <Label htmlFor="workshop-notes">Observações</Label>
                <Textarea
                  id="workshop-notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Notas sobre a oficina..."
                  rows={2}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleCreateWorkshop} disabled={saving || !formData.name}>
                {saving ? "Salvando..." : "Cadastrar Oficina"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
