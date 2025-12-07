import { useEffect, useState, useMemo, useCallback } from 'react';
import { Layout } from '@/components/Layout';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useGameNotifications } from '@/hooks/useGameNotifications';
import { useDebounce } from '@/hooks/useDebounce';
import { useIsMobile } from '@/hooks/use-mobile';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { ChevronDown, Plus, Pencil, Trash2, Clock, FileText, Copy, Filter, X, Maximize2, Minimize2, Search, LayoutGrid, Table as TableIcon, Star, Calendar, Building2, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { format, differenceInMilliseconds } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { formatCurrency, formatUserName } from '@/lib/utils';
import { parseArbitrageText } from '@/utils/arbitrageParser';
import { MonthlyGoalCard } from '@/components/MonthlyGoalCard';

interface Arbitrage {
  id: string;
  descricao: string;
  data_evento: string;
  created_at: string;
  esporte_liga?: string;
  casa_01_nome: string;
  casa_01_odd: number;
  casa_01_valor: number;
  casa_01_resultado: string;
  casa_01_mercado?: string;
  casa_01_valor_resultado?: number;
  casa_01_parceria_id?: string;
  casa_02_nome: string;
  casa_02_odd: number;
  casa_02_valor: number;
  casa_02_resultado: string;
  casa_02_mercado?: string;
  casa_02_valor_resultado?: number;
  casa_02_parceria_id?: string;
  casa_03_nome?: string;
  casa_03_odd?: number;
  casa_03_valor?: number;
  casa_03_resultado?: string;
  casa_03_mercado?: string;
  casa_03_valor_resultado?: number;
  casa_03_parceria_id?: string;
  porcentagem: number;
  retorno_previsto: number;
  lucro_projetado: number;
  lucro_real: number;
  status: string;
  user_id: string;
  partnerships_casa_01?: { nome_completo: string };
  partnerships_casa_02?: { nome_completo: string };
  partnerships_casa_03?: { nome_completo: string };
}

interface Partnership {
  id: string;
  nome_completo: string;
  status: string;
  user_id: string;
  created_at: string;
  data_inicio: string;
}

// Mapa para resultado individual de cada casa (usado no dropdown de seleção)
const resultadoMap: Record<string, { label: string; variant: 'secondary' | 'default' | 'destructive' }> = {
  aguardando: { label: 'Aguardando', variant: 'secondary' },
  green: { label: 'Green', variant: 'default' },
  green_parcial: { label: 'Green Parcial', variant: 'default' },
  red: { label: 'Red', variant: 'destructive' },
  red_parcial: { label: 'Red Parcial', variant: 'destructive' },
  devolvido: { label: 'Devolvido', variant: 'secondary' },
};

// Função para obter status consolidado baseado no lucro real (para status geral da arbitragem)
const getConsolidatedStatus = (status: string, lucroReal: number) => {
  if (status === 'aguardando') {
    return { label: 'Aguardando', variant: 'secondary' as const };
  }
  if (status === 'devolvido') {
    return { label: 'Devolvido', variant: 'secondary' as const };
  }
  // Para qualquer status fechado, verificar o lucro real
  if (lucroReal > 0) {
    return { label: 'Green', variant: 'default' as const };
  } else if (lucroReal < 0) {
    return { label: 'Red', variant: 'destructive' as const };
  } else {
    return { label: 'Devolvido', variant: 'secondary' as const };
  }
};

// Opções de resultado individual para cada casa (com parciais)
const resultOptions = [
  { value: 'aguardando', label: 'Aguardando' },
  { value: 'green', label: 'Green' },
  { value: 'green_parcial', label: 'Green Parcial' },
  { value: 'red', label: 'Red' },
  { value: 'red_parcial', label: 'Red Parcial' },
  { value: 'devolvido', label: 'Devolvido' },
];

export default function MinhasArbitragens() {
  const { user, userRole } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [arbitragens, setArbitragens] = useState<Arbitrage[]>([]);
  const [filteredArbitragens, setFilteredArbitragens] = useState<Arbitrage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editArbitrage, setEditArbitrage] = useState<Arbitrage | null>(null);
  const [viewGanhosArbitrage, setViewGanhosArbitrage] = useState<Arbitrage | null>(null);
  const [users, setUsers] = useState<Array<{ id: string; name: string }>>([]);
  const [goToHousesOpen, setGoToHousesOpen] = useState(false);
  const [selectedPartnershipForHouses, setSelectedPartnershipForHouses] = useState<string>('');
  const itemsPerPage = 30;
  
  // Restaurar filtros do sessionStorage ou usar valores padrão (mês atual como padrão)
  const today = new Date();
  const [searchText, setSearchText] = useState(() =>
    sessionStorage.getItem('arbitragens_searchText') || ''
  );
  const [filterStartDate, setFilterStartDate] = useState(() => {
    const saved = sessionStorage.getItem('arbitragens_filterStartDate');
    if (saved) return saved;
    // Padrão: primeiro dia do mês atual
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    return format(firstDayOfMonth, 'yyyy-MM-dd');
  });
  const [filterEndDate, setFilterEndDate] = useState(() => {
    const saved = sessionStorage.getItem('arbitragens_filterEndDate');
    if (saved) return saved;
    // Padrão: dia atual
    return format(today, 'yyyy-MM-dd');
  });
  const [selectedPeriod, setSelectedPeriod] = useState<'hoje' | 'semana' | 'mes' | 'mes_atual' | 'custom'>('mes_atual');
  const [filterStatus, setFilterStatus] = useState<string[]>(() => {
    const saved = sessionStorage.getItem('arbitragens_filterStatus');
    if (!saved) return ['aguardando'];
    
    try {
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? parsed : ['aguardando'];
    } catch {
      return saved === 'all' ? ['all'] : [saved];
    }
  });
  const [filterUser, setFilterUser] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(() => {
    const saved = sessionStorage.getItem('arbitragens_currentPage');
    return saved ? parseInt(saved) : 1;
  });
  
  // Debounce dos filtros para evitar queries excessivas
  const debouncedSearchText = useDebounce(searchText, 300);
  const debouncedFilterStartDate = useDebounce(filterStartDate, 300);
  const debouncedFilterEndDate = useDebounce(filterEndDate, 300);
  const debouncedFilterStatus = useDebounce(filterStatus, 300);
  const debouncedFilterUser = useDebounce(filterUser, 300);
  
  // Estados para parcerias
  const [partnerships, setPartnerships] = useState<Partnership[]>([]);
  const [selectedPartnership01, setSelectedPartnership01] = useState('');
  const [selectedPartnership02, setSelectedPartnership02] = useState('');
  const [selectedPartnership03, setSelectedPartnership03] = useState('');
  const [defaultPartnershipId, setDefaultPartnershipId] = useState<string | null>(null);
  
  // Função helper para verificar se parceria é do mês vigente
  const isPartnershipFromCurrentMonth = (partnership: Partnership) => {
    const hoje = new Date();
    const mesVigente = hoje.getMonth();
    const anoVigente = hoje.getFullYear();
    const dataInicio = new Date(partnership.data_inicio);
    return dataInicio.getMonth() === mesVigente && dataInicio.getFullYear() === anoVigente;
  };
  
  // Filtro de parcerias
  const [filterPartnership, setFilterPartnership] = useState<string[]>(() => {
    const saved = sessionStorage.getItem('arbitragens_filterPartnership');
    if (!saved) return [];
    try {
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  const debouncedFilterPartnership = useDebounce(filterPartnership, 300);
  
  // Estado para modo de visualização
  const [isExpandedView, setIsExpandedView] = useState(false);
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  
  // Estado para ordenação
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  
  // Forçar visualização em cards no mobile
  useEffect(() => {
    if (isMobile) {
      setViewMode('cards');
    }
  }, [isMobile]);
  
  // Estados para adicionar arbitragem
  const [openAdd, setOpenAdd] = useState(false);
  const [isLoadingAdd, setIsLoadingAdd] = useState(false);
  const [useTresCasas, setUseTresCasas] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [activeTab, setActiveTab] = useState('manual');
  const [formData, setFormData] = useState({
    descricao: '',
    data_evento: '',
    esporte_liga: '',
    casa_01_nome: '',
    casa_01_odd: '',
    casa_01_valor: '',
    casa_01_mercado: '',
    casa_02_nome: '',
    casa_02_odd: '',
    casa_02_valor: '',
    casa_02_mercado: '',
    casa_03_nome: '',
    casa_03_odd: '',
    casa_03_valor: '',
    casa_03_mercado: '',
    porcentagem: '',
    retorno_previsto: '',
    lucro_projetado: '',
  });

  const isAdmin = userRole?.role === 'admin' || userRole?.role === 'admin_master';

  // Função para aplicar filtros rápidos de período
  const applyPeriodFilter = useCallback((period: 'hoje' | 'semana' | 'mes' | 'mes_atual' | 'custom') => {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();
    const day = today.getDate();
    
    switch (period) {
      case 'hoje':
        const todayStr = format(new Date(year, month, day), 'yyyy-MM-dd');
        setFilterStartDate(todayStr);
        setFilterEndDate(todayStr);
        setSelectedPeriod('hoje');
        break;
      case 'semana':
        const weekAgo = new Date(year, month, day - 7);
        setFilterStartDate(format(weekAgo, 'yyyy-MM-dd'));
        setFilterEndDate(format(new Date(year, month, day), 'yyyy-MM-dd'));
        setSelectedPeriod('semana');
        break;
      case 'mes':
        const monthAgo = new Date(year, month, day - 30);
        setFilterStartDate(format(monthAgo, 'yyyy-MM-dd'));
        setFilterEndDate(format(new Date(year, month, day), 'yyyy-MM-dd'));
        setSelectedPeriod('mes');
        break;
      case 'mes_atual':
        const firstDayOfMonth = new Date(year, month, 1);
        setFilterStartDate(format(firstDayOfMonth, 'yyyy-MM-dd'));
        setFilterEndDate(format(new Date(year, month, day), 'yyyy-MM-dd'));
        setSelectedPeriod('mes_atual');
        break;
      case 'custom':
        setSelectedPeriod('custom');
        break;
    }
  }, []);

  // Ativar notificações de jogos
  useGameNotifications({ userId: user?.id, enabled: true });

  const totalPages = Math.ceil(filteredArbitragens.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedArbitragens = filteredArbitragens.slice(startIndex, endIndex);

  // Calcular totais baseado nos filtros (memoizado)
  const totais = useMemo(() => {
    return filteredArbitragens.reduce(
      (acc, arb) => {
        const lucro = arb.status === 'aguardando' ? Number(arb.lucro_projetado) : Number(arb.lucro_real);
        return {
          totalInvestido: acc.totalInvestido + Number(arb.casa_01_valor) + Number(arb.casa_02_valor) + Number(arb.casa_03_valor || 0),
          totalLucro: acc.totalLucro + lucro,
        };
      },
      { totalInvestido: 0, totalLucro: 0 }
    );
  }, [filteredArbitragens]);

  // Calcular lucro para meta (sempre mês atual, apenas filtro de operador)
  const goalProfit = useMemo(() => {
    // Definir período do mês atual
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    let filtered = [...arbitragens];

    // Filtrar apenas pelo mês atual (created_at)
    filtered = filtered.filter((arb) => {
      const arbDate = new Date(arb.created_at);
      return arbDate >= firstDayOfMonth && arbDate <= lastDayOfMonth;
    });

    // Aplicar apenas filtro de operador
    if (debouncedFilterUser.length > 0) {
      filtered = filtered.filter((arb) => debouncedFilterUser.includes(arb.user_id));
    }

    // Calcular lucro total (incluindo aguardando e fechados)
    return filtered.reduce((sum, arb) => {
      const lucro = arb.status === 'aguardando' ? Number(arb.lucro_projetado) : Number(arb.lucro_real);
      return sum + lucro;
    }, 0);
  }, [arbitragens, debouncedFilterUser]);

  const applyFilters = useCallback(() => {
    let filtered = [...arbitragens];

    // Filtrar por texto de busca
    if (debouncedSearchText.trim()) {
      const searchLower = debouncedSearchText.toLowerCase().trim();
      filtered = filtered.filter((arb) => {
        return (
          arb.descricao.toLowerCase().includes(searchLower) ||
          (arb.esporte_liga && arb.esporte_liga.toLowerCase().includes(searchLower)) ||
          arb.casa_01_nome.toLowerCase().includes(searchLower) ||
          arb.casa_02_nome.toLowerCase().includes(searchLower) ||
          (arb.casa_03_nome && arb.casa_03_nome.toLowerCase().includes(searchLower))
        );
      });
    }

    // Filtrar por data de criação (created_at) - coluna "ADICIONADO EM"
    // Regra: Se ambas as datas estiverem preenchidas, filtrar período
    // Se apenas data fim preenchida, filtrar apenas aquele dia único
    if (debouncedFilterStartDate && debouncedFilterEndDate) {
      // Ambas preenchidas: filtrar período
      const [startYear, startMonth, startDay] = debouncedFilterStartDate.split('-').map(Number);
      const [endYear, endMonth, endDay] = debouncedFilterEndDate.split('-').map(Number);
      const startDate = new Date(startYear, startMonth - 1, startDay, 0, 0, 0, 0);
      const endDate = new Date(endYear, endMonth - 1, endDay, 23, 59, 59, 999);
      filtered = filtered.filter((arb) => {
        const arbDate = new Date(arb.created_at);
        return arbDate >= startDate && arbDate <= endDate;
      });
    } else if (!debouncedFilterStartDate && debouncedFilterEndDate) {
      // Apenas data fim: filtrar apenas aquele dia
      const [year, month, day] = debouncedFilterEndDate.split('-').map(Number);
      const startOfDay = new Date(year, month - 1, day, 0, 0, 0, 0);
      const endOfDay = new Date(year, month - 1, day, 23, 59, 59, 999);
      filtered = filtered.filter((arb) => {
        const arbDate = new Date(arb.created_at);
        return arbDate >= startOfDay && arbDate <= endOfDay;
      });
    }
    // Se apenas data início preenchida, não filtrar

    if (!debouncedFilterStatus.includes('all')) {
      filtered = filtered.filter((arb) => {
        // Consolidar status para filtros
        let shouldInclude = false;
        
        if (debouncedFilterStatus.includes('green')) {
          // Green inclui: green, parcial_green, devolvido e parcial_red com lucro positivo
          if (arb.status === 'green' || arb.status === 'parcial_green' || arb.status === 'devolvido') {
            shouldInclude = true;
          }
          if (arb.status === 'parcial_red' && arb.lucro_real > 0) {
            shouldInclude = true;
          }
        }
        
        if (debouncedFilterStatus.includes('red')) {
          // Red inclui: red, perda_total e parcial_red com lucro negativo ou zero
          if (arb.status === 'red' || arb.status === 'perda_total') {
            shouldInclude = true;
          }
          if (arb.status === 'parcial_red' && arb.lucro_real <= 0) {
            shouldInclude = true;
          }
        }
        
        if (debouncedFilterStatus.includes('aguardando')) {
          if (arb.status === 'aguardando') {
            shouldInclude = true;
          }
        }
        
        return shouldInclude;
      });
    }

    if (debouncedFilterUser.length > 0) {
      filtered = filtered.filter((arb) => debouncedFilterUser.includes(arb.user_id));
    }

    // Filtrar por parceria (casa de aposta)
    if (debouncedFilterPartnership.length > 0) {
      filtered = filtered.filter((arb) => {
        const partnershipIds = [
          arb.casa_01_parceria_id,
          arb.casa_02_parceria_id,
          arb.casa_03_parceria_id
        ].filter(Boolean);
        return partnershipIds.some(id => debouncedFilterPartnership.includes(id as string));
      });
    }

    // Ordenação baseada no filtro de status e preferência do usuário
    // sortOrder 'desc' = Jogo mais próximo primeiro (hoje, amanhã, etc.)
    // sortOrder 'asc' = Jogo mais distante primeiro
    if (debouncedFilterStatus.includes('all')) {
      // Separar aguardando e fechadas
      const aguardando = filtered.filter(arb => arb.status === 'aguardando');
      const fechadas = filtered.filter(arb => arb.status !== 'aguardando');
      
      // Ordenar aguardando por data_evento conforme preferência
      aguardando.sort((a, b) => {
        const diff = new Date(a.data_evento).getTime() - new Date(b.data_evento).getTime();
        return sortOrder === 'desc' ? diff : -diff; // desc = crescente (mais próximo primeiro)
      });
      
      // Ordenar fechadas por data_evento conforme preferência
      fechadas.sort((a, b) => {
        const diff = new Date(a.data_evento).getTime() - new Date(b.data_evento).getTime();
        return sortOrder === 'desc' ? diff : -diff; // desc = crescente (mais próximo primeiro)
      });
      
      // Combinar: aguardando primeiro, depois fechadas
      filtered = [...aguardando, ...fechadas];
    } else {
      // Quando filtro de status está ativo, ordenar conforme preferência
      filtered.sort((a, b) => {
        const diff = new Date(a.data_evento).getTime() - new Date(b.data_evento).getTime();
        return sortOrder === 'desc' ? diff : -diff; // desc = crescente (mais próximo primeiro)
      });
    }

    setFilteredArbitragens(filtered);
    setCurrentPage(1);
  }, [arbitragens, debouncedSearchText, debouncedFilterStartDate, debouncedFilterEndDate, debouncedFilterStatus, debouncedFilterUser, debouncedFilterPartnership, sortOrder]);

  const loadArbitragens = useCallback(async () => {
    if (!user?.id) return;
    
    let query = supabase.from('arbitrages').select(`
      id,
      descricao,
      data_evento,
      created_at,
      esporte_liga,
      casa_01_nome,
      casa_01_odd,
      casa_01_valor,
      casa_01_resultado,
      casa_01_mercado,
      casa_01_valor_resultado,
      casa_01_parceria_id,
      casa_02_nome,
      casa_02_odd,
      casa_02_valor,
      casa_02_resultado,
      casa_02_mercado,
      casa_02_valor_resultado,
      casa_02_parceria_id,
      casa_03_nome,
      casa_03_odd,
      casa_03_valor,
      casa_03_resultado,
      casa_03_mercado,
      casa_03_valor_resultado,
      casa_03_parceria_id,
      porcentagem,
      retorno_previsto,
      lucro_projetado,
      lucro_real,
      status,
      user_id,
      profiles!arbitrages_user_id_fkey (name),
      partnerships_casa_01:partnerships!arbitrages_casa_01_parceria_id_fkey (nome_completo),
      partnerships_casa_02:partnerships!arbitrages_casa_02_parceria_id_fkey (nome_completo),
      partnerships_casa_03:partnerships!arbitrages_casa_03_parceria_id_fkey (nome_completo)
    `).order('data_evento', { ascending: true });

    if (!isAdmin) {
      query = query.eq('user_id', user.id);
    }

    const { data, error } = await query;

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar arbitragens',
        description: error.message,
      });
    } else if (data) {
      setArbitragens(data);
    }

    setIsLoading(false);
  }, [user?.id, isAdmin, toast]);

  const loadUsers = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, name')
      .order('name');
    
    if (data) {
      setUsers(data);
      
      // Por padrão, selecionar o usuário logado
      if (filterUser.length === 0 && user?.id) {
        setFilterUser([user.id]);
      }
    }
  };

  const loadPartnerships = useCallback(async (userIds?: string[]) => {
    if (!user?.id) return;
    
    // Buscar parceria padrão do usuário
    const { data: profileData } = await supabase
      .from('profiles')
      .select('default_partnership_id')
      .eq('id', user.id)
      .maybeSingle();
    
    // Armazenar parceria padrão no estado
    setDefaultPartnershipId(profileData?.default_partnership_id || null);
    
    // TODOS os usuários (incluindo admins) só podem ver suas próprias parcerias ao adicionar apostas
    const query = supabase
      .from('partnerships')
      .select('id, nome_completo, status, user_id, created_at, data_inicio')
      .eq('status', 'ativo')
      .eq('user_id', user.id)
      .order('created_at');
    
    const { data, error } = await query;
    
    if (error) {
      console.error('Erro ao carregar parcerias:', error);
    } else {
      setPartnerships(data || []);
      
      // Pré-selecionar parceria com a seguinte prioridade:
      // 1. Parceria padrão configurada pelo usuário (se ainda estiver ativa)
      // 2. Primeira parceria criada no mês vigente
      // 3. Primeira parceria da lista
      if (data && data.length > 0) {
        let parceiraDefault = data[0].id;
        
        // Verificar se há parceria padrão configurada e se ela está na lista
        if (profileData?.default_partnership_id) {
          const parceiraConfigurada = data.find(p => p.id === profileData.default_partnership_id);
          if (parceiraConfigurada) {
            parceiraDefault = parceiraConfigurada.id;
          } else {
            // Se a parceria padrão não está ativa, usar lógica de mês vigente
            const hoje = new Date();
            const mesVigente = hoje.getMonth();
            const anoVigente = hoje.getFullYear();
            
            const parceriasMesVigente = data.filter(p => {
              const dataInicio = new Date(p.data_inicio);
              return dataInicio.getMonth() === mesVigente && dataInicio.getFullYear() === anoVigente;
            });
            
            if (parceriasMesVigente.length > 0) {
              parceiraDefault = parceriasMesVigente[0].id;
            }
          }
        } else {
          // Se não há parceria padrão, usar lógica de mês vigente
          const hoje = new Date();
          const mesVigente = hoje.getMonth();
          const anoVigente = hoje.getFullYear();
          
          const parceriasMesVigente = data.filter(p => {
            const dataInicio = new Date(p.data_inicio);
            return dataInicio.getMonth() === mesVigente && dataInicio.getFullYear() === anoVigente;
          });
          
          if (parceriasMesVigente.length > 0) {
            parceiraDefault = parceriasMesVigente[0].id;
          }
        }
          
        setSelectedPartnership01(parceiraDefault);
        setSelectedPartnership02(parceiraDefault);
        setSelectedPartnership03(parceiraDefault);
      }
    }
  }, [user?.id]);

  // Carregar dados inicialmente
  useEffect(() => {
    if (!user?.id) return;
    
    loadArbitragens();
    loadPartnerships();
    if (isAdmin) {
      loadUsers();
    }
    // Apenas uma vez quando user.id ou isAdmin mudar
  }, [user?.id, isAdmin]);

  // Aplicar filtros quando arbitragens ou filtros mudarem
  useEffect(() => {
    applyFilters();
  }, [arbitragens, debouncedSearchText, debouncedFilterStartDate, debouncedFilterEndDate, debouncedFilterStatus, debouncedFilterUser, debouncedFilterPartnership]);

  // Salvar filtros no sessionStorage sempre que mudarem
  useEffect(() => {
    sessionStorage.setItem('arbitragens_searchText', searchText);
  }, [searchText]);

  useEffect(() => {
    sessionStorage.setItem('arbitragens_filterStartDate', filterStartDate);
  }, [filterStartDate]);

  useEffect(() => {
    sessionStorage.setItem('arbitragens_filterEndDate', filterEndDate);
  }, [filterEndDate]);

  useEffect(() => {
    sessionStorage.setItem('arbitragens_filterPartnership', JSON.stringify(filterPartnership));
  }, [filterPartnership]);

  useEffect(() => {
    sessionStorage.setItem('arbitragens_filterStatus', JSON.stringify(filterStatus));
  }, [filterStatus]);

  useEffect(() => {
    sessionStorage.setItem('arbitragens_filterUser', JSON.stringify(filterUser));
  }, [filterUser]);

  useEffect(() => {
    sessionStorage.setItem('arbitragens_currentPage', currentPage.toString());
  }, [currentPage]);

  // Funções para adicionar arbitragem
  const handleParsePaste = () => {
    const parsed = parseArbitrageText(pasteText);
    
    if (!parsed) {
      toast({
        variant: 'destructive',
        title: 'Erro ao processar texto',
        description: 'Verifique se o formato está correto e tente novamente.',
      });
      return;
    }

    const hasCasa03 = !!parsed.casa_03_nome && !!parsed.casa_03_odd && !!parsed.casa_03_valor;
    setUseTresCasas(hasCasa03);

    setFormData({
      descricao: parsed.descricao,
      data_evento: parsed.data_hora || '',
      esporte_liga: parsed.esporte_liga || '',
      casa_01_nome: parsed.casa_01_nome,
      casa_01_odd: parsed.casa_01_odd,
      casa_01_valor: parsed.casa_01_valor,
      casa_01_mercado: parsed.casa_01_mercado || 'Mercado não especificado',
      casa_02_nome: parsed.casa_02_nome,
      casa_02_odd: parsed.casa_02_odd,
      casa_02_valor: parsed.casa_02_valor,
      casa_02_mercado: parsed.casa_02_mercado || 'Mercado não especificado',
      casa_03_nome: parsed.casa_03_nome || '',
      casa_03_odd: parsed.casa_03_odd || '',
      casa_03_valor: parsed.casa_03_valor || '',
      casa_03_mercado: parsed.casa_03_mercado || (hasCasa03 ? 'Mercado não especificado' : ''),
      porcentagem: parsed.porcentagem,
      retorno_previsto: '',
      lucro_projetado: '',
    });

    toast({
      title: 'Texto processado!',
      description: 'Os dados foram preenchidos automaticamente.',
    });

    setActiveTab('manual');
    setPasteText('');
  };

  // Calcular automaticamente porcentagem, retorno previsto e lucro projetado
  useEffect(() => {
    const odd1 = parseFloat(formData.casa_01_odd);
    const valor1 = parseFloat(formData.casa_01_valor);
    const odd2 = parseFloat(formData.casa_02_odd);
    const valor2 = parseFloat(formData.casa_02_valor);
    const odd3 = parseFloat(formData.casa_03_odd);
    const valor3 = parseFloat(formData.casa_03_valor);

    if (useTresCasas) {
      if (odd1 > 0 && valor1 > 0 && odd2 > 0 && valor2 > 0 && odd3 > 0 && valor3 > 0) {
        const porcentagem = ((1 / odd1 + 1 / odd2 + 1 / odd3) - 1) * -100;
        const totalApostado = valor1 + valor2 + valor3;
        const retorno1 = valor1 * odd1;
        const retorno2 = valor2 * odd2;
        const retorno3 = valor3 * odd3;
        const retornoPrevisto = Math.max(retorno1, retorno2, retorno3);
        const lucroProjetado = retornoPrevisto - totalApostado;

        setFormData(prev => ({
          ...prev,
          porcentagem: formatCurrency(porcentagem),
          retorno_previsto: formatCurrency(retornoPrevisto),
          lucro_projetado: formatCurrency(lucroProjetado),
        }));
      }
    } else {
      if (odd1 > 0 && valor1 > 0 && odd2 > 0 && valor2 > 0) {
        const porcentagem = ((1 / odd1 + 1 / odd2) - 1) * -100;
        const totalApostado = valor1 + valor2;
        const retorno1 = valor1 * odd1;
        const retorno2 = valor2 * odd2;
        const retornoPrevisto = Math.max(retorno1, retorno2);
        const lucroProjetado = retornoPrevisto - totalApostado;

        setFormData(prev => ({
          ...prev,
          porcentagem: formatCurrency(porcentagem),
          retorno_previsto: formatCurrency(retornoPrevisto),
          lucro_projetado: formatCurrency(lucroProjetado),
        }));
      }
    }
  }, [
    formData.casa_01_odd,
    formData.casa_01_valor,
    formData.casa_02_odd,
    formData.casa_02_valor,
    formData.casa_03_odd,
    formData.casa_03_valor,
    useTresCasas,
  ]);

  const handleSubmitAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user?.id) {
      toast({
        variant: 'destructive',
        title: 'Erro de autenticação',
        description: 'Usuário não autenticado.',
      });
      return;
    }

    // Validar se tem pelo menos 1 parceria ativa
    if (partnerships.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Parceria obrigatória',
        description: 'Você precisa ter pelo menos uma parceria ativa para inserir apostas.',
      });
      return;
    }
    
    setIsLoadingAdd(true);

    try {
      const { error: profileError } = await supabase.rpc('ensure_user_profile', {
        user_uuid: user.id
      });

      if (profileError) {
        console.error('Erro ao verificar perfil:', profileError);
        throw profileError;
      }

      const dataEvento = formData.data_evento 
        ? new Date(formData.data_evento + ':00').toISOString() 
        : new Date().toISOString();

      const arbitrageData: any = {
        user_id: user.id,
        descricao: formData.descricao,
        data_evento: dataEvento,
        esporte_liga: formData.esporte_liga || null,
        casa_01_nome: formData.casa_01_nome,
        casa_01_odd: parseFloat(formData.casa_01_odd),
        casa_01_valor: parseFloat(formData.casa_01_valor),
        casa_01_mercado: formData.casa_01_mercado || 'Mercado não especificado',
        casa_01_parceria_id: selectedPartnership01,
        casa_02_nome: formData.casa_02_nome,
        casa_02_odd: parseFloat(formData.casa_02_odd),
        casa_02_valor: parseFloat(formData.casa_02_valor),
        casa_02_mercado: formData.casa_02_mercado || 'Mercado não especificado',
        casa_02_parceria_id: selectedPartnership02,
        porcentagem: parseFloat(formData.porcentagem),
        retorno_previsto: parseFloat(formData.retorno_previsto),
        lucro_projetado: parseFloat(formData.lucro_projetado),
      };

      if (useTresCasas) {
        arbitrageData.casa_03_nome = formData.casa_03_nome;
        arbitrageData.casa_03_odd = parseFloat(formData.casa_03_odd);
        arbitrageData.casa_03_valor = parseFloat(formData.casa_03_valor);
        arbitrageData.casa_03_mercado = formData.casa_03_mercado || 'Mercado não especificado';
        arbitrageData.casa_03_parceria_id = selectedPartnership03;
      }

      const { error: insertError } = await supabase.from('arbitrages').insert(arbitrageData);

      if (insertError) {
        throw insertError;
      }

      toast({
        title: 'Arbitragem criada!',
        description: 'A arbitragem foi cadastrada com sucesso.',
      });
      
      setOpenAdd(false);
      setFormData({
        descricao: '',
        data_evento: '',
        esporte_liga: '',
        casa_01_nome: '',
        casa_01_odd: '',
        casa_01_valor: '',
        casa_01_mercado: '',
        casa_02_nome: '',
        casa_02_odd: '',
        casa_02_valor: '',
        casa_02_mercado: '',
        casa_03_nome: '',
        casa_03_odd: '',
        casa_03_valor: '',
        casa_03_mercado: '',
        porcentagem: '',
        retorno_previsto: '',
        lucro_projetado: '',
      });
      loadArbitragens();
    } catch (error: any) {
      console.error('Erro ao criar arbitragem:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao criar arbitragem',
        description: error.message || 'Ocorreu um erro desconhecido',
      });
    } finally {
      setIsLoadingAdd(false);
    }
  };

  const handleSetDefaultPartnership = async (partnershipId: string) => {
    if (!user?.id) return;
    
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ default_partnership_id: partnershipId })
        .eq('id', user.id);
      
      if (error) throw error;
      
      setDefaultPartnershipId(partnershipId);
      toast({
        title: 'Parceria padrão atualizada',
        description: 'Esta parceria será pré-selecionada nas próximas apostas.',
      });
    } catch (error: any) {
      console.error('Erro ao definir parceria padrão:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao atualizar parceria padrão',
        description: error.message,
      });
    }
  };

  const handleUpdateResult = async (
    arbitrageId: string,
    casa: 'casa_01' | 'casa_02' | 'casa_03',
    resultado: string
  ) => {
    const arb = arbitragens.find((a) => a.id === arbitrageId);
    if (!arb) return;

    let valorResultado = 0;
    const odd = casa === 'casa_01' ? arb.casa_01_odd : casa === 'casa_02' ? arb.casa_02_odd : arb.casa_03_odd || 0;
    const valorApostado = casa === 'casa_01' ? arb.casa_01_valor : casa === 'casa_02' ? arb.casa_02_valor : arb.casa_03_valor || 0;

    // Cálculo dos resultados
    if (resultado === 'green') {
      // Ganhou: valor apostado * odd
      valorResultado = valorApostado * odd;
    } else if (resultado === 'red') {
      // Perdeu: 0
      valorResultado = 0;
    } else if (resultado === 'parcial_green') {
      // Meio Green: (stake/2) + (stake/2 * odd)
      valorResultado = (valorApostado / 2) + (valorApostado / 2 * odd);
    } else if (resultado === 'parcial_red') {
      // Meio Red: (stake/2)
      valorResultado = valorApostado / 2;
    } else if (resultado === 'devolvido') {
      // Devolvido: aposta devolvida
      valorResultado = valorApostado;
    } else if (resultado === 'aguardando') {
      // Aguardando: ainda sem resultado
      valorResultado = 0;
    }

    const updateField = casa === 'casa_01' ? 'casa_01_resultado' : casa === 'casa_02' ? 'casa_02_resultado' : 'casa_03_resultado';
    const valorField = casa === 'casa_01' ? 'casa_01_valor_resultado' : casa === 'casa_02' ? 'casa_02_valor_resultado' : 'casa_03_valor_resultado';
    
    // Atualizar o resultado individual da casa
    const updateData: any = {
      [updateField]: resultado,
      [valorField]: valorResultado,
    };

    // Calcular os valores resultados de todas as casas
    const casa01ValorResultado = casa === 'casa_01' ? valorResultado : (arb as any).casa_01_valor_resultado || 0;
    const casa02ValorResultado = casa === 'casa_02' ? valorResultado : (arb as any).casa_02_valor_resultado || 0;
    const casa03ValorResultado = casa === 'casa_03' ? valorResultado : (arb as any).casa_03_valor_resultado || 0;

    const casa01Resultado = casa === 'casa_01' ? resultado : arb.casa_01_resultado;
    const casa02Resultado = casa === 'casa_02' ? resultado : arb.casa_02_resultado;
    const casa03Resultado = casa === 'casa_03' ? resultado : arb.casa_03_resultado || 'aguardando';

    // Verificar se ainda há casas aguardando
    const todasDefinidas = casa01Resultado !== 'aguardando' && 
                           casa02Resultado !== 'aguardando' && 
                           (!arb.casa_03_nome || casa03Resultado !== 'aguardando');

    // Calcular status geral e lucro real
    let statusGeral = 'aguardando';
    let lucroReal = 0;

    if (todasDefinidas) {
      const totalInvestido = Number(arb.casa_01_valor) + Number(arb.casa_02_valor) + Number(arb.casa_03_valor || 0);
      const totalRetorno = Number(casa01ValorResultado) + Number(casa02ValorResultado) + Number(casa03ValorResultado);
      lucroReal = totalRetorno - totalInvestido;

      // Status: green se lucro >= 0 (positivo ou zerado), red se lucro < 0 (negativo)
      statusGeral = lucroReal >= 0 ? 'green' : 'red';
    }

    updateData.status = statusGeral;
    updateData.lucro_real = lucroReal;

    const { error } = await supabase
      .from('arbitrages')
      .update(updateData)
      .eq('id', arbitrageId);

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Erro ao atualizar resultado',
        description: error.message,
      });
    } else {
      toast({
        title: 'Resultado atualizado!',
        description: 'O resultado foi registrado com sucesso.',
      });
      loadArbitragens();
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;

    const { error } = await supabase
      .from('arbitrages')
      .delete()
      .eq('id', deleteId);

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Erro ao excluir arbitragem',
        description: error.message,
      });
    } else {
      toast({
        title: 'Arbitragem excluída!',
        description: 'A arbitragem foi removida com sucesso.',
      });
      loadArbitragens();
    }

    setDeleteId(null);
  };

  const handleEdit = async () => {
    if (!editArbitrage) return;

    // Recalcular retorno_previsto e lucro_projetado
    const valor1 = Number(editArbitrage.casa_01_valor);
    const odd1 = Number(editArbitrage.casa_01_odd);
    const valor2 = Number(editArbitrage.casa_02_valor);
    const odd2 = Number(editArbitrage.casa_02_odd);
    const valor3 = Number(editArbitrage.casa_03_valor || 0);
    const odd3 = Number(editArbitrage.casa_03_odd || 0);

    const retorno1 = valor1 * odd1;
    const retorno2 = valor2 * odd2;
    const retorno3 = editArbitrage.casa_03_nome ? valor3 * odd3 : 0;
    const retornoPrevisto = Math.max(retorno1, retorno2, retorno3);

    const totalApostado = valor1 + valor2 + (editArbitrage.casa_03_nome ? valor3 : 0);
    const lucroProjetado = retornoPrevisto - totalApostado;

    const porcentagem = editArbitrage.casa_03_nome 
      ? ((1 / odd1 + 1 / odd2 + 1 / odd3) - 1) * 100
      : ((1 / odd1 + 1 / odd2) - 1) * 100;

    const updateData: any = {
      descricao: editArbitrage.descricao,
      data_evento: editArbitrage.data_evento,
      casa_01_nome: editArbitrage.casa_01_nome,
      casa_01_odd: editArbitrage.casa_01_odd,
      casa_01_valor: editArbitrage.casa_01_valor,
      casa_02_nome: editArbitrage.casa_02_nome,
      casa_02_odd: editArbitrage.casa_02_odd,
      casa_02_valor: editArbitrage.casa_02_valor,
      porcentagem: porcentagem,
      retorno_previsto: retornoPrevisto,
      lucro_projetado: lucroProjetado,
    };

    // Incluir casa_03 se existir
    if (editArbitrage.casa_03_nome) {
      updateData.casa_03_nome = editArbitrage.casa_03_nome;
      updateData.casa_03_odd = editArbitrage.casa_03_odd;
      updateData.casa_03_valor = editArbitrage.casa_03_valor;
    }

    const { error } = await supabase
      .from('arbitrages')
      .update(updateData)
      .eq('id', editArbitrage.id);

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Erro ao atualizar arbitragem',
        description: error.message,
      });
      return;
    }

    toast({
      title: 'Arbitragem atualizada!',
      description: 'As alterações foram salvas com sucesso.',
    });
    
    setEditArbitrage(null);
    await loadArbitragens();
  };

  const handleDuplicate = (arb: Arbitrage) => {
    // Preencher o formulário com os dados da arbitragem
    setFormData({
      data_evento: format(new Date(arb.data_evento), "yyyy-MM-dd'T'HH:mm"),
      descricao: arb.descricao,
      esporte_liga: arb.esporte_liga || '',
      casa_01_nome: arb.casa_01_nome,
      casa_01_odd: String(arb.casa_01_odd),
      casa_01_valor: String(arb.casa_01_valor),
      casa_01_mercado: arb.casa_01_mercado || 'Mercado não especificado',
      casa_02_nome: arb.casa_02_nome,
      casa_02_odd: String(arb.casa_02_odd),
      casa_02_valor: String(arb.casa_02_valor),
      casa_02_mercado: arb.casa_02_mercado || 'Mercado não especificado',
      casa_03_nome: arb.casa_03_nome || '',
      casa_03_odd: arb.casa_03_odd ? String(arb.casa_03_odd) : '',
      casa_03_valor: arb.casa_03_valor ? String(arb.casa_03_valor) : '',
      casa_03_mercado: arb.casa_03_mercado || '',
      porcentagem: String(arb.porcentagem),
      retorno_previsto: String(arb.retorno_previsto),
      lucro_projetado: String(arb.lucro_projetado),
    });

    // Definir se usa 3 casas baseado nos dados
    setUseTresCasas(!!arb.casa_03_nome);
    
    // Abrir o dialog na aba manual
    setActiveTab('manual');
    setOpenAdd(true);

    toast({
      title: 'Arbitragem duplicada!',
      description: 'Edite os dados e salve como uma nova arbitragem.',
    });
  };

  const calcularGanhoPorCasa = (
    aposta: number,
    odd: number,
    resultado: string
  ): number => {
    if (resultado === 'green') {
      // Ganho = (aposta × odd - aposta)
      return aposta * odd - aposta;
    } else if (resultado === 'red') {
      // Perdeu = valor negativo
      return -aposta;
    } else if (resultado === 'devolvido') {
      // Devolvido: lucro 0
      return 0;
    } else {
      // Aguardando
      return 0;
    }
  };

  // Contar filtros ativos
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    // Contar filtro de data apenas se ambas preenchidas OU apenas data fim
    if ((filterStartDate && filterEndDate) || (!filterStartDate && filterEndDate)) count++;
    if (isAdmin && filterUser.length > 0 && filterUser.length < users.length) count++;
    if (!filterStatus.includes('all')) count++;
    if (filterPartnership.length > 0) count++;
    return count;
  }, [filterStartDate, filterEndDate, filterUser, users.length, filterStatus, isAdmin, filterPartnership]);

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-3xl font-bold">Minhas Arbitragens</h1>
            {activeFiltersCount > 0 && (
              <>
                <Badge className="text-xs bg-yellow-400 text-black hover:bg-yellow-500">
                  {activeFiltersCount} filtro{activeFiltersCount > 1 ? 's' : ''} ativo{activeFiltersCount > 1 ? 's' : ''}
                </Badge>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearchText('');
                    setFilterStartDate('');
                    setFilterEndDate('');
                    setFilterStatus(['all']);
                    setFilterUser(users.map(u => u.id));
                    setFilterPartnership([]);
                    setSelectedPeriod('custom');
                  }}
                  className="h-8"
                >
                  <X className="h-4 w-4 mr-2" />
                  Limpar Filtros
                </Button>
              </>
            )}
            
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Buscar..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                className="pl-9 h-8 w-64"
              />
              {searchText && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
                  onClick={() => setSearchText('')}
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setViewMode(viewMode === 'table' ? 'cards' : 'table')}
              className="gap-2 h-8 hidden md:flex"
            >
              {viewMode === 'table' ? (
                <>
                  <LayoutGrid className="h-4 w-4" />
                  Cards
                </>
              ) : (
                <>
                  <TableIcon className="h-4 w-4" />
                  Tabela
                </>
              )}
            </Button>

            {viewMode === 'table' && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsExpandedView(!isExpandedView)}
                className="gap-2 h-8"
              >
                {isExpandedView ? (
                  <>
                    <Minimize2 className="h-4 w-4" />
                    Compacto
                  </>
                ) : (
                  <>
                    <Maximize2 className="h-4 w-4" />
                    Expandido
                  </>
                )}
              </Button>
            )}

            {/* Botão Ir para Casas */}
            <Dialog open={goToHousesOpen} onOpenChange={setGoToHousesOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2 h-8">
                  <Building2 className="h-4 w-4" />
                  Ir para Casas
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Selecionar Parceria</DialogTitle>
                  <DialogDescription>
                    Escolha a parceria para ver o desempenho das casas de apostas.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Parceria</Label>
                    <Select
                      value={selectedPartnershipForHouses}
                      onValueChange={setSelectedPartnershipForHouses}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione uma parceria" />
                      </SelectTrigger>
                      <SelectContent>
                        {partnerships.filter(p => p.status === 'ativo').map((partnership) => (
                          <SelectItem key={partnership.id} value={partnership.id}>
                            {formatUserName(partnership.nome_completo)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setGoToHousesOpen(false)}>
                      Cancelar
                    </Button>
                    <Button
                      onClick={() => {
                        if (selectedPartnershipForHouses) {
                          navigate(`/parcerias?partnership=${selectedPartnershipForHouses}&view=report`);
                          setGoToHousesOpen(false);
                        }
                      }}
                      disabled={!selectedPartnershipForHouses}
                    >
                      Ir para Casas
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          
          <div className="flex items-end gap-2 flex-wrap">
            {/* Filtros Rápidos de Período */}
            <div>
              <Label className="text-xs mb-1 block">Período Rápido</Label>
              <div className="flex gap-1">
                <Button
                  variant={selectedPeriod === 'hoje' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => applyPeriodFilter('hoje')}
                  className="h-10 px-3"
                >
                  Hoje
                </Button>
                <Button
                  variant={selectedPeriod === 'semana' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => applyPeriodFilter('semana')}
                  className="h-10 px-3"
                >
                  7 dias
                </Button>
                <Button
                  variant={selectedPeriod === 'mes' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => applyPeriodFilter('mes')}
                  className="h-10 px-3"
                >
                  30 dias
                </Button>
                <Button
                  variant={selectedPeriod === 'mes_atual' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => applyPeriodFilter('mes_atual')}
                  className="h-10 px-3"
                >
                  Mês atual
                </Button>
                <div className="flex items-center gap-1">
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button
                        variant={selectedPeriod === 'custom' && (filterStartDate || filterEndDate) ? 'default' : 'outline'}
                        size="sm"
                        className="h-10 px-3"
                      >
                        <Calendar className="h-4 w-4 mr-2" />
                        {filterStartDate && filterEndDate ? (
                          <>
                            {format(new Date(filterStartDate), 'dd/MM')} - {format(new Date(filterEndDate), 'dd/MM')}
                          </>
                        ) : filterEndDate ? (
                          format(new Date(filterEndDate), 'dd/MM')
                        ) : (
                          'Selecionar Data'
                        )}
                      </Button>
                    </DialogTrigger>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle>Selecionar Período</DialogTitle>
                      <DialogDescription>
                        Selecione a data inicial e final para filtrar as arbitragens adicionadas nesse período.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="start-date">
                          Data Início
                          <span className="text-muted-foreground ml-1">(Adicionado em)</span>
                        </Label>
                        <Input
                          id="start-date"
                          type="date"
                          value={filterStartDate}
                          onChange={(e) => {
                            setFilterStartDate(e.target.value);
                            setSelectedPeriod('custom');
                          }}
                          className="w-full"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="end-date">
                          Data Fim
                          <span className="text-muted-foreground ml-1">(Adicionado em)</span>
                        </Label>
                        <Input
                          id="end-date"
                          type="date"
                          value={filterEndDate}
                          onChange={(e) => {
                            setFilterEndDate(e.target.value);
                            setSelectedPeriod('custom');
                          }}
                          className="w-full"
                        />
                      </div>
                      <p className="text-sm text-muted-foreground">
                        * Preencha ambas as datas para filtrar um período, ou apenas a data fim para filtrar um dia específico.
                      </p>
                    </div>
                    <div className="flex justify-end gap-2 pt-4 border-t">
                      <DialogTrigger asChild>
                        <Button type="button">
                          OK
                        </Button>
                      </DialogTrigger>
                    </div>
                  </DialogContent>
                  </Dialog>
                  {(filterStartDate || filterEndDate) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-10 px-2"
                      onClick={() => {
                        setFilterStartDate('');
                        setFilterEndDate('');
                        setSelectedPeriod('custom');
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </div>

            <div>
              <Label className="text-xs mb-1 block">Status</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-40 h-10 justify-between">
                    <span className="truncate">
                      {filterStatus.includes('all') ? 'Todos' : `${filterStatus.length} selecionado(s)`}
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
                          id="arb-status-all"
                          checked={filterStatus.includes('all')}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setFilterStatus(['all']);
                            } else {
                              setFilterStatus([]);
                            }
                          }}
                        />
                        <label htmlFor="arb-status-all" className="text-sm font-medium cursor-pointer">
                          Todos
                        </label>
                      </div>
                      {['aguardando', 'green', 'red'].map((status) => (
                        <div key={status} className="flex items-center space-x-2">
                          <Checkbox
                            id={`arb-status-${status}`}
                            checked={!filterStatus.includes('all') && filterStatus.includes(status)}
                            onCheckedChange={(checked) => {
                              if (filterStatus.includes('all')) {
                                setFilterStatus([status]);
                              } else {
                                if (checked) {
                                  const newStatus = [...filterStatus, status];
                                  setFilterStatus(newStatus);
                                } else {
                                  const filtered = filterStatus.filter(s => s !== status);
                                  setFilterStatus(filtered.length === 0 ? ['all'] : filtered);
                                }
                              }
                            }}
                          />
                          <label htmlFor={`arb-status-${status}`} className="text-sm cursor-pointer capitalize">
                            {status === 'aguardando' ? 'Aguardando' : status === 'green' ? 'Green' : 'Red'}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            {isAdmin && (
              <div>
                <Label className="text-xs mb-1 block">Operador</Label>
                <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-52 h-10 justify-between">
                    <span className="truncate">
                      {filterUser.length === 0 
                        ? 'Todos os operadores' 
                        : filterUser.length === users.length
                        ? 'Todos os operadores'
                        : `${filterUser.length} operador(es)`
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
                        id="select-all"
                        checked={filterUser.length === users.length}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setFilterUser(users.map(u => u.id));
                          } else {
                            setFilterUser([]);
                          }
                        }}
                      />
                      <label
                        htmlFor="select-all"
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                      >
                        Selecionar Todos
                      </label>
                    </div>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {users.map((u) => (
                        <div key={u.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={u.id}
                            checked={filterUser.includes(u.id)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setFilterUser([...filterUser, u.id]);
                              } else {
                                setFilterUser(filterUser.filter(id => id !== u.id));
                              }
                            }}
                          />
                          <label
                            htmlFor={u.id}
                            className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                          >
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

            <div>
              <Label className="text-xs mb-1 block">Parceria</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-52 h-10 justify-between">
                    <span className="truncate">
                      {filterPartnership.length === 0 
                        ? 'Todas as parcerias' 
                        : filterPartnership.length === partnerships.length
                        ? 'Todas as parcerias'
                        : `${filterPartnership.length} parceria${filterPartnership.length > 1 ? 's' : ''}`
                      }
                    </span>
                    <Filter className="h-4 w-4 ml-2 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-3 bg-background z-50" align="start">
                  <div className="space-y-3">
                    <div className="font-semibold text-sm">Filtrar por Parceria</div>
                    <div className="flex items-center space-x-2 pb-2 border-b">
                      <Checkbox
                        id="select-all-partnerships"
                        checked={filterPartnership.length === partnerships.length}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setFilterPartnership(partnerships.map(p => p.id));
                          } else {
                            setFilterPartnership([]);
                          }
                        }}
                      />
                      <label
                        htmlFor="select-all-partnerships"
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                      >
                        Selecionar Todas
                      </label>
                    </div>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {partnerships.map((p) => (
                        <div key={p.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`partnership-${p.id}`}
                            checked={filterPartnership.includes(p.id)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setFilterPartnership([...filterPartnership, p.id]);
                              } else {
                                setFilterPartnership(filterPartnership.filter(id => id !== p.id));
                              }
                            }}
                          />
                          <label
                            htmlFor={`partnership-${p.id}`}
                            className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                          >
                            {formatUserName(p.nome_completo)}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                </PopoverContent>
            </Popover>
            </div>

            <Dialog open={openAdd} onOpenChange={setOpenAdd}>
              <DialogTrigger asChild>
                <Button className="gap-2 h-10">
                  <Plus className="h-4 w-4" />
                  Adicionar Arbitragem
                </Button>
              </DialogTrigger>
            </Dialog>
          </div>
        </div>

        {/* Card de Totais */}
        {filteredArbitragens.length > 0 && (
          <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
            <div className="rounded-lg border bg-card p-3">
              <div className="text-xs text-muted-foreground mb-1">Total de Arbitragens</div>
              <div className="text-xl font-bold">{filteredArbitragens.length}</div>
            </div>
            <div className="rounded-lg border bg-card p-3">
              <div className="text-xs text-muted-foreground mb-1">Total Investido</div>
              <div className="text-xl font-bold">R$ {formatCurrency(totais.totalInvestido)}</div>
            </div>
            <div className="rounded-lg border bg-card p-3">
              <div className="text-xs text-muted-foreground mb-1">Lucro Total</div>
              <div className={`text-xl font-bold ${totais.totalLucro >= 0 ? 'text-success' : 'text-destructive'}`}>
                R$ {formatCurrency(totais.totalLucro)}
              </div>
              <p className="text-[10px] text-muted-foreground">Inclui projetado</p>
            </div>
            <div className="rounded-lg border bg-card p-3">
              <div className="text-xs text-muted-foreground mb-1">ROI</div>
              <div className={`text-xl font-bold ${totais.totalInvestido > 0 && (totais.totalLucro / totais.totalInvestido) >= 0 ? 'text-success' : 'text-destructive'}`}>
                {totais.totalInvestido > 0 ? formatCurrency((totais.totalLucro / totais.totalInvestido) * 100) : '0'}%
              </div>
              <p className="text-[10px] text-muted-foreground">Sobre investimento</p>
            </div>
            {user?.id && (
              <MonthlyGoalCard
                userId={user.id}
                selectedUserIds={isAdmin && filterUser.length > 0 ? filterUser : undefined}
                currentProfit={goalProfit}
                compact
              />
            )}
          </div>
        )}

        {arbitragens.length === 0 ? (
          <div className="rounded-lg border p-8 text-center text-muted-foreground">
            <p>Nenhuma arbitragem cadastrada ainda.</p>
          </div>
        ) : viewMode === 'cards' ? (
          // Visualização em Cards
          <>
            {/* Botão de ordenação para cards */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 bg-sky-300 rounded-full"></span>
                  Hoje
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                  Atrasado
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                className="h-8 text-xs gap-1"
                title="Ordenar por data do jogo"
              >
                {sortOrder === 'desc' ? (
                  <>
                    <ArrowUp className="h-3.5 w-3.5" />
                    Próximo jogo
                  </>
                ) : (
                  <>
                    <ArrowDown className="h-3.5 w-3.5" />
                    Jogo distante
                  </>
                )}
              </Button>
            </div>
            {isMobile ? (
            // Visualização Mobile Compacta
            <div className="space-y-3">
              {paginatedArbitragens.map((arb) => {
                const eventDate = new Date(arb.data_evento);
                eventDate.setHours(0, 0, 0, 0);
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const isEventPast = eventDate < today;
                const isEventToday = eventDate.getTime() === today.getTime();
                
                return (
                  <div
                    key={arb.id}
                    className={`rounded-lg border bg-card p-3 ${
                      isEventPast && arb.status === 'aguardando'
                        ? 'border-l-4 border-red-500'
                        : isEventToday
                        ? 'border-l-4 border-sky-300'
                        : ''
                    }`}
                  >
                    {/* Header Compacto */}
                    <div className="flex items-center justify-between mb-2">
                      <Badge variant={getConsolidatedStatus(arb.status, arb.lucro_real).variant} className="text-[10px]">
                        {getConsolidatedStatus(arb.status, arb.lucro_real).label}
                      </Badge>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditArbitrage(arb)}
                          className="h-7 w-7 p-0"
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDuplicate(arb)}
                          className="h-7 w-7 p-0"
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>

                    {/* Evento */}
                    <div className="mb-2">
                      {(() => {
                        const eventDateTime = new Date(arb.data_evento);
                        const now = new Date();
                        const isGameStarted = eventDateTime <= now;
                        const shouldPulse = isGameStarted && arb.status === 'aguardando';
                        return (
                          <div className={`text-[10px] mb-0.5 ${shouldPulse ? 'text-destructive font-semibold animate-pulse' : isGameStarted ? 'text-destructive font-semibold' : 'text-muted-foreground'}`}>
                            <Clock className="inline h-3 w-3 mr-1" />
                            {format(eventDateTime, 'dd/MM/yy HH:mm')}
                          </div>
                        );
                      })()}
                      <div className="font-medium text-sm line-clamp-2">{arb.descricao}</div>
                    </div>

                    {/* Casas - Layout Horizontal Compacto */}
                    <div className="grid grid-cols-2 gap-2 mb-2">
                      <div className="text-[10px] space-y-0.5">
                        <div className="font-medium truncate">{arb.casa_01_nome}</div>
                        <div className="text-muted-foreground">{Number(arb.casa_01_odd).toFixed(2)}x</div>
                        <div className="text-muted-foreground">R$ {formatCurrency(arb.casa_01_valor)}</div>
                      </div>
                      <div className="text-[10px] space-y-0.5">
                        <div className="font-medium truncate">{arb.casa_02_nome}</div>
                        <div className="text-muted-foreground">{Number(arb.casa_02_odd).toFixed(2)}x</div>
                        <div className="text-muted-foreground">R$ {formatCurrency(arb.casa_02_valor)}</div>
                      </div>
                    </div>

                    {/* Lucro - Compacto */}
                    <div className="flex items-center justify-between pt-2 border-t">
                      <div className="text-[10px]">
                        <span className="text-muted-foreground">Lucro: </span>
                        <span className={`font-semibold ${arb.lucro_real >= 0 ? 'text-success' : 'text-destructive'}`}>
                          R$ {formatCurrency(arb.lucro_real)}
                        </span>
                      </div>
                      <Button
                        variant="link"
                        size="sm"
                        className="h-auto p-0 text-[10px]"
                        onClick={() => setViewGanhosArbitrage(arb)}
                      >
                        Ver detalhes
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            // Visualização Desktop Normal
            <div className="space-y-4">
              {paginatedArbitragens.map((arb) => {
                const timeToEvent = differenceInMilliseconds(new Date(arb.data_evento), new Date());
                const days = Math.floor(timeToEvent / (1000 * 60 * 60 * 24));
                const hours = Math.floor((timeToEvent % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                const minutes = Math.floor((timeToEvent % (1000 * 60 * 60)) / (1000 * 60));
                
                const eventDate = new Date(arb.data_evento);
                eventDate.setHours(0, 0, 0, 0);
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const isEventPast = eventDate < today;
                const isEventToday = eventDate.getTime() === today.getTime();
              
                return (
                <div
                  key={arb.id}
                  className={`rounded-lg border bg-card p-4 ${
                    isEventPast && arb.status === 'aguardando'
                      ? 'border-l-4 border-red-500'
                      : isEventToday
                      ? 'border-l-4 border-sky-300'
                      : ''
                  }`}
                >
                  {/* Header do Card */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge variant={getConsolidatedStatus(arb.status, arb.lucro_real).variant}>
                          {getConsolidatedStatus(arb.status, arb.lucro_real).label}
                        </Badge>
                        {isAdmin && (
                          <span className="text-xs text-muted-foreground">
                            {formatUserName((arb as any).profiles?.name) || 'Desconhecido'}
                          </span>
                        )}
                      </div>
                      <div className="text-sm">
                        <span className="text-muted-foreground">Adicionado: </span>
                        <span>{format(new Date(arb.created_at), 'dd/MM/yy HH:mm')}</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditArbitrage(arb)}
                        title="Editar arbitragem"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDuplicate(arb)}
                        title="Duplicar arbitragem"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      {isAdmin && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteId(arb.id)}
                          title="Excluir arbitragem"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Informações do Evento */}
                  <div className="mb-4 pb-4 border-b">
                    {(() => {
                      const eventDateTime = new Date(arb.data_evento);
                      const now = new Date();
                      const isGameStarted = eventDateTime <= now;
                      const shouldPulse = isGameStarted && arb.status === 'aguardando';
                      return (
                        <div className={`text-sm mb-1 ${shouldPulse ? 'text-destructive font-semibold animate-pulse' : isGameStarted ? 'text-destructive font-semibold' : 'text-muted-foreground'}`}>
                          <Clock className="inline h-3 w-3 mr-1" />
                          {format(eventDateTime, 'dd/MM/yy HH:mm')}
                          {timeToEvent > 0 && (
                            <span className="ml-2">
                              ({days > 0 && `${days}d `}{hours}h {minutes}m)
                            </span>
                          )}
                        </div>
                      );
                    })()}
                    <div className="font-medium text-lg">{arb.descricao}</div>
                    {arb.esporte_liga && (
                      <div className="text-sm text-muted-foreground">{arb.esporte_liga}</div>
                    )}
                  </div>

                  {/* Casas de Apostas */}
                  <div className="grid gap-3 mb-4">
                    {/* Casa 01 */}
                    <div className="rounded-lg bg-muted/50 p-3">
                      <div className="flex items-start justify-between mb-2">
                        <div className="space-y-1 flex-1">
                          {arb.partnerships_casa_01 && (
                            <div className="text-[10px] text-primary font-medium">
                              {formatUserName(arb.partnerships_casa_01.nome_completo)}
                            </div>
                          )}
                          <div className="font-medium">{arb.casa_01_nome}</div>
                          {arb.casa_01_mercado && (
                            <div className="text-xs text-muted-foreground">{arb.casa_01_mercado}</div>
                          )}
                          <div className="text-sm text-muted-foreground">
                            {Number(arb.casa_01_odd).toFixed(3)}x • R$ {formatCurrency(arb.casa_01_valor)}
                          </div>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
                              {resultadoMap[arb.casa_01_resultado]?.label || 'Definir'}
                              <ChevronDown className="h-3 w-3" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent>
                            {resultOptions.map((option) => (
                              <DropdownMenuItem
                                key={option.value}
                                onClick={() => handleUpdateResult(arb.id, 'casa_01', option.value)}
                              >
                                {option.label}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>

                    {/* Casa 02 */}
                    <div className="rounded-lg bg-muted/50 p-3">
                      <div className="flex items-start justify-between mb-2">
                        <div className="space-y-1 flex-1">
                          {arb.partnerships_casa_02 && (
                            <div className="text-[10px] text-primary font-medium">
                              {formatUserName(arb.partnerships_casa_02.nome_completo)}
                            </div>
                          )}
                          <div className="font-medium">{arb.casa_02_nome}</div>
                          {arb.casa_02_mercado && (
                            <div className="text-xs text-muted-foreground">{arb.casa_02_mercado}</div>
                          )}
                          <div className="text-sm text-muted-foreground">
                            {Number(arb.casa_02_odd).toFixed(3)}x • R$ {formatCurrency(arb.casa_02_valor)}
                          </div>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
                              {resultadoMap[arb.casa_02_resultado]?.label || 'Definir'}
                              <ChevronDown className="h-3 w-3" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent>
                            {resultOptions.map((option) => (
                              <DropdownMenuItem
                                key={option.value}
                                onClick={() => handleUpdateResult(arb.id, 'casa_02', option.value)}
                              >
                                {option.label}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>

                    {/* Casa 03 */}
                    {arb.casa_03_nome && (
                      <div className="rounded-lg bg-muted/50 p-3">
                        <div className="flex items-start justify-between mb-2">
                          <div className="space-y-1 flex-1">
                            {arb.partnerships_casa_03 && (
                              <div className="text-[10px] text-primary font-medium">
                                {formatUserName(arb.partnerships_casa_03.nome_completo)}
                              </div>
                            )}
                            <div className="font-medium">{arb.casa_03_nome}</div>
                            {arb.casa_03_mercado && (
                              <div className="text-xs text-muted-foreground">{arb.casa_03_mercado}</div>
                            )}
                            <div className="text-sm text-muted-foreground">
                              {Number(arb.casa_03_odd).toFixed(3)}x • R$ {formatCurrency(arb.casa_03_valor)}
                            </div>
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
                                {resultadoMap[arb.casa_03_resultado || '']?.label || 'Definir'}
                                <ChevronDown className="h-3 w-3" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent>
                              {resultOptions.map((option) => (
                                <DropdownMenuItem
                                  key={option.value}
                                  onClick={() => handleUpdateResult(arb.id, 'casa_03', option.value)}
                                >
                                  {option.label}
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Informações de Lucro */}
                  <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Lucro Real</div>
                      <div className={`text-lg font-semibold ${arb.lucro_real >= 0 ? 'text-success' : 'text-destructive'}`}>
                        R$ {formatCurrency(arb.lucro_real)}
                      </div>
                      <Button
                        variant="link"
                        size="sm"
                        className="h-auto p-0 text-xs"
                        onClick={() => setViewGanhosArbitrage(arb)}
                      >
                        Ver ganhos
                      </Button>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Lucro Projetado</div>
                      <div className="text-lg font-medium">R$ {formatCurrency(arb.lucro_projetado)}</div>
                      <div className="text-xs text-muted-foreground">
                        {arb.porcentagem.toFixed(2)}% • R$ {formatCurrency(arb.retorno_previsto)}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          )}
          </>
        ) : (
          // Visualização em Tabela
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className={isExpandedView ? 'min-w-[120px]' : ''}>Adicionado em</TableHead>
                  <TableHead className={isExpandedView ? 'min-w-[300px]' : 'min-w-[200px]'}>
                    <div className="flex flex-col gap-1">
                      <span>Data do Jogo / Descrição</span>
                      <div className="flex gap-3 text-[10px] font-normal">
                        <span className="flex items-center gap-1">
                          <span className="w-2 h-2 bg-sky-300 rounded-full"></span>
                          Hoje
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                          Atrasado
                        </span>
                      </div>
                    </div>
                  </TableHead>
                  {isAdmin && <TableHead className={isExpandedView ? 'min-w-[150px]' : 'min-w-[100px]'}>Operador</TableHead>}
                  <TableHead className={isExpandedView ? 'min-w-[250px]' : 'min-w-[180px]'}>Casa 01</TableHead>
                  <TableHead className={isExpandedView ? 'min-w-[250px]' : 'min-w-[180px]'}>Casa 02</TableHead>
                  <TableHead className={isExpandedView ? 'min-w-[250px]' : 'min-w-[180px]'}>Casa 03</TableHead>
                  <TableHead className={isExpandedView ? 'min-w-[120px]' : ''}>Lucro</TableHead>
                  <TableHead className={isExpandedView ? 'min-w-[130px]' : ''}>Status</TableHead>
                  <TableHead className={isExpandedView ? 'min-w-[120px]' : ''}>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedArbitragens.map((arb) => {
                  const timeToEvent = differenceInMilliseconds(new Date(arb.data_evento), new Date());
                  const days = Math.floor(timeToEvent / (1000 * 60 * 60 * 24));
                  const hours = Math.floor((timeToEvent % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                  const minutes = Math.floor((timeToEvent % (1000 * 60 * 60)) / (1000 * 60));
                  
                  // Comparar apenas as datas (sem hora)
                  const eventDate = new Date(arb.data_evento);
                  eventDate.setHours(0, 0, 0, 0);
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  const isEventPast = eventDate < today;
                  const isEventToday = eventDate.getTime() === today.getTime();
                  
                  return (
                  <TableRow key={arb.id}>
                    <TableCell className={`text-xs relative ${
                      isEventPast && arb.status === 'aguardando'
                        ? 'border-l-4 border-red-500'
                        : isEventToday
                        ? 'border-l-4 border-sky-300'
                        : ''
                    }`}>
                      {isEventPast && arb.status === 'aguardando' ? (
                        <div className="absolute left-0 top-1 bottom-1 w-1 bg-red-500 animate-pulse" />
                      ) : isEventToday ? (
                        <div className="absolute left-0 top-1 bottom-1 w-1 bg-sky-300 animate-pulse" />
                      ) : null}
                      <div className="flex flex-col pl-2">
                        <span>{format(new Date(arb.created_at), 'dd/MM/yy')}</span>
                        <span className="text-muted-foreground">
                          {format(new Date(arb.created_at), 'HH:mm')}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className={`max-w-[200px] text-xs ${isExpandedView ? 'max-w-[350px]' : 'max-w-[250px]'}`}>
                      <div className="flex flex-col gap-0.5">
                        {(() => {
                          const eventDateTime = new Date(arb.data_evento);
                          const now = new Date();
                          const isGameStarted = eventDateTime <= now;
                          const shouldPulse = isGameStarted && arb.status === 'aguardando';
                          return (
                            <span className={`${shouldPulse ? 'text-destructive font-semibold animate-pulse' : isGameStarted ? 'text-destructive font-semibold' : 'text-muted-foreground'}`}>
                              {format(eventDateTime, 'dd/MM/yy HH:mm')}
                            </span>
                          );
                        })()}
                        <span className="font-medium break-words whitespace-normal">{arb.descricao}</span>
                        {arb.esporte_liga && (
                          <span className="text-muted-foreground break-words whitespace-normal">{arb.esporte_liga}</span>
                        )}
                      </div>
                    </TableCell>
                    {isAdmin && (
                      <TableCell className="text-xs">
                        {formatUserName((arb as any).profiles?.name) || 'Desconhecido'}
                      </TableCell>
                    )}
                    <TableCell className="text-xs">
                      <div className="space-y-1.5">
                        <div>
                          {arb.partnerships_casa_01 && (
                            <div className="text-[10px] text-primary font-medium mb-1">
                              {formatUserName(arb.partnerships_casa_01.nome_completo)}
                            </div>
                          )}
                          <div className="font-medium break-words whitespace-normal">{arb.casa_01_nome}</div>
                          {arb.casa_01_mercado && (
                            <div className="text-muted-foreground text-[10px]">{arb.casa_01_mercado}</div>
                          )}
                          <div className="text-muted-foreground">
                            {Number(arb.casa_01_odd).toFixed(3)}x • R$ {formatCurrency(arb.casa_01_valor)}
                          </div>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs gap-1"
                            >
                              {resultadoMap[arb.casa_01_resultado]?.label || 'Definir'}
                              <ChevronDown className="h-3 w-3" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent>
                            {resultOptions.map((option) => (
                              <DropdownMenuItem
                                key={option.value}
                                onClick={() =>
                                  handleUpdateResult(arb.id, 'casa_01', option.value)
                                }
                              >
                                {option.label}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs">
                      <div className="space-y-1.5">
                        <div>
                          {arb.partnerships_casa_02 && (
                            <div className="text-[10px] text-primary font-medium mb-1">
                              {formatUserName(arb.partnerships_casa_02.nome_completo)}
                            </div>
                          )}
                          <div className="font-medium break-words whitespace-normal">{arb.casa_02_nome}</div>
                          {arb.casa_02_mercado && (
                            <div className="text-muted-foreground text-[10px]">{arb.casa_02_mercado}</div>
                          )}
                          <div className="text-muted-foreground">
                            {Number(arb.casa_02_odd).toFixed(3)}x • R$ {formatCurrency(arb.casa_02_valor)}
                          </div>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs gap-1"
                            >
                              {resultadoMap[arb.casa_02_resultado]?.label || 'Definir'}
                              <ChevronDown className="h-3 w-3" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent>
                            {resultOptions.map((option) => (
                              <DropdownMenuItem
                                key={option.value}
                                onClick={() =>
                                  handleUpdateResult(arb.id, 'casa_02', option.value)
                                }
                              >
                                {option.label}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs">
                      {arb.casa_03_nome ? (
                        <div className="space-y-1.5">
                          <div>
                            {arb.partnerships_casa_03 && (
                              <div className="text-[10px] text-primary font-medium mb-1">
                                {formatUserName(arb.partnerships_casa_03.nome_completo)}
                              </div>
                            )}
                            <div className="font-medium break-words whitespace-normal">{arb.casa_03_nome}</div>
                            {arb.casa_03_mercado && (
                              <div className="text-muted-foreground text-[10px]">{arb.casa_03_mercado}</div>
                            )}
                            <div className="text-muted-foreground">
                              {Number(arb.casa_03_odd).toFixed(3)}x • R$ {formatCurrency(arb.casa_03_valor)}
                            </div>
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs gap-1"
                              >
                                {resultadoMap[arb.casa_03_resultado || '']?.label || 'Definir'}
                                <ChevronDown className="h-3 w-3" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent>
                              {resultOptions.map((option) => (
                                <DropdownMenuItem
                                  key={option.value}
                                  onClick={() =>
                                    handleUpdateResult(arb.id, 'casa_03', option.value)
                                  }
                                >
                                  {option.label}
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">
                      <div className="space-y-0.5">
                        <div
                          className={`font-semibold ${
                            arb.lucro_real >= 0 ? 'text-success' : 'text-destructive'
                          }`}
                        >
                          R$ {formatCurrency(arb.lucro_real)}
                        </div>
                        <div className="text-muted-foreground">
                          {arb.porcentagem.toFixed(2)}% • R$ {formatCurrency(arb.retorno_previsto)}
                        </div>
                        <div className="text-muted-foreground">
                          Proj: R$ {formatCurrency(arb.lucro_projetado)}
                        </div>
                        <Button
                          variant="link"
                          size="sm"
                          className="h-auto p-0 text-xs"
                          onClick={() => setViewGanhosArbitrage(arb)}
                        >
                          Ver ganhos
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getConsolidatedStatus(arb.status, arb.lucro_real).variant}>
                        {getConsolidatedStatus(arb.status, arb.lucro_real).label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-2">
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditArbitrage(arb)}
                            title="Editar arbitragem"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDuplicate(arb)}
                            title="Duplicar arbitragem"
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                          {isAdmin && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setDeleteId(arb.id)}
                              title="Excluir arbitragem"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                        {timeToEvent > 0 && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            <span>
                              {days > 0 && `${days}d `}
                              {hours}h {minutes}m
                            </span>
                          </div>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )})}
              </TableBody>
            </Table>
          </div>
        )}
        
        {arbitragens.length > itemsPerPage && (
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious 
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                />
              </PaginationItem>
              {[...Array(totalPages)].map((_, i) => (
                <PaginationItem key={i + 1}>
                  <PaginationLink
                    onClick={() => setCurrentPage(i + 1)}
                    isActive={currentPage === i + 1}
                    className="cursor-pointer"
                  >
                    {i + 1}
                  </PaginationLink>
                </PaginationItem>
              ))}
              <PaginationItem>
                <PaginationNext 
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  className={currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        )}
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir esta arbitragem? Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete}>Excluir</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Dialog open={!!editArbitrage} onOpenChange={() => setEditArbitrage(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Editar Arbitragem</DialogTitle>
            </DialogHeader>
            {editArbitrage && (
              <div className="space-y-4">
                <div>
                  <Label>Descrição</Label>
                  <Input
                    value={editArbitrage.descricao}
                    onChange={(e) => setEditArbitrage({ ...editArbitrage, descricao: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Data do Evento</Label>
                  <Input
                    type="datetime-local"
                    value={format(new Date(editArbitrage.data_evento), "yyyy-MM-dd'T'HH:mm")}
                    onChange={(e) => setEditArbitrage({ ...editArbitrage, data_evento: new Date(e.target.value + ':00').toISOString() })}
                  />
                </div>
                <div className={`grid gap-4 ${editArbitrage.casa_03_nome ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}>
                  <div>
                    <h3 className="font-semibold mb-2">Casa 01</h3>
                    <div className="space-y-2">
                      <div>
                        <Label>Nome</Label>
                        <Input
                          value={editArbitrage.casa_01_nome}
                          onChange={(e) => setEditArbitrage({ ...editArbitrage, casa_01_nome: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label>Odd</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={editArbitrage.casa_01_odd}
                          onChange={(e) => setEditArbitrage({ ...editArbitrage, casa_01_odd: parseFloat(e.target.value) })}
                        />
                      </div>
                      <div>
                        <Label>Valor</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={editArbitrage.casa_01_valor}
                          onChange={(e) => setEditArbitrage({ ...editArbitrage, casa_01_valor: parseFloat(e.target.value) })}
                        />
                      </div>
                    </div>
                  </div>
                  <div>
                    <h3 className="font-semibold mb-2">Casa 02</h3>
                    <div className="space-y-2">
                      <div>
                        <Label>Nome</Label>
                        <Input
                          value={editArbitrage.casa_02_nome}
                          onChange={(e) => setEditArbitrage({ ...editArbitrage, casa_02_nome: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label>Odd</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={editArbitrage.casa_02_odd}
                          onChange={(e) => setEditArbitrage({ ...editArbitrage, casa_02_odd: parseFloat(e.target.value) })}
                        />
                      </div>
                      <div>
                        <Label>Valor</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={editArbitrage.casa_02_valor}
                          onChange={(e) => setEditArbitrage({ ...editArbitrage, casa_02_valor: parseFloat(e.target.value) })}
                        />
                      </div>
                    </div>
                  </div>
                  {editArbitrage.casa_03_nome && (
                    <div>
                      <h3 className="font-semibold mb-2">Casa 03</h3>
                      <div className="space-y-2">
                        <div>
                          <Label>Nome</Label>
                          <Input
                            value={editArbitrage.casa_03_nome}
                            onChange={(e) => setEditArbitrage({ ...editArbitrage, casa_03_nome: e.target.value })}
                          />
                        </div>
                        <div>
                          <Label>Odd</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={editArbitrage.casa_03_odd || 0}
                            onChange={(e) => setEditArbitrage({ ...editArbitrage, casa_03_odd: parseFloat(e.target.value) })}
                          />
                        </div>
                        <div>
                          <Label>Valor</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={editArbitrage.casa_03_valor || 0}
                            onChange={(e) => setEditArbitrage({ ...editArbitrage, casa_03_valor: parseFloat(e.target.value) })}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                {editArbitrage.casa_03_nome && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Porcentagem (%)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={editArbitrage.porcentagem}
                        onChange={(e) => setEditArbitrage({ ...editArbitrage, porcentagem: parseFloat(e.target.value) })}
                      />
                    </div>
                    <div>
                      <Label>Lucro Projetado (R$)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={editArbitrage.lucro_projetado}
                        onChange={(e) => setEditArbitrage({ ...editArbitrage, lucro_projetado: parseFloat(e.target.value) })}
                      />
                    </div>
                  </div>
                )}
                <div className="flex justify-end gap-2 pt-4">
                  <Button variant="outline" onClick={() => setEditArbitrage(null)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleEdit}>
                    Salvar Alterações
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      

      {/* Dialog de Ganhos por Casa */}
      {viewGanhosArbitrage && (
        <Dialog open={!!viewGanhosArbitrage} onOpenChange={() => setViewGanhosArbitrage(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Ganhos por Casa de Aposta</DialogTitle>
              <DialogDescription>
                Visualize o ganho/perda em cada casa de aposta
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="rounded-lg border p-4 space-y-2">
                <h3 className="font-semibold">{viewGanhosArbitrage.casa_01_nome}</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="text-muted-foreground">Aposta:</div>
                  <div>R$ {formatCurrency(viewGanhosArbitrage.casa_01_valor)}</div>
                  <div className="text-muted-foreground">Odd:</div>
                  <div>{viewGanhosArbitrage.casa_01_odd}x</div>
                  <div className="text-muted-foreground">Resultado:</div>
                  <div>
                    <Badge variant={resultadoMap[viewGanhosArbitrage.casa_01_resultado]?.variant || 'secondary'}>
                      {resultadoMap[viewGanhosArbitrage.casa_01_resultado]?.label || 'Aguardando'}
                    </Badge>
                  </div>
                  <div className="text-muted-foreground font-semibold">Ganho/Perda:</div>
                  <div className={`font-semibold ${
                    calcularGanhoPorCasa(
                      viewGanhosArbitrage.casa_01_valor,
                      viewGanhosArbitrage.casa_01_odd,
                      viewGanhosArbitrage.casa_01_resultado
                    ) >= 0 ? 'text-success' : 'text-destructive'
                  }`}>
                    R$ {calcularGanhoPorCasa(
                      viewGanhosArbitrage.casa_01_valor,
                      viewGanhosArbitrage.casa_01_odd,
                      viewGanhosArbitrage.casa_01_resultado
                    ).toFixed(2)}
                  </div>
                </div>
              </div>

              <div className="rounded-lg border p-4 space-y-2">
                <h3 className="font-semibold">{viewGanhosArbitrage.casa_02_nome}</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="text-muted-foreground">Aposta:</div>
                  <div>R$ {formatCurrency(viewGanhosArbitrage.casa_02_valor)}</div>
                  <div className="text-muted-foreground">Odd:</div>
                  <div>{viewGanhosArbitrage.casa_02_odd}x</div>
                  <div className="text-muted-foreground">Resultado:</div>
                  <div>
                    <Badge variant={resultadoMap[viewGanhosArbitrage.casa_02_resultado]?.variant || 'secondary'}>
                      {resultadoMap[viewGanhosArbitrage.casa_02_resultado]?.label || 'Aguardando'}
                    </Badge>
                  </div>
                  <div className="text-muted-foreground font-semibold">Ganho/Perda:</div>
                  <div className={`font-semibold ${
                    calcularGanhoPorCasa(
                      viewGanhosArbitrage.casa_02_valor,
                      viewGanhosArbitrage.casa_02_odd,
                      viewGanhosArbitrage.casa_02_resultado
                    ) >= 0 ? 'text-success' : 'text-destructive'
                  }`}>
                    R$ {formatCurrency(calcularGanhoPorCasa(
                      viewGanhosArbitrage.casa_02_valor,
                      viewGanhosArbitrage.casa_02_odd,
                      viewGanhosArbitrage.casa_02_resultado
                    ))}
                  </div>
                </div>
              </div>

              {viewGanhosArbitrage.casa_03_nome && (
                <div className="rounded-lg border p-4 space-y-2">
                  <h3 className="font-semibold">{viewGanhosArbitrage.casa_03_nome}</h3>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="text-muted-foreground">Aposta:</div>
                    <div>R$ {formatCurrency(viewGanhosArbitrage.casa_03_valor || 0)}</div>
                    <div className="text-muted-foreground">Odd:</div>
                    <div>{viewGanhosArbitrage.casa_03_odd}x</div>
                    <div className="text-muted-foreground">Resultado:</div>
                    <div>
                      <Badge variant={resultadoMap[viewGanhosArbitrage.casa_03_resultado || '']?.variant || 'secondary'}>
                        {resultadoMap[viewGanhosArbitrage.casa_03_resultado || '']?.label || 'Aguardando'}
                      </Badge>
                    </div>
                    <div className="text-muted-foreground font-semibold">Ganho/Perda:</div>
                    <div className={`font-semibold ${
                      calcularGanhoPorCasa(
                        viewGanhosArbitrage.casa_03_valor || 0,
                        viewGanhosArbitrage.casa_03_odd || 0,
                        viewGanhosArbitrage.casa_03_resultado || 'aguardando'
                      ) >= 0 ? 'text-success' : 'text-destructive'
                    }`}>
                      R$ {formatCurrency(calcularGanhoPorCasa(
                        viewGanhosArbitrage.casa_03_valor || 0,
                        viewGanhosArbitrage.casa_03_odd || 0,
                        viewGanhosArbitrage.casa_03_resultado || 'aguardando'
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <div className="rounded-lg bg-muted p-4">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="font-semibold">Total de Ganhos/Perdas:</div>
                  <div className={`font-bold text-lg ${
                    (calcularGanhoPorCasa(
                      viewGanhosArbitrage.casa_01_valor,
                      viewGanhosArbitrage.casa_01_odd,
                      viewGanhosArbitrage.casa_01_resultado
                    ) +
                    calcularGanhoPorCasa(
                      viewGanhosArbitrage.casa_02_valor,
                      viewGanhosArbitrage.casa_02_odd,
                      viewGanhosArbitrage.casa_02_resultado
                    ) +
                    calcularGanhoPorCasa(
                      viewGanhosArbitrage.casa_03_valor || 0,
                      viewGanhosArbitrage.casa_03_odd || 0,
                      viewGanhosArbitrage.casa_03_resultado || 'aguardando'
                    )) >= 0 ? 'text-success' : 'text-destructive'
                  }`}>
                    R$ {formatCurrency(
                      calcularGanhoPorCasa(
                        viewGanhosArbitrage.casa_01_valor,
                        viewGanhosArbitrage.casa_01_odd,
                        viewGanhosArbitrage.casa_01_resultado
                      ) +
                      calcularGanhoPorCasa(
                        viewGanhosArbitrage.casa_02_valor,
                        viewGanhosArbitrage.casa_02_odd,
                        viewGanhosArbitrage.casa_02_resultado
                      ) +
                      calcularGanhoPorCasa(
                        viewGanhosArbitrage.casa_03_valor || 0,
                        viewGanhosArbitrage.casa_03_odd || 0,
                        viewGanhosArbitrage.casa_03_resultado || 'aguardando'
                      )
                    )}
                  </div>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Dialog para adicionar arbitragem */}
      <Dialog open={openAdd} onOpenChange={setOpenAdd}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nova Arbitragem</DialogTitle>
            <DialogDescription>
              Cole o texto da arbitragem ou preencha manualmente
            </DialogDescription>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="paste">
                <FileText className="h-4 w-4 mr-2" />
                Colar Texto
              </TabsTrigger>
              <TabsTrigger value="manual">
                Manual
              </TabsTrigger>
            </TabsList>

            <TabsContent value="paste" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="pasteText">Cole o texto da arbitragem aqui</Label>
                <Textarea
                  id="pasteText"
                  placeholder="Cole aqui o texto da arbitragem formatado com tabs..."
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  className="min-h-[200px] font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Formato esperado: 
                  <br />- Linha 1: Data/Hora, Evento, Esporte/Liga
                  <br />- Linha 2: Casa 01 (nome, mercado, odd, valor, etc)
                  <br />- Linha 3: Casa 02
                  <br />- Linha 4 (opcional): Casa 03 ou Total
                </p>
              </div>
              <Button 
                type="button" 
                onClick={handleParsePaste}
                className="w-full"
                disabled={!pasteText.trim()}
              >
                Processar e Preencher Formulário
              </Button>
            </TabsContent>

            <TabsContent value="manual">
              <form onSubmit={handleSubmitAdd} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="data_evento_add">Data e Hora do Evento</Label>
                  <Input
                    id="data_evento_add"
                    type="datetime-local"
                    value={formData.data_evento}
                    onChange={(e) => setFormData({ ...formData, data_evento: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="descricao_add">Descrição do Evento</Label>
                  <Textarea
                    id="descricao_add"
                    placeholder="Ex: Flamengo vs Palmeiras"
                    value={formData.descricao}
                    onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="esporte_liga_add">Esporte / Liga</Label>
                  <Input
                    id="esporte_liga_add"
                    placeholder="Ex: Futebol - Campeonato Brasileiro"
                    value={formData.esporte_liga}
                    onChange={(e) => setFormData({ ...formData, esporte_liga: e.target.value })}
                  />
                </div>

                <div className="flex items-center gap-4">
                  <Button
                    type="button"
                    variant={!useTresCasas ? "default" : "outline"}
                    onClick={() => setUseTresCasas(false)}
                    className="flex-1"
                  >
                    2 Casas
                  </Button>
                  <Button
                    type="button"
                    variant={useTresCasas ? "default" : "outline"}
                    onClick={() => setUseTresCasas(true)}
                    className="flex-1"
                  >
                    3 Casas
                  </Button>
                </div>

                <div className={`grid gap-4 ${useTresCasas ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}>
                  <div className="space-y-4 p-4 border rounded-lg">
                    <h3 className="font-semibold text-lg">Casa 01</h3>
                    {partnerships.length > 1 && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="parceria_01">Parceria</Label>
                          {selectedPartnership01 !== defaultPartnershipId && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-6 text-xs"
                              onClick={() => handleSetDefaultPartnership(selectedPartnership01)}
                            >
                              <Star className="h-3 w-3 mr-1" />
                              Definir como padrão
                            </Button>
                          )}
                        </div>
                        <Select
                          value={selectedPartnership01}
                          onValueChange={setSelectedPartnership01}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-background z-50">
                            {partnerships.map((p) => (
                              <SelectItem key={p.id} value={p.id} className="cursor-pointer">
                                <div className="flex items-center gap-2 w-full">
                                  <span className="flex-1">{p.nome_completo}</span>
                                  <div className="flex items-center gap-1">
                                    {defaultPartnershipId === p.id && (
                                      <Star className="h-3 w-3 fill-yellow-500 text-yellow-500" />
                                    )}
                                    {isPartnershipFromCurrentMonth(p) && (
                                      <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4">
                                        <Calendar className="h-2 w-2 mr-0.5" />
                                        Mês atual
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    {partnerships.length === 1 && (
                      <div className="space-y-2">
                        <Label>Parceria</Label>
                        <Input
                          value={partnerships[0].nome_completo}
                          disabled
                          className="bg-muted"
                        />
                      </div>
                    )}
                    <div className="space-y-2">
                      <Label htmlFor="casa_01_nome_add">Nome da Casa</Label>
                      <Input
                        id="casa_01_nome_add"
                        placeholder="Ex: Bet365"
                        value={formData.casa_01_nome}
                        onChange={(e) => setFormData({ ...formData, casa_01_nome: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="casa_01_odd_add">Odd</Label>
                      <Input
                        id="casa_01_odd_add"
                        type="number"
                        step="0.01"
                        placeholder="Ex: 2.50"
                        value={formData.casa_01_odd}
                        onChange={(e) => setFormData({ ...formData, casa_01_odd: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="casa_01_valor_add">Valor Apostado (R$)</Label>
                      <Input
                        id="casa_01_valor_add"
                        type="number"
                        step="0.01"
                        placeholder="Ex: 100.00"
                        value={formData.casa_01_valor}
                        onChange={(e) => setFormData({ ...formData, casa_01_valor: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="casa_01_mercado_add">Mercado</Label>
                      <Input
                        id="casa_01_mercado_add"
                        placeholder="Ex: Casa - Vitória"
                        value={formData.casa_01_mercado}
                        onChange={(e) => setFormData({ ...formData, casa_01_mercado: e.target.value })}
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-4 p-4 border rounded-lg">
                    <h3 className="font-semibold text-lg">Casa 02</h3>
                    {partnerships.length > 1 && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="parceria_02">Parceria</Label>
                          {selectedPartnership02 !== defaultPartnershipId && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-6 text-xs"
                              onClick={() => handleSetDefaultPartnership(selectedPartnership02)}
                            >
                              <Star className="h-3 w-3 mr-1" />
                              Definir como padrão
                            </Button>
                          )}
                        </div>
                        <Select
                          value={selectedPartnership02}
                          onValueChange={setSelectedPartnership02}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-background z-50">
                            {partnerships.map((p) => (
                              <SelectItem key={p.id} value={p.id} className="cursor-pointer">
                                <div className="flex items-center gap-2 w-full">
                                  <span className="flex-1">{p.nome_completo}</span>
                                  <div className="flex items-center gap-1">
                                    {defaultPartnershipId === p.id && (
                                      <Star className="h-3 w-3 fill-yellow-500 text-yellow-500" />
                                    )}
                                    {isPartnershipFromCurrentMonth(p) && (
                                      <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4">
                                        <Calendar className="h-2 w-2 mr-0.5" />
                                        Mês atual
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    {partnerships.length === 1 && (
                      <div className="space-y-2">
                        <Label>Parceria</Label>
                        <Input
                          value={partnerships[0].nome_completo}
                          disabled
                          className="bg-muted"
                        />
                      </div>
                    )}
                    <div className="space-y-2">
                      <Label htmlFor="casa_02_nome_add">Nome da Casa</Label>
                      <Input
                        id="casa_02_nome_add"
                        placeholder="Ex: Betano"
                        value={formData.casa_02_nome}
                        onChange={(e) => setFormData({ ...formData, casa_02_nome: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="casa_02_odd_add">Odd</Label>
                      <Input
                        id="casa_02_odd_add"
                        type="number"
                        step="0.01"
                        placeholder="Ex: 1.95"
                        value={formData.casa_02_odd}
                        onChange={(e) => setFormData({ ...formData, casa_02_odd: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="casa_02_valor_add">Valor Apostado (R$)</Label>
                      <Input
                        id="casa_02_valor_add"
                        type="number"
                        step="0.01"
                        placeholder="Ex: 80.00"
                        value={formData.casa_02_valor}
                        onChange={(e) => setFormData({ ...formData, casa_02_valor: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="casa_02_mercado_add">Mercado</Label>
                      <Input
                        id="casa_02_mercado_add"
                        placeholder="Ex: Fora - Vitória"
                        value={formData.casa_02_mercado}
                        onChange={(e) => setFormData({ ...formData, casa_02_mercado: e.target.value })}
                        required
                      />
                    </div>
                  </div>

                  {useTresCasas && (
                    <div className="space-y-4 p-4 border rounded-lg">
                      <h3 className="font-semibold text-lg">Casa 03</h3>
                      {partnerships.length > 1 && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label htmlFor="parceria_03">Parceria</Label>
                            {selectedPartnership03 !== defaultPartnershipId && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-6 text-xs"
                                onClick={() => handleSetDefaultPartnership(selectedPartnership03)}
                              >
                                <Star className="h-3 w-3 mr-1" />
                                Definir como padrão
                              </Button>
                            )}
                          </div>
                          <Select
                            value={selectedPartnership03}
                            onValueChange={setSelectedPartnership03}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-background z-50">
                              {partnerships.map((p) => (
                                <SelectItem key={p.id} value={p.id} className="cursor-pointer">
                                  <div className="flex items-center gap-2 w-full">
                                    <span className="flex-1">{p.nome_completo}</span>
                                    <div className="flex items-center gap-1">
                                       {defaultPartnershipId === p.id && (
                                        <Star className="h-3 w-3 fill-yellow-500 text-yellow-500" />
                                      )}
                                      {isPartnershipFromCurrentMonth(p) && (
                                        <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4">
                                          <Calendar className="h-2 w-2 mr-0.5" />
                                          Mês atual
                                        </Badge>
                                      )}
                                    </div>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                      {partnerships.length === 1 && (
                        <div className="space-y-2">
                          <Label>Parceria</Label>
                          <Input
                            value={partnerships[0].nome_completo}
                            disabled
                            className="bg-muted"
                          />
                        </div>
                      )}
                      <div className="space-y-2">
                        <Label htmlFor="casa_03_nome_add">Nome da Casa</Label>
                        <Input
                          id="casa_03_nome_add"
                          placeholder="Ex: Sportingbet"
                          value={formData.casa_03_nome}
                          onChange={(e) => setFormData({ ...formData, casa_03_nome: e.target.value })}
                          required={useTresCasas}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="casa_03_odd_add">Odd</Label>
                        <Input
                          id="casa_03_odd_add"
                          type="number"
                          step="0.01"
                          placeholder="Ex: 3.20"
                          value={formData.casa_03_odd}
                          onChange={(e) => setFormData({ ...formData, casa_03_odd: e.target.value })}
                          required={useTresCasas}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="casa_03_valor_add">Valor Apostado (R$)</Label>
                        <Input
                          id="casa_03_valor_add"
                          type="number"
                          step="0.01"
                          placeholder="Ex: 50.00"
                          value={formData.casa_03_valor}
                          onChange={(e) => setFormData({ ...formData, casa_03_valor: e.target.value })}
                          required={useTresCasas}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="casa_03_mercado_add">Mercado</Label>
                        <Input
                          id="casa_03_mercado_add"
                          placeholder="Ex: Empate"
                          value={formData.casa_03_mercado}
                          onChange={(e) => setFormData({ ...formData, casa_03_mercado: e.target.value })}
                          required={useTresCasas}
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="porcentagem_add">Porcentagem (%)</Label>
                    <Input
                      id="porcentagem_add"
                      type="text"
                      placeholder="Calculado automaticamente"
                      value={parseFloat(formData.porcentagem) < 0 ? '' : formData.porcentagem}
                      readOnly
                      className={`bg-muted ${
                        parseFloat(formData.porcentagem) > 0 
                          ? 'text-success font-semibold border-success' 
                          : ''
                      }`}
                    />
                    {formData.porcentagem && parseFloat(formData.porcentagem) > 0 && (
                      <p className="text-xs font-medium text-success">
                        ✅ Arbitragem válida!
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="retorno_previsto_add">Retorno Previsto (R$)</Label>
                    <Input
                      id="retorno_previsto_add"
                      type="number"
                      step="0.01"
                      placeholder="Calculado automaticamente"
                      value={formData.retorno_previsto}
                      readOnly
                      className="bg-muted"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lucro_projetado_add">Lucro Projetado (R$)</Label>
                    <Input
                      id="lucro_projetado_add"
                      type="number"
                      step="0.01"
                      placeholder="Calculado automaticamente"
                      value={formData.lucro_projetado}
                      readOnly
                      className={`bg-muted ${
                        parseFloat(formData.lucro_projetado) > 0 
                          ? 'text-success font-semibold' 
                          : parseFloat(formData.lucro_projetado) < 0 
                          ? 'text-destructive font-semibold' 
                          : ''
                      }`}
                    />
                  </div>
                </div>

                <Button type="submit" className="w-full" disabled={isLoadingAdd}>
                  {isLoadingAdd ? 'Salvando...' : 'Salvar Arbitragem'}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
