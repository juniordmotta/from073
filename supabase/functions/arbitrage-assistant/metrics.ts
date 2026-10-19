import { displayCurrency, monetaryRow, convert, type Rates } from '../_shared/currency.ts';
export const MAX_ROWS = 5000;
export function brazilDay(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}
export function dateRange(start: string | null, end: string | null) {
  const valid = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00-03:00`)) && brazilDay(new Date(`${v}T00:00:00-03:00`)) === v;
  if ((start && !valid(start)) || (end && !valid(end))) throw new Error('Use datas válidas no formato AAAA-MM-DD.');
  if (start && end && start > end) throw new Error('A data inicial deve ser anterior à final.');
  return { from: start ? `${start}T00:00:00-03:00` : null, until: end ? new Date(Date.parse(`${end}T00:00:00-03:00`) + 86400000).toISOString() : null };
}
export type Bet = { moeda?: string; id: string; created_at: string; status: string; lucro_projetado: number | null; lucro_real: number | null; casa_01_nome: string; casa_01_valor: number; casa_01_parceria_id: string | null; casa_02_nome: string; casa_02_valor: number; casa_02_parceria_id: string | null; casa_03_nome: string | null; casa_03_valor: number | null; casa_03_parceria_id: string | null };
export function houses(b: Bet) {
  return [{ nome: b.casa_01_nome, valor: Number(b.casa_01_valor || 0), parceria: b.casa_01_parceria_id }, { nome: b.casa_02_nome, valor: Number(b.casa_02_valor || 0), parceria: b.casa_02_parceria_id }, ...(b.casa_03_nome ? [{ nome: b.casa_03_nome, valor: Number(b.casa_03_valor || 0), parceria: b.casa_03_parceria_id }] : [])];
}
export function summarize(bets: Bet[], names: Map<string, string>, rates: Rates | null = null) {
  const code = displayCurrency(bets);
  if (bets.some(b => b.moeda && b.moeda !== code) && !rates) throw new Error('Cotação indisponível para consolidar moedas.');
  bets = bets.map(b => monetaryRow(b, code, rates));
  const cent = (n: number) => Math.round(n * 100) / 100;
  let invested = 0, realized = 0, projected = 0, open = 0;
  const days = new Set<string>(); const usage = new Map<string, number>(); const houseUsage = new Map<string, { apostas: number; investido: number }>();
  for (const b of bets) {
    const legs = houses(b); invested += legs.reduce((s, h) => s + h.valor, 0);
    if (b.status === 'aguardando') { open++; projected += Number(b.lucro_projetado || 0); } else realized += Number(b.lucro_real || 0);
    days.add(brazilDay(new Date(b.created_at)));
    for (const id of new Set(legs.map(h => h.parceria).filter((id): id is string => Boolean(id)))) usage.set(id, (usage.get(id) || 0) + 1);
    for (const name of new Set(legs.map(h => h.nome))) { const item = houseUsage.get(name) || { apostas: 0, investido: 0 }; item.apostas++; item.investido += legs.filter(h => h.nome === name).reduce((s, h) => s + h.valor, 0); houseUsage.set(name, item); }
  }
  return { moeda: code, cotacao: rates?.date || null, equivalente_brl: code === 'BRL' ? null : { lucro_realizado: rates ? cent(convert(realized, code, 'BRL', rates)) : null, investimento: rates ? cent(convert(invested, code, 'BRL', rates)) : null }, apostas: bets.length, abertas: open, encerradas: bets.length - open, investimento_total_arbitragens: cent(invested), lucro_realizado: cent(realized), lucro_projetado_abertas: cent(projected), lucro_realizado_mais_projetado: cent(realized + projected), roi_realizado_percentual: invested ? cent(realized / invested * 100) : 0, dias_com_apostas: days.size, media_por_dia_ativo: days.size ? cent(realized / days.size) : 0, parcerias_mais_usadas: [...usage].map(([id, apostas]) => ({ parceria: names.get(id) || 'Parceria não disponível', apostas })).sort((a, b) => b.apostas - a.apostas), casas_mais_usadas: [...houseUsage].map(([casa, d]) => ({ casa, apostas: d.apostas, investido_na_casa: cent(d.investido) })).sort((a, b) => b.apostas - a.apostas) };
}
export function canQueryUser(role: string, current: string, target: string | null) { return !target || target === current || role === 'admin' || role === 'admin_master'; }
