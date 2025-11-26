import { useEffect, useState, useCallback } from 'react';
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
import { Filter, X } from 'lucide-react';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { formatCurrency } from '@/lib/utils';

interface ChartData {
  date: string;
  lucro: number;
  investido: number;
  roi: number;
}

export default function Graficos() {
  const { userRole, user } = useAuth();
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [startDate, setStartDate] = useState(() => format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(() => format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const [selectedUser, setSelectedUser] = useState<string[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<string[]>(['all']);
  const [users, setUsers] = useState<Array<{ id: string; name: string }>>([]);
  const [groupBy, setGroupBy] = useState<'day' | 'week' | 'month'>('day');
  
  const debouncedStartDate = useDebounce(startDate, 300);
  const debouncedEndDate = useDebounce(endDate, 300);
  const debouncedSelectedUser = useDebounce(selectedUser, 300);
  const debouncedSelectedStatus = useDebounce(selectedStatus, 300);

  const isAdmin = userRole?.role === 'admin' || userRole?.role === 'admin_master';

  useEffect(() => {
    loadChartData();
    if (isAdmin) {
      loadUsers();
    }
  }, [debouncedSelectedUser, debouncedSelectedStatus, debouncedStartDate, debouncedEndDate, groupBy, isAdmin]);

  const loadUsers = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, name')
      .order('name');
    
    if (data) {
      setUsers(data);
      if (selectedUser.length === 0 && isAdmin) {
        setSelectedUser(data.map(u => u.id));
      }
    }
  };

  const loadChartData = useCallback(async () => {
    let query = supabase
      .from('arbitrages')
      .select('created_at, lucro_projetado, lucro_real, casa_01_valor, casa_02_valor, casa_03_valor, status');
    
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

    query = query.order('created_at', { ascending: true });

    const { data } = await query;

    if (data) {
      // Agrupar dados por período
      const groupedData = new Map<string, { lucro: number; investido: number }>();

      data.forEach((arb) => {
        const date = new Date(arb.created_at);
        let key: string;

        if (groupBy === 'day') {
          key = format(date, 'dd/MM/yyyy', { locale: ptBR });
        } else if (groupBy === 'week') {
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay());
          key = format(weekStart, 'dd/MM/yyyy', { locale: ptBR });
        } else {
          key = format(date, 'MM/yyyy', { locale: ptBR });
        }

        const lucro = arb.status === 'aguardando' ? Number(arb.lucro_projetado) : Number(arb.lucro_real);
        const investido = Number(arb.casa_01_valor) + Number(arb.casa_02_valor) + Number(arb.casa_03_valor || 0);

        if (!groupedData.has(key)) {
          groupedData.set(key, { lucro: 0, investido: 0 });
        }

        const current = groupedData.get(key)!;
        current.lucro += lucro;
        current.investido += investido;
      });

      // Converter para array e calcular ROI
      const chartArray: ChartData[] = Array.from(groupedData.entries()).map(([date, values]) => ({
        date,
        lucro: values.lucro,
        investido: values.investido,
        roi: values.investido > 0 ? (values.lucro / values.investido) * 100 : 0,
      }));

      setChartData(chartArray);
    }
  }, [isAdmin, user?.id, debouncedSelectedUser, debouncedSelectedStatus, debouncedStartDate, debouncedEndDate, groupBy]);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-background border rounded-lg p-3 shadow-lg">
          <p className="font-semibold mb-2">{payload[0].payload.date}</p>
          {payload.map((entry: any) => (
            <p key={entry.dataKey} style={{ color: entry.color }}>
              {entry.name}: {entry.dataKey === 'roi' ? `${formatCurrency(entry.value)}%` : `R$ ${formatCurrency(entry.value)}`}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <h1 className="text-3xl font-bold">Gráficos de Evolução</h1>
          
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
              <div className="space-y-1">
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
                          id="select-all-users"
                          checked={selectedUser.length === users.length}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedUser(users.map(u => u.id));
                            } else {
                              setSelectedUser([]);
                            }
                          }}
                        />
                        <label htmlFor="select-all-users" className="text-sm font-medium cursor-pointer">
                          Selecionar Todos
                        </label>
                      </div>
                      <div className="space-y-2 max-h-60 overflow-y-auto">
                        {users.map((u) => (
                          <div key={u.id} className="flex items-center space-x-2">
                            <Checkbox
                              id={`user-${u.id}`}
                              checked={selectedUser.includes(u.id)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setSelectedUser([...selectedUser, u.id]);
                                } else {
                                  setSelectedUser(selectedUser.filter(id => id !== u.id));
                                }
                              }}
                            />
                            <label htmlFor={`user-${u.id}`} className="text-sm cursor-pointer">
                              {u.name}
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            )}

            <div className="space-y-1">
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
                          id="status-all"
                          checked={selectedStatus.includes('all')}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedStatus(['all']);
                            }
                          }}
                        />
                        <label htmlFor="status-all" className="text-sm cursor-pointer">
                          Todos
                        </label>
                      </div>
                      {['aguardando', 'green', 'red'].map((status) => (
                        <div key={status} className="flex items-center space-x-2">
                          <Checkbox
                            id={`status-${status}`}
                            checked={selectedStatus.includes(status)}
                            disabled={selectedStatus.includes('all')}
                            onCheckedChange={(checked) => {
                              const newStatus = selectedStatus.filter(s => s !== 'all');
                              if (checked) {
                                setSelectedStatus([...newStatus, status]);
                              } else {
                                const filtered = newStatus.filter(s => s !== status);
                                setSelectedStatus(filtered.length === 0 ? ['all'] : filtered);
                              }
                            }}
                          />
                          <label htmlFor={`status-${status}`} className="text-sm cursor-pointer capitalize">
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
              <Label className="text-xs">Agrupar por</Label>
              <Select value={groupBy} onValueChange={(value: any) => setGroupBy(value)}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="day">Dia</SelectItem>
                  <SelectItem value="week">Semana</SelectItem>
                  <SelectItem value="month">Mês</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1 flex items-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setStartDate(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
                  setEndDate(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
                  setSelectedUser(users.map(u => u.id));
                  setSelectedStatus(['all']);
                  setGroupBy('day');
                }}
                className="h-10"
              >
                <X className="h-4 w-4 mr-2" />
                Limpar
              </Button>
            </div>
          </div>
        </div>

        {chartData.length === 0 ? (
          <Card>
            <CardContent className="flex items-center justify-center py-12">
              <p className="text-muted-foreground">Nenhum dado disponível para o período selecionado.</p>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Evolução do Lucro</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="date" className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="lucro" 
                      name="Lucro" 
                      stroke="hsl(var(--chart-1))" 
                      strokeWidth={2}
                      dot={{ fill: 'hsl(var(--chart-1))' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Evolução do ROI (%)</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="date" className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Bar 
                      dataKey="roi" 
                      name="ROI (%)" 
                      fill="hsl(var(--chart-2))"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Lucro vs Investimento</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="date" className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Bar dataKey="investido" name="Investido" fill="hsl(var(--chart-3))" />
                    <Bar dataKey="lucro" name="Lucro" fill="hsl(var(--chart-4))" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </Layout>
  );
}
