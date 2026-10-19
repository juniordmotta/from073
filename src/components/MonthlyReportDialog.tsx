import { Money } from '@/components/Money';
import { formatMoney, convert, type Currency, type Rates } from '@/lib/currency';
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
  moeda?: Currency;
  cotacao?: Rates | null;
  lucroBruto: number;
  lucroAbertas?: number;
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
  saldosParceriasAtivas?: {
    id: string;
    nome: string;
    total: number;
    saldoBancario: number;
    saldoCasas: number;
    casas: { nome: string; saldo: number; lucroLiquido: number }[];
  }[];
  validacao?: {
    ok: boolean;
    esperado: {
      apostasAbertas: number;
      lucroAbertas: number;
      lucroBruto: number;
    };
  };
}


type PartnershipDetail = NonNullable<ReportData['saldosParceriasAtivas']>[number];

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
  const [loadError, setLoadError] = useState('');
  const [data, setData] = useState<ReportData | null>(null);
  const [detailPart, setDetailPart] = useState<PartnershipDetail | null>(null);

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

  // Proteção: operadores SEMPRE forçados ao próprio userId
  useEffect(() => {
    if (!isAdmin && selectedUserId !== userId) {
      setSelectedUserId(userId);
    }
  }, [isAdmin, selectedUserId, userId]);

  useEffect(() => {
    if (!open || !selectedUserId) return;

    // Proteção front-end: operadores só pedem o próprio userId
    const requestedUserId = isAdmin ? selectedUserId : userId;

    const load = async () => {
      setLoading(true);
      setData(null);
      setLoadError('');
      try {
        // Chamada via edge function — o backend revalida o papel pelo JWT
        // e força effectiveUserId = callerId quando o papel for operador,
        // ignorando qualquer targetUserId manipulado no body.
        const { data: resp, error } = await supabase.functions.invoke(
          'monthly-report',
          {
            body: {
              month: selectedMonth,
              targetUserId: requestedUserId,
            },
          }
        );

        if (error) throw error;
        if (resp?.data) setData(resp.data as ReportData);
      } catch (e) {
        console.error('Erro ao gerar relatório:', e);
        setLoadError('Não foi possível gerar o relatório. Verifique a disponibilidade das cotações e tente novamente.');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [open, selectedUserId, selectedMonth, isAdmin, userId]);

  const monthLabel = monthOptions.find((o) => o.value === selectedMonth)?.label || '';
  const selectedUserName =
    profiles.find((p) => p.id === selectedUserId)?.name ||
    (selectedUserId === userId ? 'Meu relatório' : '');

  const exportPdf = () => {
    if (!data) return;
    const doc = new jsPDF();
    const fc = (v: number) => formatMoney(v, data.moeda || 'BRL') + (data.moeda && data.moeda !== 'BRL' && data.cotacao ? ` (aprox. ${formatMoney(convert(v, data.moeda, 'BRL', data.cotacao))})` : '');

    doc.setFontSize(16);
    doc.text('Relatório Mensal', 14, 18);
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Período: ${monthLabel}`, 14, 26);
    if (data.cotacao) { doc.setFontSize(8); doc.text(`Cotação: ${data.cotacao.date} | ${data.moeda || 'BRL'}`, 14, 36); doc.setFontSize(11); }
    if (selectedUserName) doc.text(`Usuário: ${selectedUserName}`, 14, 32);
    doc.setTextColor(0);

    autoTable(doc, {
      startY: 38,
      head: [['Indicador', 'Valor']],
      body: [
        ['Lucro Bruto + Abertas', fc(data.lucroBruto + (data.lucroAbertas || 0))],
        ['Despesas', fc(data.despesas)],
        ['Lucro Líquido + Abertas', fc(data.lucroLiquido + (data.lucroAbertas || 0))],
        ['ROI', `${formatCurrency(data.roi)}%`],
        ['Total Investido', fc(data.totalInvestido)],
        ['Quantidade de Apostas', String(data.totalApostas)],
        ['Apostas em Aberto', String(data.apostasAbertas)],
        ['Apostas Fechadas', String(data.apostasFechadas)],
        ['Dias Trabalhados', String(data.diasTrabalhados)],
        ['Média por Dia', fc(data.mediaPorDia)],
      ],
      styles: { fontSize: 10 },
      headStyles: { fillColor: [30, 41, 59] },
    });

    const afterFinancials = (doc as any).lastAutoTable.finalY + 8;
    autoTable(doc, {
      startY: afterFinancials,
      head: [['Parcerias Usadas', 'Usos']],
      body:
        data.parcerias.length > 0
          ? data.parcerias.map((p) => [p.nome, String(p.usos)])
          : [['Nenhuma parceria usada', '-']],
      styles: { fontSize: 10 },
      headStyles: { fillColor: [30, 41, 59] },
    });

    const afterParts = (doc as any).lastAutoTable.finalY + 8;
    autoTable(doc, {
      startY: afterParts,
      head: [['Casas mais usadas', 'Usos']],
      body:
        data.casas.length > 0
          ? data.casas.map((c) => [c.nome, String(c.usos)])
          : [['Nenhuma casa registrada', '-']],
      styles: { fontSize: 10 },
      headStyles: { fillColor: [30, 41, 59] },
    });

    if (data.saldosParceriasAtivas?.length) {
      autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 8,
        head: [['Parceria ativa', 'Banco', 'Casas', 'Total']],
        body: data.saldosParceriasAtivas.map(p => [p.nome, fc(p.saldoBancario), fc(p.saldoCasas), fc(p.total)]),
        styles: { fontSize: 8 },
      });
    }

    const fileName = `relatorio-${selectedMonth}${selectedUserName ? '-' + selectedUserName.replace(/\s+/g, '_') : ''}.pdf`;
    doc.save(fileName);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Relatório Mensal</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <span className="text-sm text-muted-foreground sm:w-24">Mês:</span>
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

          {isAdmin && (
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <span className="text-sm text-muted-foreground sm:w-24 flex items-center gap-1">
                <User className="h-3.5 w-3.5" /> Usuário:
              </span>
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger className="w-full sm:w-[240px]">
                  <SelectValue placeholder="Selecione um usuário" />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {profiles.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                      {p.id === userId ? ' (você)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex justify-end">
            <Button size="sm" variant="outline" onClick={exportPdf} disabled={!data || loading}>
              <Download className="h-4 w-4" />
              Exportar PDF
            </Button>
          </div>
        </div>


        {loadError && <p role="alert" className="text-sm text-destructive">{loadError}</p>}
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-20" />
            ))}
          </div>
        ) : data ? (
          <div className="space-y-4 animate-fade-in">
            <h3 className="text-base font-semibold">{monthLabel}</h3>
            {data.cotacao && <p className="text-[10px] text-muted-foreground">Cotação {data.cotacao.date} · {data.cotacao.source}</p>}

            {/* Saldo total das parcerias ativas (banco + casas) */}
            <Card className="p-2.5 bg-muted/30">
              <div className="flex items-center gap-1.5 mb-1.5">
                <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-[11px] text-muted-foreground">
                  Saldo total das parcerias ativas (banco + casas)
                </span>
              </div>
              {loading ? (
                <div className="flex flex-wrap gap-1.5">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-5 w-28" />
                  ))}
                </div>
              ) : !data.saldosParceriasAtivas || data.saldosParceriasAtivas.length === 0 ? (
                <p className="text-[11px] text-muted-foreground italic">
                  Nenhuma parceria ativa no momento.
                </p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {data.saldosParceriasAtivas.map((p) => (
                    <button
                      type="button"
                      key={p.id}
                      onClick={() => setDetailPart(p)}
                      className="inline-flex items-center gap-1.5 rounded-md border bg-background px-2 py-0.5 text-[11px] hover:bg-accent hover:border-primary/40 transition-colors cursor-pointer"
                      title="Ver detalhamento"
                    >
                      <span className="font-medium">{p.nome}</span>
                      <span
                        className={`font-semibold ${p.total >= 0 ? 'text-success' : 'text-destructive'}`}
                      >
                        <Money value={p.total} code={data?.moeda || 'BRL'} />
                      </span>
                    </button>
                  ))}
                  <span className="inline-flex items-center gap-1.5 rounded-md border border-primary/40 bg-primary/5 px-2 py-0.5 text-[11px]">
                    <span className="font-medium text-muted-foreground">Total</span>
                    <span className="font-bold text-primary">
                      R$ {formatCurrency(
                        data.saldosParceriasAtivas.reduce((s, p) => s + p.total, 0)
                      )}
                    </span>
                  </span>
                </div>
              )}
            </Card>
            {data.validacao && !data.validacao.ok && (
              <div className="rounded-md border border-destructive/50 bg-destructive/10 p-2 text-xs text-destructive">
                Divergência detectada na conferência automática — valores conferidos:{' '}
                {data.validacao.esperado.apostasAbertas} aposta(s) em aberto, R${' '}
                {formatCurrency(data.validacao.esperado.lucroAbertas)} em aberto e R${' '}
                {formatCurrency(data.validacao.esperado.lucroBruto)} de lucro bruto fechado.
              </div>
            )}

            {/* Métricas financeiras */}

            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <MetricCard
                icon={<TrendingUp className="h-3.5 w-3.5" />}
                label="Lucro Bruto + Abertas"
                value={`R$ ${formatCurrency(data.lucroBruto + (data.lucroAbertas || 0))}`}
                valueClass={(data.lucroBruto + (data.lucroAbertas || 0)) >= 0 ? 'text-success' : 'text-destructive'}
              />
              <MetricCard
                icon={<Receipt className="h-3.5 w-3.5" />}
                label="Despesas"
                value={`R$ ${formatCurrency(data.despesas)}`}
                valueClass="text-destructive"
              />
              <MetricCard
                icon={(data.lucroLiquido + (data.lucroAbertas || 0)) >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                label="Lucro Líquido + Abertas"
                value={`R$ ${formatCurrency(data.lucroLiquido + (data.lucroAbertas || 0))}`}
                valueClass={(data.lucroLiquido + (data.lucroAbertas || 0)) >= 0 ? 'text-success' : 'text-destructive'}
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
                value={`${data.apostasAbertas} · R$ ${formatCurrency(data.lucroAbertas || 0)}`}
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

      {/* Modal de detalhamento da parceria */}
      <Dialog open={!!detailPart} onOpenChange={(o) => !o && setDetailPart(null)}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              {detailPart?.nome}
            </DialogTitle>
          </DialogHeader>
          {detailPart && (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <Card className="p-2">
                  <div className="text-[10px] text-muted-foreground">Banco</div>
                  <div className={`text-sm font-bold ${detailPart.saldoBancario >= 0 ? 'text-success' : 'text-destructive'}`}>
                    <Money value={detailPart.saldoBancario} code={data?.moeda || 'BRL'} />
                  </div>
                </Card>
                <Card className="p-2">
                  <div className="text-[10px] text-muted-foreground">Casas</div>
                  <div className={`text-sm font-bold ${detailPart.saldoCasas >= 0 ? 'text-success' : 'text-destructive'}`}>
                    <Money value={detailPart.saldoCasas} code={data?.moeda || 'BRL'} />
                  </div>
                </Card>
                <Card className="p-2 border-primary/40 bg-primary/5">
                  <div className="text-[10px] text-muted-foreground">Total</div>
                  <div className={`text-sm font-bold ${detailPart.total >= 0 ? 'text-success' : 'text-destructive'}`}>
                    <Money value={detailPart.total} code={data?.moeda || 'BRL'} />
                  </div>
                </Card>
              </div>

              <Card className="p-3">
                <div className="flex items-center gap-1.5 mb-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <h4 className="text-sm font-semibold">
                    Lucro líquido por casa ({monthLabel})
                  </h4>
                </div>
                {detailPart.casas.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">
                    Nenhuma casa cadastrada nesta parceria.
                  </p>
                ) : (
                  <div className="space-y-1">
                    <div className="grid grid-cols-[1fr_auto_auto] gap-3 text-[10px] uppercase text-muted-foreground px-1">
                      <span>Casa</span>
                      <span className="text-right w-20">Saldo</span>
                      <span className="text-right w-20">Lucro Líq.</span>
                    </div>
                    {detailPart.casas.map((c) => (
                      <div
                        key={c.nome}
                        className="grid grid-cols-[1fr_auto_auto] gap-3 items-center text-xs px-1 py-1 rounded hover:bg-muted/40"
                      >
                        <span className="truncate font-medium">{c.nome}</span>
                        <span className={`text-right w-20 font-semibold ${c.saldo >= 0 ? 'text-success' : 'text-destructive'}`}>
                          <Money value={c.saldo} code={data?.moeda || 'BRL'} />
                        </span>
                        <span className={`text-right w-20 font-semibold ${c.lucroLiquido >= 0 ? 'text-success' : 'text-destructive'}`}>
                          <Money value={c.lucroLiquido} code={data?.moeda || 'BRL'} />
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          )}
          <div className="flex justify-end">
            <Button variant="outline" onClick={() => setDetailPart(null)}>
              Fechar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
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
