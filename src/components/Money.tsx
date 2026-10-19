import { convert, formatMoney, type Currency } from '@/lib/currency';
import { useExchangeRates } from '@/hooks/useExchangeRates';
export function Money({ value, code = 'BRL', approximate = true }: { value: number; code?: Currency; approximate?: boolean }) {
  const { data } = useExchangeRates();
  return <span className="inline-flex flex-wrap items-baseline gap-x-2">
    <span>{formatMoney(value, code)}</span>
    {code !== 'BRL' && approximate && <small className="text-[10px] font-normal text-muted-foreground">{data ? `≈ ${formatMoney(convert(value, code, 'BRL', data))}` : 'Cotação indisponível'}</small>}
  </span>;
}
export function ExchangeRateDate() {
  const { data, isError } = useExchangeRates();
  return data ? <p className="text-[10px] text-muted-foreground">Cotação {data.date.split('-').reverse().join('/')} · {data.source}</p> : isError ? <p className="text-xs text-destructive">Cotação indisponível; totais entre moedas não podem ser calculados.</p> : null;
}