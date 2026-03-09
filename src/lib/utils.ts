import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
}

/**
 * Converte string de data do banco (YYYY-MM-DD) para Date local
 * Adiciona T12:00:00 para evitar problemas de timezone
 */
export function parseDateString(dateString: string | null | undefined): Date {
  if (!dateString) return new Date();
  // Se já tem informação de hora, usar diretamente
  if (dateString.includes('T')) {
    return new Date(dateString);
  }
  // Adiciona meio-dia para evitar que a conversão de timezone mude o dia
  return new Date(dateString + 'T12:00:00');
}

/**
 * Formata Date para string YYYY-MM-DD para salvar no banco
 * Usa os valores locais (getFullYear, getMonth, getDate)
 */
export function formatDateForDB(date: Date | null | undefined): string {
  if (!date) return new Date().toISOString().split('T')[0];
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Formata string de data do banco para exibição no formato brasileiro (dd/MM/yyyy)
 */
export function formatDateBR(dateString: string | null | undefined): string {
  if (!dateString) return '';
  const date = parseDateString(dateString);
  return date.toLocaleDateString('pt-BR');
}
