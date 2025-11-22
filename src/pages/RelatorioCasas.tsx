import { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
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

  useEffect(() => {
    loadData();
  }, [user, dataInicio, dataFim, usuarioFiltro, statusFiltro]);

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

      if (error) throw error;
      setUsuarios(data || []);
    } catch (error) {
      console.error('Erro ao carregar usuários:', error);
    }
  };

  const loadData = async () => {
    if (!user?.id) return;

    setLoading(true);
    try {
      let query = supabase
        .from('arbitrages')
        .select('*')
        .order('data_evento', { ascending: true });

      // Filtro de usuário
      if (!isAdmin || (usuarioFiltro !== 'todos' && usuarioFiltro)) {
        query = query.eq('user_id', isAdmin && usuarioFiltro !== 'todos' ? usuarioFiltro : user.id);
      }

      // Filtro de data
      if (dataInicio) {
        query = query.gte('data_evento', new Date(dataInicio).toISOString());
      }
      if (dataFim) {
        const dataFimISO = new Date(dataFim);
        dataFimISO.setHours(23, 59, 59, 999);
        query = query.lte('data_evento', dataFimISO.toISOString());
      }

      // Filtro de status
      if (statusFiltro !== 'todos') {
        query = query.eq('status', statusFiltro as any);
      } else {
        // Mostrar apenas apostas que deram lucro ou prejuízo (excluir aguardando e devolvido)
        query = query.not('status', 'in', '("aguardando","devolvido")');
      }

      const { data, error } = await query;

      if (error) throw error;

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
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

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
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Relatório por Casa de Apostas</h1>
          <p className="text-muted-foreground">Análise de performance por casa de apostas</p>
        </div>

        {/* Filtros */}
        <Card>
          <CardHeader>
            <CardTitle>Filtros</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-2">
                <Label>Data Início</Label>
                <Input
                  type="date"
                  value={dataInicio}
                  onChange={(e) => setDataInicio(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Data Fim</Label>
                <Input
                  type="date"
                  value={dataFim}
                  onChange={(e) => setDataFim(e.target.value)}
                />
              </div>
              {isAdmin && (
                <div className="space-y-2">
                  <Label>Usuário</Label>
                  <Select value={usuarioFiltro} onValueChange={setUsuarioFiltro}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todos" />
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
                </div>
              )}
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={statusFiltro} onValueChange={setStatusFiltro}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="aguardando">Aguardando</SelectItem>
                    <SelectItem value="green">Green</SelectItem>
                    <SelectItem value="parcial_green">Parcial Green</SelectItem>
                    <SelectItem value="red">Red</SelectItem>
                    <SelectItem value="parcial_red">Parcial Red</SelectItem>
                    <SelectItem value="devolvido">Devolvido</SelectItem>
                    <SelectItem value="perda_total">Perda Total</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Cards de resumo */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Apostado</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">R$ {formatCurrency(totalGeralApostado)}</div>
              <p className="text-xs text-muted-foreground">{totalApostas} apostas</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Lucro Total</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${totalGeralLucro >= 0 ? 'text-success' : 'text-destructive'}`}>
                R$ {formatCurrency(totalGeralLucro)}
              </div>
              <p className="text-xs text-muted-foreground">
                {totalGeralApostado > 0 ? `${formatCurrency((totalGeralLucro / totalGeralApostado) * 100)}% ROI` : '0% ROI'}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Casas Diferentes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{casasStats.length}</div>
              <p className="text-xs text-muted-foreground">casas utilizadas</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabela de casas */}
        <Card>
          <CardHeader>
            <CardTitle>Desempenho por Casa</CardTitle>
            <CardDescription>Estatísticas detalhadas de cada casa de apostas</CardDescription>
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
                              {casa.green} Green
                            </Badge>
                          )}
                          {casa.red > 0 && (
                            <Badge variant="destructive">
                              {casa.red} Red
                            </Badge>
                          )}
                          {casa.aguardando > 0 && (
                            <Badge variant="secondary">
                              {casa.aguardando} Aguard.
                            </Badge>
                          )}
                          {casa.devolvido > 0 && (
                            <Badge variant="outline">
                              {casa.devolvido} Devol.
                            </Badge>
                          )}
                          {casa.perdaTotal > 0 && (
                            <Badge variant="destructive" className="bg-destructive/80">
                              {casa.perdaTotal} P.Total
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
    </Layout>
  );
}
