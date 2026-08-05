import { useEffect, useState, useMemo, useCallback } from 'react';
import { Layout } from '@/components/Layout';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useGameNotifications } from '@/hooks/useGameNotifications';
import { useDebounce } from '@/hooks/useDebounce';
import { useIsMobile } from '@/hooks/use-mobile';
import { useCountUp } from '@/hooks/useCountUp';
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
import { ChevronDown, Plus, Pencil, Trash2, Clock, FileText, Copy, Filter, X, Maximize2, Minimize2, Search, LayoutGrid, Table as TableIcon, Star, Calendar, Building2, ArrowUpDown, ArrowUp, ArrowDown, TrendingUp, TrendingDown, ExternalLink, Lock, Unlock } from 'lucide-react';
import { format, differenceInMilliseconds } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { formatCurrency, formatNumber, formatUserName, parseLocalizedNumber } from '@/lib/utils';
import { parseArbitrageText } from '@/utils/arbitrageParser';
import { MonthlyGoalCard } from '@/components/MonthlyGoalCard';
import { ConfirmDeleteDialog } from '@/components/ConfirmDeleteDialog';
import { highlightText } from '@/lib/utils/highlightText';
import { Progress } from '@/components/ui/progress';
import { BettingHouseInput } from '@/components/BettingHouseInput';
import { bettingHouseGroups } from '@/data/bettingHousesData';

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

import { ResultadoDropdown, resultadoMap, resultOptions } from '@/components/ResultadoDropdown';

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
  const [expandedMobileCard, setExpandedMobileCard] = useState<string | null>(null);
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
  const [dateFilterType, setDateFilterType] = useState<'adicionado' | 'jogo'>(() => {
    const saved = sessionStorage.getItem('arbitragens_dateFilterType');
    return (saved === 'jogo') ? 'jogo' : 'adicionado';
  });
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
  
  // Estados para parcerias (para adicionar arbitragem - sempre do user logado)
  const [partnerships, setPartnerships] = useState<Partnership[]>([]);
  // Parcerias disponíveis no filtro (baseado no operador selecionado)
  const [filterablePartnerships, setFilterablePartnerships] = useState<Partnership[]>([]);
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
  
  // Estado para banca total
  const [totalBanca, setTotalBanca] = useState(0);
  
  // Estado para lucro do mês do usuário logado
  const [userMonthStats, setUserMonthStats] = useState({
    totalLucro: 0,
    totalInvestido: 0,
    diasComApostas: 0,
  });
  
  // Estado para custos operacionais do mês
  const [monthlyCosts, setMonthlyCosts] = useState(0);
  
  // Estado para saldos das parcerias (banco + casas)
  const [partnershipBalances, setPartnershipBalances] = useState<Array<{
    id: string;
    nome: string;
    saldoBancario: number;
    saldoCasas: number;
    total: number;
  }>>([]);
  
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
  
  // Estado para prejuízo/lucro avulso
  const [openPrejuizo, setOpenPrejuizo] = useState(false);
  const [prejuizoData, setPrejuizoData] = useState({
    descricao: '',
    casa_nome: '',
    valor_apostado: '',
    valor_encerrado: '', // Valor que recebeu de volta (cashout/encerramento)
    data_evento: '',
    partnership_id: '',
  });
  const [isLoadingPrejuizo, setIsLoadingPrejuizo] = useState(false);
  
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

  // Data personalizada de registro (created_at) — bloqueada por padrão
  const [dataRegistroLocked, setDataRegistroLocked] = useState(true);
  const [dataRegistroCustom, setDataRegistroCustom] = useState('');
  const [descontarSaldo, setDescontarSaldo] = useState(true);
  const [calculoAutomatico, setCalculoAutomatico] = useState(true);

  const isAdmin = userRole?.role === 'admin' || userRole?.role === 'admin_master';

  // Mapa de URLs das casas para links
  const [customHousesUrls, setCustomHousesUrls] = useState<Map<string, string>>(new Map());
  
  const houseUrlsMap = useMemo(() => {
    const map = new Map<string, string>();
    bettingHouseGroups.forEach(group => {
      group.houses.forEach(house => {
        if (house.url) map.set(house.name.toLowerCase(), house.url);
      });
    });
    customHousesUrls.forEach((url, name) => {
      if (url) map.set(name.toLowerCase(), url);
    });
    return map;
  }, [customHousesUrls]);

  const getHouseUrl = (houseName: string): string | undefined => {
    return houseUrlsMap.get(houseName.toLowerCase());
  };

  // Valores derivados para animação do card de Lucro do Mês
  const lucroLiquido = useMemo(() => userMonthStats.totalLucro - monthlyCosts, [userMonthStats.totalLucro, monthlyCosts]);
  const mediaDia = useMemo(() => 
    userMonthStats.diasComApostas > 0 ? lucroLiquido / userMonthStats.diasComApostas : 0,
    [lucroLiquido, userMonthStats.diasComApostas]
  );
  const roiMensal = useMemo(() => 
    userMonthStats.totalInvestido > 0 ? (lucroLiquido / userMonthStats.totalInvestido) * 100 : 0,
    [lucroLiquido, userMonthStats.totalInvestido]
  );

  // Hooks de animação para o card de Lucro do Mês (devem estar no nível superior)
  const animatedMonthLucro = useCountUp(userMonthStats.totalLucro);
  const animatedLucroLiquido = useCountUp(lucroLiquido);
  const animatedMonthlyCosts = useCountUp(monthlyCosts);
  const animatedMonthInvestido = useCountUp(userMonthStats.totalInvestido);
  const animatedMediaDia = useCountUp(mediaDia);
  const animatedRoiMensal = useCountUp(roiMensal);

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

  // Verificar se o filtro de status é apenas "aguardando"
  const isOnlyAguardando = useMemo(() => {
    return filterStatus.length === 1 && filterStatus.includes('aguardando');
  }, [filterStatus]);

  // Calcular porcentagem de investimento em relação à banca
  const bancaPercentage = useMemo(() => {
    if (totalBanca === 0) return 0;
    return (totais.totalInvestido / totalBanca) * 100;
  }, [totais.totalInvestido, totalBanca]);

  // Calcular lucro para meta (sempre mês atual, sempre do usuário logado, sem filtros)
  const goalProfit = useMemo(() => {
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    let filtered = [...arbitragens];

    // Filtrar apenas pelo mês atual (created_at)
    filtered = filtered.filter((arb) => {
      const arbDate = new Date(arb.created_at);
      return arbDate >= firstDayOfMonth && arbDate <= lastDayOfMonth;
    });

    // Sempre filtrar pelo usuário logado, independente dos filtros
    if (user?.id) {
      filtered = filtered.filter((arb) => arb.user_id === user.id);
    }

    // Calcular lucro total (incluindo aguardando e fechados)
    return filtered.reduce((sum, arb) => {
      const lucro = arb.status === 'aguardando' ? Number(arb.lucro_projetado) : Number(arb.lucro_real);
      return sum + lucro;
    }, 0);
  }, [arbitragens, user?.id]);

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

    // Filtrar por data (created_at ou data_evento conforme selecionado)
    // Regra: Se ambas as datas estiverem preenchidas, filtrar período
    // Se apenas data fim preenchida, filtrar apenas aquele dia único
    if (debouncedFilterStartDate && debouncedFilterEndDate) {
      // Ambas preenchidas: filtrar período
      const [startYear, startMonth, startDay] = debouncedFilterStartDate.split('-').map(Number);
      const [endYear, endMonth, endDay] = debouncedFilterEndDate.split('-').map(Number);
      const startDate = new Date(startYear, startMonth - 1, startDay, 0, 0, 0, 0);
      const endDate = new Date(endYear, endMonth - 1, endDay, 23, 59, 59, 999);
      filtered = filtered.filter((arb) => {
        const arbDate = new Date(dateFilterType === 'jogo' ? arb.data_evento : arb.created_at);
        return arbDate >= startDate && arbDate <= endDate;
      });
    } else if (!debouncedFilterStartDate && debouncedFilterEndDate) {
      // Apenas data fim: filtrar apenas aquele dia
      const [year, month, day] = debouncedFilterEndDate.split('-').map(Number);
      const startOfDay = new Date(year, month - 1, day, 0, 0, 0, 0);
      const endOfDay = new Date(year, month - 1, day, 23, 59, 59, 999);
      filtered = filtered.filter((arb) => {
        const arbDate = new Date(dateFilterType === 'jogo' ? arb.data_evento : arb.created_at);
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
      
      // Ordenar fechadas por data_evento - mais recente primeiro (decrescente)
      fechadas.sort((a, b) => {
        return new Date(b.data_evento).getTime() - new Date(a.data_evento).getTime();
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
  }, [arbitragens, debouncedSearchText, debouncedFilterStartDate, debouncedFilterEndDate, debouncedFilterStatus, debouncedFilterUser, debouncedFilterPartnership, sortOrder, dateFilterType]);

  const loadArbitragens = useCallback(async () => {
    if (!user?.id) {
      setIsLoading(false);
      return;
    }
    
    try {
      const dateField = dateFilterType === 'jogo' ? 'data_evento' : 'created_at';
      
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

      // Aplicar filtro de data no servidor para evitar o limite de 1000 linhas
      if (debouncedFilterStartDate && debouncedFilterEndDate) {
        const [startYear, startMonth, startDay] = debouncedFilterStartDate.split('-').map(Number);
        const [endYear, endMonth, endDay] = debouncedFilterEndDate.split('-').map(Number);
        const startDate = new Date(startYear, startMonth - 1, startDay, 0, 0, 0, 0);
        const endDate = new Date(endYear, endMonth - 1, endDay, 23, 59, 59, 999);
        query = query.gte(dateField, startDate.toISOString()).lte(dateField, endDate.toISOString());
      } else if (!debouncedFilterStartDate && debouncedFilterEndDate) {
        const [year, month, day] = debouncedFilterEndDate.split('-').map(Number);
        const startOfDay = new Date(year, month - 1, day, 0, 0, 0, 0);
        const endOfDay = new Date(year, month - 1, day, 23, 59, 59, 999);
        query = query.gte(dateField, startOfDay.toISOString()).lte(dateField, endOfDay.toISOString());
      }

      // Aumentar limite para garantir todos os dados do período
      query = query.limit(5000);

      const { data, error } = await query;

      if (error) {
        console.warn('Erro ao carregar arbitragens:', error.message);
        if (!error.message.includes('permission') && !error.message.includes('RLS')) {
          toast({
            variant: 'destructive',
            title: 'Erro ao carregar arbitragens',
            description: error.message,
          });
        }
      } else if (data) {
        setArbitragens(data);
      }
    } catch (error) {
      console.error('Erro ao carregar arbitragens:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, isAdmin, toast, debouncedFilterStartDate, debouncedFilterEndDate, dateFilterType]);

  const loadUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name')
        .order('name');
      
      if (error) {
        // Operadores não têm permissão para ver todos os perfis
        console.warn('Erro ao carregar usuários:', error.message);
        // Usar apenas o próprio usuário
        if (user?.id) {
          setUsers([{ id: user.id, name: 'Meu usuário' }]);
          setFilterUser([user.id]);
        }
        return;
      }
      
      if (data) {
        setUsers(data);
        
        // Por padrão, selecionar o usuário logado
        if (filterUser.length === 0 && user?.id) {
          setFilterUser([user.id]);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar usuários:', error);
      // Fallback para o próprio usuário
      if (user?.id) {
        setUsers([{ id: user.id, name: 'Meu usuário' }]);
        setFilterUser([user.id]);
      }
    }
  };

  const loadPartnerships = useCallback(async (userIds?: string[]) => {
    if (!user?.id) return;
    
    try {
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
    } catch (error) {
      console.error('Erro ao carregar parcerias:', error);
    }
  }, [user?.id]);

  // Carregar parcerias para o filtro (baseado no operador selecionado)
  const loadFilterablePartnerships = useCallback(async () => {
    if (!user?.id) return;
    
    try {
      let query = supabase
        .from('partnerships')
        .select('id, nome_completo, status, user_id, created_at, data_inicio')
        .eq('status', 'ativo')
        .order('created_at');
      
      if (isAdmin && debouncedFilterUser.length > 0) {
        // Admin com filtro de operador: mostrar parcerias dos operadores selecionados
        query = query.in('user_id', debouncedFilterUser);
      } else if (isAdmin) {
        // Admin sem filtro: mostrar todas
        // não adiciona filtro de user_id
      } else {
        // Operador: apenas suas próprias
        query = query.eq('user_id', user.id);
      }
      
      const { data, error } = await query;
      
      if (error) {
        console.warn('Erro ao carregar parcerias filtráveis:', error.message);
        return;
      }
      
      setFilterablePartnerships(data || []);
      
      // Limpar filtro de parceria se as parcerias selecionadas não existem mais na lista
      if (data) {
        const validIds = new Set(data.map(p => p.id));
        setFilterPartnership(prev => prev.filter(id => validIds.has(id)));
      }
    } catch (error) {
      console.error('Erro ao carregar parcerias filtráveis:', error);
    }
  }, [user?.id, isAdmin, debouncedFilterUser]);

  // Recarregar parcerias filtráveis quando operador mudar
  useEffect(() => {
    loadFilterablePartnerships();
  }, [loadFilterablePartnerships]);

  // Carregar total da banca das parcerias ativas
  const loadBancaTotal = useCallback(async () => {
    if (!user?.id) return;
    
    let query = supabase
      .from('partnerships')
      .select('valor_banca')
      .eq('status', 'ativo');
    
    if (!isAdmin) {
      query = query.eq('user_id', user.id);
    } else if (debouncedFilterUser.length > 0) {
      query = query.in('user_id', debouncedFilterUser);
    }

    const { data } = await query;

    if (data) {
      const total = data.reduce((sum, p) => sum + Number(p.valor_banca || 0), 0);
      setTotalBanca(total);
    }
  }, [user?.id, isAdmin, debouncedFilterUser]);

  // Carregar lucro do mês (responde a filtros de operador e parceria)
  const loadUserMonthStats = useCallback(async () => {
    if (!user?.id) return;
    
    try {
      const now = new Date();
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

      // Se admin com filtro de operador, buscar dados desse operador
      const targetUserIds = isAdmin && debouncedFilterUser.length > 0 ? debouncedFilterUser : [user.id];

      let query = supabase
        .from('arbitrages')
        .select('status, lucro_projetado, lucro_real, casa_01_valor, casa_02_valor, casa_03_valor, created_at, casa_01_parceria_id, casa_02_parceria_id, casa_03_parceria_id')
        .in('user_id', targetUserIds)
        .gte('created_at', firstDayOfMonth.toISOString())
        .lte('created_at', lastDayOfMonth.toISOString());

      const { data, error } = await query;

      if (error) {
        console.warn('Erro ao carregar stats do mês:', error.message);
        return;
      }

      if (data) {
        // Aplicar filtro de parceria se ativo
        let filtered = data;
        if (debouncedFilterPartnership.length > 0) {
          filtered = data.filter(arb => {
            const partnershipIds = [
              arb.casa_01_parceria_id,
              arb.casa_02_parceria_id,
              arb.casa_03_parceria_id,
            ].filter(Boolean);
            return partnershipIds.some(id => debouncedFilterPartnership.includes(id as string));
          });
        }

        const totalLucro = filtered.reduce((sum, arb) => {
          const lucro = arb.status === 'aguardando' ? Number(arb.lucro_projetado) : Number(arb.lucro_real);
          return sum + lucro;
        }, 0);

        const totalInvestido = filtered.reduce(
          (sum, arb) => sum + Number(arb.casa_01_valor) + Number(arb.casa_02_valor) + Number(arb.casa_03_valor || 0),
          0
        );

        // Contar dias únicos com apostas
        const uniqueDays = new Set(
          filtered.map(arb => format(new Date(arb.created_at), 'yyyy-MM-dd'))
        );

        setUserMonthStats({
          totalLucro,
          totalInvestido,
          diasComApostas: uniqueDays.size,
        });
      }
    } catch (error) {
      console.error('Erro ao carregar stats do mês:', error);
    }
  }, [user?.id, isAdmin, debouncedFilterUser, debouncedFilterPartnership]);

  // Carregar custos operacionais do mês
  const loadMonthlyCosts = useCallback(async () => {
    if (!user?.id) return;
    try {
      const now = new Date();
      const firstDay = format(new Date(now.getFullYear(), now.getMonth(), 1), 'yyyy-MM-dd');
      const lastDay = format(new Date(now.getFullYear(), now.getMonth() + 1, 0), 'yyyy-MM-dd');

      const targetUserIds = isAdmin && debouncedFilterUser.length > 0 ? debouncedFilterUser : [user.id];

      let query = supabase
        .from('operational_costs')
        .select('valor')
        .in('user_id', targetUserIds)
        .gte('data', firstDay)
        .lte('data', lastDay);

      const { data, error } = await query;
      if (error) {
        console.warn('Erro ao carregar custos:', error.message);
        return;
      }
      const total = (data || []).reduce((sum, c) => sum + Number(c.valor), 0);
      setMonthlyCosts(total);
    } catch (error) {
      console.error('Erro ao carregar custos:', error);
    }
  }, [user?.id, isAdmin, debouncedFilterUser]);

  useEffect(() => {
    loadMonthlyCosts();
  }, [loadMonthlyCosts]);

  // Carregar saldos das parcerias (banco + casas) - sempre do usuário logado
  const [isLoadingBalances, setIsLoadingBalances] = useState(true);
  const loadPartnershipBalances = useCallback(async () => {
    if (!user?.id) return;
    try {
      // Sempre buscar parcerias do usuário logado, independente dos filtros
      const { data: partnershipsData } = await supabase
        .from('partnerships')
        .select('id, nome_completo, saldo_bancario')
        .eq('status', 'ativo')
        .eq('user_id', user.id);

      if (!partnershipsData || partnershipsData.length === 0) {
        setPartnershipBalances([]);
        setIsLoadingBalances(false);
        return;
      }

      const ids = partnershipsData.map(p => p.id);
      const { data: housesData } = await supabase
        .from('partnership_houses')
        .select('partnership_id, saldo')
        .in('partnership_id', ids);

      const houseSumMap = new Map<string, number>();
      (housesData || []).forEach(h => {
        const prev = houseSumMap.get(h.partnership_id) || 0;
        houseSumMap.set(h.partnership_id, prev + Number(h.saldo || 0));
      });

      const balances = partnershipsData.map(p => {
        const saldoBancario = Number(p.saldo_bancario || 0);
        const saldoCasas = houseSumMap.get(p.id) || 0;
        return {
          id: p.id,
          nome: formatUserName(p.nome_completo),
          saldoBancario,
          saldoCasas,
          total: saldoBancario + saldoCasas,
        };
      });

      setPartnershipBalances(balances);
    } catch (error) {
      console.error('Erro ao carregar saldos das parcerias:', error);
    } finally {
      setIsLoadingBalances(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadPartnershipBalances();
  }, [loadPartnershipBalances]);

  useEffect(() => {
    const loadCustomHousesUrls = async () => {
      const { data } = await supabase.from('custom_betting_houses').select('name, url');
      if (data) {
        const urlMap = new Map<string, string>();
        data.forEach(h => { if (h.url) urlMap.set(h.name.toLowerCase(), h.url); });
        setCustomHousesUrls(urlMap);
      }
    };
    loadCustomHousesUrls();
  }, []);

  // Carregar dados inicialmente e quando filtros de data/role mudam
  useEffect(() => {
    if (!user?.id) return;
    
    loadArbitragens();
    loadPartnerships();
    loadBancaTotal();
    loadUserMonthStats();
    if (isAdmin) {
      loadUsers();
    }
  }, [user?.id, isAdmin, loadArbitragens]);

  // Recarregar banca e stats quando filtro de usuário/parceria mudar
  useEffect(() => {
    loadBancaTotal();
    loadUserMonthStats();
  }, [loadBancaTotal, loadUserMonthStats]);

  // Aplicar filtros quando arbitragens ou filtros mudarem
  useEffect(() => {
    applyFilters();
  }, [arbitragens, debouncedSearchText, debouncedFilterStartDate, debouncedFilterEndDate, debouncedFilterStatus, debouncedFilterUser, debouncedFilterPartnership, dateFilterType, sortOrder]);

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
    sessionStorage.setItem('arbitragens_dateFilterType', dateFilterType);
  }, [dateFilterType]);

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

    if (calculoAutomatico) {
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
            porcentagem: formatNumber(porcentagem),
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
            porcentagem: formatNumber(porcentagem),
            retorno_previsto: formatCurrency(retornoPrevisto),
            lucro_projetado: formatCurrency(lucroProjetado),
          }));
        }
      }
    } else {
      // Modo manual: recalcula porcentagem e lucro projetado com base no retorno_previsto digitado
      const retornoPrevisto = parseLocalizedNumber(formData.retorno_previsto);
      const totalApostado = useTresCasas
        ? (valor1 || 0) + (valor2 || 0) + (valor3 || 0)
        : (valor1 || 0) + (valor2 || 0);
      if (totalApostado > 0 && retornoPrevisto > 0) {
        const lucroProjetado = retornoPrevisto - totalApostado;
        const porcentagem = (lucroProjetado / totalApostado) * 100;
        setFormData(prev => ({
          ...prev,
          porcentagem: formatNumber(porcentagem),
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
    formData.retorno_previsto,
    useTresCasas,
    calculoAutomatico,
  ]);

  // Auto-debitar saldos das casas ao criar arbitragem
  // Se a aposta for maior que o saldo da casa, entende-se que houve depósito (debita do saldo bancário)
  const autoDebitHouseBalances = async (bets: { partnershipId: string; houseName: string; valor: number }[]) => {
    // Agrupar por partnership para otimizar queries
    const byPartnership = new Map<string, { houseName: string; valor: number }[]>();
    for (const bet of bets) {
      if (!bet.partnershipId || !bet.houseName || !bet.valor) continue;
      const existing = byPartnership.get(bet.partnershipId) || [];
      existing.push({ houseName: bet.houseName, valor: bet.valor });
      byPartnership.set(bet.partnershipId, existing);
    }

    for (const [partnershipId, houseBets] of byPartnership) {
      try {
        // Buscar saldo bancário atual da parceria
        const { data: partnershipData } = await supabase
          .from('partnerships')
          .select('saldo_bancario')
          .eq('id', partnershipId)
          .single();

        let saldoBancario = partnershipData?.saldo_bancario || 0;
        let totalDepositado = 0;

        for (const bet of houseBets) {
          // Buscar saldo atual da casa
          const { data: houseData } = await supabase
            .from('partnership_houses')
            .select('id, saldo')
            .eq('partnership_id', partnershipId)
            .eq('house_name', bet.houseName)
            .maybeSingle();

          const currentSaldo = houseData?.saldo || 0;
          let newSaldo = currentSaldo - bet.valor;

          // Se o saldo ficaria negativo, significa que houve depósito
          if (newSaldo < 0) {
            const depositNeeded = Math.abs(newSaldo);
            totalDepositado += depositNeeded;
            newSaldo = 0; // Nunca fica negativo
          }

          // Atualizar saldo da casa
          if (houseData) {
            await supabase
              .from('partnership_houses')
              .update({ saldo: Math.max(0, newSaldo) })
              .eq('id', houseData.id);
          } else {
            // Criar registro da casa se não existir (saldo fica 0 pois foi usado na aposta)
            await supabase
              .from('partnership_houses')
              .insert({
                partnership_id: partnershipId,
                house_name: bet.houseName,
                status: 'ativa',
                saldo: 0,
              });
          }
        }

        // Debitar do saldo bancário o valor depositado nas casas
        if (totalDepositado > 0) {
          const novoSaldoBancario = Math.max(0, saldoBancario - totalDepositado);
          await supabase
            .from('partnerships')
            .update({ saldo_bancario: novoSaldoBancario })
            .eq('id', partnershipId);
          
          // Registrar movimentação no extrato
          await supabase.from('balance_movements' as any).insert({
            partnership_id: partnershipId,
            user_id: user?.id,
            tipo: 'debito',
            valor: totalDepositado,
            saldo_anterior: saldoBancario,
            saldo_novo: novoSaldoBancario,
            descricao: `Depósito automático em ${houseBets.map(b => b.houseName).join(', ')}`,
          });
        }
      } catch (error) {
        console.error('Erro ao debitar saldos:', error);
        // Não bloquear a criação da arbitragem por erro no débito
      }
    }
  };

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
    
    // Validação do Retorno Previsto quando cálculo manual
    if (!calculoAutomatico) {
      const raw = (formData.retorno_previsto ?? '').toString().trim();
      const retornoManual = parseLocalizedNumber(raw);
      const totalInvestido =
        (parseFloat(formData.casa_01_valor) || 0) +
        (parseFloat(formData.casa_02_valor) || 0) +
        (useTresCasas ? (parseFloat(formData.casa_03_valor) || 0) : 0);

      if (raw === '') {
        toast({
          variant: 'destructive',
          title: 'Retorno Previsto obrigatório',
          description: 'Informe o valor do retorno previsto ou reative o cálculo automático.',
        });
        return;
      }
      if (!Number.isFinite(retornoManual) || retornoManual <= 0) {
        toast({
          variant: 'destructive',
          title: 'Retorno Previsto inválido',
          description: 'O retorno previsto precisa ser um número maior que zero.',
        });
        return;
      }
      if (totalInvestido > 0 && retornoManual < totalInvestido) {
        toast({
          variant: 'destructive',
          title: 'Retorno Previsto fora do intervalo',
          description: 'O retorno previsto não pode ser menor que o total investido.',
        });
        return;
      }
      if (retornoManual > 1_000_000_000) {
        toast({
          variant: 'destructive',
          title: 'Retorno Previsto fora do intervalo',
          description: 'O valor informado é muito alto.',
        });
        return;
      }
    }

    setIsLoadingAdd(true);



    try {


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
        porcentagem: parseLocalizedNumber(formData.porcentagem),
        retorno_previsto: parseLocalizedNumber(formData.retorno_previsto),
        lucro_projetado: parseLocalizedNumber(formData.lucro_projetado),
      };

      // Data personalizada de registro (created_at) quando o usuário desbloqueou
      // Conversão de fuso: datetime-local é interpretado como horário LOCAL do usuário
      // e convertido para UTC via toISOString(). Ao exibir, `new Date(created_at)`
      // volta para o fuso local, garantindo que o dia bata no relatório.
      if (!dataRegistroLocked && dataRegistroCustom) {
        const parsed = new Date(dataRegistroCustom);
        if (isNaN(parsed.getTime())) {
          toast({
            variant: 'destructive',
            title: 'Data inválida',
            description: 'A data do registro informada não é válida.',
          });
          setIsLoadingAdd(false);
          return;
        }
        const now = new Date();
        // Não permitir datas futuras (tolerância de 5 min para relógio dessincronizado)
        if (parsed.getTime() > now.getTime() + 5 * 60 * 1000) {
          toast({
            variant: 'destructive',
            title: 'Data futura não permitida',
            description: 'A data do registro não pode ser posterior ao momento atual.',
          });
          setIsLoadingAdd(false);
          return;
        }
        // Limite máximo de 5 anos no passado
        const fiveYearsAgo = new Date();
        fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);
        if (parsed.getTime() < fiveYearsAgo.getTime()) {
          toast({
            variant: 'destructive',
            title: 'Data muito antiga',
            description: 'A data do registro não pode ser anterior a 5 anos.',
          });
          setIsLoadingAdd(false);
          return;
        }
        arbitrageData.created_at = parsed.toISOString();
      }


      if (useTresCasas) {
        arbitrageData.casa_03_nome = formData.casa_03_nome;
        arbitrageData.casa_03_odd = parseFloat(formData.casa_03_odd);
        arbitrageData.casa_03_valor = parseFloat(formData.casa_03_valor);
        arbitrageData.casa_03_mercado = formData.casa_03_mercado || 'Mercado não especificado';
        arbitrageData.casa_03_parceria_id = selectedPartnership03;
      }

      // Registrar no histórico da aposta se o saldo das casas foi descontado
      (arbitrageData as any).saldo_descontado = descontarSaldo;
      // Persistir o modo de cálculo (automático/manual) junto com a arbitragem
      (arbitrageData as any).calculo_automatico = calculoAutomatico;



      const { data: insertedData, error: insertError } = await supabase
        .from('arbitrages')
        .insert(arbitrageData)
        .select(`
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
          user_id
        `)
        .single();

      if (insertError) {
        throw insertError;
      }

      // Atualização otimística - adicionar ao estado local imediatamente
      if (insertedData) {
        setArbitragens(prev => [...prev, insertedData as unknown as Arbitrage]);
      }

      // Auto-debitar saldos das casas e ajustar saldo bancário (se marcado)
      if (descontarSaldo) {
        await autoDebitHouseBalances([
          { partnershipId: selectedPartnership01, houseName: formData.casa_01_nome, valor: parseFloat(formData.casa_01_valor) },
          { partnershipId: selectedPartnership02, houseName: formData.casa_02_nome, valor: parseFloat(formData.casa_02_valor) },
          ...(useTresCasas && formData.casa_03_nome ? [{ partnershipId: selectedPartnership03, houseName: formData.casa_03_nome, valor: parseFloat(formData.casa_03_valor) }] : []),
        ]);
      }

      // Recarregar stats do mês e saldos para atualizar os cards
      loadUserMonthStats();
      loadPartnershipBalances();
      
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
      setDataRegistroLocked(true);
      setDataRegistroCustom('');
      setDescontarSaldo(true);
      setCalculoAutomatico(true);
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

  // Handler para prejuízo/lucro avulso (aposta em uma única casa que foi encerrada)
  const handleSubmitPrejuizo = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user?.id) {
      toast({
        variant: 'destructive',
        title: 'Erro de autenticação',
        description: 'Usuário não autenticado.',
      });
      return;
    }

    if (partnerships.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Parceria obrigatória',
        description: 'Você precisa ter pelo menos uma parceria ativa.',
      });
      return;
    }
    
    setIsLoadingPrejuizo(true);

    try {
      const valorApostado = parseLocalizedNumber(prejuizoData.valor_apostado);
      const valorEncerrado = parseLocalizedNumber(prejuizoData.valor_encerrado);
      // Lucro = valor encerrado - valor apostado (positivo = lucro, negativo = prejuízo)
      const lucroReal = valorEncerrado - valorApostado;
      const isLucro = lucroReal >= 0;
      
      const dataEvento = prejuizoData.data_evento 
        ? new Date(prejuizoData.data_evento + ':00').toISOString() 
        : new Date().toISOString();

      // Determinar status baseado no resultado
      const statusFinal = isLucro ? 'green' : 'red';
      const resultadoCasa = isLucro ? 'green' : 'red';
      const tipoRegistro = isLucro ? 'Lucro Avulso' : 'Prejuízo Avulso';

      // Criar uma arbitragem com resultado já fechado
      const arbitrageData = {
        user_id: user.id,
        // Registrar no dia informado no formulário (não no dia atual)
        created_at: dataEvento,
        descricao: prejuizoData.descricao || tipoRegistro,
        data_evento: dataEvento,
        esporte_liga: tipoRegistro,
        casa_01_nome: prejuizoData.casa_nome,
        casa_01_odd: 1.0,
        casa_01_valor: valorApostado,
        casa_01_mercado: 'Aposta encerrada',
        casa_01_parceria_id: prejuizoData.partnership_id || selectedPartnership01,
        casa_01_resultado: resultadoCasa as 'green' | 'red',
        casa_01_valor_resultado: valorEncerrado,
        casa_02_nome: '-',
        casa_02_odd: 1.0,
        casa_02_valor: 0,
        casa_02_mercado: 'N/A',
        casa_02_parceria_id: prejuizoData.partnership_id || selectedPartnership01,
        casa_02_resultado: 'devolvido' as const,
        porcentagem: 0,
        retorno_previsto: 0,
        lucro_projetado: lucroReal,
        lucro_real: lucroReal,
        status: statusFinal as 'green' | 'red',
      };

      const { data: insertedData, error: insertError } = await supabase
        .from('arbitrages')
        .insert([arbitrageData])
        .select()
        .single();

      if (insertError) throw insertError;

      // Atualização otimística
      if (insertedData) {
        setArbitragens(prev => [...prev, insertedData as unknown as Arbitrage]);
      }

      // Descontar da casa apenas o prejuízo (quando houver perda)
      if (prejuizoData.casa_nome && lucroReal < 0) {
        await autoDebitHouseBalances([
          { partnershipId: prejuizoData.partnership_id || selectedPartnership01, houseName: prejuizoData.casa_nome, valor: Math.abs(lucroReal) },
        ]);
      }


      loadUserMonthStats();
      loadPartnershipBalances();
      
      toast({
        title: isLucro ? 'Lucro registrado' : 'Prejuízo registrado',
        description: isLucro 
          ? `Lucro de R$ ${formatCurrency(lucroReal)} registrado.`
          : `Perda de R$ ${formatCurrency(Math.abs(lucroReal))} registrada.`,
      });
      
      setOpenPrejuizo(false);
      setPrejuizoData({
        descricao: '',
        casa_nome: '',
        valor_apostado: '',
        valor_encerrado: '',
        data_evento: '',
        partnership_id: '',
      });
    } catch (error: any) {
      console.error('Erro ao registrar prejuízo:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao registrar prejuízo',
        description: error.message || 'Ocorreu um erro desconhecido',
      });
    } finally {
      setIsLoadingPrejuizo(false);
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
    resultado: string,
    cashoutValue?: number
  ) => {
    const arb = arbitragens.find((a) => a.id === arbitrageId);
    if (!arb) return;

    let valorResultado = 0;
    const odd = casa === 'casa_01' ? arb.casa_01_odd : casa === 'casa_02' ? arb.casa_02_odd : arb.casa_03_odd || 0;
    const valorApostado = casa === 'casa_01' ? arb.casa_01_valor : casa === 'casa_02' ? arb.casa_02_valor : arb.casa_03_valor || 0;

    // Cálculo dos resultados
    if (resultado === 'green') {
      valorResultado = valorApostado * odd;
    } else if (resultado === 'red') {
      valorResultado = 0;
    } else if (resultado === 'parcial_green') {
      valorResultado = (valorApostado / 2) + (valorApostado / 2 * odd);
    } else if (resultado === 'parcial_red') {
      valorResultado = valorApostado / 2;
    } else if (resultado === 'devolvido') {
      valorResultado = valorApostado;
    } else if (resultado === 'cashout') {
      // Cashout: valor_resultado é o valor do cashout (já recebido)
      valorResultado = cashoutValue ?? 0;
    } else if (resultado === 'aguardando') {
      valorResultado = 0;
    }

    const updateField = casa === 'casa_01' ? 'casa_01_resultado' : casa === 'casa_02' ? 'casa_02_resultado' : 'casa_03_resultado';
    const valorField = casa === 'casa_01' ? 'casa_01_valor_resultado' : casa === 'casa_02' ? 'casa_02_valor_resultado' : 'casa_03_valor_resultado';
    
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
      statusGeral = lucroReal >= 0 ? 'green' : 'red';
    }

    updateData.status = statusGeral;
    updateData.lucro_real = lucroReal;

    // Atualização otimística - atualizar estado local imediatamente
    setArbitragens(prev => prev.map(a => {
      if (a.id !== arbitrageId) return a;
      return {
        ...a,
        [updateField]: resultado,
        [valorField]: valorResultado,
        status: statusGeral,
        lucro_real: lucroReal,
      };
    }));

    const { error } = await supabase
      .from('arbitrages')
      .update(updateData)
      .eq('id', arbitrageId);

    if (error) {
      // Reverter em caso de erro - recarregar dados
      loadArbitragens();
      toast({
        variant: 'destructive',
        title: 'Erro ao atualizar resultado',
        description: error.message,
      });
    } else {
      // Recarregar stats do mês e saldos para atualizar os cards
      loadUserMonthStats();
      loadPartnershipBalances();
      toast({
        title: 'Resultado atualizado!',
        description: 'O resultado foi registrado com sucesso.',
      });
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;

    // Atualização otimística - remover do estado local imediatamente
    const deletedArb = arbitragens.find(a => a.id === deleteId);
    setArbitragens(prev => prev.filter(a => a.id !== deleteId));

    const { error } = await supabase
      .from('arbitrages')
      .delete()
      .eq('id', deleteId);

    if (error) {
      // Reverter em caso de erro - restaurar item deletado
      if (deletedArb) {
        setArbitragens(prev => [...prev, deletedArb]);
      }
      toast({
        variant: 'destructive',
        title: 'Erro ao excluir arbitragem',
        description: error.message,
      });
    } else {
      // Recarregar stats do mês para atualizar o card de lucro
      loadUserMonthStats();
      loadPartnershipBalances();
      toast({
        title: 'Arbitragem excluída!',
        description: 'A arbitragem foi removida com sucesso.',
      });
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
      casa_01_mercado: editArbitrage.casa_01_mercado || 'Mercado não especificado',
      casa_01_parceria_id: editArbitrage.casa_01_parceria_id || null,
      casa_02_nome: editArbitrage.casa_02_nome,
      casa_02_odd: editArbitrage.casa_02_odd,
      casa_02_valor: editArbitrage.casa_02_valor,
      casa_02_mercado: editArbitrage.casa_02_mercado || 'Mercado não especificado',
      casa_02_parceria_id: editArbitrage.casa_02_parceria_id || null,
      porcentagem: porcentagem,
      retorno_previsto: retornoPrevisto,
      lucro_projetado: lucroProjetado,
    };

    // Incluir casa_03 se existir
    if (editArbitrage.casa_03_nome) {
      updateData.casa_03_nome = editArbitrage.casa_03_nome;
      updateData.casa_03_odd = editArbitrage.casa_03_odd;
      updateData.casa_03_valor = editArbitrage.casa_03_valor;
      updateData.casa_03_mercado = editArbitrage.casa_03_mercado || 'Mercado não especificado';
      updateData.casa_03_parceria_id = editArbitrage.casa_03_parceria_id || null;
    }

    // Atualização otimística - atualizar estado local imediatamente
    const originalArb = arbitragens.find(a => a.id === editArbitrage.id);
    setArbitragens(prev => prev.map(a => {
      if (a.id !== editArbitrage.id) return a;
      return {
        ...a,
        ...updateData,
      };
    }));
    
    setEditArbitrage(null);

    const { error } = await supabase
      .from('arbitrages')
      .update(updateData)
      .eq('id', editArbitrage.id);

    if (error) {
      // Reverter em caso de erro - restaurar dados originais
      if (originalArb) {
        setArbitragens(prev => prev.map(a => a.id === originalArb.id ? originalArb : a));
      }
      toast({
        variant: 'destructive',
        title: 'Erro ao atualizar arbitragem',
        description: error.message,
      });
      return;
    }

    // Recarregar stats do mês para atualizar o card de lucro
    loadUserMonthStats();

    toast({
      title: 'Arbitragem atualizada!',
      description: 'As alterações foram salvas com sucesso.',
    });
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
    resultado: string,
    valorResultado?: number | null
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
    } else if (resultado === 'cashout') {
      // Cashout: valor_resultado - aposta
      return (valorResultado ?? 0) - aposta;
    } else if (resultado === 'parcial_green') {
      // Meio Green: metade devolvida + metade ganhou
      return (aposta / 2) * odd - aposta / 2;
    } else if (resultado === 'parcial_red') {
      // Meio Red: perdeu metade
      return -aposta / 2;
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



            {/* Botão Ir para Casas + Adicionar */}
            {(() => {
              const activePartnerships = partnerships.filter(p => p.status === 'ativo');
              
              const addButton = isMobile ? (
                <Button size="icon" className="h-8 w-8 shrink-0" onClick={() => setOpenAdd(true)}>
                  <Plus className="h-4 w-4" />
                </Button>
              ) : (
                <Button size="sm" className="h-8 gap-1.5 shrink-0" onClick={() => setOpenAdd(true)}>
                  <Plus className="h-4 w-4" />
                  Adicionar Arbitragem
                </Button>
              );

              // Se só tem 1 parceria ativa, vai direto
              if (activePartnerships.length === 1) {
                return (
                  <div className="flex items-center gap-1">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="gap-2 h-8"
                      onClick={() => navigate(`/parcerias?partnership=${activePartnerships[0].id}&view=report`)}
                    >
                      <Building2 className="h-4 w-4" />
                      Ir para Casas
                    </Button>
                    {addButton}
                  </div>
                );
              }
              
              // Múltiplas parcerias: mostra dialog
              return (
                <div className="flex items-center gap-1">
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
                    <form 
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (selectedPartnershipForHouses) {
                          navigate(`/parcerias?partnership=${selectedPartnershipForHouses}&view=report`);
                          setGoToHousesOpen(false);
                        }
                      }} 
                      className="space-y-4"
                    >
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
                            {activePartnerships.map((partnership) => (
                              <SelectItem key={partnership.id} value={partnership.id}>
                                {formatUserName(partnership.nome_completo)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button type="button" variant="outline" onClick={() => setGoToHousesOpen(false)}>
                          Cancelar
                        </Button>
                        <Button type="submit" disabled={!selectedPartnershipForHouses}>
                          Ir para Casas
                        </Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
                {addButton}
                </div>
              );
            })()}
          </div>

        {/* Filtros agrupados */}
        <div className="flex flex-col md:flex-row gap-2">
          {/* Filtros de Data */}
          <div className="flex items-center gap-1 flex-wrap">
            <div className="flex rounded-md border overflow-hidden">
              <Button
                variant={dateFilterType === 'adicionado' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setDateFilterType('adicionado')}
                className="h-8 px-2 text-xs rounded-none"
              >
                Adicionado
              </Button>
              <Button
                variant={dateFilterType === 'jogo' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setDateFilterType('jogo')}
                className="h-8 px-2 text-xs rounded-none"
              >
                Jogo
              </Button>
            </div>
            <div className="flex gap-1">
              <Button variant={selectedPeriod === 'hoje' ? 'default' : 'outline'} size="sm" onClick={() => applyPeriodFilter('hoje')} className="h-8 px-2 text-xs">Hoje</Button>
              <Button variant={selectedPeriod === 'semana' ? 'default' : 'outline'} size="sm" onClick={() => applyPeriodFilter('semana')} className="h-8 px-2 text-xs">7d</Button>
              <Button variant={selectedPeriod === 'mes' ? 'default' : 'outline'} size="sm" onClick={() => applyPeriodFilter('mes')} className="h-8 px-2 text-xs">30d</Button>
              <Button variant={selectedPeriod === 'mes_atual' ? 'default' : 'outline'} size="sm" onClick={() => applyPeriodFilter('mes_atual')} className="h-8 px-2 text-xs">Mês</Button>
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant={selectedPeriod === 'custom' && (filterStartDate || filterEndDate) ? 'default' : 'outline'} size="sm" className="h-8 px-2 text-xs">
                    <Calendar className="h-3.5 w-3.5 mr-1" />
                    {filterStartDate && filterEndDate ? (
                      <>{format(new Date(filterStartDate), 'dd/MM')} - {format(new Date(filterEndDate), 'dd/MM')}</>
                    ) : filterEndDate ? format(new Date(filterEndDate), 'dd/MM') : 'Data'}
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Selecionar Período</DialogTitle>
                    <DialogDescription>
                      Selecione a data inicial e final para filtrar as arbitragens {dateFilterType === 'jogo' ? 'com jogos' : 'adicionadas'} nesse período.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="start-date">Data Início <span className="text-muted-foreground ml-1">({dateFilterType === 'jogo' ? 'Data do Jogo' : 'Adicionado em'})</span></Label>
                      <Input id="start-date" type="date" value={filterStartDate} onChange={(e) => { setFilterStartDate(e.target.value); setSelectedPeriod('custom'); }} className="w-full" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="end-date">Data Fim <span className="text-muted-foreground ml-1">({dateFilterType === 'jogo' ? 'Data do Jogo' : 'Adicionado em'})</span></Label>
                      <Input id="end-date" type="date" value={filterEndDate} onChange={(e) => { setFilterEndDate(e.target.value); setSelectedPeriod('custom'); }} className="w-full" />
                    </div>
                    <p className="text-sm text-muted-foreground">* Preencha ambas as datas para filtrar um período, ou apenas a data fim para filtrar um dia específico.</p>
                  </div>
                  <div className="flex justify-end gap-2 pt-4 border-t">
                    <DialogTrigger asChild><Button type="button">OK</Button></DialogTrigger>
                  </div>
                </DialogContent>
              </Dialog>
              {(filterStartDate || filterEndDate) && (
                <Button variant="ghost" size="sm" className="h-8 px-1.5" onClick={() => { setFilterStartDate(''); setFilterEndDate(''); setSelectedPeriod('custom'); }}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>

          {/* Status + Operador + Parceria - same line on desktop */}
          <div className="flex items-center gap-1 flex-wrap md:border-l md:pl-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 justify-between text-xs gap-1">
                  <span className="truncate">{filterStatus.includes('all') ? 'Status: Todos' : `Status: ${filterStatus.length}`}</span>
                  <Filter className="h-3.5 w-3.5 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-3 bg-background z-50" align="start">
                <div className="space-y-3">
                  <div className="font-semibold text-sm">Filtrar por Status</div>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <Checkbox id="arb-status-all" checked={filterStatus.includes('all')} onCheckedChange={(checked) => { if (checked) { setFilterStatus(['all']); } else { setFilterStatus([]); } }} />
                      <label htmlFor="arb-status-all" className="text-sm font-medium cursor-pointer">Todos</label>
                    </div>
                    {['aguardando', 'green', 'red'].map((status) => (
                      <div key={status} className="flex items-center space-x-2">
                        <Checkbox
                          id={`arb-status-${status}`}
                          checked={!filterStatus.includes('all') && filterStatus.includes(status)}
                          onCheckedChange={(checked) => {
                            if (filterStatus.includes('all')) { setFilterStatus([status]); } else {
                              if (checked) { setFilterStatus([...filterStatus, status]); } else {
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

            {isAdmin && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 justify-between text-xs gap-1">
                    <span className="truncate">
                      {filterUser.length === 0 ? 'Operador: Todos' : filterUser.length === users.length ? 'Operador: Todos' : `Operador: ${filterUser.length}`}
                    </span>
                    <Filter className="h-3.5 w-3.5 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-3 bg-background z-50" align="start">
                  <div className="space-y-3">
                    <div className="font-semibold text-sm">Filtrar por Operador</div>
                    <div className="flex items-center space-x-2 pb-2 border-b">
                      <Checkbox id="select-all" checked={filterUser.length === users.length} onCheckedChange={(checked) => { if (checked) { setFilterUser(users.map(u => u.id)); } else { setFilterUser([]); } }} />
                      <label htmlFor="select-all" className="text-sm font-medium leading-none cursor-pointer">Selecionar Todos</label>
                    </div>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {users.map((u) => (
                        <div key={u.id} className="flex items-center space-x-2">
                          <Checkbox id={u.id} checked={filterUser.includes(u.id)} onCheckedChange={(checked) => { if (checked) { setFilterUser([...filterUser, u.id]); } else { setFilterUser(filterUser.filter(id => id !== u.id)); } }} />
                          <label htmlFor={u.id} className="text-sm leading-none cursor-pointer">{u.name}</label>
                        </div>
                      ))}
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            )}

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 justify-between text-xs gap-1">
                  <span className="truncate">
                    {filterPartnership.length === 0 ? 'Parceria: Todas' : filterPartnership.length === filterablePartnerships.length ? 'Parceria: Todas' : `Parceria: ${filterPartnership.length}`}
                  </span>
                  <Filter className="h-3.5 w-3.5 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-3 bg-background z-50" align="start">
                <div className="space-y-3">
                  <div className="font-semibold text-sm">Filtrar por Parceria</div>
                  {filterablePartnerships.length === 0 ? (
                    <div className="text-sm text-muted-foreground py-2">Nenhuma parceria ativa encontrada para o(s) operador(es) selecionado(s).</div>
                  ) : (
                    <>
                      <div className="flex items-center space-x-2 pb-2 border-b">
                        <Checkbox id="select-all-partnerships" checked={filterPartnership.length === filterablePartnerships.length && filterablePartnerships.length > 0} onCheckedChange={(checked) => { if (checked) { setFilterPartnership(filterablePartnerships.map(p => p.id)); } else { setFilterPartnership([]); } }} />
                        <label htmlFor="select-all-partnerships" className="text-sm font-medium leading-none cursor-pointer">Selecionar Todas</label>
                      </div>
                      <div className="space-y-2 max-h-60 overflow-y-auto">
                        {filterablePartnerships.map((p) => (
                          <div key={p.id} className="flex items-center space-x-2">
                            <Checkbox id={`partnership-${p.id}`} checked={filterPartnership.includes(p.id)} onCheckedChange={(checked) => { if (checked) { setFilterPartnership([...filterPartnership, p.id]); } else { setFilterPartnership(filterPartnership.filter(id => id !== p.id)); } }} />
                            <label htmlFor={`partnership-${p.id}`} className="text-sm leading-none cursor-pointer">{formatUserName(p.nome_completo)}</label>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Cards de resumo - Layout igual ao Dashboard */}
        {filteredArbitragens.length > 0 && (
          <div className="space-y-2">
            {/* Row 1: Investido + Total/Lucro/ROI side by side */}
            <div className="grid gap-2 grid-cols-2 md:grid-cols-[3fr_3fr_3.5fr_2.6fr_3.5fr]">
              {/* Total Investido */}
              <div className="rounded-lg border bg-card p-2 animate-fade-in">
                <div className="flex items-center gap-1 mb-0.5">
                  <span className="text-[10px] text-muted-foreground">Total Investido</span>
                </div>
                <div className="text-base md:text-lg font-bold truncate">R$ {formatCurrency(totais.totalInvestido)}</div>
                {isOnlyAguardando && totalBanca > 0 && (
                  <>
                    <Progress 
                      value={Math.min(bancaPercentage, 100)} 
                      className="h-1.5 mt-1"
                    />
                    <p className="text-[9px] text-muted-foreground">
                      {formatCurrency(bancaPercentage)}% da banca
                    </p>
                  </>
                )}
              </div>

              {/* Quantidade + Lucro Aberto + ROI */}
              <div className="rounded-lg border bg-card p-2 animate-fade-in" style={{ animationDelay: '50ms', animationFillMode: 'backwards' }}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-muted-foreground">Total</span>
                  <span className="text-sm font-bold">{filteredArbitragens.length}</span>
                </div>
                <div className="border-t pt-1 flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground">Lucro</span>
                  <span className={`text-xs font-bold truncate ml-1 ${totais.totalLucro >= 0 ? 'text-success' : 'text-destructive'}`}>
                    R$ {formatCurrency(totais.totalLucro)}
                  </span>
                </div>
                <div className="border-t pt-1 flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground">ROI</span>
                  <span className={`text-sm font-bold ${totais.totalInvestido > 0 && (totais.totalLucro / totais.totalInvestido) >= 0 ? 'text-success' : 'text-destructive'}`}>
                    {totais.totalInvestido > 0 ? formatCurrency((totais.totalLucro / totais.totalInvestido) * 100) : '0'}%
                  </span>
                </div>
              </div>

              {/* Lucro do Mês - hidden on mobile, shown in desktop grid */}
              <div className="rounded-lg border bg-card p-2 animate-fade-in hidden md:block" style={{ animationDelay: '100ms', animationFillMode: 'backwards' }}>
                <div className="flex items-center gap-1 mb-1">
                  {lucroLiquido >= 0 ? (
                    <TrendingUp className="h-3 w-3 text-success" />
                  ) : (
                    <TrendingDown className="h-3 w-3 text-destructive" />
                  )}
                  <span className="text-[10px] text-muted-foreground">Lucro do Mês</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <div>
                      <span className="text-[9px] text-muted-foreground block">Bruto</span>
                      <span className={`text-sm font-bold ${userMonthStats.totalLucro >= 0 ? 'text-success' : 'text-destructive'}`}>
                        R$ {formatCurrency(animatedMonthLucro)}
                      </span>
                    </div>
                    <div className="border-t pt-1">
                      <span className="text-[9px] text-muted-foreground block">Custos</span>
                      <span className="text-sm font-bold text-destructive">
                        - R$ {formatCurrency(animatedMonthlyCosts)}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col items-center justify-center border-l border-r px-2">
                    <span className="text-[9px] text-muted-foreground">Líquido</span>
                    <span className={`text-lg font-bold ${lucroLiquido >= 0 ? 'text-success' : 'text-destructive'}`}>
                      R$ {formatCurrency(animatedLucroLiquido)}
                    </span>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] text-muted-foreground">Investido</span>
                      <span className="text-xs font-medium">R$ {formatCurrency(animatedMonthInvestido)}</span>
                    </div>
                    <div className="border-t pt-1 flex items-center justify-between">
                      <span className="text-[9px] text-muted-foreground">Média/Dia</span>
                      <span className={`text-xs font-medium ${mediaDia >= 0 ? 'text-success' : 'text-destructive'}`}>
                        R$ {formatCurrency(animatedMediaDia)}
                      </span>
                    </div>
                    <div className="border-t pt-1 flex items-center justify-between">
                      <span className="text-[9px] text-muted-foreground">ROI</span>
                      <span className={`text-xs font-medium ${roiMensal >= 0 ? 'text-success' : 'text-destructive'}`}>
                        {formatCurrency(animatedRoiMensal)}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Meta Mensal - hidden on mobile, shown in desktop grid */}
              {user?.id && (
                <div className="animate-fade-in hidden md:block" style={{ animationDelay: '150ms', animationFillMode: 'backwards' }}>
                  <MonthlyGoalCard
                    userId={user.id}
                    currentProfit={goalProfit}
                    compact
                  />
                </div>
              )}

              {/* Saldos das Parcerias - desktop only */}
              {(isLoadingBalances || partnershipBalances.length > 0) && (
                <div className="rounded-lg border bg-card p-2 animate-fade-in hidden md:flex md:flex-col" style={{ animationDelay: '200ms', animationFillMode: 'backwards' }}>
                  <div className="flex items-center gap-1 mb-1">
                    <Building2 className="h-3 w-3 text-muted-foreground" />
                    <span className="text-[10px] text-muted-foreground">Saldos</span>
                  </div>
                  {isLoadingBalances ? (
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3 w-full rounded bg-muted animate-pulse" />
                      <div className="h-3 w-3/4 rounded bg-muted animate-pulse" />
                      <div className="border-t mt-1 pt-1">
                        <div className="h-4 w-1/2 rounded bg-muted animate-pulse ml-auto" />
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex-1 space-y-0.5 overflow-auto max-h-[80px]">
                        {partnershipBalances.map((p) => (
                          <div key={p.id} className="flex items-center justify-between text-[9px] leading-tight">
                            <span className="text-muted-foreground truncate mr-1">{p.nome}</span>
                            <span className="font-medium whitespace-nowrap">
                              <span className="text-muted-foreground">{formatCurrency(p.saldoBancario)}</span>
                              <span className="text-muted-foreground mx-0.5">+</span>
                              <span className="text-muted-foreground">{formatCurrency(p.saldoCasas)}</span>
                              <span className="mx-0.5">=</span>
                              <span className="font-bold">{formatCurrency(p.total)}</span>
                            </span>
                          </div>
                        ))}
                      </div>
                      <div className="border-t mt-1 pt-1 flex items-center justify-between">
                        <span className="text-[10px] text-muted-foreground font-medium">Total</span>
                        <span className="text-sm font-bold">
                          R$ {formatCurrency(partnershipBalances.reduce((s, p) => s + p.total, 0))}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Mobile only: Lucro do Mês full width */}
            <div className="rounded-lg border bg-card p-3 animate-fade-in md:hidden" style={{ animationDelay: '100ms', animationFillMode: 'backwards' }}>
              <div className="flex items-center gap-1 mb-2">
                {lucroLiquido >= 0 ? (
                  <TrendingUp className="h-3 w-3 text-success" />
                ) : (
                  <TrendingDown className="h-3 w-3 text-destructive" />
                )}
                <span className="text-[10px] text-muted-foreground">Lucro do Mês</span>
              </div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-muted-foreground">Líquido</span>
                <span className={`text-xl font-bold ${lucroLiquido >= 0 ? 'text-success' : 'text-destructive'}`}>
                  R$ {formatCurrency(animatedLucroLiquido)}
                </span>
              </div>
              <div className="space-y-1 border-t pt-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground">Bruto</span>
                  <span className={`text-xs font-medium ${userMonthStats.totalLucro >= 0 ? 'text-success' : 'text-destructive'}`}>
                    R$ {formatCurrency(animatedMonthLucro)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground">Custos</span>
                  <span className="text-xs font-medium text-destructive">
                    - R$ {formatCurrency(animatedMonthlyCosts)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground">Investido</span>
                  <span className="text-xs font-medium">R$ {formatCurrency(animatedMonthInvestido)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground">Média/Dia ({userMonthStats.diasComApostas} dias)</span>
                  <span className={`text-xs font-medium ${mediaDia >= 0 ? 'text-success' : 'text-destructive'}`}>
                    R$ {formatCurrency(animatedMediaDia)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground">ROI Mensal</span>
                  <span className={`text-xs font-medium ${roiMensal >= 0 ? 'text-success' : 'text-destructive'}`}>
                    {formatCurrency(animatedRoiMensal)}%
                  </span>
                </div>
              </div>
            </div>

            {/* Mobile only: Meta Mensal full width */}
            {user?.id && (
              <div className="animate-fade-in md:hidden" style={{ animationDelay: '150ms', animationFillMode: 'backwards' }}>
                <MonthlyGoalCard
                  userId={user.id}
                  currentProfit={goalProfit}
                  compact
                />
              </div>
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
            // Visualização Mobile - Lista compacta com expansão por clique
            <div className={`space-y-1.5 ${debouncedSearchText ? 'animate-fade-in' : ''}`}>
              {paginatedArbitragens.map((arb) => {
                const eventDate = new Date(arb.data_evento);
                eventDate.setHours(0, 0, 0, 0);
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const isEventPast = eventDate < today;
                const isEventToday = eventDate.getTime() === today.getTime();
                const eventDateTime = new Date(arb.data_evento);
                const isGameStarted = eventDateTime <= new Date();
                const shouldPulse = isGameStarted && arb.status === 'aguardando';
                const isExpanded = expandedMobileCard === arb.id;
                
                return (
                  <div
                    key={arb.id}
                    className={`rounded-lg border bg-card overflow-hidden ${debouncedSearchText ? 'animate-fade-in' : ''} ${
                      isEventPast && arb.status === 'aguardando'
                        ? 'border-l-4 border-red-500'
                        : isEventToday
                        ? 'border-l-4 border-sky-300'
                        : ''
                    }`}
                  >
                    {/* Linha principal - sempre visível, clicável */}
                    <div 
                      className="flex items-center gap-2 px-2.5 py-2 cursor-pointer active:bg-muted/50"
                      onClick={() => setExpandedMobileCard(isExpanded ? null : arb.id)}
                    >
                      {/* Descrição + casas */}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{arb.descricao}</p>
                        <p className="text-[10px] text-muted-foreground truncate">
                          {arb.casa_01_nome} × {arb.casa_02_nome}
                        </p>
                      </div>
                      
                      {/* Data/hora + lucro */}
                      <div className="text-right shrink-0">
                        <div className={`text-[10px] ${shouldPulse ? 'text-destructive font-semibold animate-pulse' : 'text-muted-foreground'}`}>
                          {format(eventDateTime, 'dd/MM HH:mm')}
                        </div>
                        <div className={`text-[10px] font-medium ${(arb.status === 'aguardando' ? arb.lucro_projetado : (arb.lucro_real ?? 0)) >= 0 ? 'text-success' : 'text-destructive'}`}>
                          R$ {formatCurrency(arb.status === 'aguardando' ? arb.lucro_projetado : (arb.lucro_real ?? 0))}
                        </div>
                      </div>
                      
                      <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                    </div>

                    {/* Detalhes expandidos */}
                    {isExpanded && (
                      <div className="px-2.5 pb-2.5 pt-0 space-y-2 border-t animate-fade-in">
                        {/* Ações */}
                        <div className="flex items-center justify-between pt-2">
                          <div className="flex gap-1">
                            <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); setEditArbitrage(arb); }} className="h-7 text-xs gap-1">
                              <Pencil className="h-3 w-3" />
                              Editar
                            </Button>
                            <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); handleDuplicate(arb); }} className="h-7 text-xs gap-1">
                              <Copy className="h-3 w-3" />
                              Duplicar
                            </Button>
                            <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); setViewGanhosArbitrage(arb); }} className="h-7 text-xs gap-1">
                              <FileText className="h-3 w-3" />
                              Detalhes
                            </Button>
                          </div>
                        </div>

                        {/* Evento completo */}
                        <div>
                          <p className="text-xs font-medium">{arb.descricao}</p>
                          {arb.esporte_liga && <p className="text-[10px] text-muted-foreground">{arb.esporte_liga}</p>}
                          <p className={`text-[10px] mt-0.5 ${shouldPulse ? 'text-destructive font-semibold animate-pulse' : 'text-muted-foreground'}`}>
                            <Clock className="inline h-3 w-3 mr-0.5" />
                            {format(eventDateTime, 'dd/MM/yyyy HH:mm')}
                          </p>
                        </div>

                        {/* Casas detalhadas */}
                        <div className="grid grid-cols-2 gap-2">
                          <div className="rounded-md border p-2 text-[10px] space-y-0.5">
                            <div className="font-medium">{arb.casa_01_nome}</div>
                            <div className="text-muted-foreground">Odd: {Number(arb.casa_01_odd).toFixed(3)}</div>
                            <div className="text-muted-foreground">Valor: R$ {formatCurrency(arb.casa_01_valor)}</div>
                            {arb.casa_01_mercado && <div className="text-muted-foreground">{arb.casa_01_mercado}</div>}
                          </div>
                          <div className="rounded-md border p-2 text-[10px] space-y-0.5">
                            <div className="font-medium">{arb.casa_02_nome}</div>
                            <div className="text-muted-foreground">Odd: {Number(arb.casa_02_odd).toFixed(3)}</div>
                            <div className="text-muted-foreground">Valor: R$ {formatCurrency(arb.casa_02_valor)}</div>
                            {arb.casa_02_mercado && <div className="text-muted-foreground">{arb.casa_02_mercado}</div>}
                          </div>
                        </div>
                        {arb.casa_03_nome && (
                          <div className="rounded-md border p-2 text-[10px] space-y-0.5">
                            <div className="font-medium">{arb.casa_03_nome}</div>
                            <div className="text-muted-foreground">Odd: {Number(arb.casa_03_odd || 0).toFixed(3)} • Valor: R$ {formatCurrency(arb.casa_03_valor || 0)}</div>
                            {arb.casa_03_mercado && <div className="text-muted-foreground">{arb.casa_03_mercado}</div>}
                          </div>
                        )}

                        {/* Resumo financeiro */}
                        <div className="flex items-center justify-between text-[10px] pt-1 border-t">
                          <div>
                            <span className="text-muted-foreground">Investido: </span>
                            <span className="font-medium">R$ {formatCurrency(Number(arb.casa_01_valor) + Number(arb.casa_02_valor) + Number(arb.casa_03_valor || 0))}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Lucro: </span>
                            <span className={`font-bold ${(arb.status === 'aguardando' ? arb.lucro_projetado : arb.lucro_real) >= 0 ? 'text-success' : 'text-destructive'}`}>
                              R$ {formatCurrency(arb.status === 'aguardando' ? arb.lucro_projetado : arb.lucro_real)}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            // Visualização Desktop Normal
            <div className={`space-y-4 ${debouncedSearchText ? 'animate-fade-in' : ''}`}>
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
                  className={`rounded-lg border bg-card p-4 ${debouncedSearchText ? 'animate-fade-in' : ''} ${
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
                      {(isAdmin || arb.user_id === user?.id) && (
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
                    <div className="font-medium text-lg">{highlightText(arb.descricao, debouncedSearchText)}</div>
                    {arb.esporte_liga && (
                      <div className="text-sm text-muted-foreground">{highlightText(arb.esporte_liga, debouncedSearchText)}</div>
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
                          {(() => {
                            const url = getHouseUrl(arb.casa_01_nome);
                            return url ? (
                              <a href={url.startsWith('http') ? url : `https://${url}`} target="_blank" rel="noopener noreferrer" className="font-medium hover:underline flex items-center gap-1">
                                {highlightText(arb.casa_01_nome, debouncedSearchText)}<ExternalLink className="h-3 w-3 inline flex-shrink-0" />
                              </a>
                            ) : (
                              <div className="font-medium">{highlightText(arb.casa_01_nome, debouncedSearchText)}</div>
                            );
                          })()}
                          {arb.casa_01_mercado && (
                            <div className="text-xs text-muted-foreground">{arb.casa_01_mercado}</div>
                          )}
                          <div className="text-sm text-muted-foreground">
                            {Number(arb.casa_01_odd).toFixed(3)}x • R$ {formatCurrency(arb.casa_01_valor)}
                          </div>
                        </div>
                        <ResultadoDropdown
                          currentResult={arb.casa_01_resultado}
                          currentCashoutValue={arb.casa_01_valor_resultado}
                          valorApostado={arb.casa_01_valor}
                          onResultChange={(resultado, cashoutValue) => 
                            handleUpdateResult(arb.id, 'casa_01', resultado, cashoutValue)
                          }
                        />
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
                          {(() => {
                            const url = getHouseUrl(arb.casa_02_nome);
                            return url ? (
                              <a href={url.startsWith('http') ? url : `https://${url}`} target="_blank" rel="noopener noreferrer" className="font-medium hover:underline flex items-center gap-1">
                                {highlightText(arb.casa_02_nome, debouncedSearchText)}<ExternalLink className="h-3 w-3 inline flex-shrink-0" />
                              </a>
                            ) : (
                              <div className="font-medium">{highlightText(arb.casa_02_nome, debouncedSearchText)}</div>
                            );
                          })()}
                          {arb.casa_02_mercado && (
                            <div className="text-xs text-muted-foreground">{arb.casa_02_mercado}</div>
                          )}
                          <div className="text-sm text-muted-foreground">
                            {Number(arb.casa_02_odd).toFixed(3)}x • R$ {formatCurrency(arb.casa_02_valor)}
                          </div>
                        </div>
                        <ResultadoDropdown
                          currentResult={arb.casa_02_resultado}
                          currentCashoutValue={arb.casa_02_valor_resultado}
                          valorApostado={arb.casa_02_valor}
                          onResultChange={(resultado, cashoutValue) => 
                            handleUpdateResult(arb.id, 'casa_02', resultado, cashoutValue)
                          }
                        />
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
                            {(() => {
                              const url = getHouseUrl(arb.casa_03_nome!);
                              return url ? (
                                <a href={url.startsWith('http') ? url : `https://${url}`} target="_blank" rel="noopener noreferrer" className="font-medium hover:underline flex items-center gap-1">
                                  {highlightText(arb.casa_03_nome!, debouncedSearchText)}<ExternalLink className="h-3 w-3 inline flex-shrink-0" />
                                </a>
                              ) : (
                                <div className="font-medium">{highlightText(arb.casa_03_nome!, debouncedSearchText)}</div>
                              );
                            })()}
                            {arb.casa_03_mercado && (
                              <div className="text-xs text-muted-foreground">{arb.casa_03_mercado}</div>
                            )}
                            <div className="text-sm text-muted-foreground">
                              {Number(arb.casa_03_odd).toFixed(3)}x • R$ {formatCurrency(arb.casa_03_valor)}
                            </div>
                          </div>
                          <ResultadoDropdown
                            currentResult={arb.casa_03_resultado || 'aguardando'}
                            currentCashoutValue={arb.casa_03_valor_resultado}
                            valorApostado={arb.casa_03_valor || 0}
                            onResultChange={(resultado, cashoutValue) => 
                              handleUpdateResult(arb.id, 'casa_03', resultado, cashoutValue)
                            }
                          />
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
                          {(() => {
                            const url = getHouseUrl(arb.casa_01_nome);
                            return url ? (
                              <a href={url.startsWith('http') ? url : `https://${url}`} target="_blank" rel="noopener noreferrer" className="font-medium break-words whitespace-normal hover:underline flex items-center gap-1">
                                {arb.casa_01_nome}<ExternalLink className="h-3 w-3 inline flex-shrink-0" />
                              </a>
                            ) : (
                              <div className="font-medium break-words whitespace-normal">{arb.casa_01_nome}</div>
                            );
                          })()}
                          {arb.casa_01_mercado && (
                            <div className="text-muted-foreground text-[10px]">{arb.casa_01_mercado}</div>
                          )}
                          <div className="text-muted-foreground">
                            {Number(arb.casa_01_odd).toFixed(3)}x • R$ {formatCurrency(arb.casa_01_valor)}
                          </div>
                        </div>
                        <ResultadoDropdown
                          currentResult={arb.casa_01_resultado}
                          currentCashoutValue={arb.casa_01_valor_resultado}
                          valorApostado={arb.casa_01_valor}
                          onResultChange={(resultado, cashoutValue) => 
                            handleUpdateResult(arb.id, 'casa_01', resultado, cashoutValue)
                          }
                        />
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
                          {(() => {
                            const url = getHouseUrl(arb.casa_02_nome);
                            return url ? (
                              <a href={url.startsWith('http') ? url : `https://${url}`} target="_blank" rel="noopener noreferrer" className="font-medium break-words whitespace-normal hover:underline flex items-center gap-1">
                                {arb.casa_02_nome}<ExternalLink className="h-3 w-3 inline flex-shrink-0" />
                              </a>
                            ) : (
                              <div className="font-medium break-words whitespace-normal">{arb.casa_02_nome}</div>
                            );
                          })()}
                          {arb.casa_02_mercado && (
                            <div className="text-muted-foreground text-[10px]">{arb.casa_02_mercado}</div>
                          )}
                          <div className="text-muted-foreground">
                            {Number(arb.casa_02_odd).toFixed(3)}x • R$ {formatCurrency(arb.casa_02_valor)}
                          </div>
                        </div>
                        <ResultadoDropdown
                          currentResult={arb.casa_02_resultado}
                          currentCashoutValue={arb.casa_02_valor_resultado}
                          valorApostado={arb.casa_02_valor}
                          onResultChange={(resultado, cashoutValue) => 
                            handleUpdateResult(arb.id, 'casa_02', resultado, cashoutValue)
                          }
                        />
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
                            {(() => {
                              const url = getHouseUrl(arb.casa_03_nome!);
                              return url ? (
                                <a href={url.startsWith('http') ? url : `https://${url}`} target="_blank" rel="noopener noreferrer" className="font-medium break-words whitespace-normal hover:underline flex items-center gap-1">
                                  {arb.casa_03_nome}<ExternalLink className="h-3 w-3 inline flex-shrink-0" />
                                </a>
                              ) : (
                                <div className="font-medium break-words whitespace-normal">{arb.casa_03_nome}</div>
                              );
                            })()}
                            {arb.casa_03_mercado && (
                              <div className="text-muted-foreground text-[10px]">{arb.casa_03_mercado}</div>
                            )}
                            <div className="text-muted-foreground">
                              {Number(arb.casa_03_odd).toFixed(3)}x • R$ {formatCurrency(arb.casa_03_valor)}
                            </div>
                          </div>
                          <ResultadoDropdown
                            currentResult={arb.casa_03_resultado || 'aguardando'}
                            currentCashoutValue={arb.casa_03_valor_resultado}
                            valorApostado={arb.casa_03_valor || 0}
                            onResultChange={(resultado, cashoutValue) => 
                              handleUpdateResult(arb.id, 'casa_03', resultado, cashoutValue)
                            }
                          />
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
                          {(isAdmin || arb.user_id === user?.id) && (
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

      <ConfirmDeleteDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        onConfirm={handleDelete}
        title="Excluir Arbitragem"
        description="Tem certeza que deseja excluir esta arbitragem? Esta ação não pode ser desfeita."
      />

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
                      {partnerships.length > 0 && (
                        <div>
                          <Label>Parceria</Label>
                          <Select
                            value={editArbitrage.casa_01_parceria_id || ''}
                            onValueChange={(v) => setEditArbitrage({ ...editArbitrage, casa_01_parceria_id: v })}
                          >
                            <SelectTrigger><SelectValue placeholder="Selecione a parceria" /></SelectTrigger>
                            <SelectContent className="bg-background z-50">
                              {partnerships.map((p) => (
                                <SelectItem key={p.id} value={p.id}>{p.nome_completo}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                      <div>
                        <Label>Nome</Label>
                        <Input
                          value={editArbitrage.casa_01_nome}
                          onChange={(e) => setEditArbitrage({ ...editArbitrage, casa_01_nome: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label>Mercado</Label>
                        <Input
                          value={editArbitrage.casa_01_mercado || ''}
                          onChange={(e) => setEditArbitrage({ ...editArbitrage, casa_01_mercado: e.target.value })}
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
                      {partnerships.length > 0 && (
                        <div>
                          <Label>Parceria</Label>
                          <Select
                            value={editArbitrage.casa_02_parceria_id || ''}
                            onValueChange={(v) => setEditArbitrage({ ...editArbitrage, casa_02_parceria_id: v })}
                          >
                            <SelectTrigger><SelectValue placeholder="Selecione a parceria" /></SelectTrigger>
                            <SelectContent className="bg-background z-50">
                              {partnerships.map((p) => (
                                <SelectItem key={p.id} value={p.id}>{p.nome_completo}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                      <div>
                        <Label>Nome</Label>
                        <Input
                          value={editArbitrage.casa_02_nome}
                          onChange={(e) => setEditArbitrage({ ...editArbitrage, casa_02_nome: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label>Mercado</Label>
                        <Input
                          value={editArbitrage.casa_02_mercado || ''}
                          onChange={(e) => setEditArbitrage({ ...editArbitrage, casa_02_mercado: e.target.value })}
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
                        {partnerships.length > 0 && (
                          <div>
                            <Label>Parceria</Label>
                            <Select
                              value={editArbitrage.casa_03_parceria_id || ''}
                              onValueChange={(v) => setEditArbitrage({ ...editArbitrage, casa_03_parceria_id: v })}
                            >
                              <SelectTrigger><SelectValue placeholder="Selecione a parceria" /></SelectTrigger>
                              <SelectContent className="bg-background z-50">
                                {partnerships.map((p) => (
                                  <SelectItem key={p.id} value={p.id}>{p.nome_completo}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                        <div>
                          <Label>Nome</Label>
                          <Input
                            value={editArbitrage.casa_03_nome}
                            onChange={(e) => setEditArbitrage({ ...editArbitrage, casa_03_nome: e.target.value })}
                          />
                        </div>
                        <div>
                          <Label>Mercado</Label>
                          <Input
                            value={editArbitrage.casa_03_mercado || ''}
                            onChange={(e) => setEditArbitrage({ ...editArbitrage, casa_03_mercado: e.target.value })}
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
      </div>

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
                      viewGanhosArbitrage.casa_01_resultado,
                      viewGanhosArbitrage.casa_01_valor_resultado
                    ) >= 0 ? 'text-success' : 'text-destructive'
                  }`}>
                    R$ {calcularGanhoPorCasa(
                      viewGanhosArbitrage.casa_01_valor,
                      viewGanhosArbitrage.casa_01_odd,
                      viewGanhosArbitrage.casa_01_resultado,
                      viewGanhosArbitrage.casa_01_valor_resultado
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
                      viewGanhosArbitrage.casa_02_resultado,
                      viewGanhosArbitrage.casa_02_valor_resultado
                    ) >= 0 ? 'text-success' : 'text-destructive'
                  }`}>
                    R$ {formatCurrency(calcularGanhoPorCasa(
                      viewGanhosArbitrage.casa_02_valor,
                      viewGanhosArbitrage.casa_02_odd,
                      viewGanhosArbitrage.casa_02_resultado,
                      viewGanhosArbitrage.casa_02_valor_resultado
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
                        viewGanhosArbitrage.casa_03_resultado || 'aguardando',
                        viewGanhosArbitrage.casa_03_valor_resultado
                      ) >= 0 ? 'text-success' : 'text-destructive'
                    }`}>
                      R$ {formatCurrency(calcularGanhoPorCasa(
                        viewGanhosArbitrage.casa_03_valor || 0,
                        viewGanhosArbitrage.casa_03_odd || 0,
                        viewGanhosArbitrage.casa_03_resultado || 'aguardando',
                        viewGanhosArbitrage.casa_03_valor_resultado
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
                      viewGanhosArbitrage.casa_01_resultado,
                      viewGanhosArbitrage.casa_01_valor_resultado
                    ) +
                    calcularGanhoPorCasa(
                      viewGanhosArbitrage.casa_02_valor,
                      viewGanhosArbitrage.casa_02_odd,
                      viewGanhosArbitrage.casa_02_resultado,
                      viewGanhosArbitrage.casa_02_valor_resultado
                    ) +
                    calcularGanhoPorCasa(
                      viewGanhosArbitrage.casa_03_valor || 0,
                      viewGanhosArbitrage.casa_03_odd || 0,
                      viewGanhosArbitrage.casa_03_resultado || 'aguardando',
                      viewGanhosArbitrage.casa_03_valor_resultado
                    )) >= 0 ? 'text-success' : 'text-destructive'
                  }`}>
                    R$ {formatCurrency(
                      calcularGanhoPorCasa(
                        viewGanhosArbitrage.casa_01_valor,
                        viewGanhosArbitrage.casa_01_odd,
                        viewGanhosArbitrage.casa_01_resultado,
                        viewGanhosArbitrage.casa_01_valor_resultado
                      ) +
                      calcularGanhoPorCasa(
                        viewGanhosArbitrage.casa_02_valor,
                        viewGanhosArbitrage.casa_02_odd,
                        viewGanhosArbitrage.casa_02_resultado,
                        viewGanhosArbitrage.casa_02_valor_resultado
                      ) +
                      calcularGanhoPorCasa(
                        viewGanhosArbitrage.casa_03_valor || 0,
                        viewGanhosArbitrage.casa_03_odd || 0,
                        viewGanhosArbitrage.casa_03_resultado || 'aguardando',
                        viewGanhosArbitrage.casa_03_valor_resultado
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

          {/* Botão de Prejuízo Avulso */}
          <div className="flex justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-destructive border-destructive/50 hover:bg-destructive/10"
              onClick={() => {
                setOpenAdd(false);
                setOpenPrejuizo(true);
              }}
            >
              <TrendingDown className="h-4 w-4 mr-2" />
              Prejuízo Avulso
            </Button>
          </div>

          <div className="space-y-2 rounded-md border p-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="data_registro_add">Data do Registro da Aposta</Label>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 px-2 gap-1"
                onClick={() => {
                  setDataRegistroLocked((prev) => {
                    const next = !prev;
                    if (!next && !dataRegistroCustom) {
                      const now = new Date();
                      const tzOffset = now.getTimezoneOffset() * 60000;
                      setDataRegistroCustom(new Date(now.getTime() - tzOffset).toISOString().slice(0, 16));
                    }
                    return next;
                  });
                }}
              >
                {dataRegistroLocked ? (
                  <>
                    <Lock className="h-3.5 w-3.5" />
                    <span className="text-xs">Bloqueado</span>
                  </>
                ) : (
                  <>
                    <Unlock className="h-3.5 w-3.5" />
                    <span className="text-xs">Desbloqueado</span>
                  </>
                )}
              </Button>
            </div>
            <Input
              id="data_registro_add"
              type="datetime-local"
              value={dataRegistroCustom}
              onChange={(e) => setDataRegistroCustom(e.target.value)}
              disabled={dataRegistroLocked}
            />
            <p className="text-xs text-muted-foreground">
              {dataRegistroLocked
                ? 'Por padrão, a aposta é registrada com a data e hora atuais. Clique no cadeado para alterar (somente no momento da criação).'
                : 'A aposta será registrada no relatório com a data escolhida acima. Só pode ser definida agora, no cadastro.'}
            </p>
          </div>

          <div className="flex items-start gap-3 rounded-md border-2 border-primary/40 bg-primary/5 p-3">
            <Checkbox
              id="descontar_saldo"
              checked={descontarSaldo}
              onCheckedChange={(v) => setDescontarSaldo(v === true)}
              className="mt-0.5 h-5 w-5"
            />
            <div className="space-y-1 flex-1">
              <Label htmlFor="descontar_saldo" className="cursor-pointer font-semibold text-sm">
                Descontar do saldo das casas
              </Label>
              <p className="text-xs text-muted-foreground">
                {descontarSaldo
                  ? '✓ O valor apostado será descontado automaticamente do saldo das casas envolvidas.'
                  : '✗ O saldo das casas NÃO será alterado ao registrar esta aposta.'}
              </p>
            </div>
          </div>

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
                      <BettingHouseInput
                        id="casa_01_nome_add"
                        value={formData.casa_01_nome}
                        onChange={(value) => setFormData({ ...formData, casa_01_nome: value })}
                        placeholder="Ex: Bet365"
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
                        className={parseFloat(formData.casa_01_odd) > 1 ? 'border-success' : ''}
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
                        className={parseFloat(formData.casa_01_valor) > 0 ? 'border-success' : ''}
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
                      <BettingHouseInput
                        id="casa_02_nome_add"
                        value={formData.casa_02_nome}
                        onChange={(value) => setFormData({ ...formData, casa_02_nome: value })}
                        placeholder="Ex: Betano"
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
                        className={parseFloat(formData.casa_02_odd) > 1 ? 'border-success' : ''}
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
                        className={parseFloat(formData.casa_02_valor) > 0 ? 'border-success' : ''}
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
                        <BettingHouseInput
                          id="casa_03_nome_add"
                          value={formData.casa_03_nome}
                          onChange={(value) => setFormData({ ...formData, casa_03_nome: value })}
                          placeholder="Ex: Sportingbet"
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
                          className={parseFloat(formData.casa_03_odd) > 1 ? 'border-success' : ''}
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
                          className={parseFloat(formData.casa_03_valor) > 0 ? 'border-success' : ''}
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
                      value={parseLocalizedNumber(formData.porcentagem) < 0 ? '' : formData.porcentagem}
                      readOnly
                      className={`bg-muted ${
                        parseLocalizedNumber(formData.porcentagem) > 0 
                          ? 'text-success font-semibold border-success' 
                          : ''
                      }`}
                    />
                    {formData.porcentagem && parseLocalizedNumber(formData.porcentagem) > 0 && (
                      <p className="text-xs font-medium text-success">
                        ✅ Arbitragem válida!
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <Label htmlFor="retorno_previsto_add">Retorno Previsto (R$)</Label>
                      <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                        <Checkbox
                          checked={calculoAutomatico}
                          onCheckedChange={(v) => setCalculoAutomatico(v === true)}
                          className="h-3.5 w-3.5"
                        />
                        <span>Cálculo automático</span>
                      </label>
                    </div>
                    <Input
                      id="retorno_previsto_add"
                      type="text"
                      placeholder={calculoAutomatico ? "Calculado automaticamente" : "Digite o retorno"}
                      value={formData.retorno_previsto}
                      readOnly={calculoAutomatico}
                      onChange={(e) => !calculoAutomatico && setFormData(prev => ({ ...prev, retorno_previsto: e.target.value }))}
                      className={`${calculoAutomatico ? 'bg-muted' : ''} ${parseLocalizedNumber(formData.retorno_previsto) > 0 ? 'border-success' : ''}`}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lucro_projetado_add">Lucro Projetado (R$)</Label>
                    <Input
                      id="lucro_projetado_add"
                      type="text"
                      placeholder="Calculado automaticamente"
                      value={formData.lucro_projetado}
                      readOnly
                      className={`bg-muted ${
                        parseLocalizedNumber(formData.lucro_projetado) > 0 
                          ? 'text-success font-semibold border-success' 
                          : parseLocalizedNumber(formData.lucro_projetado) < 0 
                            ? 'text-destructive border-destructive' 
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

      {/* Dialog de Prejuízo/Lucro Avulso */}
      <Dialog open={openPrejuizo} onOpenChange={setOpenPrejuizo}>
        <DialogContent className="max-w-md">
          {(() => {
            const valorApostado = parseLocalizedNumber(prejuizoData.valor_apostado);
            const valorEncerrado = parseLocalizedNumber(prejuizoData.valor_encerrado);
            const resultado = valorEncerrado - valorApostado;
            const isLucro = resultado >= 0;
            const hasValues = prejuizoData.valor_apostado && prejuizoData.valor_encerrado;
            
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    {hasValues && isLucro ? (
                      <TrendingUp className="h-5 w-5 text-green-500" />
                    ) : (
                      <TrendingDown className="h-5 w-5 text-destructive" />
                    )}
                    {hasValues && isLucro ? 'Lucro Avulso' : 'Prejuízo Avulso'}
                  </DialogTitle>
                  <DialogDescription>
                    Registre o encerramento de uma aposta que não foi completada nas duas casas
                  </DialogDescription>
                </DialogHeader>
                
                <form onSubmit={handleSubmitPrejuizo} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="prejuizo_data_evento">Data/Hora</Label>
                    <Input
                      id="prejuizo_data_evento"
                      type="datetime-local"
                      value={prejuizoData.data_evento}
                      onChange={(e) => setPrejuizoData({ ...prejuizoData, data_evento: e.target.value })}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="prejuizo_descricao">Descrição (opcional)</Label>
                    <Input
                      id="prejuizo_descricao"
                      placeholder="Ex: Desistência por queda de odd"
                      value={prejuizoData.descricao}
                      onChange={(e) => setPrejuizoData({ ...prejuizoData, descricao: e.target.value })}
                    />
                  </div>
                  
                  {partnerships.length > 0 && (
                    <div className="space-y-2">
                      <Label htmlFor="prejuizo_parceria">Parceria</Label>
                      <Select
                        value={prejuizoData.partnership_id || selectedPartnership01}
                        onValueChange={(v) => setPrejuizoData({ ...prejuizoData, partnership_id: v })}
                      >
                        <SelectTrigger id="prejuizo_parceria">
                          <SelectValue placeholder="Selecione a parceria" />
                        </SelectTrigger>
                        <SelectContent className="bg-background z-50">
                          {partnerships.map((p) => (
                            <SelectItem key={p.id} value={p.id}>{p.nome_completo}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="prejuizo_casa">Casa de Aposta</Label>
                    <BettingHouseInput
                      id="prejuizo_casa"
                      value={prejuizoData.casa_nome}
                      onChange={(value) => setPrejuizoData({ ...prejuizoData, casa_nome: value })}
                      placeholder="Nome da casa"
                      required
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="prejuizo_valor_apostado">Valor Apostado (R$)</Label>
                      <Input
                        id="prejuizo_valor_apostado"
                        placeholder="100,00"
                        value={prejuizoData.valor_apostado}
                        onChange={(e) => setPrejuizoData({ ...prejuizoData, valor_apostado: e.target.value })}
                        required
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="prejuizo_valor_encerrado">Valor Encerrado (R$)</Label>
                      <Input
                        id="prejuizo_valor_encerrado"
                        placeholder="50,00"
                        value={prejuizoData.valor_encerrado}
                        onChange={(e) => setPrejuizoData({ ...prejuizoData, valor_encerrado: e.target.value })}
                        required
                      />
                    </div>
                  </div>
                  
                  {/* Preview do resultado */}
                  {hasValues && (
                    <div className={`p-3 rounded-lg border ${
                      isLucro 
                        ? 'bg-green-500/10 border-green-500/30' 
                        : 'bg-destructive/10 border-destructive/30'
                    }`}>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Valor apostado:</span>
                        <span>R$ {formatCurrency(valorApostado)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Valor encerrado:</span>
                        <span>R$ {formatCurrency(valorEncerrado)}</span>
                      </div>
                      <div className={`flex justify-between text-sm pt-2 border-t mt-2 ${
                        isLucro ? 'border-green-500/30' : 'border-destructive/30'
                      }`}>
                        <span className="text-muted-foreground font-medium">
                          {isLucro ? 'Lucro:' : 'Prejuízo:'}
                        </span>
                        <span className={`font-semibold ${
                          isLucro ? 'text-green-500' : 'text-destructive'
                        }`}>
                          {isLucro ? '+' : '-'} R$ {formatCurrency(Math.abs(resultado))}
                        </span>
                      </div>
                    </div>
                  )}
                  
                  <div className="flex gap-2 pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1"
                      onClick={() => setOpenPrejuizo(false)}
                    >
                      Cancelar
                    </Button>
                    <Button
                      type="submit"
                      variant={hasValues && isLucro ? 'default' : 'destructive'}
                      className={`flex-1 ${hasValues && isLucro ? 'bg-green-600 hover:bg-green-700' : ''}`}
                      disabled={isLoadingPrejuizo}
                    >
                      {isLoadingPrejuizo 
                        ? 'Salvando...' 
                        : hasValues && isLucro 
                          ? 'Registrar Lucro' 
                          : 'Registrar Prejuízo'
                      }
                    </Button>
                  </div>
                </form>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
