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
 * Formata números no padrão brasileiro (sem símbolo de moeda)
 * Exemplos: 1234.56 → "1.234,56", 3.5 → "3,50"
 */
export function formatNumber(value: number | string | null | undefined, decimals: number = 2): string {
  if (value === null || value === undefined) return "0,00";
  
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "0,00";
  
  return num.toLocaleString('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Parse de números formatados no padrão brasileiro para número
 * Aceita formatos: "1.234,56", "R$ 1.234,56", "1234.56", "1234,56"
 */
export function parseLocalizedNumber(value: string | null | undefined): number {
  if (!value || value === "") return 0;

  let str = String(value).trim();

  // Remove símbolos de moeda e espaços
  str = str.replace(/[R$€£¥\s]/g, "");

  // Auto-detectar formato pela posição da última vírgula e ponto
  const lastComma = str.lastIndexOf(",");
  const lastDot = str.lastIndexOf(".");

  // Se a última vírgula aparece depois do último ponto, é formato brasileiro (1.234,56)
  const isCommaDecimal = lastComma > lastDot;

  if (isCommaDecimal) {
    // Formato brasileiro: remove pontos (separador de milhares) e troca vírgula por ponto
    str = str.replace(/\./g, "");
    str = str.replace(",", ".");
  } else {
    // Formato americano: remove vírgulas (separador de milhares)
    str = str.replace(/,/g, "");
  }

  const parsed = parseFloat(str);
  return isNaN(parsed) ? 0 : parsed;
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
