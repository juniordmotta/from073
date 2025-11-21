import { useEffect, useState } from 'react';
import { Layout } from '@/components/Layout';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
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
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { ChevronDown, Plus, Pencil, Trash2, Clock } from 'lucide-react';
import { format, differenceInMilliseconds } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';

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
  casa_02_nome: string;
  casa_02_odd: number;
  casa_02_valor: number;
  casa_02_resultado: string;
  casa_02_mercado?: string;
  casa_03_nome?: string;
  casa_03_odd?: number;
  casa_03_valor?: number;
  casa_03_resultado?: string;
  casa_03_mercado?: string;
  porcentagem: number;
  lucro_projetado: number;
  lucro_real: number;
  status: string;
  user_id: string;
}

const statusMap = {
  aguardando: { label: 'Aguardando', variant: 'secondary' as const },
  green: { label: 'Green', variant: 'default' as const },
  red: { label: 'Red', variant: 'destructive' as const },
  parcial_green: { label: 'Parcial Green', variant: 'default' as const },
  parcial_red: { label: 'Parcial Red', variant: 'destructive' as const },
  perda_total: { label: 'Perda Total', variant: 'destructive' as const },
  devolvido: { label: 'Devolvido', variant: 'secondary' as const },
};

const resultOptions = [
  { value: 'green', label: 'Ganhou' },
  { value: 'red', label: 'Perdeu' },
  { value: 'parcial_green', label: 'Ganho Parcial' },
  { value: 'parcial_red', label: 'Perda Parcial' },
  { value: 'perda_total', label: 'Perda Total' },
  { value: 'devolvido', label: 'Devolvido' },
];

export default function MinhasArbitragens() {
  const { user, userRole } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [arbitragens, setArbitragens] = useState<Arbitrage[]>([]);
  const [filteredArbitragens, setFilteredArbitragens] = useState<Arbitrage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editArbitrage, setEditArbitrage] = useState<Arbitrage | null>(null);
  const [viewGanhosArbitrage, setViewGanhosArbitrage] = useState<Arbitrage | null>(null);
  const [filterDate, setFilterDate] = useState('');
  const [filterStatus, setFilterStatus] = useState('aguardando');
  const [filterUser, setFilterUser] = useState('all');
  const [users, setUsers] = useState<Array<{ id: string; name: string }>>([]);
  const itemsPerPage = 10;

  const isAdmin = userRole?.role === 'admin' || userRole?.role === 'admin_master';

  const totalPages = Math.ceil(filteredArbitragens.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedArbitragens = filteredArbitragens.slice(startIndex, endIndex);

  // Calcular totais baseado nos filtros
  const totais = filteredArbitragens.reduce(
    (acc, arb) => {
      const lucro = arb.status === 'aguardando' ? Number(arb.lucro_projetado) : Number(arb.lucro_real);
      return {
        totalInvestido: acc.totalInvestido + Number(arb.casa_01_valor) + Number(arb.casa_02_valor) + Number(arb.casa_03_valor || 0),
        totalLucro: acc.totalLucro + lucro,
      };
    },
    { totalInvestido: 0, totalLucro: 0 }
  );

  useEffect(() => {
    loadArbitragens();
    if (isAdmin) {
      loadUsers();
    }
  }, [user, isAdmin]);

  useEffect(() => {
    applyFilters();
  }, [arbitragens, filterDate, filterStatus, filterUser]);

  const loadUsers = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, name')
      .order('name');
    
    if (data) {
      setUsers(data);
    }
  };

  const applyFilters = () => {
    let filtered = [...arbitragens];

    if (filterDate) {
      filtered = filtered.filter((arb) => 
        format(new Date(arb.created_at), 'yyyy-MM-dd') === filterDate
      );
    }

    if (filterStatus !== 'all') {
      filtered = filtered.filter((arb) => arb.status === filterStatus);
    }

    if (filterUser !== 'all') {
      filtered = filtered.filter((arb) => arb.user_id === filterUser);
    }

    setFilteredArbitragens(filtered);
    setCurrentPage(1);
  };

  const loadArbitragens = async () => {
    let query = supabase.from('arbitrages').select(`
      *,
      profiles!arbitrages_user_id_fkey (name)
    `).order('created_at', { ascending: false });

    if (!isAdmin) {
      query = query.eq('user_id', user?.id);
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

    // Cálculo conforme as novas regras
    if (resultado === 'green') {
      // Ganhou: valor apostado * odd
      valorResultado = valorApostado * odd;
    } else if (resultado === 'red') {
      // Perdeu: 0
      valorResultado = 0;
    } else if (resultado === 'parcial_green') {
      // Ganho parcial: metade devolvida + (metade * odd)
      const metade = valorApostado / 2;
      valorResultado = metade + (metade * odd);
    } else if (resultado === 'parcial_red') {
      // Perda parcial: metade devolvida
      valorResultado = valorApostado / 2;
    } else if (resultado === 'perda_total') {
      // Perda total: 0 para esta casa
      valorResultado = 0;
    } else if (resultado === 'devolvido') {
      // Devolvido: aposta devolvida
      valorResultado = valorApostado;
    }

    const updateField = casa === 'casa_01' ? 'casa_01_resultado' : casa === 'casa_02' ? 'casa_02_resultado' : 'casa_03_resultado';
    const valorField = casa === 'casa_01' ? 'casa_01_valor_resultado' : casa === 'casa_02' ? 'casa_02_valor_resultado' : 'casa_03_valor_resultado';
    
    // Se for perda total, marcar todas as casas também como perda total
    const updateData: any = {
      [updateField]: resultado,
      [valorField]: valorResultado,
    };

    if (resultado === 'perda_total') {
      updateData.casa_01_resultado = 'perda_total';
      updateData.casa_01_valor_resultado = 0;
      updateData.casa_02_resultado = 'perda_total';
      updateData.casa_02_valor_resultado = 0;
      if (arb.casa_03_nome) {
        updateData.casa_03_resultado = 'perda_total';
        updateData.casa_03_valor_resultado = 0;
      }
    }

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

    const updateData: any = {
      descricao: editArbitrage.descricao,
      data_evento: editArbitrage.data_evento,
      casa_01_nome: editArbitrage.casa_01_nome,
      casa_01_odd: editArbitrage.casa_01_odd,
      casa_01_valor: editArbitrage.casa_01_valor,
      casa_02_nome: editArbitrage.casa_02_nome,
      casa_02_odd: editArbitrage.casa_02_odd,
      casa_02_valor: editArbitrage.casa_02_valor,
      porcentagem: editArbitrage.porcentagem,
      lucro_projetado: editArbitrage.lucro_projetado,
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
    } else {
      toast({
        title: 'Arbitragem atualizada!',
        description: 'As alterações foram salvas com sucesso.',
      });
      loadArbitragens();
    }

    setEditArbitrage(null);
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
    } else if (resultado === 'parcial_green') {
      // Meio green: metade devolvida + (metade × odd) - aposta total
      const metade = aposta / 2;
      return metade + (metade * odd) - aposta;
    } else if (resultado === 'parcial_red') {
      // Meio red: metade devolvida - aposta total
      const metade = aposta / 2;
      return metade - aposta;
    } else if (resultado === 'devolvido') {
      // Devolvido: lucro 0
      return 0;
    } else if (resultado === 'perda_total') {
      // Perda total
      return -aposta;
    } else {
      // Aguardando
      return 0;
    }
  };

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
          <h1 className="text-3xl font-bold">Minhas Arbitragens</h1>
          
          <div className="flex items-center gap-2 flex-wrap">
            <div className="w-40">
              <Input
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                placeholder="Filtrar por data"
              />
            </div>

            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Status" />
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

            {isAdmin && (
              <Select value={filterUser} onValueChange={setFilterUser}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Operador" />
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
            )}

            <Button onClick={() => navigate('/arbitragens')} className="gap-2">
              <Plus className="h-4 w-4" />
              Adicionar Arbitragem
            </Button>
          </div>
        </div>

        {/* Card de Totais */}
        {filteredArbitragens.length > 0 && (
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-lg border bg-card p-6">
              <div className="text-sm font-medium text-muted-foreground">Total de Arbitragens</div>
              <div className="text-2xl font-bold mt-2">{filteredArbitragens.length}</div>
            </div>
            <div className="rounded-lg border bg-card p-6">
              <div className="text-sm font-medium text-muted-foreground">Total Investido</div>
              <div className="text-2xl font-bold mt-2">R$ {totais.totalInvestido.toFixed(2)}</div>
            </div>
            <div className="rounded-lg border bg-card p-6">
              <div className="text-sm font-medium text-muted-foreground">Lucro Total</div>
              <div className={`text-2xl font-bold mt-2 ${totais.totalLucro >= 0 ? 'text-success' : 'text-destructive'}`}>
                R$ {totais.totalLucro.toFixed(2)}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                (Inclui lucro projetado dos aguardando)
              </div>
            </div>
          </div>
        )}

        {arbitragens.length === 0 ? (
          <div className="rounded-lg border p-8 text-center text-muted-foreground">
            <p>Nenhuma arbitragem cadastrada ainda.</p>
          </div>
        ) : (
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Adicionado em</TableHead>
                  <TableHead>Descrição</TableHead>
                  {isAdmin && <TableHead>Operador</TableHead>}
                  <TableHead>Casa 01</TableHead>
                  <TableHead>Casa 02</TableHead>
                  <TableHead>Casa 03</TableHead>
                  <TableHead>Lucro</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedArbitragens.map((arb) => {
                  const timeToEvent = differenceInMilliseconds(new Date(arb.data_evento), new Date());
                  const days = Math.floor(timeToEvent / (1000 * 60 * 60 * 24));
                  const hours = Math.floor((timeToEvent % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                  const minutes = Math.floor((timeToEvent % (1000 * 60 * 60)) / (1000 * 60));
                  
                  return (
                  <TableRow key={arb.id}>
                    <TableCell className={`text-xs relative ${
                      format(new Date(arb.data_evento), 'dd/MM/yy') === format(new Date(), 'dd/MM/yy')
                        ? 'border-l-4 border-yellow-400'
                        : ''
                    }`}>
                      {format(new Date(arb.data_evento), 'dd/MM/yy') === format(new Date(), 'dd/MM/yy') && (
                        <div className="absolute left-0 top-1 bottom-1 w-1 bg-yellow-400 animate-pulse" />
                      )}
                      <div className="flex flex-col pl-2">
                        <span>{format(new Date(arb.created_at), 'dd/MM/yy')}</span>
                        <span className="text-muted-foreground">
                          {format(new Date(arb.created_at), 'HH:mm')}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[200px] text-xs">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-muted-foreground">
                          {format(new Date(arb.data_evento), 'dd/MM/yy HH:mm')}
                        </span>
                        <span className="font-medium truncate">{arb.descricao}</span>
                        {arb.esporte_liga && (
                          <span className="text-muted-foreground truncate">{arb.esporte_liga}</span>
                        )}
                      </div>
                    </TableCell>
                    {isAdmin && (
                      <TableCell className="text-xs">
                        {(arb as any).profiles?.name || 'Desconhecido'}
                      </TableCell>
                    )}
                    <TableCell className="text-xs">
                      <div className="space-y-1.5">
                        <div>
                          <div className="font-medium">{arb.casa_01_nome}</div>
                          {arb.casa_01_mercado && (
                            <div className="text-muted-foreground text-[10px]">{arb.casa_01_mercado}</div>
                          )}
                          <div className="text-muted-foreground">
                            {Number(arb.casa_01_odd).toFixed(3)}x • R$ {arb.casa_01_valor}
                          </div>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs gap-1"
                            >
                              {statusMap[arb.casa_01_resultado as keyof typeof statusMap]?.label ||
                                'Definir'}
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
                          <div className="font-medium">{arb.casa_02_nome}</div>
                          {arb.casa_02_mercado && (
                            <div className="text-muted-foreground text-[10px]">{arb.casa_02_mercado}</div>
                          )}
                          <div className="text-muted-foreground">
                            {Number(arb.casa_02_odd).toFixed(3)}x • R$ {arb.casa_02_valor}
                          </div>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs gap-1"
                            >
                              {statusMap[arb.casa_02_resultado as keyof typeof statusMap]?.label ||
                                'Definir'}
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
                            <div className="font-medium">{arb.casa_03_nome}</div>
                            {arb.casa_03_mercado && (
                              <div className="text-muted-foreground text-[10px]">{arb.casa_03_mercado}</div>
                            )}
                            <div className="text-muted-foreground">
                              {Number(arb.casa_03_odd).toFixed(3)}x • R$ {arb.casa_03_valor}
                            </div>
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs gap-1"
                              >
                                {statusMap[arb.casa_03_resultado as keyof typeof statusMap]?.label ||
                                  'Definir'}
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
                          R$ {Number(arb.lucro_real).toFixed(2)}
                        </div>
                        <div className="text-muted-foreground">
                          Proj: R$ {Number(arb.lucro_projetado).toFixed(2)}
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
                      <Badge variant={statusMap[arb.status as keyof typeof statusMap]?.variant}>
                        {statusMap[arb.status as keyof typeof statusMap]?.label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-2">
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditArbitrage(arb)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          {isAdmin && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setDeleteId(arb.id)}
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
                  <div>R$ {viewGanhosArbitrage.casa_01_valor.toFixed(2)}</div>
                  <div className="text-muted-foreground">Odd:</div>
                  <div>{viewGanhosArbitrage.casa_01_odd}x</div>
                  <div className="text-muted-foreground">Resultado:</div>
                  <div>
                    <Badge variant={statusMap[viewGanhosArbitrage.casa_01_resultado as keyof typeof statusMap]?.variant}>
                      {statusMap[viewGanhosArbitrage.casa_01_resultado as keyof typeof statusMap]?.label || 'Aguardando'}
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
                  <div>R$ {viewGanhosArbitrage.casa_02_valor.toFixed(2)}</div>
                  <div className="text-muted-foreground">Odd:</div>
                  <div>{viewGanhosArbitrage.casa_02_odd}x</div>
                  <div className="text-muted-foreground">Resultado:</div>
                  <div>
                    <Badge variant={statusMap[viewGanhosArbitrage.casa_02_resultado as keyof typeof statusMap]?.variant}>
                      {statusMap[viewGanhosArbitrage.casa_02_resultado as keyof typeof statusMap]?.label || 'Aguardando'}
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
                    R$ {calcularGanhoPorCasa(
                      viewGanhosArbitrage.casa_02_valor,
                      viewGanhosArbitrage.casa_02_odd,
                      viewGanhosArbitrage.casa_02_resultado
                    ).toFixed(2)}
                  </div>
                </div>
              </div>

              {viewGanhosArbitrage.casa_03_nome && (
                <div className="rounded-lg border p-4 space-y-2">
                  <h3 className="font-semibold">{viewGanhosArbitrage.casa_03_nome}</h3>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="text-muted-foreground">Aposta:</div>
                    <div>R$ {viewGanhosArbitrage.casa_03_valor?.toFixed(2)}</div>
                    <div className="text-muted-foreground">Odd:</div>
                    <div>{viewGanhosArbitrage.casa_03_odd}x</div>
                    <div className="text-muted-foreground">Resultado:</div>
                    <div>
                      <Badge variant={statusMap[viewGanhosArbitrage.casa_03_resultado as keyof typeof statusMap]?.variant}>
                        {statusMap[viewGanhosArbitrage.casa_03_resultado as keyof typeof statusMap]?.label || 'Aguardando'}
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
                      R$ {calcularGanhoPorCasa(
                        viewGanhosArbitrage.casa_03_valor || 0,
                        viewGanhosArbitrage.casa_03_odd || 0,
                        viewGanhosArbitrage.casa_03_resultado || 'aguardando'
                      ).toFixed(2)}
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
                    R$ {(
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
                    ).toFixed(2)}
                  </div>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </Layout>
  );
}
