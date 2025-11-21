import { useEffect, useState } from 'react';
import { Layout } from '@/components/Layout';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { TrendingUp, TrendingDown, DollarSign, Target } from 'lucide-react';

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
  const [selectedUser, setSelectedUser] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [users, setUsers] = useState<Array<{ id: string; name: string }>>([]);

  const isAdmin = userRole?.role === 'admin' || userRole?.role === 'admin_master';

  useEffect(() => {
    loadStats();
    if (isAdmin) {
      loadUsers();
    }
  }, [selectedUser, selectedStatus, startDate, endDate, isAdmin]);

  const loadUsers = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, name')
      .order('name');
    
    if (data) {
      setUsers(data);
    }
  };

  const loadStats = async () => {
    let query = supabase.from('arbitrages').select('*');
    
    if (!isAdmin) {
      query = query.eq('user_id', user?.id);
    } else if (selectedUser !== 'all') {
      query = query.eq('user_id', selectedUser);
    }

    if (selectedStatus !== 'all') {
      query = query.eq('status', selectedStatus as any);
    }

    if (startDate) {
      query = query.gte('created_at', new Date(startDate).toISOString());
    }

    if (endDate) {
      const endOfDay = new Date(endDate);
      endOfDay.setHours(23, 59, 59, 999);
      query = query.lte('created_at', endOfDay.toISOString());
    }

    const { data } = await query;

    if (data) {
      const totalArbitragens = data.length;
      const totalInvestido = data.reduce(
        (sum, arb) => sum + Number(arb.casa_01_valor) + Number(arb.casa_02_valor),
        0
      );
      const totalLucro = data.reduce((sum, arb) => sum + Number(arb.lucro_real), 0);
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
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <h1 className="text-3xl font-bold">Dashboard</h1>
          
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
                <Select value={selectedUser} onValueChange={setSelectedUser}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {users.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-1">
              <Label className="text-xs">Status</Label>
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="aguardando">Aguardando</SelectItem>
                  <SelectItem value="green">Green</SelectItem>
                  <SelectItem value="red">Red</SelectItem>
                  <SelectItem value="parcial_green">Parcial Green</SelectItem>
                  <SelectItem value="parcial_red">Parcial Red</SelectItem>
                  <SelectItem value="perda_total">Perda Total</SelectItem>
                  <SelectItem value="devolvido">Devolvido</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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
                R$ {stats.totalInvestido.toFixed(2)}
              </div>
              <p className="text-xs text-muted-foreground">valor total apostado</p>
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
                R$ {stats.totalLucro.toFixed(2)}
              </div>
              <p className="text-xs text-muted-foreground">resultado líquido</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Taxa de Sucesso</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.taxaSucesso.toFixed(1)}%</div>
              <p className="text-xs text-muted-foreground">arbitragens positivas</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
