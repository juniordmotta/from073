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
export function formatCurrency(value: number | string | null | undefined): string {
  // Verifica se o valor é null ou undefined
  if (value === null || value === undefined) return "0.00";
  
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "0.00";
  
  const fixed3 = num.toFixed(3);
  // Se o terceiro dígito for 0, retorna apenas 2 casas decimais
  if (fixed3.endsWith("0")) {
    return num.toFixed(2);
  }
  return fixed3;
}

/**
 * Formata nome de usuário: Primeiro Nome + Primeira letra do sobrenome.
 * Exemplos: "João Silva" → "João S.", "Maria" → "Maria", "ADRIANO OLIVEIRA SANTOS" → "Adriano S."
 */
export function formatUserName(input: string | undefined): string {
  if (!input) return '';
  
  // Dividir o nome em palavras (por espaço, ponto, underline ou hífen)
  const words = input.split(/[\s._-]+/).filter(word => word.length > 0);
  
  if (words.length === 0) return '';
  
  const firstName = words[0].charAt(0).toUpperCase() + words[0].slice(1).toLowerCase();
  
  if (words.length > 1) {
    const lastNameInitial = words[words.length - 1].charAt(0).toUpperCase();
    return `${firstName} ${lastNameInitial}.`;
  }
  
  return firstName;
}
