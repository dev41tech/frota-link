import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useDriverAuth } from "@/hooks/useDriverAuth";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { FileImage, ArrowLeft, Fuel, FileText } from "lucide-react"; // Ícones úteis
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatDateBR } from "@/lib/utils";

interface Expense {
  id: string;
  type: "expense" | "fuel";
  date: string;
  amount: number; // Padronizado (contém o valor final, seja expense ou fuel)
  category?: string;
  description?: string;
  liters?: number;
  vehicle_id?: string;
  receipt_url?: string;
}

export default function DriverHistory() {
  const navigate = useNavigate();
  const { driver, loading: authLoading } = useDriverAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReceipt, setSelectedReceipt] = useState<string | null>(null);
  const [showReceiptDialog, setShowReceiptDialog] = useState(false);

  useEffect(() => {
    if (driver) {
      fetchHistory();
    }
  }, [driver]);

  const fetchHistory = async () => {
    if (!driver) return;

    // Prevenção: Se não tiver veículos, não busca nada para evitar erro no Supabase
    if (!driver.assignedVehicles || driver.assignedVehicles.length === 0) {
      setExpenses([]);
      setLoading(false);
      return;
    }

    try {
      const vehicleIds = driver.assignedVehicles.map((v) => v.id);

      const [expensesData, fuelData] = await Promise.all([
        supabase
          .from("expenses")
          .select("*")
          .in("vehicle_id", vehicleIds)
          .order("date", { ascending: false })
          .limit(50),
        supabase
          .from("fuel_expenses")
          .select("*")
          .in("vehicle_id", vehicleIds)
          .order("date", { ascending: false })
          .limit(50),
      ]);

      const combined: Expense[] = [
        ...(expensesData.data || []).map((e) => ({
          id: e.id,
          type: "expense" as const,
          date: e.date,
          amount: Number(e.amount), // Garantindo que é número
          category: e.category,
          description: e.description,
          vehicle_id: e.vehicle_id,
          receipt_url: e.receipt_url,
        })),
        ...(fuelData.data || []).map((f) => ({
          id: f.id,
          type: "fuel" as const,
          date: f.date,
          amount: Number(f.total_amount), // Mapeando total_amount para amount
          liters: f.liters,
          vehicle_id: f.vehicle_id,
          receipt_url: f.receipt_url,
        })),
      ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      setExpenses(combined);
    } catch (error) {
      console.error("Erro ao carregar histórico:", error);
    } finally {
      setLoading(false);
    }
  };

  const getVehiclePlate = (vehicleId?: string) => {
    if (!vehicleId) return "N/A";
    const vehicle = driver?.assignedVehicles.find((v) => v.id === vehicleId);
    return vehicle?.plate || "Placa desconhecida";
  };

  if (authLoading) {
    return (
      <div className="p-4 space-y-3">
        <Skeleton className="h-8 w-48" />
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  if (!driver) return null;

  return (
    <div className="p-4 space-y-4 pb-20">
      {" "}
      {/* pb-20 adicionado para scroll em mobile */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-2xl font-bold">Histórico</h1>
      </div>
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : expenses.length === 0 ? (
        <Card className="p-8 text-center bg-muted/50 border-dashed">
          <p className="text-muted-foreground">Nenhum histórico encontrado para seus veículos.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {expenses.map((item) => (
            <Card key={`${item.type}-${item.id}`} className="p-4">
              <div className="space-y-2">
                <div className="flex items-start justify-between">
                  <div className="flex gap-3">
                    {/* Ícone dinâmico */}
                    <div
                      className={`p-2 rounded-full ${item.type === "fuel" ? "bg-orange-100 text-orange-600" : "bg-blue-100 text-blue-600"}`}
                    >
                      {item.type === "fuel" ? <Fuel size={20} /> : <FileText size={20} />}
                    </div>

                    <div>
                      <p className="font-semibold">
                        {item.type === "fuel" ? `Abastecimento` : item.category || "Despesa Geral"}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {item.type === "fuel" && `${item.liters}L • `}
                        {getVehiclePlate(item.vehicle_id)}
                      </p>
                      <p className="text-xs text-muted-foreground">{formatDateBR(item.date)}</p>
                    </div>
                  </div>

                  <p className="font-bold text-lg">R$ {item.amount.toFixed(2)}</p>
                </div>

                {/* Exibir descrição se houver (para expenses) */}
                {item.description && (
                  <p className="text-sm text-gray-600 italic border-l-2 pl-2 border-gray-200">"{item.description}"</p>
                )}

                {item.receipt_url && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full mt-2"
                    onClick={() => {
                      setSelectedReceipt(item.receipt_url || null);
                      setShowReceiptDialog(true);
                    }}
                  >
                    <FileImage className="h-4 w-4 mr-2" />
                    Ver Comprovante
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
      <Dialog open={showReceiptDialog} onOpenChange={setShowReceiptDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Comprovante</DialogTitle>
          </DialogHeader>
          {selectedReceipt && (
            <div className="relative w-full h-[60vh] flex items-center justify-center bg-black/5 rounded-lg overflow-hidden">
              <img src={selectedReceipt} alt="Comprovante" className="max-w-full max-h-full object-contain" />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
