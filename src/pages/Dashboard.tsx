import { useEffect, useState, useMemo, useCallback } from 'react';
import { Layout } from '@/components/Layout';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useCountUp } from '@/hooks/useCountUp';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TrendingUp, TrendingDown, DollarSign, Target, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { formatCurrency, formatUserName } from '@/lib/utils';
import { MonthlyGoalCard } from '@/components/MonthlyGoalCard';

interface MonthStats {
  totalLucro: number;
  totalInvestido: number;
  diasComApostas: number;
}

export default function Dashboard() {
  const { userRole, user } = useAuth();
  const [monthStats, setMonthStats] = useState<MonthStats>({
    totalLucro: 0,
    totalInvestido: 0,
    diasComApostas: 0,
  });
  const [openBets, setOpenBets] = useState<any[]>([]);

  const isAdmin = userRole?.role === 'admin' || userRole?.role === 'admin_master';

  // Datas do mês atual
  const today = new Date();
  const startDate = format(new Date(today.getFullYear(), today.getMonth(), 1), 'yyyy-MM-dd');
  const endDate = format(today, 'yyyy-MM-dd');

  useEffect(() => {
    loadMonthStats();
    loadOpenBets();
  }, [user?.id, isAdmin]);

  const loadMonthStats = useCallback(async () => {
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    let query = supabase.from('arbitrages').select('status, lucro_projetado, lucro_real, casa_01_valor, casa_02_valor, casa_03_valor, created_at');
    
    query = query.eq('user_id', user?.id);
    query = query.gte('created_at', firstDayOfMonth.toISOString()).lte('created_at', lastDayOfMonth.toISOString());

    const { data } = await query;

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
  }, [user?.id]);

  const loadOpenBets = useCallback(async () => {
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
      .eq('user_id', user?.id)
      .order('data_evento', { ascending: true })
      .limit(50);

    const { data } = await query;

    if (data) {
      setOpenBets(data);
    }
  }, [user?.id]);

  // Média por dia (apenas dias com apostas)
  const mediaPorDia = useMemo(() => {
    if (monthStats.diasComApostas === 0) return 0;
    return monthStats.totalLucro / monthStats.diasComApostas;
  }, [monthStats.totalLucro, monthStats.diasComApostas]);

  // Animated values
  const animatedTotalLucro = useCountUp(monthStats.totalLucro);
  const animatedTotalInvestido = useCountUp(monthStats.totalInvestido);
  const animatedMediaPorDia = useCountUp(mediaPorDia);

  return (
    <Layout>
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Dashboard</h1>

        {/* Cards compactos */}
        <div className="grid gap-2 grid-cols-2 md:grid-cols-4">
          {/* Lucro Total do Mês */}
          <Card className="p-2 animate-fade-in">
            <div className="flex items-center gap-1 mb-0.5">
              {monthStats.totalLucro >= 0 ? (
                <TrendingUp className="h-3 w-3 text-success" />
              ) : (
                <TrendingDown className="h-3 w-3 text-destructive" />
              )}
              <span className="text-[10px] text-muted-foreground">Lucro do Mês</span>
            </div>
            <div className={`text-lg font-bold ${monthStats.totalLucro >= 0 ? 'text-success' : 'text-destructive'}`}>
              R$ {formatCurrency(animatedTotalLucro)}
            </div>
          </Card>

          {/* Total Investido do Mês */}
          <Card className="p-2 animate-fade-in" style={{ animationDelay: '50ms', animationFillMode: 'backwards' }}>
            <div className="flex items-center gap-1 mb-0.5">
              <DollarSign className="h-3 w-3 text-muted-foreground" />
              <span className="text-[10px] text-muted-foreground">Investido no Mês</span>
            </div>
            <div className="text-lg font-bold">
              R$ {formatCurrency(animatedTotalInvestido)}
            </div>
          </Card>

          {/* Média por Dia */}
          <Card className="p-2 animate-fade-in" style={{ animationDelay: '100ms', animationFillMode: 'backwards' }}>
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
            <div className="animate-fade-in" style={{ animationDelay: '150ms', animationFillMode: 'backwards' }}>
              <MonthlyGoalCard
                userId={user.id}
                currentProfit={monthStats.totalLucro}
                compact
              />
            </div>
          )}
        </div>

        {/* Apostas em Aberto */}
        {openBets.length > 0 && (
          <Card className="animate-slide-in-bottom" style={{ animationDelay: '200ms', animationFillMode: 'backwards' }}>
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-base">Apostas em Aberto ({openBets.length})</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
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
