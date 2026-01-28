import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formata valores monetários em reais no padrão brasileiro
 * Exemplos: 1234.56 → "R$ 1.234,56", 100.50 → "R$ 100,50"
 */
export function formatCurrency(value: number | string | null | undefined): string {
  if (value === null || value === undefined) return "R$ 0,00";
  
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "R$ 0,00";
  
  return num.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
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
