import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Receipt,
  Percent,
  Target,
  Users,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  User,
} from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  isAdmin?: boolean;
}

interface ProfileOption {
  id: string;
  name: string;
}


interface ReportData {
  lucroBruto: number;
  despesas: number;
  lucroLiquido: number;
  totalInvestido: number;
  roi: number;
  totalApostas: number;
  apostasAbertas: number;
  apostasFechadas: number;
  diasTrabalhados: number;
  mediaPorDia: number;
  parcerias: { id: string; nome: string; usos: number }[];
  casas: { nome: string; usos: number }[];
}

function buildMonthOptions(): { value: string; label: string }[] {
  const opts: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = 0; i < 24; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = format(d, "MMMM 'de' yyyy", { locale: ptBR });
    opts.push({ value, label: label.charAt(0).toUpperCase() + label.slice(1) });
  }
  return opts;
}

export function MonthlyReportDialog({ open, onOpenChange, userId, isAdmin = false }: Props) {
  const monthOptions = useMemo(buildMonthOptions, []);
  const [selectedMonth, setSelectedMonth] = useState(monthOptions[0].value);
  const [selectedUserId, setSelectedUserId] = useState(userId);
  const [profiles, setProfiles] = useState<ProfileOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ReportData | null>(null);

  // Carregar lista de usuários para admins
  useEffect(() => {
    if (!open || !isAdmin) return;
    supabase
      .from('profiles')
      .select('id, name')
      .order('name')
      .then(({ data, error }) => {
        if (!error && data) setProfiles(data as ProfileOption[]);
      });
  }, [open, isAdmin]);

  // Resetar usuário ao abrir
  useEffect(() => {
    if (open) setSelectedUserId(userId);
  }, [open, userId]);

  useEffect(() => {
    if (!open || !selectedUserId) return;


    const load = async () => {
      setLoading(true);
      try {
        const [y, m] = selectedMonth.split('-').map(Number);
        const first = new Date(y, m - 1, 1, 0, 0, 0, 0);
        const last = new Date(y, m, 0, 23, 59, 59, 999);

        const [arbsRes, costsRes, partsRes] = await Promise.all([
          supabase
            .from('arbitrages')
            .select(
              'id, status, lucro_real, lucro_projetado, casa_01_nome, casa_02_nome, casa_03_nome, casa_01_valor, casa_02_valor, casa_03_valor, casa_01_parceria_id, casa_02_parceria_id, casa_03_parceria_id, created_at'
            )
            .eq('user_id', selectedUserId)
            .gte('created_at', first.toISOString())
            .lte('created_at', last.toISOString()),
          supabase
            .from('operational_costs')
            .select('valor')
            .eq('user_id', selectedUserId)
            .gte('data', format(first, 'yyyy-MM-dd'))
            .lte('data', format(last, 'yyyy-MM-dd')),
          supabase.from('partnerships').select('id, nome_completo').eq('user_id', selectedUserId),
        ]);

        const arbs = arbsRes.data || [];
        const costs = costsRes.data || [];
        const partsMap = new Map((partsRes.data || []).map((p: any) => [p.id, p.nome_completo]));

        let lucroBruto = 0;
        let totalInvestido = 0;
        let apostasAbertas = 0;
        let apostasFechadas = 0;
        const dias = new Set<string>();
        const casasMap = new Map<string, number>();
        const parceriasMap = new Map<string, number>();

        for (const a of arbs) {
          const invest =
            Number(a.casa_01_valor || 0) +
            Number(a.casa_02_valor || 0) +
            Number(a.casa_03_valor || 0);
          totalInvestido += invest;

          if (a.status === 'aguardando') {
            apostasAbertas++;
          } else {
            apostasFechadas++;
            lucroBruto += Number(a.lucro_real || 0);
          }

          dias.add(format(new Date(a.created_at), 'yyyy-MM-dd'));

          [a.casa_01_nome, a.casa_02_nome, a.casa_03_nome].forEach((n) => {
            if (n) casasMap.set(n, (casasMap.get(n) || 0) + 1);
          });
          [a.casa_01_parceria_id, a.casa_02_parceria_id, a.casa_03_parceria_id].forEach((pid) => {
            if (pid) parceriasMap.set(pid, (parceriasMap.get(pid) || 0) + 1);
          });
        }

        const despesas = costs.reduce((s: number, c: any) => s + Number(c.valor || 0), 0);
        const lucroLiquido = lucroBruto - despesas;
        const roi = totalInvestido > 0 ? (lucroBruto / totalInvestido) * 100 : 0;
        const diasTrabalhados = dias.size;
        const mediaPorDia = diasTrabalhados > 0 ? lucroBruto / diasTrabalhados : 0;

        const casas = Array.from(casasMap.entries())
          .map(([nome, usos]) => ({ nome, usos }))
          .sort((a, b) => b.usos - a.usos)
          .slice(0, 8);

        const parcerias = Array.from(parceriasMap.entries())
          .map(([id, usos]) => ({ id, nome: partsMap.get(id) || 'Parceria', usos }))
          .sort((a, b) => b.usos - a.usos);

        setData({
          lucroBruto,
          despesas,
          lucroLiquido,
          totalInvestido,
          roi,
          totalApostas: arbs.length,
          apostasAbertas,
          apostasFechadas,
          diasTrabalhados,
          mediaPorDia,
          parcerias,
          casas,
        });
      } catch (e) {
        console.error('Erro ao gerar relatório:', e);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [open, userId, selectedMonth]);

  const monthLabel = monthOptions.find((o) => o.value === selectedMonth)?.label || '';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Relatório Mensal</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <span className="text-sm text-muted-foreground">Selecione o mês:</span>
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-full sm:w-[240px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-[300px]">
              {monthOptions.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-20" />
            ))}
          </div>
        ) : data ? (
          <div className="space-y-4 animate-fade-in">
            <h3 className="text-base font-semibold">{monthLabel}</h3>

            {/* Métricas financeiras */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <MetricCard
                icon={<TrendingUp className="h-3.5 w-3.5" />}
                label="Lucro Bruto"
                value={`R$ ${formatCurrency(data.lucroBruto)}`}
                valueClass={data.lucroBruto >= 0 ? 'text-success' : 'text-destructive'}
              />
              <MetricCard
                icon={<Receipt className="h-3.5 w-3.5" />}
                label="Despesas"
                value={`R$ ${formatCurrency(data.despesas)}`}
                valueClass="text-destructive"
              />
              <MetricCard
                icon={data.lucroLiquido >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                label="Lucro Líquido"
                value={`R$ ${formatCurrency(data.lucroLiquido)}`}
                valueClass={data.lucroLiquido >= 0 ? 'text-success' : 'text-destructive'}
              />
              <MetricCard
                icon={<Percent className="h-3.5 w-3.5" />}
                label="ROI"
                value={`${formatCurrency(data.roi)}%`}
                valueClass={data.roi >= 0 ? 'text-success' : 'text-destructive'}
              />
              <MetricCard
                icon={<DollarSign className="h-3.5 w-3.5" />}
                label="Total Investido"
                value={`R$ ${formatCurrency(data.totalInvestido)}`}
              />
              <MetricCard
                icon={<Target className="h-3.5 w-3.5" />}
                label="Apostas"
                value={String(data.totalApostas)}
              />
              <MetricCard
                icon={<Clock className="h-3.5 w-3.5" />}
                label="Em Aberto"
                value={String(data.apostasAbertas)}
              />
              <MetricCard
                icon={<CheckCircle2 className="h-3.5 w-3.5" />}
                label="Fechadas"
                value={String(data.apostasFechadas)}
              />
              <MetricCard
                icon={<Calendar className="h-3.5 w-3.5" />}
                label="Dias Trabalhados"
                value={String(data.diasTrabalhados)}
              />
              <MetricCard
                icon={<TrendingUp className="h-3.5 w-3.5" />}
                label="Média/Dia"
                value={`R$ ${formatCurrency(data.mediaPorDia)}`}
                valueClass={data.mediaPorDia >= 0 ? 'text-success' : 'text-destructive'}
              />
            </div>

            {/* Parcerias usadas */}
            <Card className="p-3">
              <div className="flex items-center gap-1.5 mb-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <h4 className="text-sm font-semibold">Parcerias usadas ({data.parcerias.length})</h4>
              </div>
              {data.parcerias.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nenhuma parceria usada neste mês.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {data.parcerias.map((p) => (
                    <span
                      key={p.id}
                      className="inline-flex items-center gap-1 rounded-md border bg-muted/40 px-2 py-1 text-xs"
                    >
                      <span className="font-medium">{p.nome}</span>
                      <span className="text-muted-foreground">×{p.usos}</span>
                    </span>
                  ))}
                </div>
              )}
            </Card>

            {/* Casas mais usadas */}
            <Card className="p-3">
              <div className="flex items-center gap-1.5 mb-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <h4 className="text-sm font-semibold">Casas mais usadas</h4>
              </div>
              {data.casas.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nenhuma casa registrada neste mês.</p>
              ) : (
                <div className="space-y-1.5">
                  {data.casas.map((c) => {
                    const max = data.casas[0].usos;
                    const pct = (c.usos / max) * 100;
                    return (
                      <div key={c.nome} className="flex items-center gap-2">
                        <div className="text-xs min-w-[120px] truncate font-medium">{c.nome}</div>
                        <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <div className="text-xs text-muted-foreground w-10 text-right">×{c.usos}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          </div>
        ) : null}

        <div className="flex justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function MetricCard({
  icon,
  label,
  value,
  valueClass,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <Card className="p-2">
      <div className="flex items-center gap-1 mb-0.5 text-muted-foreground">
        {icon}
        <span className="text-[10px]">{label}</span>
      </div>
      <div className={`text-sm font-bold ${valueClass || ''}`}>{value}</div>
    </Card>
  );
}
