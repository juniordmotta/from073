import { useEffect, useState, useMemo, useCallback } from 'react';
import { Money, ExchangeRateDate } from '@/components/Money';
import { useExchangeRates } from '@/hooks/useExchangeRates';
import { currency, displayCurrency, monetaryRow, convert, type Currency } from '@/lib/currency';
import { Layout } from '@/components/Layout';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useCountUp } from '@/hooks/useCountUp';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TrendingUp, TrendingDown, DollarSign, Target, Calendar, ChevronDown, FileBarChart } from 'lucide-react';
import { format } from 'date-fns';
import { formatCurrency, formatUserName } from '@/lib/utils';
import { MonthlyGoalCard } from '@/components/MonthlyGoalCard';
import { MonthlyReportDialog } from '@/components/MonthlyReportDialog';
import { Button } from '@/components/ui/button';
import { withSupabaseRetry } from '@/lib/supabaseRetry';

interface OpenBetsStats {
  totalArbitragens: number;
  totalInvestido: number;
  totalLucroProjetado: number;
}

interface MonthStats {
  totalLucro: number;
  totalInvestido: number;
  diasComApostas: number;
}

export default function Dashboard() {
  const { userRole, user } = useAuth();
  const { data: exchangeRates } = useExchangeRates();
  const [openCurrency, setOpenCurrency] = useState<Currency>('BRL');
  const [monthCurrency, setMonthCurrency] = useState<Currency>('BRL');
  const [openBetsStats, setOpenBetsStats] = useState<OpenBetsStats>({
    totalArbitragens: 0,
    totalInvestido: 0,
    totalLucroProjetado: 0,
  });
  const [monthStats, setMonthStats] = useState<MonthStats>({
    totalLucro: 0,
    totalInvestido: 0,
    diasComApostas: 0,
  });
  const [openBets, setOpenBets] = useState<any[]>([]);
  const [totalBanca, setTotalBanca] = useState(0);
  const [expandedDashboardBet, setExpandedDashboardBet] = useState<string | null>(null);
  const [reportOpen, setReportOpen] = useState(false);

  const isAdmin = userRole?.role === 'admin' || userRole?.role === 'admin_master';

  

  const loadOpenBetsStats = useCallback(async () => {
    if (!user?.id) return;
    
    try {
      const { data: rawData, error } = await withSupabaseRetry(() =>
        supabase
          .from('arbitrages')
          .select('moeda, lucro_projetado, casa_01_valor, casa_02_valor, casa_03_valor')
          .eq('user_id', user.id)
          .eq('status', 'aguardando')
      );

      const code = displayCurrency(rawData || []);
      setOpenCurrency(code);
      const data = rawData?.map(row => monetaryRow(row, code, exchangeRates ?? null));
      if (error) {
        console.warn('Erro ao carregar stats:', error.message);
        return;
      }

      if (data) {
        const totalArbitragens = data.length;
        const totalInvestido = data.reduce(
          (sum, arb) => sum + Number(arb.casa_01_valor) + Number(arb.casa_02_valor) + Number(arb.casa_03_valor || 0),
          0
        );
        const totalLucroProjetado = data.reduce((sum, arb) => sum + Number(arb.lucro_projetado), 0);

        setOpenBetsStats({
          totalArbitragens,
          totalInvestido,
          totalLucroProjetado,
        });
      }
    } catch (error) {
      console.error('Erro ao carregar stats:', error);
    }
  }, [user?.id, exchangeRates]);

  const loadMonthStats = useCallback(async () => {
    if (!user?.id) return;
    
    try {
      const now = new Date();
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

      const { data: rawData, error } = await withSupabaseRetry(() =>
        supabase
          .from('arbitrages')
          .select('moeda, status, lucro_projetado, lucro_real, casa_01_valor, casa_02_valor, casa_03_valor, created_at')
          .eq('user_id', user.id)
          .gte('created_at', firstDayOfMonth.toISOString())
          .lte('created_at', lastDayOfMonth.toISOString())
      );

      const code = displayCurrency(rawData || []);
      setMonthCurrency(code);
      const data = rawData?.map(row => monetaryRow(row, code, exchangeRates ?? null));
      if (error) {
        console.warn('Erro ao carregar stats do mês:', error.message);
        return;
      }

      if (data) {
        const totalLucro = data.reduce((sum, arb) => {
          const lucro = arb.status === 'aguardando' ? Number(arb.lucro_projetado) : Number(arb.lucro_real);
          return sum + lucro;
        }, 0);

        const totalInvestido = data.reduce(
          (sum, arb) => sum + Number(arb.casa_01_valor) + Number(arb.casa_02_valor) + Number(arb.casa_03_valor || 0),
          0
        );

        // Contar dias únicos com apostas
        const uniqueDays = new Set(
          data.map(arb => format(new Date(arb.created_at), 'yyyy-MM-dd'))
        );
        
        setMonthStats({
          totalLucro,
          totalInvestido,
          diasComApostas: uniqueDays.size,
        });
      }
    } catch (error) {
      console.error('Erro ao carregar stats do mês:', error);
    }
  }, [user?.id, exchangeRates]);

  const loadOpenBets = useCallback(async () => {
    if (!user?.id) return;
    
    try {
      const { data, error } = await withSupabaseRetry(() =>
        supabase
          .from('arbitrages')
          .select(`
            id,
            moeda,
            descricao,
            data_evento,
            casa_01_nome,
            casa_01_odd,
            casa_01_valor,
            casa_02_nome,
            casa_02_odd,
            casa_02_valor,
            casa_03_nome,
            casa_03_odd,
            casa_03_valor,
            casa_01_mercado,
            casa_02_mercado,
            casa_03_mercado,
            lucro_projetado,
            profiles:user_id (name)
          `)
          .eq('status', 'aguardando')
          .eq('user_id', user.id)
          .order('data_evento', { ascending: true })
          .limit(50)
      );

      if (error) {
        console.warn('Erro ao carregar apostas abertas:', error.message);
        return;
      }

      if (data) {
        setOpenBets(data);
      }
    } catch (error) {
      console.error('Erro ao carregar apostas abertas:', error);
    }
  }, [user?.id]);

  const loadBancaTotal = useCallback(async () => {
    if (!user?.id) return;
    
    try {
      const { data, error } = await withSupabaseRetry(() =>
        supabase
          .from('partnerships')
          .select('valor_banca')
          .eq('status', 'ativo')
          .eq('user_id', user.id)
      );

      if (error) {
        console.warn('Erro ao carregar banca:', error.message);
        return;
      }

      if (data) {
        const total = data.reduce((sum, p) => sum + Number(p.valor_banca || 0), 0);
        setTotalBanca(total);
      }
    } catch (error) {
      console.error('Erro ao carregar banca:', error);
    }
  }, [user?.id]);

  // Load data on mount - consolidar em uma única chamada
  useEffect(() => {
    if (!user?.id) return;
    
    // Carregar todos os dados em paralelo uma única vez
    Promise.all([
      loadOpenBetsStats(),
      loadMonthStats(),
      loadOpenBets(),
      loadBancaTotal()
    ]).catch(console.error);
    
    // Remover dependências de funções para evitar loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const bancaPercentage = useMemo(() => {
    if (totalBanca === 0) return 0;
    return (openBetsStats.totalInvestido / totalBanca) * 100;
  }, [openBetsStats.totalInvestido, totalBanca]);

  // ROI das apostas abertas
  const roi = useMemo(() => {
    if (openBetsStats.totalInvestido === 0) return 0;
    return (openBetsStats.totalLucroProjetado / openBetsStats.totalInvestido) * 100;
  }, [openBetsStats.totalLucroProjetado, openBetsStats.totalInvestido]);

  // Média por dia (apenas dias com apostas)
  const mediaPorDia = useMemo(() => {
    if (monthStats.diasComApostas === 0) return 0;
    return monthStats.totalLucro / monthStats.diasComApostas;
  }, [monthStats.totalLucro, monthStats.diasComApostas]);

  // Animated values
  const animatedOpenInvestido = useCountUp(openBetsStats.totalInvestido);
  const animatedOpenLucro = useCountUp(openBetsStats.totalLucroProjetado);
  const animatedOpenCount = useCountUp(openBetsStats.totalArbitragens, { decimals: 0 });
  const animatedBancaPercentage = useCountUp(bancaPercentage);
  const animatedRoi = useCountUp(roi);
  const animatedMonthLucro = useCountUp(monthStats.totalLucro);
  const animatedMonthInvestido = useCountUp(monthStats.totalInvestido);
  const animatedMediaPorDia = useCountUp(mediaPorDia);

  return (
    <Layout>
      <div className="space-y-4 md:space-y-4 pb-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <p className="md:hidden text-[10px] font-medium uppercase text-mobile-muted">Visão geral</p>
            <h1 className="text-xl md:text-2xl font-bold">Dashboard</h1>
          <ExchangeRateDate />
          </div>
          <Button size="sm" variant="outline" className="mobile-dashboard-card border-mobile-border bg-mobile-surface/80 md:border-border md:bg-background" onClick={() => setReportOpen(true)}>
            <FileBarChart className="h-4 w-4" />
            Relatório Mensal
          </Button>
        </div>

        {user?.id && (
          <MonthlyReportDialog open={reportOpen} onOpenChange={setReportOpen} userId={user.id} isAdmin={isAdmin} />
        )}

        {/* Cards compactos */}
        <div className="grid gap-3 grid-cols-2 md:gap-2 md:grid-cols-5">
          {/* Total Investido (Abertas) */}
          <Card className="mobile-dashboard-card p-3 md:p-2 animate-fade-in">
            <div className="flex items-center gap-1 mb-0.5">
              <DollarSign className="h-3 w-3 text-muted-foreground" />
              <span className="text-[10px] text-muted-foreground">Investido (Abertas)</span>
            </div>
            <div className="text-lg font-bold">R$ {formatCurrency(animatedOpenInvestido)}</div>
            {totalBanca > 0 && (
              <>
                <Progress value={Math.min(animatedBancaPercentage, 100)} className="h-1.5 mt-1" />
                <p className="text-[9px] text-muted-foreground">{formatCurrency(animatedBancaPercentage)}% da banca</p>
              </>
            )}
          </Card>

          {/* Quantidade + Lucro Projetado + ROI */}
          <Card className="mobile-dashboard-card p-3 md:p-2 animate-fade-in" style={{ animationDelay: '50ms', animationFillMode: 'backwards' }}>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1">
                <Target className="h-3 w-3 text-muted-foreground" />
                <span className="text-[10px] text-muted-foreground">Abertas</span>
              </div>
              <span className="text-sm font-bold">{animatedOpenCount}</span>
            </div>
            <div className="border-t pt-1 flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground">Lucro Proj.</span>
              <span className="text-sm font-bold text-success">R$ {formatCurrency(animatedOpenLucro)}</span>
            </div>
            <div className="border-t pt-1 flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground">ROI</span>
              <span className={`text-sm font-bold ${roi >= 0 ? 'text-success' : 'text-destructive'}`}>
                {formatCurrency(animatedRoi)}%
              </span>
            </div>
          </Card>

          {/* Lucro do Mês */}
          <Card className="mobile-dashboard-card col-span-2 md:col-span-1 p-5 md:p-2 text-center md:text-left animate-fade-in" style={{ animationDelay: '100ms', animationFillMode: 'backwards' }}>
            <div className="flex items-center gap-1 mb-0.5">
              {monthStats.totalLucro >= 0 ? (
                <TrendingUp className="h-3 w-3 text-success" />
              ) : (
                <TrendingDown className="h-3 w-3 text-destructive" />
              )}
              <span className="text-[10px] text-muted-foreground">Lucro do Mês</span>
            </div>
            <div className={`text-3xl md:text-lg font-bold ${monthStats.totalLucro >= 0 ? 'text-success' : 'text-destructive'}`}>
              <Money value={animatedMonthLucro} code={monthCurrency} />
            </div>
            <div className="border-t pt-1 mt-1 flex items-center justify-between">
              <span className="text-[9px] text-muted-foreground">Investido</span>
              <span className="text-xs font-medium"><Money value={animatedMonthInvestido} code={monthCurrency} /></span>
            </div>
          </Card>

          {/* Média por Dia */}
          <Card className="mobile-dashboard-card min-w-0 p-3 md:p-2 animate-fade-in" style={{ animationDelay: '150ms', animationFillMode: 'backwards' }}>
            <div className="flex items-center gap-1 mb-0.5">
              <Calendar className="h-3 w-3 text-muted-foreground" />
              <span className="text-[10px] text-muted-foreground">Média/Dia</span>
            </div>
            <div className={`text-lg font-bold ${mediaPorDia >= 0 ? 'text-success' : 'text-destructive'}`}>
              R$ {formatCurrency(animatedMediaPorDia)}
            </div>
            <p className="text-[9px] text-muted-foreground">{monthStats.diasComApostas} dias com apostas</p>
          </Card>

          {/* Meta Mensal */}
          {user?.id && (
            <div className="mobile-dashboard-goal min-w-0 md:col-span-1 animate-fade-in" style={{ animationDelay: '200ms', animationFillMode: 'backwards' }}>
              <MonthlyGoalCard
                userId={user.id}
                currentProfit={convert(monthStats.totalLucro, monthCurrency, 'BRL', exchangeRates ?? null)}
                compact
              />
            </div>
          )}
        </div>

        {/* Apostas em Aberto */}
        {openBets.length > 0 && (
          <Card className="mobile-dashboard-card animate-slide-in-bottom" style={{ animationDelay: '250ms', animationFillMode: 'backwards' }}>
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-base">Apostas em Aberto ({openBets.length})</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              {/* Desktop: Table */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs min-w-[150px]">Descrição</TableHead>
                      <TableHead className="text-xs min-w-[100px]">Data Evento</TableHead>
                      {isAdmin && <TableHead className="text-xs min-w-[100px]">Usuário</TableHead>}
                      <TableHead className="text-xs min-w-[150px]">Casa 1</TableHead>
                      <TableHead className="text-xs min-w-[150px]">Casa 2</TableHead>
                      <TableHead className="text-xs min-w-[150px]">Casa 3</TableHead>
                      <TableHead className="text-right text-xs min-w-[100px]">Investido</TableHead>
                      <TableHead className="text-right text-xs min-w-[100px]">Lucro Proj.</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {openBets.map((bet) => {
                      const eventDate = new Date(bet.data_evento);
                      eventDate.setHours(0, 0, 0, 0);
                      const todayDate = new Date();
                      todayDate.setHours(0, 0, 0, 0);
                      const isEventPast = eventDate < todayDate;
                      const isEventToday = eventDate.getTime() === todayDate.getTime();
                      
                      return (
                      <TableRow key={bet.id}>
                        <TableCell className="font-medium text-xs break-words whitespace-normal max-w-[200px]">{bet.descricao}</TableCell>
                        <TableCell className={`text-xs relative ${
                          isEventPast ? 'border-l-4 border-red-500' : isEventToday ? 'border-l-4 border-sky-300' : ''
                        }`}>
                          {isEventPast ? (
                            <div className="absolute left-0 top-1 bottom-1 w-1 bg-red-500 animate-pulse" />
                          ) : isEventToday ? (
                            <div className="absolute left-0 top-1 bottom-1 w-1 bg-sky-300 animate-pulse" />
                          ) : null}
                          {(() => {
                            const eventDateTime = new Date(bet.data_evento);
                            const now = new Date();
                            const isGameStarted = eventDateTime <= now;
                            return (
                              <span className={isGameStarted ? 'text-destructive font-semibold animate-pulse' : ''}>
                                {format(eventDateTime, 'dd/MM/yy HH:mm')}
                              </span>
                            );
                          })()}
                        </TableCell>
                        {isAdmin && <TableCell className="text-xs">{formatUserName(bet.profiles?.name) || '-'}</TableCell>}
                        <TableCell className="text-xs">
                          <div>
                            <div className="font-medium break-words whitespace-normal">{bet.casa_01_nome}</div>
                            <div className="text-muted-foreground">@{Number(bet.casa_01_odd).toFixed(3)} • <Money value={bet.casa_01_valor} code={currency(bet.moeda)} /></div>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs">
                          <div>
                            <div className="font-medium break-words whitespace-normal">{bet.casa_02_nome}</div>
                            <div className="text-muted-foreground">@{Number(bet.casa_02_odd).toFixed(3)} • <Money value={bet.casa_02_valor} code={currency(bet.moeda)} /></div>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs">
                          {bet.casa_03_nome ? (
                            <div>
                              <div className="font-medium break-words whitespace-normal">{bet.casa_03_nome}</div>
                              <div className="text-muted-foreground">@{Number(bet.casa_03_odd).toFixed(3)} • <Money value={bet.casa_03_valor} code={currency(bet.moeda)} /></div>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right text-xs font-medium">
                          <Money value={Number(bet.casa_01_valor) + Number(bet.casa_02_valor) + Number(bet.casa_03_valor || 0)} code={currency(bet.moeda)} />
                        </TableCell>
                        <TableCell className="text-right text-xs font-medium text-success">
                          <Money value={bet.lucro_projetado} code={currency(bet.moeda)} />
                        </TableCell>
                      </TableRow>
                    )})}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile: Compact list with expand on tap */}
              <div className="md:hidden space-y-1.5">
                {openBets.map((bet) => {
                  const eventDate = new Date(bet.data_evento);
                  eventDate.setHours(0, 0, 0, 0);
                  const todayDate = new Date();
                  todayDate.setHours(0, 0, 0, 0);
                  const isEventPast = eventDate < todayDate;
                  const isEventToday = eventDate.getTime() === todayDate.getTime();
                  const eventDateTime = new Date(bet.data_evento);
                  const isGameStarted = eventDateTime <= new Date();
                  const isExpanded = expandedDashboardBet === bet.id;

                  return (
                    <div
                      key={bet.id}
                       className={`mobile-dashboard-bet rounded-lg border overflow-hidden ${
                        isEventPast ? 'border-l-4 border-red-500' : isEventToday ? 'border-l-4 border-sky-300' : ''
                      }`}
                    >
                      {/* Summary row - always visible */}
                      <div
                        className="flex items-center gap-2 px-2.5 py-2 cursor-pointer active:bg-muted/50"
                        onClick={() => setExpandedDashboardBet(isExpanded ? null : bet.id)}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">{bet.descricao}</p>
                          <p className="text-[10px] text-muted-foreground truncate">
                            {bet.casa_01_nome} × {bet.casa_02_nome}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <div className={`text-[10px] ${isGameStarted ? 'text-destructive font-semibold animate-pulse' : 'text-muted-foreground'}`}>
                            {format(eventDateTime, 'dd/MM HH:mm')}
                          </div>
                          <div className="text-[10px] font-medium text-success">
                            +<Money value={bet.lucro_projetado} code={currency(bet.moeda)} />
                          </div>
                        </div>
                        <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                      </div>

                      {/* Expanded details */}
                      {isExpanded && (
                        <div className="px-2.5 pb-2.5 space-y-2 border-t animate-fade-in">
                          <div className="grid grid-cols-2 gap-2 pt-2">
                            <div className="rounded-md border p-2 text-[10px] space-y-0.5">
                              <div className="font-medium">{bet.casa_01_nome}</div>
                              <div className="text-muted-foreground">Odd: {Number(bet.casa_01_odd).toFixed(3)}</div>
                              <div className="text-muted-foreground"><Money value={bet.casa_01_valor} code={currency(bet.moeda)} /></div>
                              {bet.casa_01_mercado && <div className="text-muted-foreground">{bet.casa_01_mercado}</div>}
                            </div>
                            <div className="rounded-md border p-2 text-[10px] space-y-0.5">
                              <div className="font-medium">{bet.casa_02_nome}</div>
                              <div className="text-muted-foreground">Odd: {Number(bet.casa_02_odd).toFixed(3)}</div>
                              <div className="text-muted-foreground"><Money value={bet.casa_02_valor} code={currency(bet.moeda)} /></div>
                              {bet.casa_02_mercado && <div className="text-muted-foreground">{bet.casa_02_mercado}</div>}
                            </div>
                          </div>
                          {bet.casa_03_nome && (
                            <div className="rounded-md border p-2 text-[10px] space-y-0.5">
                              <div className="font-medium">{bet.casa_03_nome}</div>
                              <div className="text-muted-foreground">Odd: {Number(bet.casa_03_odd).toFixed(3)} • <Money value={bet.casa_03_valor} code={currency(bet.moeda)} /></div>
                              {bet.casa_03_mercado && <div className="text-muted-foreground">{bet.casa_03_mercado}</div>}
                            </div>
                          )}
                          <div className="flex items-center justify-between text-[10px] pt-1 border-t">
                            <div>
                              <span className="text-muted-foreground">Investido: </span>
                              <span className="font-medium"><Money value={Number(bet.casa_01_valor) + Number(bet.casa_02_valor) + Number(bet.casa_03_valor || 0)} code={currency(bet.moeda)} /></span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Lucro Proj.: </span>
                              <span className="font-bold text-success"><Money value={bet.lucro_projetado} code={currency(bet.moeda)} /></span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}
