import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { CURRENCIES, type Currency } from '@/lib/currency';
import { formatCurrency, parseLocalizedNumber } from '@/lib/utils';
import { Money } from '@/components/Money';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Wallet } from 'lucide-react';
type BalanceRow = { id: string; house_name?: string; saldo?: number; saldo_usd?: number; saldo_eur?: number; saldo_bancario?: number; saldo_bancario_usd?: number; saldo_bancario_eur?: number };
export function CurrencyBalances({ partnershipId }: { partnershipId: string }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState<Currency>('BRL');
  const [bank, setBank] = useState<BalanceRow | null>(null);
  const [houses, setHouses] = useState<BalanceRow[]>([]);
  const [owner, setOwner] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const bankField = code === 'BRL' ? 'saldo_bancario' : code === 'USD' ? 'saldo_bancario_usd' : 'saldo_bancario_eur';
  const houseField = code === 'BRL' ? 'saldo' : code === 'USD' ? 'saldo_usd' : 'saldo_eur';
  useEffect(() => {
    if (!open) return;
    let active = true;
    setError('');
    Promise.all([
      supabase.from('partnerships').select('id,user_id,status,saldo_bancario,saldo_bancario_usd,saldo_bancario_eur').eq('id', partnershipId).single(),
      supabase.from('partnership_houses').select('id,house_name,saldo,saldo_usd,saldo_eur').eq('partnership_id', partnershipId).order('house_name'),
    ]).then(([b, h]) => {
      if (!active) return;
      if (b.error || h.error) { setError('Não foi possível carregar os saldos.'); return; }
      setBank(b.data); setHouses(h.data || []); setOwner(b.data?.user_id === user?.id && ['ativo','ativa'].includes(b.data?.status || ''));
    });
    return () => { active = false; };
  }, [open, partnershipId, user?.id]);
  async function save(row: BalanceRow, value: string, isBank: boolean) {
    const amount = parseLocalizedNumber(value);
    if (!owner || !Number.isFinite(amount) || amount < 0 || saving) return;
    const field = isBank ? bankField : houseField;
    if (Number(row[field] || 0) === amount) return;
    setSaving(true);
    const { error } = await supabase.rpc('adjust_currency_balance', { p_partnership: partnershipId, p_house_id: isBank ? undefined : row.id, p_currency: code, p_amount: amount });
    setSaving(false);
    if (error) { toast({ variant: 'destructive', title: 'Saldo não alterado', description: error.message }); return; }
    if (isBank) setBank(current => current ? { ...current, [field]: amount } : current);
    else setHouses(current => current.map(h => h.id === row.id ? { ...h, [field]: amount } : h));
  }
  const balance = (row: BalanceRow, isBank: boolean) => {
    const field = isBank ? bankField : houseField;
    return <div key={`${row.id}-${code}`} className="flex items-center justify-between gap-3 border-b py-3 last:border-0">
      <Label htmlFor={`balance-${row.id}-${code}`} className="min-w-0">{isBank ? 'Conta bancária' : row.house_name}</Label>
      <div className="text-right shrink-0"><Input id={`balance-${row.id}-${code}`} aria-label={`${isBank ? 'Conta bancária' : row.house_name} ${code}`} className="w-32 h-8 text-right" defaultValue={formatCurrency(row[field])} disabled={!owner || saving} inputMode="decimal" onBlur={event => save(row, event.target.value, isBank)} onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); }} /><span className="text-[10px] text-muted-foreground">{code}</span></div>
    </div>;
  };
  return <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button size="sm" variant="outline"><Wallet className="h-4 w-4" />Saldos por moeda</Button></DialogTrigger><DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto"><DialogHeader><DialogTitle>Saldos por moeda</DialogTitle></DialogHeader>
    <Select value={code} onValueChange={value => setCode(value as Currency)}><SelectTrigger aria-label="Moeda do saldo"><SelectValue /></SelectTrigger><SelectContent>{CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select>
    {error ? <p className="text-destructive text-sm">{error}</p> : bank ? <div>{balance(bank, true)}{houses.map(h => balance(h, false))}<div className="flex justify-between pt-4 font-semibold"><span>Total {code}</span><Money code={code} value={Number(bank[bankField] || 0) + houses.reduce((sum, h) => sum + Number(h[houseField] || 0), 0)} /></div></div> : <p className="text-muted-foreground text-sm">Carregando saldos…</p>}
  </DialogContent></Dialog>;
}