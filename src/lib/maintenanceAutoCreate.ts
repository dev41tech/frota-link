import { supabase } from "@/integrations/supabase/client";

/**
 * Remove acentos e converte para minúsculas para comparação segura
 */
function normalizeText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export const SERVICE_CATEGORIES = [
  { value: "oil_change", label: "Troca de Óleo" },
  { value: "general_revision", label: "Revisão Geral" },
  { value: "tires", label: "Pneus" },
  { value: "brakes", label: "Freios" },
  { value: "general_mechanics", label: "Mecânica Geral" },
  { value: "electrical", label: "Elétrica" },
  { value: "body_work", label: "Funilaria" },
  { value: "other", label: "Outros" },
] as const;

export interface MaintenanceFromExpenseParams {
  expense_id: string;
  category_name: string;
  vehicle_id: string | null | undefined;
  company_id: string;
  user_id: string;
  amount: number;
  description: string;
  date: string;
  supplier?: string | null;
  service_category?: string;
  maintenance_type?: "preventive" | "corrective";
  provider_name?: string;
  odometer_at_service?: number;
  notes?: string;
}

/**
 * Se a despesa for de categoria "manutenção", cria automaticamente
 * um registro em vehicle_maintenances para manter o histórico.
 * Falha silenciosa: nunca impede o salvamento da despesa.
 */
export async function maybeCreateMaintenanceFromExpense(
  params: MaintenanceFromExpenseParams
): Promise<{ created: boolean; error?: string }> {
  try {
    // Sem veículo, não faz sentido criar manutenção
    if (!params.vehicle_id) {
      return { created: false };
    }

    const normalized = normalizeText(params.category_name);
    if (!normalized.includes("manutencao")) {
      return { created: false };
    }

    const serviceDate = params.date.includes("T")
      ? params.date.split("T")[0]
      : params.date;

    const { error } = await supabase.from("vehicle_maintenances").insert({
      company_id: params.company_id,
      user_id: params.user_id,
      vehicle_id: params.vehicle_id,
      maintenance_type: params.maintenance_type || "corrective",
      service_category: params.service_category || "other",
      description: params.notes || params.description || "Manutenção registrada via despesa",
      total_cost: params.amount,
      service_date: serviceDate,
      status: "completed",
      provider_name: params.provider_name || params.supplier || null,
      expense_id: params.expense_id,
      odometer_at_service: params.odometer_at_service || null,
    });

    if (error) {
      console.error("Erro ao criar manutenção automática:", error);
      return { created: false, error: error.message };
    }

    return { created: true };
  } catch (err: any) {
    console.error("Erro ao criar manutenção automática:", err);
    return { created: false, error: err.message };
  }
}
