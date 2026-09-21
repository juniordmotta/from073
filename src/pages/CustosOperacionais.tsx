import { useEffect, useState, useMemo } from 'react';
import { Layout } from '@/components/Layout';
import { MobileFilters } from '@/components/MobileFilters';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { Plus, DollarSign, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import { format, startOfMonth, endOfMonth, subMonths, addMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatCurrency } from '@/lib/utils';
import { ValidatedInput } from '@/components/ui/validated-input';
import { operationalCostSchema } from '@/lib/validations/forms';
import { ConfirmDeleteDialog } from '@/components/ConfirmDeleteDialog';

interface OperationalCost {
  id: string;
  descricao: string;
  valor: number;
  data: string;
  created_at: string;
  user_id: string;
}

interface Profile {
  id: string;
  name: string;
}

export default function CustosOperacionais() {
  const { user, userRole } = useAuth();
  const { toast } = useToast();
  const [costs, setCosts] = useState<OperationalCost[]>([]);
  const [availableMonths, setAvailableMonths] = useState<string[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [deleteTarget, setDeleteTarget] = useState<OperationalCost | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string>(user?.id || '');
  const [users, setUsers] = useState<Array<{ id: string; name: string }>>([]);
  const [formData, setFormData] = useState({
    descricao: '',
    valor: '',
    data: format(new Date(), 'yyyy-MM-dd'),
  });
  const [touched, setTouched] = useState({
    descricao: false,
    valor: false,
    data: false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Validação em tempo real
  useEffect(() => {
    const result = operationalCostSchema.safeParse(formData);
    if (!result.success) {
      const newErrors: Record<string, string> = {};
      result.error.issues.forEach((err) => {
        if (err.path[0]) {
          newErrors[err.path[0] as string] = err.message;
        }
      });
      setErrors(newErrors);
    } else {
      setErrors({});
    }
  }, [formData]);

  const isFormValid = Object.keys(errors).length === 0 && 
    formData.descricao.trim().length > 0 && 
    formData.valor.length > 0 && 
    formData.data.length > 0;

  const isAdmin = userRole?.role === 'admin' || userRole?.role === 'admin_master';

  const currentMonth = format(new Date(), 'yyyy-MM');

  // Carregar meses disponíveis (que têm custos)
  const loadAvailableMonths = async () => {
    if (!user?.id) return;
    
    try {
      let query = supabase
        .from('operational_costs')
        .select('data');

      if (!isAdmin) {
        query = query.eq('user_id', user.id);
      }

      const { data, error } = await query;
      
      if (error) {
        console.warn('Erro ao carregar meses disponíveis:', error.message);
        setAvailableMonths([currentMonth]);
        return;
      }
      
      if (data) {
        const months = new Set<string>();
        months.add(currentMonth); // Sempre incluir mês atual
        data.forEach((cost) => {
          const month = format(new Date(cost.data), 'yyyy-MM');
          months.add(month);
        });
        // Ordenar do mais recente ao mais antigo
        const sortedMonths = Array.from(months).sort((a, b) => b.localeCompare(a));
        setAvailableMonths(sortedMonths);
      }
    } catch (error) {
      console.error('Erro inesperado ao carregar meses:', error);
      setAvailableMonths([currentMonth]);
    }
  };

  // Gerar opções de meses baseadas nos meses disponíveis
  const monthOptions = useMemo(() => {
    return availableMonths.map((month) => {
      const [year, monthNum] = month.split('-').map(Number);
      const date = new Date(year, monthNum - 1, 1);
      return {
        value: month,
        label: format(date, 'MMMM yyyy', { locale: ptBR }),
      };
    });
  }, [availableMonths]);

  // Calcular datas de início e fim do mês selecionado
  const { startDate, endDate } = useMemo(() => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const date = new Date(year, month - 1, 1);
    return {
      startDate: format(startOfMonth(date), 'yyyy-MM-dd'),
      endDate: format(endOfMonth(date), 'yyyy-MM-dd'),
    };
  }, [selectedMonth]);

  // Inicializar selectedUserId com usuário logado
  useEffect(() => {
    if (user?.id && !selectedUserId) {
      setSelectedUserId(user.id);
    }
  }, [user?.id]);

  useEffect(() => {
    loadAvailableMonths();
    if (isAdmin) {
      loadUsers();
    }
  }, [isAdmin, user?.id]);

  useEffect(() => {
    loadCosts();
  }, [startDate, endDate, isAdmin, selectedUserId]);

  const loadUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name')
        .order('name');

      if (error) {
        console.warn('Erro ao buscar usuários:', error.message);
        return;
      }
      setUsers(data || []);
    } catch (error) {
      console.error('Erro inesperado ao carregar usuários:', error);
    }
  };

  // Navegação entre meses
  const currentMonthIndex = availableMonths.indexOf(selectedMonth);
  const canGoPrevious = currentMonthIndex < availableMonths.length - 1;
  const canGoNext = currentMonthIndex > 0;

  const goToPreviousMonth = () => {
    if (canGoPrevious) {
      setSelectedMonth(availableMonths[currentMonthIndex + 1]);
    }
  };

  const goToNextMonth = () => {
    if (canGoNext) {
      setSelectedMonth(availableMonths[currentMonthIndex - 1]);
    }
  };

  const loadProfiles = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name');
      
      if (error) {
        // Operadores não têm permissão - comportamento esperado
        console.warn('Erro ao carregar profiles (RLS):', error.message);
        return;
      }
      
      if (data) {
        const profilesMap = data.reduce((acc, profile) => {
          acc[profile.id] = profile;
          return acc;
        }, {} as Record<string, Profile>);
        setProfiles(profilesMap);
      }
    } catch (error) {
      console.error('Erro inesperado ao carregar profiles:', error);
    }
  };

  const loadCosts = async () => {
    if (!user?.id) return;
    
    try {
      let query = supabase
        .from('operational_costs')
        .select('*')
        .order('data', { ascending: false });

      // Filtrar por usuário selecionado (ou próprio se não for admin)
      if (isAdmin && selectedUserId && selectedUserId !== 'all') {
        query = query.eq('user_id', selectedUserId);
      } else if (!isAdmin) {
        query = query.eq('user_id', user.id);
      }

      if (startDate) {
        query = query.gte('data', startDate);
      }

      if (endDate) {
        query = query.lte('data', endDate);
      }

      const { data, error } = await query;

      if (error) {
        console.warn('Erro ao carregar custos:', error.message);
        setCosts([]);
        return;
      }

      if (data) {
        setCosts(data);
      }
    } catch (error) {
      console.error('Erro inesperado ao carregar custos:', error);
      setCosts([]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Marcar todos os campos como tocados
    setTouched({ descricao: true, valor: true, data: true });
    
    // Validar antes de submeter
    const result = operationalCostSchema.safeParse(formData);
    if (!result.success) {
      return;
    }
    
    if (!user?.id) {
      toast({
        variant: 'destructive',
        title: 'Erro de autenticação',
        description: 'Usuário não autenticado.',
      });
      return;
    }
    
    setIsLoading(true);

    try {
      const { data: insertedData, error } = await supabase
        .from('operational_costs')
        .insert({
          user_id: user.id,
          descricao: formData.descricao.trim(),
          valor: parseFloat(formData.valor),
          data: formData.data,
        })
        .select()
        .single();

      if (error) throw error;

      // Atualização otimística - adicionar ao estado local imediatamente
      if (insertedData) {
        setCosts(prev => [insertedData, ...prev]);
        
        // Atualizar meses disponíveis se necessário
        const newMonth = format(new Date(insertedData.data), 'yyyy-MM');
        if (!availableMonths.includes(newMonth)) {
          setAvailableMonths(prev => [...prev, newMonth].sort((a, b) => b.localeCompare(a)));
        }
      }

      toast({
        title: 'Custo adicionado!',
        description: 'O custo operacional foi registrado com sucesso.',
      });

      setOpen(false);
      setFormData({
        descricao: '',
        valor: '',
        data: format(new Date(), 'yyyy-MM-dd'),
      });
      setTouched({ descricao: false, valor: false, data: false });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Erro ao adicionar custo',
        description: error.message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    
    // Atualização otimística - remover do estado local imediatamente
    const deletedCost = deleteTarget;
    setCosts(prev => prev.filter(c => c.id !== deletedCost.id));
    setDeleteTarget(null);
    
    try {
      const { error } = await supabase
        .from('operational_costs')
        .delete()
        .eq('id', deletedCost.id);

      if (error) throw error;

      toast({
        title: 'Custo removido!',
        description: 'O custo operacional foi removido com sucesso.',
      });

      // Atualizar meses disponíveis
      loadAvailableMonths();
    } catch (error: any) {
      // Reverter em caso de erro
      setCosts(prev => [...prev, deletedCost].sort((a, b) => 
        new Date(b.data).getTime() - new Date(a.data).getTime()
      ));
      toast({
        variant: 'destructive',
        title: 'Erro ao remover custo',
        description: error.message,
      });
    }
  };

  const totalCosts = costs.reduce((sum, cost) => sum + Number(cost.valor), 0);

  return (
    <Layout>
      <div className="mobile-section-page space-y-4">
        {/* Header compacto */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl md:text-3xl font-bold">Custos Operacionais</h1>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1">
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Adicionar</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Novo Custo Operacional</DialogTitle>
                <DialogDescription>
                  Registre um novo custo operacional
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={handleSubmit} className="space-y-4">
                <ValidatedInput
                  id="descricao"
                  label="Descrição"
                  placeholder="Ex: Mensalidade plataforma"
                  value={formData.descricao}
                  onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                  onBlur={() => setTouched({ ...touched, descricao: true })}
                  required
                  autoFocus
                  error={errors.descricao}
                  touched={touched.descricao}
                  showSuccess
                />

                <ValidatedInput
                  id="valor"
                  label="Valor (R$)"
                  type="number"
                  step="0.01"
                  placeholder="Ex: 50.00"
                  value={formData.valor}
                  onChange={(e) => setFormData({ ...formData, valor: e.target.value })}
                  onBlur={() => setTouched({ ...touched, valor: true })}
                  required
                  error={errors.valor}
                  touched={touched.valor}
                  showSuccess
                />

                <ValidatedInput
                  id="data"
                  label="Data"
                  type="date"
                  value={formData.data}
                  onChange={(e) => setFormData({ ...formData, data: e.target.value })}
                  onBlur={() => setTouched({ ...touched, data: true })}
                  required
                  error={errors.data}
                  touched={touched.data}
                  showSuccess
                />

                <Button type="submit" className="w-full" disabled={isLoading || !isFormValid}>
                  {isLoading ? 'Salvando...' : 'Salvar Custo'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Filtros inline */}
        <div className="flex flex-wrap items-center gap-2">
          <MobileFilters className="mobile-standard-filters w-full md:w-auto md:contents" label="Filtros de período">
          <div className="mobile-standard-filter-panel flex flex-wrap items-center gap-2">
          {isAdmin && (

            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
              <SelectTrigger className="w-[140px] h-8 text-sm">
                <SelectValue placeholder="Usuário" />
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
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={goToPreviousMonth}
              disabled={!canGoPrevious}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-[160px] h-8 text-sm">
                <SelectValue placeholder="Mês" />
              </SelectTrigger>
              <SelectContent>
                {monthOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label.charAt(0).toUpperCase() + option.label.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={goToNextMonth}
              disabled={!canGoNext}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          </div>
          </MobileFilters>
          <div className="mobile-dashboard-goal ml-auto flex items-center gap-2 rounded-lg border bg-card px-3 py-1.5">

            <DollarSign className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Total:</span>
            <span className="text-sm font-bold">R$ {formatCurrency(totalCosts)}</span>
          </div>
        </div>

        {/* Lista de custos - Desktop: tabela, Mobile: cards */}
        <div className="hidden md:block">
          <Card>
            <CardContent className="p-0">
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Valor</TableHead>
                      {isAdmin && <TableHead>Usuário</TableHead>}
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {costs.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={isAdmin ? 5 : 4} className="text-center text-muted-foreground">
                          Nenhum custo encontrado
                        </TableCell>
                      </TableRow>
                    ) : (
                      costs.map((cost) => (
                        <TableRow key={cost.id}>
                          <TableCell className="font-medium">
                            {format(new Date(cost.data), 'dd/MM/yyyy', { locale: ptBR })}
                          </TableCell>
                          <TableCell>{cost.descricao}</TableCell>
                          <TableCell className="font-semibold">
                            R$ {formatCurrency(cost.valor)}
                          </TableCell>
                          {isAdmin && (
                            <TableCell>
                              {profiles[cost.user_id]?.name || 'N/A'}
                            </TableCell>
                          )}
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setDeleteTarget(cost)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Mobile: Cards */}
        <div className="md:hidden space-y-2">
          {costs.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nenhum custo encontrado</p>
          ) : (
            costs.map((cost) => (
              <div key={cost.id} className="mobile-dashboard-card rounded-lg border p-3 flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{cost.descricao}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                    <span>{format(new Date(cost.data), 'dd/MM', { locale: ptBR })}</span>
                    {isAdmin && profiles[cost.user_id]?.name && (
                      <>
                        <span>•</span>
                        <span className="truncate">{profiles[cost.user_id]?.name}</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="font-bold text-sm">R$ {formatCurrency(cost.valor)}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setDeleteTarget(cost)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>

        <ConfirmDeleteDialog
          open={!!deleteTarget}
          onOpenChange={(open) => !open && setDeleteTarget(null)}
          onConfirm={handleDelete}
          itemName={deleteTarget?.descricao}
        />
      </div>
    </Layout>
  );
}
