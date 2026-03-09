import { useState, useEffect, useRef, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { parseNFeXml, detectXmlDocumentType } from "@/lib/nfeXmlParser";
import { useAuth } from "@/hooks/useAuth";
import { useMultiTenant } from "@/hooks/useMultiTenant";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Loader2,
  Plus,
  Search,
  Package,
  Disc,
  Upload,
  Wrench,
  DollarSign,
  Truck,
  Car,
  History,
  AlertTriangle,
  ArrowDownCircle,
  ArrowUpCircle,
  Pencil,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

// --- INTERFACES ---
export interface InventoryItem {
  id: string;
  company_id: string;
  name: string;
  sku?: string | null;
  description?: string | null;
  category: string;
  quantity: number;
  min_stock: number;
  unit_price: number;
  location?: string | null;
  created_at: string;
  updated_at: string;
}

export interface TireAsset {
  id: string;
  company_id: string;
  brand: string;
  model: string;
  size: string;
  dot?: string | null;
  serial_number?: string | null;
  status: "in_stock" | "installed" | "maintenance" | "discarded";
  condition?: "new" | "used" | "retreaded";
  location?: string | null;
  current_km?: number | null;
  notes?: string | null;
  created_at: string;
}

// Status labels for display
const TIRE_STATUS_LABELS: Record<string, string> = {
  in_stock: "Em estoque",
  installed: "Instalado",
  maintenance: "Manutenção",
  discarded: "Descartado",
};

const TIRE_CONDITION_LABELS: Record<string, string> = {
  new: "Novo",
  used: "Usado",
  retreaded: "Recapado",
};

export interface Vehicle {
  id: string;
  plate: string;
  model: string;
  brand?: string;
  status?: string;
}

export interface StockMovement {
  id: string;
  created_at: string;
  item_name: string;
  type: "IN" | "OUT";
  quantity: number;
  vehicle_plate?: string | null;
  notes?: string | null;
}

export default function Stock() {
  const { user } = useAuth();
  const { currentCompany } = useMultiTenant();
  const { toast } = useToast();

  // --- ESTADOS ---
  const [loading, setLoading] = useState(true);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [tires, setTires] = useState<TireAsset[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);

  // Filtros
  const [searchTerm, setSearchTerm] = useState("");
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);

  // Modais
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isTireDialogOpen, setIsTireDialogOpen] = useState(false);
  const tireFileInputRef = useRef<HTMLInputElement>(null);

  // Modal BAIXA
  const [itemToConsume, setItemToConsume] = useState<InventoryItem | null>(null);
  const [consumptionData, setConsumptionData] = useState({
    quantity: "1",
    vehicle_id: "general",
    vehicle_plate: "",
    notes: "",
  });

  // Edição individual
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [editItemData, setEditItemData] = useState({
    name: "", sku: "", category: "", quantity: "", min_stock: "", unit_price: "", location: "", description: "",
  });
  const [editingTire, setEditingTire] = useState<TireAsset | null>(null);
  const [editTireData, setEditTireData] = useState({
    brand: "", model: "", size: "", dot: "", serial_number: "", status: "in_stock" as string, condition: "new" as string, notes: "",
  });

  // Forms
  const [newItem, setNewItem] = useState({
    name: "",
    sku: "",
    category: "Geral",
    quantity: "1",
    min_stock: "5",
    unit_price: "0",
    description: "",
    location: "Estoque Principal",
  });
  const [newTire, setNewTire] = useState({
    brand: "",
    model: "",
    size: "",
    dot: "",
    serial_number: "",
    status: "in_stock" as "in_stock" | "installed" | "maintenance" | "discarded",
    condition: "new" as "new" | "used" | "retreaded",
    notes: "",
  });

  // --- FETCH ---
  useEffect(() => {
    if (user && currentCompany?.id) {
      fetchStockData();
      fetchVehicles();
      fetchMovements();
    }
  }, [user, currentCompany?.id]);

  const fetchVehicles = async () => {
    try {
      const { data } = await supabase
        .from("vehicles" as any)
        .select("id, plate, model, brand, status")
        .eq("company_id", currentCompany?.id)
        .eq("status", "active");
      if (data) setVehicles(data as unknown as Vehicle[]);
    } catch (error) {
      console.error(error);
    }
  };

  const fetchMovements = async () => {
    try {
      const { data, error } = await supabase
        .from("stock_movements" as any)
        .select("*")
        .eq("company_id", currentCompany?.id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) console.error("Erro ao buscar histórico:", error);
      if (data) setMovements(data as unknown as StockMovement[]);
    } catch (error) {
      console.error(error);
    }
  };

  const fetchStockData = async () => {
    setLoading(true);
    try {
      const { data: inventoryData } = await supabase
        .from("inventory_items" as any)
        .select("*")
        .eq("company_id", currentCompany?.id)
        .order("name", { ascending: true });
      if (inventoryData) setInventory(inventoryData as unknown as InventoryItem[]);

      const { data: tiresData } = await supabase
        .from("tire_assets" as any)
        .select("*")
        .eq("company_id", currentCompany?.id)
        .order("created_at", { ascending: false });
      if (tiresData) setTires(tiresData as unknown as TireAsset[]);
    } catch (error: any) {
      toast({ title: "Erro ao carregar", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // --- ACTIONS: PEÇAS (Manual) - COM DETECÇÃO DE DUPLICATA ---
  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentCompany?.id) return;
    try {
      const qty = parseInt(newItem.quantity);
      const sku = newItem.sku?.trim() || null;
      const name = newItem.name.trim();

      // Buscar item existente por SKU ou nome
      let existingItem: InventoryItem | null = null;
      if (sku) {
        const { data } = await supabase
          .from("inventory_items" as any)
          .select("*")
          .eq("company_id", currentCompany.id)
          .eq("sku", sku)
          .limit(1);
        if (data && (data as any[]).length > 0) existingItem = (data as unknown as InventoryItem[])[0];
      }
      if (!existingItem) {
        const { data } = await supabase
          .from("inventory_items" as any)
          .select("*")
          .eq("company_id", currentCompany.id)
          .ilike("name", name)
          .limit(1);
        if (data && (data as any[]).length > 0) existingItem = (data as unknown as InventoryItem[])[0];
      }

      if (existingItem) {
        // REPOSIÇÃO: somar quantidade ao existente
        const { error: updateError } = await supabase
          .from("inventory_items" as any)
          .update({
            quantity: existingItem.quantity + qty,
            unit_price: parseFloat(newItem.unit_price) || existingItem.unit_price,
          })
          .eq("id", existingItem.id);
        if (updateError) throw updateError;

        // Registrar movimentação de entrada
        await supabase.from("stock_movements" as any).insert([{
          company_id: currentCompany.id,
          item_id: existingItem.id,
          item_name: existingItem.name,
          type: "IN",
          quantity: qty,
          notes: "Reposição de estoque",
        }]);

        toast({
          title: "Estoque reposto!",
          description: `+${qty} unidades adicionadas a "${existingItem.name}" (total: ${existingItem.quantity + qty})`,
        });
      } else {
        // NOVO ITEM
        const payload = {
          company_id: currentCompany.id,
          name,
          sku,
          category: newItem.category,
          quantity: qty,
          min_stock: parseInt(newItem.min_stock),
          unit_price: parseFloat(newItem.unit_price),
          description: newItem.description || null,
          location: newItem.location,
        };

        const { data, error } = await supabase
          .from("inventory_items" as any)
          .insert([payload])
          .select();
        if (error) throw error;

        const insertedItems = data as unknown as InventoryItem[];
        if (insertedItems && insertedItems.length > 0) {
          const item = insertedItems[0];
          const { error: moveError } = await supabase.from("stock_movements" as any).insert([{
            company_id: currentCompany.id,
            item_id: item.id,
            item_name: item.name,
            type: "IN",
            quantity: qty,
            notes: "Entrada Manual",
          }]);
          if (moveError) console.error("Erro ao salvar histórico:", moveError);
        }

        toast({ title: "Sucesso", description: "Peça cadastrada." });
      }

      setIsDialogOpen(false);
      setNewItem({
        name: "", sku: "", category: "Geral", quantity: "1", min_stock: "5", unit_price: "0", description: "", location: "Estoque Principal",
      });
      fetchStockData();
      fetchMovements();
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    }
  };

  // --- ACTIONS: PEÇAS (XML) - COM DETECÇÃO DE DUPLICATA ---
  const handleXMLUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !currentCompany?.id) return;
    setIsImporting(true);
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const xmlText = e.target?.result as string;
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, "text/xml");
        const products = xmlDoc.getElementsByTagName("det");

        let updatedCount = 0;
        let insertedCount = 0;

        for (let i = 0; i < products.length; i++) {
          const prod = products[i].getElementsByTagName("prod")[0];
          const sku = prod.getElementsByTagName("cProd")[0]?.textContent || "";
          const name = prod.getElementsByTagName("xProd")[0]?.textContent || "Item";
          const qty = parseFloat(prod.getElementsByTagName("qCom")[0]?.textContent || "0");
          const unitPrice = parseFloat(prod.getElementsByTagName("vUnCom")[0]?.textContent || "0");

          // Buscar existente por SKU
          let existingItem: InventoryItem | null = null;
          if (sku) {
            const { data } = await supabase
              .from("inventory_items" as any)
              .select("*")
              .eq("company_id", currentCompany.id)
              .eq("sku", sku)
              .limit(1);
            if (data && (data as any[]).length > 0) existingItem = (data as unknown as InventoryItem[])[0];
          }
          if (!existingItem) {
            const { data } = await supabase
              .from("inventory_items" as any)
              .select("*")
              .eq("company_id", currentCompany.id)
              .ilike("name", name)
              .limit(1);
            if (data && (data as any[]).length > 0) existingItem = (data as unknown as InventoryItem[])[0];
          }

          if (existingItem) {
            // Atualizar quantidade e preço
            await supabase
              .from("inventory_items" as any)
              .update({ quantity: existingItem.quantity + qty, unit_price: unitPrice || existingItem.unit_price })
              .eq("id", existingItem.id);

            await supabase.from("stock_movements" as any).insert([{
              company_id: currentCompany.id,
              item_id: existingItem.id,
              item_name: existingItem.name,
              type: "IN",
              quantity: qty,
              notes: "Reposição via XML (NF-e)",
            }]);
            updatedCount++;
          } else {
            const { data, error } = await supabase
              .from("inventory_items" as any)
              .insert([{
                company_id: currentCompany.id,
                name,
                sku: sku || null,
                description: `NCM: ${prod.getElementsByTagName("NCM")[0]?.textContent || ""}`,
                category: "Peças/Insumos (Importado)",
                quantity: qty,
                min_stock: 5,
                unit_price: unitPrice,
                location: "Estoque Principal",
              }])
              .select();
            if (error) throw error;

            const inserted = data as unknown as InventoryItem[];
            if (inserted?.[0]) {
              await supabase.from("stock_movements" as any).insert([{
                company_id: currentCompany.id,
                item_id: inserted[0].id,
                item_name: inserted[0].name,
                type: "IN",
                quantity: qty,
                notes: "Importação XML (NF-e)",
              }]);
            }
            insertedCount++;
          }
        }

        const msgs: string[] = [];
        if (insertedCount > 0) msgs.push(`${insertedCount} novo(s)`);
        if (updatedCount > 0) msgs.push(`${updatedCount} reposto(s)`);

        toast({ title: "Importação Concluída", description: msgs.join(", ") || "Nenhum item processado.", className: "bg-green-600 text-white" });
        setIsDialogOpen(false);
        fetchStockData();
        fetchMovements();
      } catch (error) {
        toast({ title: "Erro", description: "XML inválido.", variant: "destructive" });
      } finally {
        setIsImporting(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };
    reader.readAsText(file);
  };

  // --- ACTIONS: PNEUS (Manual) - COM DETECÇÃO DE DUPLICATA ---
  const handleTireSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentCompany?.id) return;
    try {
      const serial = newTire.serial_number?.trim();

      // Buscar pneu existente por serial_number
      if (serial) {
        const { data } = await supabase
          .from("tire_assets" as any)
          .select("*")
          .eq("company_id", currentCompany.id)
          .eq("serial_number", serial)
          .limit(1);

        if (data && (data as any[]).length > 0) {
          const existing = (data as unknown as TireAsset[])[0];
          if (existing.status === "discarded" || existing.status === "maintenance") {
            // Reativar pneu
            const { error } = await supabase
              .from("tire_assets" as any)
              .update({
                status: "in_stock",
                condition: newTire.condition || "used",
                notes: newTire.dot ? `DOT: ${newTire.dot}` : existing.notes,
              })
              .eq("id", existing.id);
            if (error) throw error;

            toast({
              title: "Pneu reativado!",
              description: `Pneu série "${serial}" foi reativado para estoque.`,
            });
            setIsTireDialogOpen(false);
            setNewTire({ brand: "", model: "", size: "", dot: "", serial_number: "", status: "in_stock", condition: "new", notes: "" });
            fetchStockData();
            return;
          } else {
            toast({
              title: "Pneu já existe",
              description: `Já existe um pneu com série "${serial}" (Status: ${TIRE_STATUS_LABELS[existing.status]}).`,
              variant: "destructive",
            });
            return;
          }
        }
      }

      // Inserir novo pneu
      const payload = {
        company_id: currentCompany.id,
        brand: newTire.brand,
        model: newTire.model,
        size: newTire.size,
        serial_number: serial || `MAN-${Date.now()}`,
        status: newTire.status,
        condition: newTire.condition || "new",
        installation_km: 0,
        total_km: 0,
        notes: newTire.dot ? `DOT: ${newTire.dot}` : newTire.notes || null,
      };
      const { error } = await supabase.from("tire_assets" as any).insert([payload]);
      if (error) throw error;
      toast({ title: "Sucesso", description: "Pneu cadastrado." });
      setIsTireDialogOpen(false);
      setNewTire({ brand: "", model: "", size: "", dot: "", serial_number: "", status: "in_stock", condition: "new", notes: "" });
      fetchStockData();
    } catch (error: any) {
      toast({ title: "Erro", variant: "destructive" });
    }
  };

  // Helper: Extrai medida do pneu do nome do produto
  const extractSizeFromName = (name: string): string => {
    const sizePattern = /(\d{2,4}[\/\.]?\d{0,3}\s?R?\d{2}\.?\d?)/i;
    const match = name.match(sizePattern);
    return match ? match[1].trim() : "";
  };

  const extractBrandFromName = (name: string): string => {
    const knownBrands = ["BRIDGESTONE", "FIRESTONE", "GOODYEAR", "MICHELIN", "PIRELLI", "CONTINENTAL", "DUNLOP", "YOKOHAMA", "HANKOOK", "KUMHO", "TOYO", "FALKEN", "GENERAL", "BANDAG"];
    const upperName = name.toUpperCase();
    for (const brand of knownBrands) {
      if (upperName.includes(brand)) return brand;
    }
    return "";
  };

  // --- ACTIONS: PNEUS (XML) - COM DETECÇÃO DE DUPLICATA ---
  const handleTireXMLUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !currentCompany?.id) return;
    setIsImporting(true);
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const xmlText = e.target?.result as string;
        const docType = detectXmlDocumentType(xmlText);
        if (docType !== 'nfe') {
          toast({ title: "Arquivo inválido", description: "O arquivo não é uma NF-e válida.", variant: "destructive" });
          setIsImporting(false);
          if (tireFileInputRef.current) tireFileInputRef.current.value = "";
          return;
        }

        const parsedNFe = parseNFeXml(xmlText);
        if (!parsedNFe) {
          toast({ title: "Erro no XML", description: "Não foi possível ler a NF-e.", variant: "destructive" });
          setIsImporting(false);
          if (tireFileInputRef.current) tireFileInputRef.current.value = "";
          return;
        }

        const { nfeNumber, emissionDate, items } = parsedNFe;
        const nfeDate = emissionDate?.split("T")[0] || new Date().toISOString().split("T")[0];

        const tiresToInsert = [];
        const timestamp = Date.now();
        let skippedCount = 0;

        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          const qty = Math.floor(item.quantity);
          const extractedSize = extractSizeFromName(item.description);
          const extractedBrand = extractBrandFromName(item.description);

          for (let j = 0; j < qty; j++) {
            const serialNumber = `IMP-${nfeNumber || timestamp}-${i + 1}-${j + 1}`;
            const dotMatch = item.description.match(/DOT[:\s]*(\d{4})/i);
            const serieMatch = item.description.match(/SERIE[:\s]*([A-Z0-9]+)/i) ||
                               item.description.match(/SN[:\s]*([A-Z0-9]+)/i);
            const extractedDot = dotMatch ? dotMatch[1] : null;
            const extractedSerial = serieMatch ? serieMatch[1] : null;
            const finalSerialNumber = extractedSerial || serialNumber;

            // Verificar duplicata por serial_number
            const { data: existingData } = await supabase
              .from("tire_assets" as any)
              .select("id")
              .eq("company_id", currentCompany.id)
              .eq("serial_number", finalSerialNumber)
              .limit(1);

            if (existingData && (existingData as any[]).length > 0) {
              skippedCount++;
              continue;
            }

            tiresToInsert.push({
              company_id: currentCompany.id,
              brand: extractedBrand || "Importado XML",
              model: item.description,
              size: extractedSize || "Verificar",
              status: "in_stock",
              condition: "new",
              serial_number: finalSerialNumber,
              cost: item.unitValue,
              purchase_date: nfeDate,
              installation_km: 0,
              total_km: 0,
              notes: `Importado da NF-e ${nfeNumber || "N/A"}${extractedDot ? ` | DOT: ${extractedDot}` : ""}`,
            });
          }
        }

        if (tiresToInsert.length > 0) {
          const { data: insertedData, error } = await supabase
            .from("tire_assets" as any)
            .insert(tiresToInsert)
            .select();

          if (error) throw error;

          const inserted = insertedData as unknown as TireAsset[];
          if (inserted && inserted.length > 0) {
            const movs = inserted.map((tire, idx) => ({
              company_id: currentCompany.id,
              item_id: tire.id,
              item_name: `Pneu: ${tiresToInsert[idx]?.model || tire.model}`,
              type: "IN",
              quantity: 1,
              notes: `Importação XML (NF-e ${nfeNumber || "N/A"})`,
            }));
            await supabase.from("stock_movements" as any).insert(movs);
          }
        }

        const msgs: string[] = [];
        if (tiresToInsert.length > 0) msgs.push(`${tiresToInsert.length} importado(s)`);
        if (skippedCount > 0) msgs.push(`${skippedCount} duplicata(s) ignorada(s)`);

        toast({
          title: tiresToInsert.length > 0 ? "Importação Concluída" : "Nenhum pneu novo",
          description: msgs.join(", ") || "Nenhum item processado.",
          className: tiresToInsert.length > 0 ? "bg-green-600 text-white" : undefined,
        });
        setIsTireDialogOpen(false);
        fetchStockData();
        fetchMovements();
      } catch (err: any) {
        console.error("Erro ao importar XML de pneus:", err);
        if (err?.code === "23514" && err?.message?.includes("tire_assets_status_check")) {
          toast({ title: "Erro de Status", description: "Status inválido para o cadastro de pneus.", variant: "destructive" });
        } else {
          toast({ title: "Erro na Importação", description: err?.message || "Verifique se o arquivo é uma NF-e válida.", variant: "destructive" });
        }
      } finally {
        setIsImporting(false);
        if (tireFileInputRef.current) tireFileInputRef.current.value = "";
      }
    };
    reader.readAsText(file);
  };

  // --- BAIXA DE ESTOQUE ---
  const handleConsumeItem = async () => {
    if (!itemToConsume || !currentCompany?.id) return;
    const qtd = parseInt(consumptionData.quantity);
    const selectedVehicle = vehicles.find((v) => v.id === consumptionData.vehicle_id);
    const plateToSave = selectedVehicle
      ? selectedVehicle.plate
      : consumptionData.vehicle_id === "general"
        ? "GERAL"
        : "N/A";

    try {
      const { error: updateError } = await supabase
        .from("inventory_items" as any)
        .update({ quantity: itemToConsume.quantity - qtd })
        .eq("id", itemToConsume.id);
      if (updateError) throw updateError;

      const { error: movementError } = await supabase.from("stock_movements" as any).insert([
        {
          company_id: currentCompany.id,
          item_id: itemToConsume.id,
          item_name: itemToConsume.name,
          type: "OUT",
          quantity: qtd,
          vehicle_id: selectedVehicle ? selectedVehicle.id : null,
          vehicle_plate: plateToSave,
          notes: consumptionData.notes || "Baixa manual",
        },
      ]);

      if (movementError) {
        console.error("Erro movimento:", movementError);
        toast({ title: "Atenção", description: "Estoque baixado, mas erro ao salvar histórico.", variant: "destructive" });
      }

      toast({
        title: "Baixa realizada!",
        description: selectedVehicle ? `Aplicado em ${selectedVehicle.plate}` : "Baixa geral.",
      });
      setItemToConsume(null);
      setConsumptionData({ quantity: "1", vehicle_id: "general", vehicle_plate: "", notes: "" });
      fetchStockData();
      fetchMovements();
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    }
  };

  // --- EDIÇÃO INDIVIDUAL DE PEÇA ---
  const openEditItem = (item: InventoryItem) => {
    setEditingItem(item);
    setEditItemData({
      name: item.name,
      sku: item.sku || "",
      category: item.category,
      quantity: String(item.quantity),
      min_stock: String(item.min_stock),
      unit_price: String(item.unit_price),
      location: item.location || "",
      description: item.description || "",
    });
  };

  const handleUpdateItem = async () => {
    if (!editingItem || !currentCompany?.id) return;
    try {
      const newQty = parseInt(editItemData.quantity);
      const qtyDiff = newQty - editingItem.quantity;

      const { error } = await supabase
        .from("inventory_items" as any)
        .update({
          name: editItemData.name,
          sku: editItemData.sku || null,
          category: editItemData.category,
          quantity: newQty,
          min_stock: parseInt(editItemData.min_stock),
          unit_price: parseFloat(editItemData.unit_price),
          location: editItemData.location || null,
          description: editItemData.description || null,
        })
        .eq("id", editingItem.id);
      if (error) throw error;

      // Registrar movimentação de ajuste se quantidade mudou
      if (qtyDiff !== 0) {
        await supabase.from("stock_movements" as any).insert([{
          company_id: currentCompany.id,
          item_id: editingItem.id,
          item_name: editItemData.name,
          type: qtyDiff > 0 ? "IN" : "OUT",
          quantity: Math.abs(qtyDiff),
          notes: "Ajuste manual (edição)",
        }]);
      }

      toast({ title: "Peça atualizada!" });
      setEditingItem(null);
      fetchStockData();
      fetchMovements();
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    }
  };

  // --- EDIÇÃO INDIVIDUAL DE PNEU ---
  const openEditTire = (tire: TireAsset) => {
    setEditingTire(tire);
    const dotMatch = tire.notes?.match(/DOT:\s*(\w+)/);
    setEditTireData({
      brand: tire.brand,
      model: tire.model,
      size: tire.size,
      dot: dotMatch ? dotMatch[1] : "",
      serial_number: tire.serial_number || "",
      status: tire.status,
      condition: tire.condition || "new",
      notes: tire.notes || "",
    });
  };

  const handleUpdateTire = async () => {
    if (!editingTire) return;
    try {
      const notesWithDot = editTireData.dot
        ? (editTireData.notes.includes("DOT:") ? editTireData.notes.replace(/DOT:\s*\w+/, `DOT: ${editTireData.dot}`) : `DOT: ${editTireData.dot}${editTireData.notes ? ` | ${editTireData.notes}` : ""}`)
        : editTireData.notes;

      const { error } = await supabase
        .from("tire_assets" as any)
        .update({
          brand: editTireData.brand,
          model: editTireData.model,
          size: editTireData.size,
          serial_number: editTireData.serial_number || editingTire.serial_number,
          status: editTireData.status,
          condition: editTireData.condition,
          notes: notesWithDot || null,
        })
        .eq("id", editingTire.id);
      if (error) throw error;

      toast({ title: "Pneu atualizado!" });
      setEditingTire(null);
      fetchStockData();
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    }
  };

  // --- HELPERS ---
  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);
  const totalStockValue = useMemo(
    () => inventory.reduce((acc, item) => acc + item.quantity * item.unit_price, 0),
    [inventory],
  );

  const filteredInventory = inventory.filter((item) => {
    const matchesSearch =
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.sku && item.sku.toLowerCase().includes(searchTerm.toLowerCase()));
    if (showLowStockOnly) return matchesSearch && item.quantity <= item.min_stock;
    return matchesSearch;
  });

  const filteredTires = tires.filter(
    (tire) =>
      tire.brand.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tire.size.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  if (loading)
    return (
      <div className="p-8 flex justify-center">
        <Loader2 className="animate-spin" />
      </div>
    );

  return (
    <div className="p-6 space-y-6">
      {/* HEADER & KPI */}
      <div className="flex flex-col md:flex-row justify-between gap-4 items-center">
        <div>
          <h1 className="text-3xl font-bold">Gestão de Estoque</h1>
          <p className="text-muted-foreground">Controle de peças, pneus e custos.</p>
        </div>
        <Card className="min-w-[200px] border-l-4 border-l-green-500 shadow-sm">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 bg-green-100 rounded-full">
              <DollarSign className="text-green-700" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Valor em Estoque</p>
              <h3 className="text-2xl font-bold text-green-700">{formatCurrency(totalStockValue)}</h3>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* SEARCH & FILTROS GLOBAIS */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white p-3 rounded-lg border shadow-sm">
        <div className="relative w-full md:w-1/3">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Buscar..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="low-stock-mode" className="text-sm cursor-pointer flex items-center gap-2">
            {showLowStockOnly ? (
              <AlertTriangle className="w-4 h-4 text-orange-500" />
            ) : (
              <Package className="w-4 h-4 text-muted-foreground" />
            )}
            {showLowStockOnly ? "Mostrando apenas Baixo Estoque" : "Mostrar Baixo Estoque"}
          </Label>
          <Switch id="low-stock-mode" checked={showLowStockOnly} onCheckedChange={setShowLowStockOnly} />
        </div>
      </div>

      {/* ABAS PRINCIPAIS */}
      <Tabs defaultValue="parts" className="w-full">
        <TabsList>
          <TabsTrigger value="parts">
            <Package className="mr-2 h-4 w-4" /> Peças
          </TabsTrigger>
          <TabsTrigger value="tires">
            <Disc className="mr-2 h-4 w-4" /> Pneus
          </TabsTrigger>
          <TabsTrigger value="history">
            <History className="mr-2 h-4 w-4" /> Histórico
          </TabsTrigger>
        </TabsList>

        {/* --- ABA PEÇAS --- */}
        <TabsContent value="parts">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle>Inventário de Peças</CardTitle>
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-primary">
                    <Plus className="mr-2 h-4 w-4" /> Nova Peça / Importar
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-xl">
                  <DialogHeader>
                    <DialogTitle>Nova Peça / Repor Estoque</DialogTitle>
                    <DialogDescription>Se o SKU ou nome já existir, a quantidade será somada automaticamente.</DialogDescription>
                  </DialogHeader>
                  <Tabs defaultValue="manual">
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="manual">Manual</TabsTrigger>
                      <TabsTrigger value="xml">XML (NF-e)</TabsTrigger>
                    </TabsList>
                    <TabsContent value="manual">
                      <form onSubmit={handleManualSubmit} className="space-y-4 pt-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="col-span-2">
                            <Label>Nome</Label>
                            <Input
                              required
                              value={newItem.name}
                              onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                            />
                          </div>
                          <div>
                            <Label>SKU</Label>
                            <Input
                              value={newItem.sku}
                              onChange={(e) => setNewItem({ ...newItem, sku: e.target.value })}
                            />
                          </div>
                          <div>
                            <Label>Categoria</Label>
                            <Input
                              value={newItem.category}
                              onChange={(e) => setNewItem({ ...newItem, category: e.target.value })}
                            />
                          </div>
                          <div>
                            <Label>Qtd</Label>
                            <Input
                              type="number"
                              required
                              value={newItem.quantity}
                              onChange={(e) => setNewItem({ ...newItem, quantity: e.target.value })}
                            />
                          </div>
                          <div>
                            <Label>Preço Un.</Label>
                            <Input
                              type="number"
                              required
                              value={newItem.unit_price}
                              onChange={(e) => setNewItem({ ...newItem, unit_price: e.target.value })}
                            />
                          </div>
                        </div>
                        <Button type="submit" className="w-full mt-4">
                          Salvar
                        </Button>
                      </form>
                    </TabsContent>
                    <TabsContent value="xml" className="pt-4 text-center">
                      <div
                        className="border-2 border-dashed p-8 rounded cursor-pointer"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <Upload className="mx-auto h-10 w-10 text-gray-400" />
                        <p className="mt-2 text-sm text-gray-600">Selecionar XML</p>
                      </div>
                      <input
                        type="file"
                        accept=".xml"
                        className="hidden"
                        ref={fileInputRef}
                        onChange={handleXMLUpload}
                      />
                    </TabsContent>
                  </Tabs>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Qtd</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead className="text-right">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInventory.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8">
                        Nenhum item encontrado.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredInventory.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <div>{item.name}</div>
                          <div className="text-xs text-muted-foreground">{item.description}</div>
                        </TableCell>
                        <TableCell className="text-xs">{item.sku || "-"}</TableCell>
                        <TableCell>
                          <Badge variant={item.quantity <= item.min_stock ? "destructive" : "secondary"}>
                            {item.quantity}
                          </Badge>
                        </TableCell>
                        <TableCell>{formatCurrency(item.quantity * item.unit_price)}</TableCell>
                        <TableCell className="text-right space-x-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-muted-foreground hover:bg-muted"
                            onClick={() => openEditItem(item)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-blue-600 hover:bg-blue-50"
                            onClick={() => {
                              setItemToConsume(item);
                              setConsumptionData({
                                quantity: "1",
                                vehicle_id: "general",
                                vehicle_plate: "",
                                notes: "",
                              });
                            }}
                          >
                            <Wrench className="h-4 w-4 mr-1" /> Baixar
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* --- ABA PNEUS --- */}
        <TabsContent value="tires">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle>Gestão de Pneus</CardTitle>
              <Button variant="outline" size="sm" onClick={() => setIsTireDialogOpen(true)}>
                <Disc className="w-4 h-4 mr-2" /> Novo Pneu / Importar
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Marca/Modelo</TableHead>
                    <TableHead>Medida</TableHead>
                    <TableHead>DOT/Série</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Condição</TableHead>
                    <TableHead className="text-right">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTires.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        Nenhum pneu.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredTires.map((tire) => (
                      <TableRow key={tire.id}>
                        <TableCell>
                          {tire.brand} - {tire.model}
                        </TableCell>
                        <TableCell>{tire.size}</TableCell>
                        <TableCell>
                          <div className="text-xs">{tire.notes?.includes("DOT:") ? tire.notes.match(/DOT:\s*(\w+)/)?.[0] || "-" : "-"}</div>
                          <div className="text-xs text-muted-foreground">Série: {tire.serial_number || "-"}</div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{TIRE_STATUS_LABELS[tire.status] || tire.status}</Badge>
                        </TableCell>
                        <TableCell>{tire.condition ? TIRE_CONDITION_LABELS[tire.condition] || tire.condition : "-"}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-muted-foreground hover:bg-muted"
                            onClick={() => openEditTire(tire)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* --- ABA HISTÓRICO --- */}
        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>Histórico de Movimentações</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead>Qtd</TableHead>
                    <TableHead>Destino / Obs</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {movements.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        Nenhuma movimentação.
                      </TableCell>
                    </TableRow>
                  ) : (
                    movements.map((mov) => (
                      <TableRow key={mov.id}>
                        <TableCell className="text-xs font-medium text-muted-foreground">
                          {format(new Date(mov.created_at), "dd/MM/yyyy HH:mm")}
                        </TableCell>
                        <TableCell>
                          {mov.type === "IN" ? (
                            <Badge className="bg-green-100 text-green-800 border-none">
                              <ArrowDownCircle className="w-3 h-3 mr-1" /> Entrada
                            </Badge>
                          ) : (
                            <Badge className="bg-red-100 text-red-800 border-none">
                              <ArrowUpCircle className="w-3 h-3 mr-1" /> Saída
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>{mov.item_name}</TableCell>
                        <TableCell>{mov.quantity}</TableCell>
                        <TableCell>
                          {mov.vehicle_plate && mov.vehicle_plate !== "N/A" && mov.vehicle_plate !== "GERAL" ? (
                            <div className="flex items-center gap-1 font-semibold text-gray-700">
                              <Truck className="w-3 h-3" /> {mov.vehicle_plate}
                            </div>
                          ) : (
                            <span className="text-sm text-gray-500">Uso Geral</span>
                          )}
                          {mov.notes && <div className="text-xs text-muted-foreground mt-0.5">{mov.notes}</div>}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* MODAL NOVO PNEU */}
      <Dialog open={isTireDialogOpen} onOpenChange={setIsTireDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Cadastrar Pneus</DialogTitle>
            <DialogDescription>Se a série já existir, o pneu poderá ser reativado.</DialogDescription>
          </DialogHeader>
          <Tabs defaultValue="manual">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="manual">Manual</TabsTrigger>
              <TabsTrigger value="xml">Lote (XML)</TabsTrigger>
            </TabsList>
            <TabsContent value="manual">
              <form onSubmit={handleTireSubmit} className="space-y-4 py-2">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-1 space-y-2">
                    <Label>Marca</Label>
                    <Input
                      required
                      value={newTire.brand}
                      onChange={(e) => setNewTire({ ...newTire, brand: e.target.value })}
                    />
                  </div>
                  <div className="col-span-1 space-y-2">
                    <Label>Modelo</Label>
                    <Input
                      required
                      value={newTire.model}
                      onChange={(e) => setNewTire({ ...newTire, model: e.target.value })}
                    />
                  </div>
                  <div className="col-span-1 space-y-2">
                    <Label>Medida</Label>
                    <Input
                      required
                      value={newTire.size}
                      onChange={(e) => setNewTire({ ...newTire, size: e.target.value })}
                    />
                  </div>
                  <div className="col-span-1 space-y-2">
                    <Label>Status</Label>
                    <Select
                      value={newTire.status}
                      onValueChange={(val: any) => setNewTire({ ...newTire, status: val })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="in_stock">Em estoque</SelectItem>
                        <SelectItem value="installed">Instalado</SelectItem>
                        <SelectItem value="maintenance">Manutenção</SelectItem>
                        <SelectItem value="discarded">Descartado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-1 space-y-2">
                    <Label>Condição</Label>
                    <Select
                      value={newTire.condition}
                      onValueChange={(val: any) => setNewTire({ ...newTire, condition: val })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="new">Novo</SelectItem>
                        <SelectItem value="used">Usado</SelectItem>
                        <SelectItem value="retreaded">Recapado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-1 space-y-2">
                    <Label>DOT</Label>
                    <Input value={newTire.dot} onChange={(e) => setNewTire({ ...newTire, dot: e.target.value })} />
                  </div>
                  <div className="col-span-1 space-y-2">
                    <Label>Série</Label>
                    <Input
                      value={newTire.serial_number}
                      onChange={(e) => setNewTire({ ...newTire, serial_number: e.target.value })}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit">Salvar Pneu</Button>
                </DialogFooter>
              </form>
            </TabsContent>
            <TabsContent value="xml" className="pt-4 text-center space-y-4">
              <div
                className="border-2 border-dashed p-8 rounded cursor-pointer"
                onClick={() => tireFileInputRef.current?.click()}
              >
                <Upload className="mx-auto h-10 w-10 text-gray-400" />
                <p className="mt-2 text-sm text-gray-600">Selecionar XML</p>
              </div>
              <input
                type="file"
                accept=".xml"
                className="hidden"
                ref={tireFileInputRef}
                onChange={handleTireXMLUpload}
                disabled={isImporting}
              />
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* MODAL BAIXA */}
      <Dialog open={!!itemToConsume} onOpenChange={(open) => !open && setItemToConsume(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Baixar Estoque</DialogTitle>
            <DialogDescription>
              Uso de <strong>{itemToConsume?.name}</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Destino</Label>
              <Select
                value={consumptionData.vehicle_id}
                onValueChange={(val) => setConsumptionData({ ...consumptionData, vehicle_id: val })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="general">
                    <span className="flex items-center">
                      <Package className="w-4 h-4 mr-2" /> Geral
                    </span>
                  </SelectItem>
                  {vehicles.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      <span className="font-semibold">{v.plate}</span> - {v.model}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Qtd (Max: {itemToConsume?.quantity})</Label>
              <Input
                type="number"
                min="1"
                max={itemToConsume?.quantity}
                value={consumptionData.quantity}
                onChange={(e) => setConsumptionData({ ...consumptionData, quantity: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Motivo</Label>
              <Input
                value={consumptionData.notes}
                onChange={(e) => setConsumptionData({ ...consumptionData, notes: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleConsumeItem} disabled={!consumptionData.vehicle_id}>
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL EDIÇÃO DE PEÇA */}
      <Dialog open={!!editingItem} onOpenChange={(open) => !open && setEditingItem(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar Peça</DialogTitle>
            <DialogDescription>Altere os dados da peça. Mudanças na quantidade geram movimentação de ajuste.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-2">
                <Label>Nome</Label>
                <Input value={editItemData.name} onChange={(e) => setEditItemData({ ...editItemData, name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>SKU</Label>
                <Input value={editItemData.sku} onChange={(e) => setEditItemData({ ...editItemData, sku: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Categoria</Label>
                <Input value={editItemData.category} onChange={(e) => setEditItemData({ ...editItemData, category: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Quantidade</Label>
                <Input type="number" value={editItemData.quantity} onChange={(e) => setEditItemData({ ...editItemData, quantity: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Preço Un.</Label>
                <Input type="number" step="0.01" value={editItemData.unit_price} onChange={(e) => setEditItemData({ ...editItemData, unit_price: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Estoque Mín.</Label>
                <Input type="number" value={editItemData.min_stock} onChange={(e) => setEditItemData({ ...editItemData, min_stock: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Localização</Label>
                <Input value={editItemData.location} onChange={(e) => setEditItemData({ ...editItemData, location: e.target.value })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingItem(null)}>Cancelar</Button>
            <Button onClick={handleUpdateItem}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL EDIÇÃO DE PNEU */}
      <Dialog open={!!editingTire} onOpenChange={(open) => !open && setEditingTire(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar Pneu</DialogTitle>
            <DialogDescription>Altere os dados do pneu.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Marca</Label>
                <Input value={editTireData.brand} onChange={(e) => setEditTireData({ ...editTireData, brand: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Modelo</Label>
                <Input value={editTireData.model} onChange={(e) => setEditTireData({ ...editTireData, model: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Medida</Label>
                <Input value={editTireData.size} onChange={(e) => setEditTireData({ ...editTireData, size: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>DOT</Label>
                <Input value={editTireData.dot} onChange={(e) => setEditTireData({ ...editTireData, dot: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Série</Label>
                <Input value={editTireData.serial_number} onChange={(e) => setEditTireData({ ...editTireData, serial_number: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={editTireData.status} onValueChange={(val) => setEditTireData({ ...editTireData, status: val })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="in_stock">Em estoque</SelectItem>
                    <SelectItem value="installed">Instalado</SelectItem>
                    <SelectItem value="maintenance">Manutenção</SelectItem>
                    <SelectItem value="discarded">Descartado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Condição</Label>
                <Select value={editTireData.condition} onValueChange={(val) => setEditTireData({ ...editTireData, condition: val })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">Novo</SelectItem>
                    <SelectItem value="used">Usado</SelectItem>
                    <SelectItem value="retreaded">Recapado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2 space-y-2">
                <Label>Observações</Label>
                <Input value={editTireData.notes} onChange={(e) => setEditTireData({ ...editTireData, notes: e.target.value })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingTire(null)}>Cancelar</Button>
            <Button onClick={handleUpdateTire}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
