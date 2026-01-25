import { useEffect, useState, useMemo, useCallback } from 'react';
import { Layout } from '@/components/Layout';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useCountUp } from '@/hooks/useCountUp';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TrendingUp, TrendingDown, DollarSign, Target } from 'lucide-react';
import { format } from 'date-fns';
import { formatCurrency, formatUserName } from '@/lib/utils';
import { MonthlyGoalCard } from '@/components/MonthlyGoalCard';

interface Stats {
  totalArbitragens: number;
  totalInvestido: number;
  totalLucro: number;
  taxaSucesso: number;
}

interface GoalStats {
  totalLucro: number;
}

export default function Dashboard() {
  const { userRole, user } = useAuth();
  const [stats, setStats] = useState<Stats>({
    totalArbitragens: 0,
    totalInvestido: 0,
    totalLucro: 0,
    taxaSucesso: 0,
  });
  const [openBets, setOpenBets] = useState<any[]>([]);
  const [totalCosts, setTotalCosts] = useState(0);
  const [goalStats, setGoalStats] = useState<GoalStats>({ totalLucro: 0 });
  const [totalBanca, setTotalBanca] = useState(0);

  const isAdmin = userRole?.role === 'admin' || userRole?.role === 'admin_master';

  // Datas do mês atual
  const today = new Date();
  const startDate = format(new Date(today.getFullYear(), today.getMonth(), 1), 'yyyy-MM-dd');
  const endDate = format(today, 'yyyy-MM-dd');

  useEffect(() => {
    loadStats();
    loadOpenBets();
    loadCosts();
    loadBancaTotal();
    loadGoalStats();
  }, [user?.id, isAdmin]);

  const loadStats = useCallback(async () => {
    // Filtrar apenas aguardando, mês atual, usuário logado
    const [startYear, startMonth, startDay] = startDate.split('-').map(Number);
    const [endYear, endMonth, endDay] = endDate.split('-').map(Number);
    const startOfDay = new Date(startYear, startMonth - 1, startDay, 0, 0, 0, 0);
    const endOfDay = new Date(endYear, endMonth - 1, endDay, 23, 59, 59, 999);

    let query = supabase.from('arbitrages').select('status, lucro_projetado, lucro_real, casa_01_valor, casa_02_valor, casa_03_valor');
    
    if (!isAdmin) {
      query = query.eq('user_id', user?.id);
    } else {
      // Admin vê apenas próprios dados no dashboard
      query = query.eq('user_id', user?.id);
    }

    query = query.eq('status', 'aguardando');
    query = query.gte('created_at', startOfDay.toISOString()).lte('created_at', endOfDay.toISOString());

    const { data } = await query;

    if (data) {
      const totalArbitragens = data.length;
      const totalInvestido = data.reduce(
        (sum, arb) => sum + Number(arb.casa_01_valor) + Number(arb.casa_02_valor) + Number(arb.casa_03_valor || 0),
        0
      );
      
      const totalLucro = data.reduce((sum, arb) => {
        const lucro = arb.status === 'aguardando' ? Number(arb.lucro_projetado) : Number(arb.lucro_real);
        return sum + lucro;
      }, 0);
      
      const greenCount = data.filter(
        (arb) => arb.status === 'green' || arb.status === 'parcial_green'
      ).length;
      const taxaSucesso = totalArbitragens > 0 ? (greenCount / totalArbitragens) * 100 : 0;

      setStats({
        totalArbitragens,
        totalInvestido,
        totalLucro,
        taxaSucesso,
      });
    }
  }, [isAdmin, user?.id, startDate, endDate]);

  const loadOpenBets = useCallback(async () => {
    const [startYear, startMonth, startDay] = startDate.split('-').map(Number);
    const [endYear, endMonth, endDay] = endDate.split('-').map(Number);
    const startOfDay = new Date(startYear, startMonth - 1, startDay, 0, 0, 0, 0);
    const endOfDay = new Date(endYear, endMonth - 1, endDay, 23, 59, 59, 999);

    let query = supabase
      .from('arbitrages')
      .select(`
        id,
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
        lucro_projetado,
        profiles:user_id (name)
      `)
      .eq('status', 'aguardando')
      .order('data_evento', { ascending: true })
      .limit(50);
    
    if (!isAdmin) {
      query = query.eq('user_id', user?.id);
    } else {
      query = query.eq('user_id', user?.id);
    }

    query = query.gte('created_at', startOfDay.toISOString()).lte('created_at', endOfDay.toISOString());

    const { data } = await query;

    if (data) {
      setOpenBets(data);
    }
  }, [isAdmin, user?.id, startDate, endDate]);

  const loadCosts = useCallback(async () => {
    let query = supabase
      .from('operational_costs')
      .select('valor');
    
    if (!isAdmin) {
      query = query.eq('user_id', user?.id);
    } else {
      query = query.eq('user_id', user?.id);
    }

    query = query.gte('data', startDate).lte('data', endDate);

    const { data } = await query;

    if (data) {
      const total = data.reduce((sum, cost) => sum + Number(cost.valor), 0);
      setTotalCosts(total);
    }
  }, [isAdmin, user?.id, startDate, endDate]);

  const loadGoalStats = useCallback(async () => {
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    let query = supabase.from('arbitrages').select('status, lucro_projetado, lucro_real');
    
    if (!isAdmin) {
      query = query.eq('user_id', user?.id);
    } else {
      query = query.eq('user_id', user?.id);
    }

    query = query.gte('created_at', firstDayOfMonth.toISOString()).lte('created_at', lastDayOfMonth.toISOString());

    const { data } = await query;

    if (data) {
      const totalLucro = data.reduce((sum, arb) => {
        const lucro = arb.status === 'aguardando' ? Number(arb.lucro_projetado) : Number(arb.lucro_real);
        return sum + lucro;
      }, 0);
      
      setGoalStats({ totalLucro });
    }
  }, [isAdmin, user?.id]);

  const loadBancaTotal = useCallback(async () => {
    let query = supabase
      .from('partnerships')
      .select('valor_banca')
      .eq('status', 'ativo');
    
    if (!isAdmin) {
      query = query.eq('user_id', user?.id);
    } else {
      query = query.eq('user_id', user?.id);
    }

    const { data } = await query;

    if (data) {
      const total = data.reduce((sum, p) => sum + Number(p.valor_banca || 0), 0);
      setTotalBanca(total);
    }
  }, [isAdmin, user?.id]);

  // Calcular porcentagem de investimento em relação à banca
  const bancaPercentage = useMemo(() => {
    if (totalBanca === 0) return 0;
    return (stats.totalInvestido / totalBanca) * 100;
  }, [stats.totalInvestido, totalBanca]);

  // Animated values for cards
  const animatedTotalInvestido = useCountUp(stats.totalInvestido);
  const animatedTotalLucro = useCountUp(stats.totalLucro);
  const animatedTotalArbitragens = useCountUp(stats.totalArbitragens, { decimals: 0 });
  const animatedTotalCosts = useCountUp(totalCosts);
  const animatedBancaPercentage = useCountUp(bancaPercentage);
  const animatedRoi = useCountUp(stats.totalInvestido > 0 ? (stats.totalLucro / stats.totalInvestido) * 100 : 0);

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <h1 className="text-3xl font-bold">Dashboard</h1>
        </div>

        <div className="grid gap-3 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
          <Card className="p-3 animate-fade-in" style={{ animationDelay: '0ms' }}>
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="h-3 w-3 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Total Investido</span>
            </div>
            <div className="text-2xl font-bold">R$ {formatCurrency(animatedTotalInvestido)}</div>
            {totalBanca > 0 ? (
              <>
                <p className="text-xs text-muted-foreground mt-1">
                  de R$ {formatCurrency(totalBanca)} da banca
                </p>
                <div className="mt-2">
                  <Progress 
                    value={Math.min(animatedBancaPercentage, 100)} 
                    className="h-2"
                  />
                  <p className="text-xs text-muted-foreground font-medium mt-1">
                    {formatCurrency(animatedBancaPercentage)}% utilizado
                  </p>
                </div>
              </>
            ) : (
              <p className="text-xs text-muted-foreground">em todas as casas</p>
            )}
          </Card>

          <Card className="p-3 space-y-2 animate-fade-in" style={{ animationDelay: '50ms', animationFillMode: 'backwards' }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Target className="h-3 w-3 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Total Arbitragens</span>
              </div>
              <span className="text-lg font-bold">{animatedTotalArbitragens}</span>
            </div>
            <div className="border-t pt-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                {stats.totalLucro >= 0 ? (
                  <TrendingUp className="h-3 w-3 text-success" />
                ) : (
                  <TrendingDown className="h-3 w-3 text-destructive" />
                )}
                <span className="text-xs text-muted-foreground">Lucro Total</span>
              </div>
              <span className={`text-lg font-bold ${stats.totalLucro >= 0 ? 'text-success' : 'text-destructive'}`}>
                R$ {formatCurrency(animatedTotalLucro)}
              </span>
            </div>
            <div className="border-t pt-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                {stats.totalInvestido > 0 && (stats.totalLucro / stats.totalInvestido) >= 0 ? (
                  <TrendingUp className="h-3 w-3 text-success" />
                ) : (
                  <TrendingDown className="h-3 w-3 text-destructive" />
                )}
                <span className="text-xs text-muted-foreground">ROI</span>
              </div>
              <span className={`text-lg font-bold ${stats.totalInvestido > 0 && (stats.totalLucro / stats.totalInvestido) >= 0 ? 'text-success' : 'text-destructive'}`}>
                {formatCurrency(animatedRoi)}%
              </span>
            </div>
          </Card>

          <Card className="p-3 animate-fade-in" style={{ animationDelay: '100ms', animationFillMode: 'backwards' }}>
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="h-3 w-3 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Custos</span>
            </div>
            <div className="text-xl font-bold text-destructive">R$ {formatCurrency(animatedTotalCosts)}</div>
            <p className="text-[10px] text-muted-foreground">mês atual</p>
          </Card>

          {user?.id && (
            <div className="animate-fade-in" style={{ animationDelay: '150ms', animationFillMode: 'backwards' }}>
              <MonthlyGoalCard
                userId={user.id}
                currentProfit={goalStats.totalLucro}
                compact
              />
            </div>
          )}
        </div>

        {openBets.length > 0 && (
          <Card className="animate-slide-in-bottom" style={{ animationDelay: '200ms', animationFillMode: 'backwards' }}>
            <CardHeader>
              <CardTitle>Apostas em Aberto ({openBets.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
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
                          isEventPast
                            ? 'border-l-4 border-red-500'
                            : isEventToday
                            ? 'border-l-4 border-sky-300'
                            : ''
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
                            <div className="text-muted-foreground">
                              @{Number(bet.casa_01_odd).toFixed(3)} • R$ {formatCurrency(bet.casa_01_valor)}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs">
                          <div>
                            <div className="font-medium break-words whitespace-normal">{bet.casa_02_nome}</div>
                            <div className="text-muted-foreground">
                              @{Number(bet.casa_02_odd).toFixed(3)} • R$ {formatCurrency(bet.casa_02_valor)}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs">
                          {bet.casa_03_nome ? (
                            <div>
                              <div className="font-medium break-words whitespace-normal">{bet.casa_03_nome}</div>
                              <div className="text-muted-foreground">
                                @{Number(bet.casa_03_odd).toFixed(3)} • R$ {formatCurrency(bet.casa_03_valor)}
                              </div>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right text-xs font-medium">
                          R$ {formatCurrency(Number(bet.casa_01_valor) + Number(bet.casa_02_valor) + Number(bet.casa_03_valor || 0))}
                        </TableCell>
                        <TableCell className="text-right text-xs font-medium text-success">
                          R$ {formatCurrency(bet.lucro_projetado)}
                        </TableCell>
                      </TableRow>
                    )})}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}
