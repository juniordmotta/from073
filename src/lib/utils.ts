import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formata valores monetários em reais com até 3 casas decimais
 * Remove o terceiro dígito se for zero
 * Exemplos: 100.50 → "100.50", 100.123 → "100.123", 100.120 → "100.12"
 */
export function formatCurrency(value: number | string): string {
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "0.00";
  
  const fixed3 = num.toFixed(3);
  // Se o terceiro dígito for 0, retorna apenas 2 casas decimais
  if (fixed3.endsWith("0")) {
    return num.toFixed(2);
  }
  return fixed3;
}
