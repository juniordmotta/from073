export const CURRENCIES = ['BRL', 'USD', 'EUR'] as const;
export type Currency = typeof CURRENCIES[number];
export type Rates = { date: string; source: string; brl: Record<Currency, number> };
export function currency(value?: string | null): Currency {
  if (!value) return 'BRL';
  if (value === 'BRL' || value === 'USD' || value === 'EUR') return value;
  throw new Error('Moeda inválida.');
}
export function displayCurrency(rows: { moeda?: string | null }[]): Currency {
  const codes = new Set(rows.map(row => currency(row.moeda)));
  return codes.size === 1 ? currency(rows[0]?.moeda) : 'BRL';
}
export function convert(value: number, from: Currency, to: Currency, rates: Rates | null): number {
  if (from === to || value === 0) return value;
  if (!rates || !(rates.brl[from] > 0) || !(rates.brl[to] > 0)) return NaN;
  return value * rates.brl[from] / rates.brl[to];
}
export function roundMoney(value: number) { return Math.round((value + Number.EPSILON) * 100) / 100; }
export function formatMoney(value: number, code: Currency = 'BRL'): string {
  if (!Number.isFinite(value)) return 'Cotação indisponível';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: code }).format(value);
}
export const MONEY_FIELDS = ['casa_01_valor', 'casa_02_valor', 'casa_03_valor', 'casa_01_valor_resultado', 'casa_02_valor_resultado', 'casa_03_valor_resultado', 'lucro_projetado', 'lucro_real', 'retorno_previsto'] as const;
export function monetaryRow<T extends { moeda?: string | null }>(row: T, to: Currency, rates: Rates | null): T {
  const result: Record<string, unknown> = { ...row };
  const source = row as T & Record<string, unknown>;
  for (const key of MONEY_FIELDS) {
    if (source[key] !== null && source[key] !== undefined) result[key] = convert(Number(source[key]), currency(row.moeda), to, rates);
  }
  return result as T;
}
let cached: { at: number; rates: Rates } | null = null;
export async function latestRates(): Promise<Rates> {
  if (cached && Date.now() - cached.at < 15 * 60 * 1000) return cached.rates;
  const response = await fetch('https://api.frankfurter.dev/v1/latest?base=BRL&symbols=USD,EUR', { signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error('Cotação indisponível.');
  const data = await response.json();
  if (data.base !== 'BRL' || !/^\d{4}-\d{2}-\d{2}$/.test(data.date) || !(data.rates?.USD > 0) || !(data.rates?.EUR > 0)) throw new Error('Cotação inválida.');
  const age = Date.now() - Date.parse(`${data.date}T00:00:00Z`);
  if (age < -86400000 || age > 7 * 86400000) throw new Error('Cotação desatualizada.');
  const rates: Rates = { date: data.date, source: 'Frankfurter · Banco Central Europeu', brl: { BRL: 1, USD: 1 / data.rates.USD, EUR: 1 / data.rates.EUR } };
  cached = { at: Date.now(), rates };
  return rates;
}