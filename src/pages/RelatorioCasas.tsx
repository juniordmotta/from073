import { useState, useEffect, useMemo, useCallback } from 'react';
import { Layout } from '@/components/Layout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useDebounce } from '@/hooks/useDebounce';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { format } from 'date-fns';
import { formatCurrency } from '@/lib/utils';

interface CasaStats {
  nome: string;
  totalApostas: number;
  valorApostado: number;
  lucroReal: number;
  green: number;
  red: number;
  aguardando: number;
  devolvido: number;
  perdaTotal: number;
  taxaSucesso: number;
}

export default function RelatorioCasas() {
  const { user, userRole } = useAuth();
  const isAdmin = userRole?.role === 'admin' || userRole?.role === 'admin_master';

  const [casasStats, setCasasStats] = useState<CasaStats[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filtros
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [usuarioFiltro, setUsuarioFiltro] = useState<string>('todos');
  const [statusFiltro, setStatusFiltro] = useState<string>('todos');
  const [usuarios, setUsuarios] = useState<any[]>([]);
  
  // Debounce dos filtros
  const debouncedDataInicio = useDebounce(dataInicio, 300);
  const debouncedDataFim = useDebounce(dataFim, 300);
  const debouncedUsuarioFiltro = useDebounce(usuarioFiltro, 300);
  const debouncedStatusFiltro = useDebounce(statusFiltro, 300);

  useEffect(() => {
    loadData();
  }, [user, debouncedDataInicio, debouncedDataFim, debouncedUsuarioFiltro, debouncedStatusFiltro]);

  useEffect(() => {
    if (isAdmin) {
      loadUsers();
    }
  }, [isAdmin]);

  const loadUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name')
        .order('name');

      if (error) {
        // Operadores não têm permissão para listar todos os profiles - comportamento esperado
        console.warn('Erro ao carregar usuários (RLS):', error.message);
        return;
      }
      setUsuarios(data || []);
    } catch (error) {
      console.error('Erro inesperado ao carregar usuários:', error);
    }
  };

  const loadData = useCallback(async () => {
    if (!user?.id) return;

    setLoading(true);
    try {
      let query = supabase
        .from('arbitrages')
        .select(`
          casa_01_nome,
          casa_01_valor,
          casa_01_resultado,
          casa_01_valor_resultado,
          casa_02_nome,
          casa_02_valor,
          casa_02_resultado,
          casa_02_valor_resultado,
          casa_03_nome,
          casa_03_valor,
          casa_03_resultado,
          casa_03_valor_resultado
        `)
        .order('data_evento', { ascending: true });

      // Filtro de usuário
      if (!isAdmin || (debouncedUsuarioFiltro !== 'todos' && debouncedUsuarioFiltro)) {
        query = query.eq('user_id', isAdmin && debouncedUsuarioFiltro !== 'todos' ? debouncedUsuarioFiltro : user.id);
      }

      // Filtro de data
      if (debouncedDataInicio) {
        query = query.gte('data_evento', new Date(debouncedDataInicio).toISOString());
      }
      if (debouncedDataFim) {
        const dataFimISO = new Date(debouncedDataFim);
        dataFimISO.setHours(23, 59, 59, 999);
        query = query.lte('data_evento', dataFimISO.toISOString());
      }

      // Filtro de status
      if (debouncedStatusFiltro !== 'todos') {
        query = query.eq('status', debouncedStatusFiltro as any);
      } else {
        // Mostrar apenas apostas que deram lucro ou prejuízo (excluir aguardando e devolvido)
        query = query.not('status', 'in', '("aguardando","devolvido")');
      }

      const { data, error } = await query;

      if (error) {
        console.warn('Erro ao carregar dados (RLS):', error.message);
        setCasasStats([]);
        return;
      }

      // Processar dados por casa de aposta
      const casasMap = new Map<string, CasaStats>();

      data?.forEach((arb: any) => {
        // Casa 01
        processarCasa(casasMap, arb.casa_01_nome, arb.casa_01_valor, arb.casa_01_resultado || 'aguardando', arb.casa_01_valor_resultado);
        
        // Casa 02
        processarCasa(casasMap, arb.casa_02_nome, arb.casa_02_valor, arb.casa_02_resultado || 'aguardando', arb.casa_02_valor_resultado);
        
        // Casa 03 (se existir)
        if (arb.casa_03_nome) {
          processarCasa(casasMap, arb.casa_03_nome, arb.casa_03_valor, arb.casa_03_resultado || 'aguardando', arb.casa_03_valor_resultado);
        }
      });

      // Converter map para array e ordenar por lucro
      const casasArray = Array.from(casasMap.values()).sort((a, b) => b.lucroReal - a.lucroReal);
      setCasasStats(casasArray);
    } catch (error) {
      console.error('Erro inesperado ao carregar dados:', error);
      setCasasStats([]);
    } finally {
      setLoading(false);
    }
  }, [user?.id, isAdmin, debouncedDataInicio, debouncedDataFim, debouncedUsuarioFiltro, debouncedStatusFiltro]);

  const processarCasa = (
    casasMap: Map<string, CasaStats>,
    nome: string,
    valorApostado: number,
    resultado: string,
    valorResultado: number | null
  ) => {
    // Ignorar apostas aguardando e devolvidas (só mostrar lucro/prejuízo real)
    const resultadoLower = resultado?.toLowerCase();
    if (resultadoLower === 'aguardando' || resultadoLower === 'devolvido') {
      return;
    }

    if (!casasMap.has(nome)) {
      casasMap.set(nome, {
        nome,
        totalApostas: 0,
        valorApostado: 0,
        lucroReal: 0,
        green: 0,
        red: 0,
        aguardando: 0,
        devolvido: 0,
        perdaTotal: 0,
        taxaSucesso: 0,
      });
    }

    const stats = casasMap.get(nome)!;
    stats.totalApostas++;
    stats.valorApostado += valorApostado;

    // Calcular lucro (retorno - aposta)
    const ganho = (valorResultado || 0) - valorApostado;
    stats.lucroReal += ganho;

    // Contar resultados
    switch (resultadoLower) {
      case 'green':
        stats.green++;
        break;
      case 'red':
        stats.red++;
        break;
      case 'aguardando':
        stats.aguardando++;
        break;
      case 'devolvido':
        stats.devolvido++;
        break;
      case 'perda_total':
        stats.perdaTotal++;
        break;
    }

    // Calcular taxa de sucesso (green + devolvido) / (total - aguardando)
    const apostasFinalizadas = stats.totalApostas - stats.aguardando;
    if (apostasFinalizadas > 0) {
      stats.taxaSucesso = ((stats.green + stats.devolvido) / apostasFinalizadas) * 100;
    }
  };

  const totalGeralApostado = casasStats.reduce((sum, casa) => sum + casa.valorApostado, 0);
  const totalGeralLucro = casasStats.reduce((sum, casa) => sum + casa.lucroReal, 0);
  const totalApostas = casasStats.reduce((sum, casa) => sum + casa.totalApostas, 0);

  return (
    <Layout>
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Relatório por Casa</h1>
          <p className="text-sm text-muted-foreground">Performance por casa de apostas</p>
        </div>

        {/* Filtros inline */}
        <div className="flex flex-wrap items-center gap-2">
          <Input
            type="date"
            value={dataInicio}
            onChange={(e) => setDataInicio(e.target.value)}
            className="w-[130px] h-8 text-sm"
            placeholder="Início"
          />
          <Input
            type="date"
            value={dataFim}
            onChange={(e) => setDataFim(e.target.value)}
            className="w-[130px] h-8 text-sm"
            placeholder="Fim"
          />
          {isAdmin && (
            <Select value={usuarioFiltro} onValueChange={setUsuarioFiltro}>
              <SelectTrigger className="w-[130px] h-8 text-sm">
                <SelectValue placeholder="Usuário" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {usuarios.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Select value={statusFiltro} onValueChange={setStatusFiltro}>
            <SelectTrigger className="w-[130px] h-8 text-sm">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="green">Green</SelectItem>
              <SelectItem value="parcial_green">Parcial Green</SelectItem>
              <SelectItem value="red">Red</SelectItem>
              <SelectItem value="parcial_red">Parcial Red</SelectItem>
              <SelectItem value="perda_total">Perda Total</SelectItem>
              <SelectItem value="devolvido">Devolvido</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Cards de resumo compactos */}
        <div className="grid gap-2 grid-cols-3">
          <div className="rounded-lg border bg-card p-3">
            <p className="text-xs text-muted-foreground">Total Apostado</p>
            <p className="text-lg font-bold">R$ {formatCurrency(totalGeralApostado)}</p>
            <p className="text-xs text-muted-foreground">{totalApostas} apostas</p>
          </div>
          <div className="rounded-lg border bg-card p-3">
            <p className="text-xs text-muted-foreground">Lucro Total</p>
            <p className={`text-lg font-bold ${totalGeralLucro >= 0 ? 'text-success' : 'text-destructive'}`}>
              R$ {formatCurrency(totalGeralLucro)}
            </p>
            <p className="text-xs text-muted-foreground">
              {totalGeralApostado > 0 ? `${formatCurrency((totalGeralLucro / totalGeralApostado) * 100)}% ROI` : '0% ROI'}
            </p>
          </div>
          <div className="rounded-lg border bg-card p-3">
            <p className="text-xs text-muted-foreground">Casas</p>
            <p className="text-lg font-bold">{casasStats.length}</p>
            <p className="text-xs text-muted-foreground">utilizadas</p>
          </div>
        </div>

        {/* Desktop: Tabela */}
        <div className="hidden md:block">
          <Card>
            <CardHeader>
              <CardTitle>Desempenho por Casa</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8">Carregando...</div>
              ) : casasStats.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">Nenhum dado encontrado</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Casa</TableHead>
                      <TableHead className="text-right">Apostas</TableHead>
                      <TableHead className="text-right">Investido</TableHead>
                      <TableHead className="text-right">Lucro/Prejuízo</TableHead>
                      <TableHead className="text-right">ROI</TableHead>
                      <TableHead className="text-right">Taxa Sucesso</TableHead>
                      <TableHead className="text-center">Resultados</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {casasStats.map((casa) => (
                      <TableRow key={casa.nome}>
                        <TableCell className="font-medium">{casa.nome}</TableCell>
                        <TableCell className="text-right">{casa.totalApostas}</TableCell>
                        <TableCell className="text-right">R$ {formatCurrency(casa.valorApostado)}</TableCell>
                        <TableCell className="text-right">
                          <div className={`flex items-center justify-end gap-1 font-semibold ${casa.lucroReal >= 0 ? 'text-success' : 'text-destructive'}`}>
                            {casa.lucroReal >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                            R$ {formatCurrency(casa.lucroReal)}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className={casa.lucroReal >= 0 ? 'text-success' : 'text-destructive'}>
                            {formatCurrency((casa.lucroReal / casa.valorApostado) * 100)}%
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className={casa.taxaSucesso >= 50 ? 'text-success' : 'text-destructive'}>
                            {casa.taxaSucesso.toFixed(1)}%
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1 justify-center flex-wrap">
                            {casa.green > 0 && (
                              <Badge variant="default" className="bg-success text-white">
                                {casa.green} G
                              </Badge>
                            )}
                            {casa.red > 0 && (
                              <Badge variant="destructive">
                                {casa.red} R
                              </Badge>
                            )}
                            {casa.devolvido > 0 && (
                              <Badge variant="outline">
                                {casa.devolvido} D
                              </Badge>
                            )}
                            {casa.perdaTotal > 0 && (
                              <Badge variant="destructive" className="bg-destructive/80">
                                {casa.perdaTotal} PT
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Mobile: Cards */}
        <div className="md:hidden space-y-2">
          {loading ? (
            <div className="text-center py-8">Carregando...</div>
          ) : casasStats.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">Nenhum dado encontrado</div>
          ) : (
            casasStats.map((casa) => (
              <div key={casa.nome} className="rounded-lg border bg-card p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-sm">{casa.nome}</span>
                  <div className={`flex items-center gap-1 text-sm font-bold ${casa.lucroReal >= 0 ? 'text-success' : 'text-destructive'}`}>
                    {casa.lucroReal >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                    R$ {formatCurrency(casa.lucroReal)}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <span className="text-muted-foreground">Apostas</span>
                    <p className="font-medium">{casa.totalApostas}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Investido</span>
                    <p className="font-medium">R$ {formatCurrency(casa.valorApostado)}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">ROI</span>
                    <p className={`font-medium ${casa.lucroReal >= 0 ? 'text-success' : 'text-destructive'}`}>
                      {formatCurrency((casa.lucroReal / casa.valorApostado) * 100)}%
                    </p>
                  </div>
                </div>
                <div className="flex gap-1 flex-wrap">
                  {casa.green > 0 && <Badge variant="default" className="bg-success text-white text-xs h-5">{casa.green} G</Badge>}
                  {casa.red > 0 && <Badge variant="destructive" className="text-xs h-5">{casa.red} R</Badge>}
                  {casa.devolvido > 0 && <Badge variant="outline" className="text-xs h-5">{casa.devolvido} D</Badge>}
                  {casa.perdaTotal > 0 && <Badge variant="destructive" className="bg-destructive/80 text-xs h-5">{casa.perdaTotal} PT</Badge>}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </Layout>
  );
}
