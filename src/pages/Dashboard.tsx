import { useEffect, useState, useMemo, useCallback } from 'react';
import { Layout } from '@/components/Layout';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useDebounce } from '@/hooks/useDebounce';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TrendingUp, TrendingDown, DollarSign, Target, Filter, X, Download } from 'lucide-react';
import { format } from 'date-fns';
import { formatCurrency, formatUserName } from '@/lib/utils';
import * as XLSX from 'xlsx';

interface Stats {
  totalArbitragens: number;
  totalInvestido: number;
  totalLucro: number;
  taxaSucesso: number;
}

export default function Dashboard() {
  const { userRole, user } = useAuth();
  const [stats, setStats] = useState<Stats>({
    totalArbitragens: 0,
    totalInvestido: 0,
    totalLucro: 0,
    taxaSucesso: 0,
  });
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedUser, setSelectedUser] = useState<string[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<string[]>(['aguardando']);
  const [users, setUsers] = useState<Array<{ id: string; name: string }>>([]);
  const [openBets, setOpenBets] = useState<any[]>([]);
  const [totalCosts, setTotalCosts] = useState(0);
  const [allArbitrages, setAllArbitrages] = useState<any[]>([]);
  
  // Debounce dos filtros
  const debouncedStartDate = useDebounce(startDate, 300);
  const debouncedEndDate = useDebounce(endDate, 300);
  const debouncedSelectedUser = useDebounce(selectedUser, 300);
  const debouncedSelectedStatus = useDebounce(selectedStatus, 300);

  const isAdmin = userRole?.role === 'admin' || userRole?.role === 'admin_master';

  useEffect(() => {
    loadStats();
    loadOpenBets();
    loadCosts();
    loadAllArbitrages();
    if (isAdmin) {
      loadUsers();
    }
  }, [debouncedSelectedUser, debouncedSelectedStatus, debouncedStartDate, debouncedEndDate, isAdmin]);

  const loadUsers = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, name')
      .order('name');
    
    if (data) {
      setUsers(data);
      // Inicializar com todos os usuários selecionados
      if (selectedUser.length === 0 && isAdmin) {
        setSelectedUser(data.map(u => u.id));
      }
    }
  };

  const loadStats = useCallback(async () => {
    let query = supabase.from('arbitrages').select('status, lucro_projetado, lucro_real, casa_01_valor, casa_02_valor, casa_03_valor');
    
    if (!isAdmin) {
      query = query.eq('user_id', user?.id);
    } else if (debouncedSelectedUser.length > 0) {
      query = query.in('user_id', debouncedSelectedUser);
    }

    if (!debouncedSelectedStatus.includes('all')) {
      const conditions: string[] = [];
      
      if (debouncedSelectedStatus.includes('green')) {
        conditions.push('status.eq.green', 'status.eq.parcial_green', 'status.eq.devolvido');
      }
      if (debouncedSelectedStatus.includes('red')) {
        conditions.push('status.eq.red', 'status.eq.parcial_red', 'status.eq.perda_total');
      }
      if (debouncedSelectedStatus.includes('aguardando')) {
        conditions.push('status.eq.aguardando');
      }
      
      if (conditions.length > 0) {
        query = query.or(conditions.join(','));
      }
    }

    if (debouncedStartDate) {
      query = query.gte('created_at', new Date(debouncedStartDate).toISOString());
    }

    if (debouncedEndDate) {
      const endOfDay = new Date(debouncedEndDate);
      endOfDay.setHours(23, 59, 59, 999);
      query = query.lte('created_at', endOfDay.toISOString());
    }

    const { data } = await query;

    if (data) {
      const totalArbitragens = data.length;
      const totalInvestido = data.reduce(
        (sum, arb) => sum + Number(arb.casa_01_valor) + Number(arb.casa_02_valor) + Number(arb.casa_03_valor || 0),
        0
      );
      
      // Calcular lucro total: se aguardando usa lucro_projetado, senão usa lucro_real
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
  }, [isAdmin, user?.id, debouncedSelectedUser, debouncedSelectedStatus, debouncedStartDate, debouncedEndDate]);

  const loadAllArbitrages = useCallback(async () => {
    let query = supabase
      .from('arbitrages')
      .select(`
        *,
        profiles:user_id (name)
      `)
      .order('created_at', { ascending: false });
    
    if (!isAdmin) {
      query = query.eq('user_id', user?.id);
    } else if (debouncedSelectedUser.length > 0) {
      query = query.in('user_id', debouncedSelectedUser);
    }

    if (!debouncedSelectedStatus.includes('all')) {
      const conditions: string[] = [];
      
      if (debouncedSelectedStatus.includes('green')) {
        conditions.push('status.eq.green', 'status.eq.parcial_green', 'status.eq.devolvido');
      }
      if (debouncedSelectedStatus.includes('red')) {
        conditions.push('status.eq.red', 'status.eq.parcial_red', 'status.eq.perda_total');
      }
      if (debouncedSelectedStatus.includes('aguardando')) {
        conditions.push('status.eq.aguardando');
      }
      
      if (conditions.length > 0) {
        query = query.or(conditions.join(','));
      }
    }

    if (debouncedStartDate) {
      query = query.gte('created_at', new Date(debouncedStartDate).toISOString());
    }

    if (debouncedEndDate) {
      const endOfDay = new Date(debouncedEndDate);
      endOfDay.setHours(23, 59, 59, 999);
      query = query.lte('created_at', endOfDay.toISOString());
    }

    const { data } = await query;

    if (data) {
      setAllArbitrages(data);
    }
  }, [isAdmin, user?.id, debouncedSelectedUser, debouncedSelectedStatus, debouncedStartDate, debouncedEndDate]);

  const handleExportExcel = () => {
    if (allArbitrages.length === 0) {
      return;
    }

    const exportData = allArbitrages.map((arb) => ({
      'Data Criação': format(new Date(arb.created_at), 'dd/MM/yyyy HH:mm'),
      'Data Evento': format(new Date(arb.data_evento), 'dd/MM/yyyy HH:mm'),
      'Descrição': arb.descricao,
      'Esporte/Liga': arb.esporte_liga || '-',
      'Usuário': formatUserName(arb.profiles?.name) || '-',
      'Casa 01': arb.casa_01_nome,
      'Casa 01 Mercado': arb.casa_01_mercado || '-',
      'Casa 01 Odd': arb.casa_01_odd,
      'Casa 01 Valor': arb.casa_01_valor,
      'Casa 01 Resultado': arb.casa_01_resultado || 'aguardando',
      'Casa 01 Valor Resultado': arb.casa_01_valor_resultado || 0,
      'Casa 02': arb.casa_02_nome,
      'Casa 02 Mercado': arb.casa_02_mercado || '-',
      'Casa 02 Odd': arb.casa_02_odd,
      'Casa 02 Valor': arb.casa_02_valor,
      'Casa 02 Resultado': arb.casa_02_resultado || 'aguardando',
      'Casa 02 Valor Resultado': arb.casa_02_valor_resultado || 0,
      'Casa 03': arb.casa_03_nome || '-',
      'Casa 03 Mercado': arb.casa_03_mercado || '-',
      'Casa 03 Odd': arb.casa_03_odd || 0,
      'Casa 03 Valor': arb.casa_03_valor || 0,
      'Casa 03 Resultado': arb.casa_03_resultado || '-',
      'Casa 03 Valor Resultado': arb.casa_03_valor_resultado || 0,
      'Porcentagem': arb.porcentagem,
      'Retorno Previsto': arb.retorno_previsto,
      'Lucro Projetado': arb.lucro_projetado,
      'Lucro Real': arb.lucro_real || 0,
      'Status': arb.status,
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Arbitragens');
    
    const fileName = `arbitragens_${format(new Date(), 'dd-MM-yyyy_HH-mm')}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

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
      .order('data_evento', { ascending: true })
      .limit(50);
    
    if (!isAdmin) {
      query = query.eq('user_id', user?.id);
    } else if (debouncedSelectedUser.length > 0) {
      query = query.in('user_id', debouncedSelectedUser);
    }

    if (debouncedStartDate) {
      query = query.gte('created_at', new Date(debouncedStartDate).toISOString());
    }

    if (debouncedEndDate) {
      const endOfDay = new Date(debouncedEndDate);
      endOfDay.setHours(23, 59, 59, 999);
      query = query.lte('created_at', endOfDay.toISOString());
    }

    const { data } = await query;

    if (data) {
      setOpenBets(data);
    }
  }, [isAdmin, user?.id, debouncedSelectedUser, debouncedStartDate, debouncedEndDate]);

  const loadCosts = useCallback(async () => {
    let query = supabase
      .from('operational_costs')
      .select('valor');
    
    if (!isAdmin) {
      query = query.eq('user_id', user?.id);
    } else if (debouncedSelectedUser.length > 0) {
      query = query.in('user_id', debouncedSelectedUser);
    }

    if (debouncedStartDate) {
      query = query.gte('data', debouncedStartDate);
    }

    if (debouncedEndDate) {
      query = query.lte('data', debouncedEndDate);
    }

    const { data } = await query;

    if (data) {
      const total = data.reduce((sum, cost) => sum + Number(cost.valor), 0);
      setTotalCosts(total);
    }
  }, [isAdmin, user?.id, debouncedSelectedUser, debouncedStartDate, debouncedEndDate]);

  // Contar filtros ativos
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (startDate) count++;
    if (endDate) count++;
    if (isAdmin && selectedUser.length > 0 && selectedUser.length < users.length) count++;
    if (!selectedStatus.includes('all')) count++;
    return count;
  }, [startDate, endDate, selectedUser, users.length, selectedStatus, isAdmin]);

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold">Dashboard</h1>
            {activeFiltersCount > 0 && (
              <>
                <Badge className="text-xs bg-yellow-400 text-black hover:bg-yellow-500">
                  {activeFiltersCount} filtro{activeFiltersCount > 1 ? 's' : ''} ativo{activeFiltersCount > 1 ? 's' : ''}
                </Badge>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setStartDate('');
                    setEndDate('');
                    setSelectedUser(users.map(u => u.id));
                    setSelectedStatus(['all']);
                  }}
                  className="h-8"
                >
                  <X className="h-4 w-4 mr-2" />
                  Limpar Filtros
                </Button>
              </>
            )}
          </div>
          
          <div className="flex items-center gap-2 flex-wrap">
            <div className="space-y-1">
              <Label className="text-xs">Data Início</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-40"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Data Fim</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-40"
              />
            </div>

            {isAdmin && (
              <div className="flex flex-col space-y-1">
                <Label className="text-xs">Operador</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-52 justify-between">
                      <span className="truncate">
                        {selectedUser.length === 0 
                          ? 'Todos os operadores' 
                          : selectedUser.length === users.length
                          ? 'Todos os operadores'
                          : `${selectedUser.length} operador(es)`
                        }
                      </span>
                      <Filter className="h-4 w-4 ml-2 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64 p-3 bg-background z-50" align="start">
                    <div className="space-y-3">
                      <div className="font-semibold text-sm">Filtrar por Operador</div>
                      <div className="flex items-center space-x-2 pb-2 border-b">
                        <Checkbox
                          id="select-all-dashboard"
                          checked={selectedUser.length === users.length}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedUser(users.map(u => u.id));
                            } else {
                              setSelectedUser([]);
                            }
                          }}
                        />
                        <label
                          htmlFor="select-all-dashboard"
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                        >
                          Selecionar Todos
                        </label>
                      </div>
                      <div className="space-y-2 max-h-60 overflow-y-auto">
                        {users.map((u) => (
                          <div key={u.id} className="flex items-center space-x-2">
                            <Checkbox
                              id={`dashboard-${u.id}`}
                              checked={selectedUser.includes(u.id)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setSelectedUser([...selectedUser, u.id]);
                                } else {
                                  setSelectedUser(selectedUser.filter(id => id !== u.id));
                                }
                              }}
                            />
                            <label
                              htmlFor={`dashboard-${u.id}`}
                              className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                            >
                              {formatUserName(u.name)}
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            )}

            <div className="flex flex-col space-y-1">
              <Label className="text-xs">Status</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-40 justify-between">
                    <span className="truncate">
                      {selectedStatus.includes('all') ? 'Todos' : `${selectedStatus.length} selecionado(s)`}
                    </span>
                    <Filter className="h-4 w-4 ml-2 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-3 bg-background z-50" align="start">
                  <div className="space-y-3">
                    <div className="font-semibold text-sm">Filtrar por Status</div>
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="dashboard-status-all"
                          checked={selectedStatus.includes('all')}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedStatus(['all']);
                            } else {
                              setSelectedStatus([]);
                            }
                          }}
                        />
                        <label htmlFor="dashboard-status-all" className="text-sm font-medium cursor-pointer">
                          Todos
                        </label>
                      </div>
                      {['aguardando', 'green', 'red'].map((status) => (
                        <div key={status} className="flex items-center space-x-2">
                          <Checkbox
                            id={`dashboard-status-${status}`}
                            checked={!selectedStatus.includes('all') && selectedStatus.includes(status)}
                            onCheckedChange={(checked) => {
                              if (selectedStatus.includes('all')) {
                                setSelectedStatus([status]);
                              } else {
                                if (checked) {
                                  const newStatus = [...selectedStatus, status];
                                  setSelectedStatus(newStatus);
                                } else {
                                  const filtered = selectedStatus.filter(s => s !== status);
                                  setSelectedStatus(filtered.length === 0 ? ['all'] : filtered);
                                }
                              }
                            }}
                          />
                          <label htmlFor={`dashboard-status-${status}`} className="text-sm cursor-pointer capitalize">
                            {status === 'aguardando' ? 'Aguardando' : status === 'green' ? 'Green' : 'Red'}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-1">
              <Label className="text-xs opacity-0">Ações</Label>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportExcel}
                disabled={allArbitrages.length === 0}
                className="h-10"
              >
                <Download className="h-4 w-4 mr-2" />
                Exportar Excel
              </Button>
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Arbitragens</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalArbitragens}</div>
              <p className="text-xs text-muted-foreground">arbitragens cadastradas</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Investido</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                R$ {formatCurrency(stats.totalInvestido)}
              </div>
              <p className="text-xs text-muted-foreground">em todas as casas</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Lucro Total</CardTitle>
              {stats.totalLucro >= 0 ? (
                <TrendingUp className="h-4 w-4 text-success" />
              ) : (
                <TrendingDown className="h-4 w-4 text-destructive" />
              )}
            </CardHeader>
            <CardContent>
              <div
                className={`text-2xl font-bold ${
                  stats.totalLucro >= 0 ? 'text-success' : 'text-destructive'
                }`}
              >
                R$ {formatCurrency(stats.totalLucro)}
              </div>
              <p className="text-xs text-muted-foreground">real + projetado</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">ROI</CardTitle>
              {stats.totalInvestido > 0 && (stats.totalLucro / stats.totalInvestido) >= 0 ? (
                <TrendingUp className="h-4 w-4 text-success" />
              ) : (
                <TrendingDown className="h-4 w-4 text-destructive" />
              )}
            </CardHeader>
            <CardContent>
              <div
                className={`text-2xl font-bold ${
                  stats.totalInvestido > 0 && (stats.totalLucro / stats.totalInvestido) >= 0 ? 'text-success' : 'text-destructive'
                }`}
              >
                {stats.totalInvestido > 0 ? formatCurrency((stats.totalLucro / stats.totalInvestido) * 100) : '0'}%
              </div>
              <p className="text-xs text-muted-foreground">retorno sobre investimento</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Custos Operacionais</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">
                R$ {formatCurrency(totalCosts)}
              </div>
              <p className="text-xs text-muted-foreground">período selecionado</p>
            </CardContent>
          </Card>
        </div>

        {openBets.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Apostas em Aberto ({openBets.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Descrição</TableHead>
                      <TableHead className="text-xs">Data Evento</TableHead>
                      {isAdmin && <TableHead className="text-xs">Usuário</TableHead>}
                      <TableHead className="text-xs">Casa 1</TableHead>
                      <TableHead className="text-xs">Casa 2</TableHead>
                      <TableHead className="text-xs">Casa 3</TableHead>
                      <TableHead className="text-right text-xs">Investido</TableHead>
                      <TableHead className="text-right text-xs">Lucro Proj.</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {openBets.map((bet) => (
                      <TableRow key={bet.id}>
                        <TableCell className="font-medium text-xs max-w-[150px] truncate">{bet.descricao}</TableCell>
                        <TableCell className={`text-xs ${
                          format(new Date(bet.data_evento), 'dd/MM/yy') === format(new Date(), 'dd/MM/yy')
                            ? 'border-l-4 border-sky-300 pl-2'
                            : ''
                        }`}>
                          {format(new Date(bet.data_evento), 'dd/MM/yy HH:mm')}
                        </TableCell>
                        {isAdmin && <TableCell className="text-xs">{formatUserName(bet.profiles?.name) || '-'}</TableCell>}
                        <TableCell className="text-xs">
                          <div>
                            <div className="font-medium">{bet.casa_01_nome}</div>
                            <div className="text-muted-foreground">
                              @{Number(bet.casa_01_odd).toFixed(3)} • R$ {formatCurrency(bet.casa_01_valor)}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs">
                          <div>
                            <div className="font-medium">{bet.casa_02_nome}</div>
                            <div className="text-muted-foreground">
                              @{Number(bet.casa_02_odd).toFixed(3)} • R$ {formatCurrency(bet.casa_02_valor)}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs">
                          {bet.casa_03_nome ? (
                            <div>
                              <div className="font-medium">{bet.casa_03_nome}</div>
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
                    ))}
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
