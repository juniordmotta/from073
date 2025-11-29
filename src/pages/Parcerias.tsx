import { useEffect, useState, useMemo } from 'react';
import { Layout } from '@/components/Layout';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Plus, Pencil, Trash2, History, TrendingUp, ArrowLeft, LayoutDashboard, Download, AlertTriangle, TrendingDown, DollarSign, Target, X, Building2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatCurrency, formatUserName } from '@/lib/utils';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import * as XLSX from 'xlsx';
import { CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { formatCpf, unformatCpf } from '@/hooks/useCpfFormat';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { MonthlyGoalCard } from '@/components/MonthlyGoalCard';
import { BanksDialog } from '@/components/BanksDialog';

interface Partnership {
  id: string;
  user_id: string;
  nome_completo: string;
  cpf: string;
  endereco: string;
  valor_banca: number;
  bancos_cadastrados: string;
  data_inicio: string;
  status: string;
  created_at: string;
  profiles?: {
    name: string;
    email: string;
  };
}

interface HistoryEntry {
  id: string;
  partnership_id: string;
  field_changed: string;
  old_value: string;
  new_value: string;
  changed_at: string;
  changed_by: string;
  partnerships?: {
    nome_completo: string;
  };
  profiles?: {
    name: string;
  };
}

interface ArbitrageResult {
  id: string;
  casa_01_parceria_id: string;
  casa_02_parceria_id: string;
  casa_03_parceria_id: string;
  lucro_real: number;
  status: string;
  created_at: string;
}

const fieldLabels: Record<string, string> = {
  nome_completo: 'Nome Completo',
  cpf: 'CPF',
  endereco: 'Endereço',
  valor_banca: 'Valor da Banca',
  bancos_cadastrados: 'Bancos Cadastrados',
  status: 'Status',
};

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

const Parcerias = () => {
  const { user, userRole } = useAuth();
  const { toast } = useToast();
  const [partnerships, setPartnerships] = useState<Partnership[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPartnership, setEditingPartnership] = useState<Partnership | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string>('all');
  const [users, setUsers] = useState<{ id: string; name: string; email: string }[]>([]);
  const [viewMode, setViewMode] = useState<'list' | 'history' | 'report' | 'dashboard'>('list');
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [arbitrages, setArbitrages] = useState<ArbitrageResult[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [selectedPartnershipId, setSelectedPartnershipId] = useState<string | null>(null);
  const [partnershipDetails, setPartnershipDetails] = useState<any>(null);
  const [banks, setBanks] = useState<Array<{ id: string; nome: string }>>([]);
  const [selectedBanks, setSelectedBanks] = useState<string[]>([]);
  const [isBanksDialogOpen, setIsBanksDialogOpen] = useState(false);

  const isAdmin = userRole?.role === 'admin' || userRole?.role === 'admin_master';

  const [formData, setFormData] = useState({
    nome_completo: '',
    cpf: '',
    endereco: '',
    valor_banca: '',
    bancos_cadastrados: '',
    data_inicio: format(new Date(), 'yyyy-MM-dd'),
    status: 'ativo',
  });

  useEffect(() => {
    console.log('useEffect disparado - isAdmin:', isAdmin, 'user:', user?.id);
    if (user) {
      fetchPartnerships();
      fetchBanks();
      if (isAdmin) {
        fetchUsers();
      }
    }
  }, [user, selectedUserId, isAdmin]);

  const fetchBanks = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('banks')
        .select('id, nome')
        .eq('user_id', user.id)
        .order('nome');

      if (error) throw error;
      setBanks(data || []);
    } catch (error) {
      console.error('Erro ao buscar bancos:', error);
    }
  };

  const fetchUsers = async () => {
    try {
      console.log('Buscando usuários...');
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, email')
        .order('name');

      if (error) {
        console.error('Erro ao buscar usuários:', error);
        throw error;
      }
      console.log('Usuários encontrados:', data);
      setUsers(data || []);
    } catch (error) {
      console.error('Erro ao buscar usuários:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar a lista de usuários',
        variant: 'destructive',
      });
    }
  };

  const fetchPartnerships = async () => {
    try {
      setLoading(true);
      console.log('isAdmin:', isAdmin, 'selectedUserId:', selectedUserId);
      
      let query = supabase
        .from('partnerships')
        .select('*')
        .order('created_at', { ascending: false });

      // Se for admin e tiver filtro específico, filtrar por usuário
      if (isAdmin && selectedUserId && selectedUserId !== 'all') {
        console.log('Filtrando por usuário:', selectedUserId);
        query = query.eq('user_id', selectedUserId);
      } else if (!isAdmin) {
        // Se não for admin, só mostrar suas próprias parcerias
        console.log('Não é admin, mostrando apenas parcerias do usuário:', user?.id);
        query = query.eq('user_id', user?.id);
      } else {
        console.log('Admin sem filtro - mostrando todas as parcerias');
      }

      const { data, error } = await query;

      if (error) throw error;

      console.log('Parcerias encontradas:', data?.length);

      // Buscar os perfis dos usuários separadamente se for admin
      if (isAdmin && data && data.length > 0) {
        const userIds = [...new Set(data.map(p => p.user_id))];
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, name, email')
          .in('id', userIds);

        const profilesMap = new Map(profilesData?.map(p => [p.id, p]) || []);
        
        const partnershipsWithProfiles = data.map(p => ({
          ...p,
          profiles: profilesMap.get(p.user_id),
        }));
        
        setPartnerships(partnershipsWithProfiles as Partnership[]);
      } else {
        setPartnerships(data || []);
      }
    } catch (error) {
      console.error('Erro ao buscar parcerias:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar as parcerias',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const clearFilters = () => {
    setSelectedUserId('all');
  };

  // Contar filtros ativos
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (isAdmin && selectedUserId !== 'all') count++;
    return count;
  }, [selectedUserId, isAdmin]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const filteredBanks = selectedBanks.filter(b => b && b.trim() !== '' && b.toLowerCase() !== 'não informado');
      
      const partnershipData = {
        nome_completo: formData.nome_completo,
        cpf: unformatCpf(formData.cpf),
        endereco: formData.endereco,
        valor_banca: parseFloat(formData.valor_banca),
        bancos_cadastrados: filteredBanks.length > 0 ? filteredBanks.join(', ') : 'Não informado',
        data_inicio: formData.data_inicio,
        status: formData.status,
        user_id: user?.id,
      };

      if (editingPartnership) {
        const { error } = await supabase
          .from('partnerships')
          .update(partnershipData)
          .eq('id', editingPartnership.id);

        if (error) throw error;

        toast({
          title: 'Sucesso',
          description: 'Parceria atualizada com sucesso',
        });
      } else {
        const { error } = await supabase
          .from('partnerships')
          .insert([partnershipData]);

        if (error) throw error;

        toast({
          title: 'Sucesso',
          description: 'Parceria criada com sucesso',
        });
      }

      setIsDialogOpen(false);
      resetForm();
      fetchPartnerships();
    } catch (error) {
      console.error('Erro ao salvar parceria:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível salvar a parceria',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta parceria?')) return;

    try {
      const { error } = await supabase
        .from('partnerships')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Sucesso',
        description: 'Parceria excluída com sucesso',
      });

      fetchPartnerships();
    } catch (error) {
      console.error('Erro ao excluir parceria:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível excluir a parceria',
        variant: 'destructive',
      });
    }
  };

  const openEditDialog = (partnership: Partnership) => {
    setEditingPartnership(partnership);
    const banksArray = partnership.bancos_cadastrados
      .split(', ')
      .filter(b => b && b.trim() !== '' && b.toLowerCase() !== 'não informado');
    setSelectedBanks(banksArray);
    setFormData({
      nome_completo: partnership.nome_completo,
      cpf: formatCpf(partnership.cpf),
      endereco: partnership.endereco,
      valor_banca: partnership.valor_banca.toString(),
      bancos_cadastrados: partnership.bancos_cadastrados,
      data_inicio: partnership.data_inicio,
      status: partnership.status,
    });
    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setEditingPartnership(null);
    setSelectedBanks([]);
    setFormData({
      nome_completo: '',
      cpf: '',
      endereco: '',
      valor_banca: '',
      bancos_cadastrados: '',
      data_inicio: format(new Date(), 'yyyy-MM-dd'),
      status: 'ativo',
    });
  };

  const loadHistory = async () => {
    try {
      setLoadingData(true);
      let query = supabase
        .from('partnerships_history')
        .select('*')
        .order('changed_at', { ascending: false });

      if (!isAdmin) {
        query = query.eq('user_id', user?.id);
      } else if (selectedUserId && selectedUserId !== 'all') {
        query = query.eq('user_id', selectedUserId);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Buscar dados adicionais separadamente
      if (data && data.length > 0) {
        const partnershipIds = [...new Set(data.map(h => h.partnership_id))];
        const changedByIds = [...new Set(data.map(h => h.changed_by))];

        const { data: partnershipsData } = await supabase
          .from('partnerships')
          .select('id, nome_completo')
          .in('id', partnershipIds);

        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, name')
          .in('id', changedByIds);

        const partnershipsMap = new Map(partnershipsData?.map(p => [p.id, p]) || []);
        const profilesMap = new Map(profilesData?.map(p => [p.id, p]) || []);

        const historyWithDetails = data.map(h => ({
          ...h,
          partnerships: partnershipsMap.get(h.partnership_id),
          profiles: profilesMap.get(h.changed_by),
        }));

        setHistory(historyWithDetails as HistoryEntry[]);
      } else {
        setHistory([]);
      }
    } catch (error) {
      console.error('Erro ao carregar histórico:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar o histórico',
        variant: 'destructive',
      });
    } finally {
      setLoadingData(false);
    }
  };

  const loadArbitragesData = async () => {
    try {
      setLoadingData(true);
      let query = supabase
        .from('arbitrages')
        .select('id, casa_01_parceria_id, casa_02_parceria_id, casa_03_parceria_id, lucro_real, status, created_at, user_id');

      if (!isAdmin) {
        query = query.eq('user_id', user?.id);
      } else if (selectedUserId && selectedUserId !== 'all') {
        query = query.eq('user_id', selectedUserId);
      }

      const { data, error } = await query;

      if (error) throw error;
      setArbitrages(data || []);
    } catch (error) {
      console.error('Erro ao carregar arbitragens:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar os dados de arbitragens',
        variant: 'destructive',
      });
    } finally {
      setLoadingData(false);
    }
  };

  const reportData = useMemo(() => {
    if (!arbitrages.length || !partnerships.length) return [];

    const partnershipStats = partnerships.map(partnership => {
      const relatedArbitrages = arbitrages.filter(arb => 
        arb.casa_01_parceria_id === partnership.id ||
        arb.casa_02_parceria_id === partnership.id ||
        arb.casa_03_parceria_id === partnership.id
      );

      const totalArbitrages = relatedArbitrages.length;
      const closedArbitrages = relatedArbitrages.filter(arb => arb.status !== 'aguardando');
      const totalLucro = closedArbitrages.reduce((sum, arb) => sum + (arb.lucro_real || 0), 0);
      const greenCount = closedArbitrages.filter(arb => 
        arb.status === 'green' || arb.status === 'parcial_green' || arb.status === 'devolvido'
      ).length;
      const redCount = closedArbitrages.filter(arb => 
        arb.status === 'red' || arb.status === 'parcial_red' || arb.status === 'perda_total'
      ).length;

      return {
        id: partnership.id,
        nome: partnership.nome_completo,
        totalArbitrages,
        totalLucro,
        greenCount,
        redCount,
        roi: partnership.valor_banca > 0 ? (totalLucro / partnership.valor_banca) * 100 : 0,
      };
    });

    return partnershipStats;
  }, [arbitrages, partnerships]);

  const handleViewHistory = () => {
    setViewMode('history');
    loadHistory();
  };

  const handleViewReport = () => {
    setViewMode('report');
    loadArbitragesData();
  };

  const handleBackToList = () => {
    setViewMode('list');
    setHistory([]);
    setArbitrages([]);
  };

  const handleViewDashboard = () => {
    setViewMode('dashboard');
    loadArbitragesData();
  };

  const loadPartnershipDetails = async (partnershipId: string) => {
    setLoadingData(true);
    try {
      // Buscar dados da parceria
      const { data: partnership, error: partnershipError } = await supabase
        .from('partnerships')
        .select('*')
        .eq('id', partnershipId)
        .single();

      if (partnershipError) throw partnershipError;

      // Buscar arbitragens relacionadas
      const { data: arbs, error: arbsError } = await supabase
        .from('arbitrages')
        .select('*')
        .or(`casa_01_parceria_id.eq.${partnershipId},casa_02_parceria_id.eq.${partnershipId},casa_03_parceria_id.eq.${partnershipId}`);

      if (arbsError) throw arbsError;

      // Buscar custos operacionais do mês atual
      const firstDayOfMonth = new Date();
      firstDayOfMonth.setDate(1);
      const lastDayOfMonth = new Date(firstDayOfMonth.getFullYear(), firstDayOfMonth.getMonth() + 1, 0);

      const { data: costs, error: costsError } = await supabase
        .from('operational_costs')
        .select('*')
        .eq('user_id', partnership.user_id)
        .gte('data', format(firstDayOfMonth, 'yyyy-MM-dd'))
        .lte('data', format(lastDayOfMonth, 'yyyy-MM-dd'));

      if (costsError) throw costsError;

      // Calcular estatísticas por casa
      const casasStats = new Map();

      arbs?.forEach((arb: any) => {
        // Casa 01
        if (arb.casa_01_parceria_id === partnershipId) {
          if (!casasStats.has(arb.casa_01_nome)) {
            casasStats.set(arb.casa_01_nome, {
              nome: arb.casa_01_nome,
              ganhos: 0,
              perdas: 0,
              devolvidos: 0,
              aguardando: 0,
              totalApostas: 0,
            });
          }
          const stats = casasStats.get(arb.casa_01_nome);
          stats.totalApostas++;
          
          if (arb.casa_01_resultado === 'green' || arb.casa_01_resultado === 'parcial_green') {
            stats.ganhos += arb.casa_01_valor_resultado || 0;
          } else if (arb.casa_01_resultado === 'red' || arb.casa_01_resultado === 'parcial_red' || arb.casa_01_resultado === 'perda_total') {
            stats.perdas += arb.casa_01_valor || 0;
          } else if (arb.casa_01_resultado === 'devolvido') {
            stats.devolvidos++;
          } else if (arb.casa_01_resultado === 'aguardando') {
            stats.aguardando++;
          }
        }

        // Casa 02
        if (arb.casa_02_parceria_id === partnershipId) {
          if (!casasStats.has(arb.casa_02_nome)) {
            casasStats.set(arb.casa_02_nome, {
              nome: arb.casa_02_nome,
              ganhos: 0,
              perdas: 0,
              devolvidos: 0,
              aguardando: 0,
              totalApostas: 0,
            });
          }
          const stats = casasStats.get(arb.casa_02_nome);
          stats.totalApostas++;
          
          if (arb.casa_02_resultado === 'green' || arb.casa_02_resultado === 'parcial_green') {
            stats.ganhos += arb.casa_02_valor_resultado || 0;
          } else if (arb.casa_02_resultado === 'red' || arb.casa_02_resultado === 'parcial_red' || arb.casa_02_resultado === 'perda_total') {
            stats.perdas += arb.casa_02_valor || 0;
          } else if (arb.casa_02_resultado === 'devolvido') {
            stats.devolvidos++;
          } else if (arb.casa_02_resultado === 'aguardando') {
            stats.aguardando++;
          }
        }

        // Casa 03
        if (arb.casa_03_parceria_id === partnershipId && arb.casa_03_nome) {
          if (!casasStats.has(arb.casa_03_nome)) {
            casasStats.set(arb.casa_03_nome, {
              nome: arb.casa_03_nome,
              ganhos: 0,
              perdas: 0,
              devolvidos: 0,
              aguardando: 0,
              totalApostas: 0,
            });
          }
          const stats = casasStats.get(arb.casa_03_nome);
          stats.totalApostas++;
          
          if (arb.casa_03_resultado === 'green' || arb.casa_03_resultado === 'parcial_green') {
            stats.ganhos += arb.casa_03_valor_resultado || 0;
          } else if (arb.casa_03_resultado === 'red' || arb.casa_03_resultado === 'parcial_red' || arb.casa_03_resultado === 'perda_total') {
            stats.perdas += arb.casa_03_valor || 0;
          } else if (arb.casa_03_resultado === 'devolvido') {
            stats.devolvidos++;
          } else if (arb.casa_03_resultado === 'aguardando') {
            stats.aguardando++;
          }
        }
      });

      // Calcular lucro líquido por casa
      const casasArray = Array.from(casasStats.values()).map(casa => ({
        ...casa,
        lucroLiquido: casa.ganhos - casa.perdas,
      }));

      // Calcular totais
      const totalCustos = costs?.reduce((sum, cost) => sum + Number(cost.valor), 0) || 0;
      const lucroBruto = arbs?.reduce((sum, arb) => {
        if (arb.status === 'aguardando') return sum;
        return sum + (arb.lucro_real || 0);
      }, 0) || 0;
      const lucroLiquido = lucroBruto - totalCustos;

      setPartnershipDetails({
        partnership,
        custosMes: totalCustos,
        lucroBruto,
        lucroLiquido,
        casas: casasArray,
        totalArbitragens: arbs?.length || 0,
      });
    } catch (error) {
      console.error('Erro ao carregar detalhes da parceria:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar os detalhes da parceria',
        variant: 'destructive',
      });
    } finally {
      setLoadingData(false);
    }
  };

  const handlePartnershipClick = (partnershipId: string) => {
    setSelectedPartnershipId(partnershipId);
    loadPartnershipDetails(partnershipId);
  };

  const handleBackToReport = () => {
    setSelectedPartnershipId(null);
    setPartnershipDetails(null);
  };

  const handleExportReport = () => {
    if (reportData.length === 0) {
      toast({
        title: 'Aviso',
        description: 'Nenhum dado disponível para exportar',
        variant: 'destructive',
      });
      return;
    }

    const exportData = reportData.map((data) => ({
      'Parceria': data.nome,
      'Total de Apostas': data.totalArbitrages,
      'Apostas Green': data.greenCount,
      'Apostas Red': data.redCount,
      'Lucro Total (R$)': data.totalLucro,
      'ROI (%)': data.roi.toFixed(2),
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Relatório de Lucro');
    
    const fileName = `relatorio_parcerias_${format(new Date(), 'dd-MM-yyyy_HH-mm')}.xlsx`;
    XLSX.writeFile(wb, fileName);

    toast({
      title: 'Sucesso',
      description: 'Relatório exportado com sucesso',
    });
  };

  // Métricas consolidadas para o dashboard
  const dashboardMetrics = useMemo(() => {
    if (partnerships.length === 0 || arbitrages.length === 0) {
      return null;
    }

    const activePartnerships = partnerships.filter(p => p.status === 'ativo');
    const inactivePartnerships = partnerships.filter(p => p.status === 'inativo');
    const totalBanca = partnerships.reduce((sum, p) => sum + Number(p.valor_banca), 0);

    // Calcular métricas de apostas
    const partnershipStats = new Map();
    
    partnerships.forEach(partnership => {
      const partnershipArbitrages = arbitrages.filter(
        arb => arb.casa_01_parceria_id === partnership.id || 
               arb.casa_02_parceria_id === partnership.id || 
               arb.casa_03_parceria_id === partnership.id
      );

      const totalLucro = partnershipArbitrages.reduce((sum, arb) => {
        const lucro = arb.status === 'aguardando' ? 0 : (arb.lucro_real || 0);
        return sum + Number(lucro);
      }, 0);

      const greenCount = partnershipArbitrages.filter(
        arb => arb.status === 'green' || arb.status === 'parcial_green'
      ).length;

      partnershipStats.set(partnership.id, {
        nome: partnership.nome_completo,
        totalArbitrages: partnershipArbitrages.length,
        totalLucro,
        greenCount,
      });
    });

    // Identificar alertas
    const alerts = [];
    
    // Alerta: Parcerias com performance negativa
    Array.from(partnershipStats.entries()).forEach(([id, stats]) => {
      if (stats.totalLucro < -100 && stats.totalArbitrages > 5) {
        alerts.push({
          type: 'negative_performance',
          severity: 'high',
          message: `${formatUserName(stats.nome)} está com lucro negativo de R$ ${formatCurrency(Math.abs(stats.totalLucro))}`,
        });
      }
    });

    // Alerta: Parcerias sem apostas recentes (últimos 30 dias)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    activePartnerships.forEach(partnership => {
      const recentArbitrages = arbitrages.filter(
        arb => (arb.casa_01_parceria_id === partnership.id || 
                arb.casa_02_parceria_id === partnership.id || 
                arb.casa_03_parceria_id === partnership.id) &&
               new Date(arb.created_at) >= thirtyDaysAgo
      );

      if (recentArbitrages.length === 0) {
        alerts.push({
          type: 'no_recent_activity',
          severity: 'medium',
          message: `${formatUserName(partnership.nome_completo)} não possui apostas nos últimos 30 dias`,
        });
      }
    });

    // Alerta: Parcerias com baixa taxa de sucesso
    Array.from(partnershipStats.entries()).forEach(([id, stats]) => {
      if (stats.totalArbitrages >= 10) {
        const successRate = (stats.greenCount / stats.totalArbitrages) * 100;
        if (successRate < 50) {
          alerts.push({
            type: 'low_success_rate',
            severity: 'medium',
            message: `${formatUserName(stats.nome)} tem taxa de sucesso baixa (${successRate.toFixed(1)}%)`,
          });
        }
      }
    });

    return {
      totalPartnerships: partnerships.length,
      activePartnerships: activePartnerships.length,
      inactivePartnerships: inactivePartnerships.length,
      totalBanca,
      totalArbitrages: arbitrages.length,
      alerts,
      partnershipStats: Array.from(partnershipStats.values()),
    };
  }, [partnerships, arbitrages]);

  return (
    <Layout>
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <h1 className="text-3xl font-bold">Parcerias</h1>
            {activeFiltersCount > 0 && (
              <>
                <Badge className="text-xs bg-yellow-400 text-black hover:bg-yellow-500">
                  {activeFiltersCount} filtro{activeFiltersCount > 1 ? 's' : ''} ativo{activeFiltersCount > 1 ? 's' : ''}
                </Badge>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearFilters}
                  className="h-8"
                >
                  <X className="h-4 w-4 mr-2" />
                  Limpar Filtros
                </Button>
              </>
            )}
            {viewMode !== 'list' && (
              <Button variant="outline" onClick={handleBackToList}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar
              </Button>
            )}
          </div>
          {viewMode === 'list' && (
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={() => setIsBanksDialogOpen(true)}
              >
                <Building2 className="h-4 w-4 mr-2" />
                Bancos
              </Button>
              <Button variant="outline" onClick={handleViewDashboard}>
                <LayoutDashboard className="h-4 w-4 mr-2" />
                Dashboard
              </Button>
              <Button variant="outline" onClick={handleViewHistory}>
                <History className="h-4 w-4 mr-2" />
                Histórico de Alterações
              </Button>
              <Button variant="outline" onClick={handleViewReport}>
                <TrendingUp className="h-4 w-4 mr-2" />
                Relatório de Lucro
              </Button>
              <Dialog open={isDialogOpen} onOpenChange={(open) => {
                setIsDialogOpen(open);
                if (!open) resetForm();
              }}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Nova Parceria
                  </Button>
                </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>
                  {editingPartnership ? 'Editar Parceria' : 'Nova Parceria'}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="nome_completo">Nome Completo</Label>
                    <Input
                      id="nome_completo"
                      value={formData.nome_completo}
                      onChange={(e) => setFormData({ ...formData, nome_completo: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cpf">CPF *</Label>
                    <Input
                      id="cpf"
                      value={formData.cpf}
                      onChange={(e) => {
                        const formatted = formatCpf(e.target.value);
                        setFormData({ ...formData, cpf: formatted });
                      }}
                      placeholder="000.000.000-00"
                      maxLength={14}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="endereco">Endereço</Label>
                  <Input
                    id="endereco"
                    value={formData.endereco}
                    onChange={(e) => setFormData({ ...formData, endereco: e.target.value })}
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="valor_banca">Valor da Banca</Label>
                    <Input
                      id="valor_banca"
                      type="number"
                      step="0.01"
                      value={formData.valor_banca}
                      onChange={(e) => setFormData({ ...formData, valor_banca: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bancos_cadastrados">Bancos Cadastrados *</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className="w-full justify-between"
                          type="button"
                        >
                          {selectedBanks.length === 0
                            ? 'Selecionar bancos'
                            : selectedBanks.join(', ')}
                          {selectedBanks.length > 0 && (
                            <X
                              className="ml-2 h-4 w-4 opacity-50"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedBanks([]);
                              }}
                            />
                          )}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-full p-4 bg-popover z-50" align="start">
                        <div className="space-y-2">
                          {banks.length === 0 ? (
                            <div className="space-y-2">
                              <p className="text-sm text-muted-foreground">
                                Nenhum banco cadastrado.
                              </p>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setIsBanksDialogOpen(true);
                                }}
                                type="button"
                              >
                                <Plus className="mr-2 h-4 w-4" />
                                Adicionar Banco
                              </Button>
                            </div>
                          ) : (
                            banks.map((bank) => (
                              <div key={bank.id} className="flex items-center space-x-2">
                                <Checkbox
                                  id={bank.id}
                                  checked={selectedBanks.includes(bank.nome)}
                                  onCheckedChange={() => {
                                    const newSelectedBanks = selectedBanks.includes(bank.nome)
                                      ? selectedBanks.filter((b) => b !== bank.nome)
                                      : [...selectedBanks, bank.nome];
                                    
                                    // Remover "Não informado" quando selecionar qualquer banco
                                    const filteredBanks = newSelectedBanks.filter(
                                      b => b.toLowerCase() !== 'não informado'
                                    );
                                    
                                    setSelectedBanks(filteredBanks);
                                  }}
                                />
                                <label
                                  htmlFor={bank.id}
                                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                                >
                                  {bank.nome}
                                </label>
                              </div>
                            ))
                          )}
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="data_inicio">Data de Início</Label>
                    <Input
                      id="data_inicio"
                      type="date"
                      value={formData.data_inicio}
                      onChange={(e) => setFormData({ ...formData, data_inicio: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="status">Status</Label>
                    <Select
                      value={formData.status}
                      onValueChange={(value) => setFormData({ ...formData, status: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ativo">Ativo</SelectItem>
                        <SelectItem value="inativo">Inativo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit">
                    {editingPartnership ? 'Atualizar' : 'Criar'}
                  </Button>
                </div>
              </form>
            </DialogContent>
              </Dialog>
            </div>
          )}
        </div>

        {viewMode === 'list' && isAdmin && (
          <div className="space-y-2">
            <div className="flex gap-4 items-end">
              <div className="space-y-2 flex-1">
                <Label htmlFor="user-filter">
                  Filtrar por Usuário
                </Label>
                <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos os usuários" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os usuários</SelectItem>
                    {users.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {formatUserName(user.name)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {users.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Carregando usuários...
              </p>
            )}
          </div>
        )}

        {viewMode === 'list' && (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  {isAdmin && <TableHead>Usuário</TableHead>}
                  <TableHead>Nome Completo</TableHead>
                  <TableHead>CPF</TableHead>
                  <TableHead>Endereço</TableHead>
                  <TableHead>Valor da Banca</TableHead>
                  <TableHead>Bancos</TableHead>
                  <TableHead>Data Início</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={isAdmin ? 9 : 8} className="text-center py-8">
                      Carregando...
                    </TableCell>
                  </TableRow>
                ) : partnerships.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={isAdmin ? 9 : 8} className="text-center py-8">
                      Nenhuma parceria encontrada
                    </TableCell>
                  </TableRow>
                ) : (
                  partnerships.map((partnership) => (
                    <TableRow key={partnership.id}>
                      {isAdmin && (
                        <TableCell>
                          {formatUserName(partnership.profiles?.name) || partnership.profiles?.email}
                        </TableCell>
                      )}
                      <TableCell>{formatUserName(partnership.nome_completo)}</TableCell>
                      <TableCell>{formatCpf(partnership.cpf)}</TableCell>
                      <TableCell className="max-w-xs truncate">{partnership.endereco}</TableCell>
                      <TableCell>R$ {formatCurrency(partnership.valor_banca)}</TableCell>
                      <TableCell>{partnership.bancos_cadastrados}</TableCell>
                      <TableCell>
                        {format(new Date(partnership.data_inicio), 'dd/MM/yyyy', { locale: ptBR })}
                      </TableCell>
                      <TableCell>
                        <Badge variant={partnership.status === 'ativo' ? 'default' : 'secondary'}>
                          {partnership.status === 'ativo' ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditDialog(partnership)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(partnership.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}

        {viewMode === 'history' && (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold">Histórico de Alterações</h2>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data/Hora</TableHead>
                    <TableHead>Parceria</TableHead>
                    <TableHead>Campo Alterado</TableHead>
                    <TableHead>Valor Anterior</TableHead>
                    <TableHead>Valor Novo</TableHead>
                    <TableHead>Alterado por</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingData ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8">
                        Carregando histórico...
                      </TableCell>
                    </TableRow>
                  ) : history.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8">
                        Nenhuma alteração registrada
                      </TableCell>
                    </TableRow>
                  ) : (
                    history.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell>
                          {format(new Date(entry.changed_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                        </TableCell>
                        <TableCell>{formatUserName(entry.partnerships?.nome_completo) || 'N/A'}</TableCell>
                        <TableCell>{fieldLabels[entry.field_changed] || entry.field_changed}</TableCell>
                        <TableCell className="max-w-xs truncate">
                          {entry.field_changed === 'valor_banca' 
                            ? `R$ ${formatCurrency(parseFloat(entry.old_value))}` 
                            : entry.field_changed === 'cpf'
                            ? formatCpf(entry.old_value)
                            : entry.old_value}
                        </TableCell>
                        <TableCell className="max-w-xs truncate">
                          {entry.field_changed === 'valor_banca' 
                            ? `R$ ${formatCurrency(parseFloat(entry.new_value))}` 
                            : entry.field_changed === 'cpf'
                            ? formatCpf(entry.new_value)
                            : entry.new_value}
                        </TableCell>
                        <TableCell>{formatUserName(entry.profiles?.name) || 'Sistema'}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {viewMode === 'report' && (
          <div className="space-y-6">
            {!selectedPartnershipId ? (
              <>
                <div className="flex justify-between items-center">
                  <h2 className="text-2xl font-bold">Relatório de Lucro por Parceria</h2>
                  {reportData.length > 0 && (
                    <Button onClick={handleExportReport} variant="outline">
                      <Download className="h-4 w-4 mr-2" />
                      Exportar Excel
                    </Button>
                  )}
                </div>
                
                {loadingData ? (
                  <div className="text-center py-8">Carregando relatório...</div>
                ) : reportData.length === 0 ? (
                  <div className="text-center py-8">Nenhum dado disponível para gerar relatório</div>
                ) : (
                  <>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                      {reportData.map((data) => (
                        <Card 
                          key={data.id} 
                          className="p-4 cursor-pointer hover:shadow-lg transition-shadow"
                          onClick={() => handlePartnershipClick(data.id)}
                        >
                          <h3 className="font-semibold text-sm mb-2 truncate">{formatUserName(data.nome)}</h3>
                          <div className="space-y-1 text-sm">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Total Apostas:</span>
                              <span className="font-medium">{data.totalArbitrages}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Lucro Total:</span>
                              <span className={`font-medium ${data.totalLucro >= 0 ? 'text-success' : 'text-destructive'}`}>
                                R$ {formatCurrency(data.totalLucro)}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">ROI:</span>
                              <span className={`font-medium ${data.roi >= 0 ? 'text-success' : 'text-destructive'}`}>
                                {data.roi.toFixed(2)}%
                              </span>
                            </div>
                            <div className="flex justify-between text-xs pt-1 border-t">
                              <span className="text-success">Green: {data.greenCount}</span>
                              <span className="text-destructive">Red: {data.redCount}</span>
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>

                    <div className="grid gap-6 md:grid-cols-2">
                      <Card className="p-6">
                        <h3 className="text-lg font-semibold mb-4">Lucro por Parceria</h3>
                        <ResponsiveContainer width="100%" height={300}>
                          <BarChart data={reportData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="nome" angle={-45} textAnchor="end" height={100} tickFormatter={formatUserName} />
                            <YAxis />
                            <Tooltip formatter={(value: number) => `R$ ${formatCurrency(value)}`} />
                            <Legend />
                            <Bar dataKey="totalLucro" fill="#8884d8" name="Lucro Total (R$)" />
                          </BarChart>
                        </ResponsiveContainer>
                      </Card>
                      
                      <Card className="p-6">
                        <h3 className="text-lg font-semibold mb-4">Distribuição de Resultados</h3>
                        <ResponsiveContainer width="100%" height={300}>
                          <PieChart>
                            <Pie
                              data={reportData}
                              dataKey="totalArbitrages"
                              nameKey="nome"
                              cx="50%"
                              cy="50%"
                              outerRadius={100}
                              label={(entry) => formatUserName(entry.nome)}
                            >
                              {reportData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip />
                            <Legend />
                          </PieChart>
                        </ResponsiveContainer>
                      </Card>
                    </div>
                  </>
                )}
              </>
            ) : (
              // Visualização detalhada da parceria
              <div className="space-y-6">
                <div className="flex items-center gap-4">
                  <Button variant="outline" onClick={handleBackToReport}>
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Voltar
                  </Button>
                  <h2 className="text-2xl font-bold">
                    {partnershipDetails ? formatUserName(partnershipDetails.partnership.nome_completo) : 'Carregando...'}
                  </h2>
                </div>

                {loadingData ? (
                  <div className="text-center py-8">Carregando detalhes...</div>
                ) : partnershipDetails ? (
                  <>
                    {/* Métricas principais */}
                    <div className="grid gap-4 md:grid-cols-4">
                      <Card className="p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <DollarSign className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">Custos do Mês</span>
                        </div>
                        <p className="text-2xl font-bold text-destructive">
                          R$ {formatCurrency(partnershipDetails.custosMes)}
                        </p>
                      </Card>

                      <Card className="p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <TrendingUp className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">Lucro Bruto</span>
                        </div>
                        <p className={`text-2xl font-bold ${partnershipDetails.lucroBruto >= 0 ? 'text-success' : 'text-destructive'}`}>
                          R$ {formatCurrency(partnershipDetails.lucroBruto)}
                        </p>
                      </Card>

                      <Card className="p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Target className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">Lucro Líquido</span>
                        </div>
                        <p className={`text-2xl font-bold ${partnershipDetails.lucroLiquido >= 0 ? 'text-success' : 'text-destructive'}`}>
                          R$ {formatCurrency(partnershipDetails.lucroLiquido)}
                        </p>
                      </Card>

                      <Card className="p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <LayoutDashboard className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">Total Apostas</span>
                        </div>
                        <p className="text-2xl font-bold">
                          {partnershipDetails.totalArbitragens}
                        </p>
                      </Card>
                    </div>

                    {/* Tabela de casas */}
                    <Card className="p-6">
                      <h3 className="text-lg font-semibold mb-4">Desempenho por Casa de Apostas</h3>
                      {partnershipDetails.casas.length === 0 ? (
                        <p className="text-center text-muted-foreground py-4">
                          Nenhuma aposta registrada para esta parceria
                        </p>
                      ) : (
                        <div className="rounded-md border">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Casa</TableHead>
                                <TableHead className="text-right">Total Apostas</TableHead>
                                <TableHead className="text-right">Ganhos</TableHead>
                                <TableHead className="text-right">Perdas</TableHead>
                                <TableHead className="text-right">Devolvidos</TableHead>
                                <TableHead className="text-right">Aguardando</TableHead>
                                <TableHead className="text-right">Lucro Líquido</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {partnershipDetails.casas.map((casa: any, index: number) => (
                                <TableRow key={index}>
                                  <TableCell className="font-medium">{casa.nome}</TableCell>
                                  <TableCell className="text-right">{casa.totalApostas}</TableCell>
                                  <TableCell className="text-right text-success">
                                    R$ {formatCurrency(casa.ganhos)}
                                  </TableCell>
                                  <TableCell className="text-right text-destructive">
                                    R$ {formatCurrency(casa.perdas)}
                                  </TableCell>
                                  <TableCell className="text-right">{casa.devolvidos}</TableCell>
                                  <TableCell className="text-right text-muted-foreground">{casa.aguardando}</TableCell>
                                  <TableCell className={`text-right font-semibold ${casa.lucroLiquido >= 0 ? 'text-success' : 'text-destructive'}`}>
                                    R$ {formatCurrency(casa.lucroLiquido)}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </Card>
                  </>
                ) : null}
              </div>
            )}
          </div>
        )}

        {viewMode === 'dashboard' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold">Dashboard - Visão Geral das Parcerias</h2>
            
            {loadingData ? (
              <div className="text-center py-8">Carregando dashboard...</div>
            ) : !dashboardMetrics ? (
              <div className="text-center py-8">Nenhum dado disponível para gerar dashboard</div>
            ) : (
              <>
                {/* Métricas Principais */}
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Total Parcerias</CardTitle>
                      <LayoutDashboard className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{dashboardMetrics.totalPartnerships}</div>
                      <p className="text-xs text-muted-foreground">
                        {dashboardMetrics.activePartnerships} ativas
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Parcerias Ativas</CardTitle>
                      <TrendingUp className="h-4 w-4 text-success" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-success">{dashboardMetrics.activePartnerships}</div>
                      <p className="text-xs text-muted-foreground">
                        {((dashboardMetrics.activePartnerships / dashboardMetrics.totalPartnerships) * 100).toFixed(1)}% do total
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Parcerias Inativas</CardTitle>
                      <TrendingDown className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-muted-foreground">{dashboardMetrics.inactivePartnerships}</div>
                      <p className="text-xs text-muted-foreground">
                        {((dashboardMetrics.inactivePartnerships / dashboardMetrics.totalPartnerships) * 100).toFixed(1)}% do total
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Valor Total Banca</CardTitle>
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">R$ {formatCurrency(dashboardMetrics.totalBanca)}</div>
                      <p className="text-xs text-muted-foreground">
                        Média: R$ {formatCurrency(dashboardMetrics.totalBanca / dashboardMetrics.totalPartnerships)}
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Total Apostas</CardTitle>
                      <Target className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{dashboardMetrics.totalArbitrages}</div>
                      <p className="text-xs text-muted-foreground">
                        em todas as parcerias
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* Alertas */}
                {dashboardMetrics.alerts.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-lg font-semibold">Alertas e Notificações</h3>
                    {dashboardMetrics.alerts.map((alert, index) => (
                      <Alert
                        key={index}
                        variant={alert.severity === 'high' ? 'destructive' : 'default'}
                      >
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>
                          {alert.severity === 'high' ? 'Atenção Urgente' : 'Aviso'}
                        </AlertTitle>
                        <AlertDescription>{alert.message}</AlertDescription>
                      </Alert>
                    ))}
                  </div>
                )}

                {/* Performance por Parceria */}
                <div className="space-y-3">
                  <h3 className="text-lg font-semibold">Performance por Parceria</h3>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {dashboardMetrics.partnershipStats
                      .sort((a, b) => b.totalLucro - a.totalLucro)
                      .map((stat, index) => (
                        <Card key={index} className="p-4">
                          <h4 className="font-semibold text-sm mb-2 truncate">{formatUserName(stat.nome)}</h4>
                          <div className="space-y-1 text-sm">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Apostas:</span>
                              <span className="font-medium">{stat.totalArbitrages}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Green:</span>
                              <span className="font-medium text-success">{stat.greenCount}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Lucro:</span>
                              <span className={`font-medium ${stat.totalLucro >= 0 ? 'text-success' : 'text-destructive'}`}>
                                R$ {formatCurrency(stat.totalLucro)}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Taxa Sucesso:</span>
                              <span className="font-medium">
                                {stat.totalArbitrages > 0 ? ((stat.greenCount / stat.totalArbitrages) * 100).toFixed(1) : 0}%
                              </span>
                            </div>
                          </div>
                        </Card>
                      ))}
                  </div>
                </div>

                {/* Gráfico de Comparação */}
                <Card className="p-6">
                  <h3 className="text-lg font-semibold mb-4">Comparação de Performance</h3>
                  <ResponsiveContainer width="100%" height={400}>
                    <BarChart data={dashboardMetrics.partnershipStats.sort((a, b) => b.totalLucro - a.totalLucro)}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="nome" angle={-45} textAnchor="end" height={100} tickFormatter={formatUserName} />
                      <YAxis />
                      <Tooltip 
                        formatter={(value: number, name: string) => {
                          if (name === 'Lucro (R$)') return `R$ ${formatCurrency(value)}`;
                          return value;
                        }}
                      />
                      <Legend />
                      <Bar dataKey="totalLucro" fill="#8884d8" name="Lucro (R$)" />
                      <Bar dataKey="totalArbitrages" fill="#82ca9d" name="Total Apostas" />
                      <Bar dataKey="greenCount" fill="#00C49F" name="Green" />
                    </BarChart>
                  </ResponsiveContainer>
                </Card>
              </>
            )}
          </div>
        )}
      </div>

      <BanksDialog
        isOpen={isBanksDialogOpen}
        onOpenChange={setIsBanksDialogOpen}
        userId={user?.id || ''}
        onBanksUpdate={fetchBanks}
      />
    </Layout>
  );
};

export default Parcerias;
