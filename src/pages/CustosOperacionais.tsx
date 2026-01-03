import { useEffect, useState, useMemo } from 'react';
import { Layout } from '@/components/Layout';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { Plus, DollarSign, Trash2 } from 'lucide-react';
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
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [deleteTarget, setDeleteTarget] = useState<OperationalCost | null>(null);
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

  // Gerar lista de meses (últimos 12 meses + próximos 2)
  const monthOptions = useMemo(() => {
    const months = [];
    const today = new Date();
    for (let i = 11; i >= -2; i--) {
      const date = i >= 0 ? subMonths(today, i) : addMonths(today, Math.abs(i));
      months.push({
        value: format(date, 'yyyy-MM'),
        label: format(date, 'MMMM yyyy', { locale: ptBR }),
      });
    }
    return months;
  }, []);

  // Calcular datas de início e fim do mês selecionado
  const { startDate, endDate } = useMemo(() => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const date = new Date(year, month - 1, 1);
    return {
      startDate: format(startOfMonth(date), 'yyyy-MM-dd'),
      endDate: format(endOfMonth(date), 'yyyy-MM-dd'),
    };
  }, [selectedMonth]);

  useEffect(() => {
    loadCosts();
    if (isAdmin) {
      loadProfiles();
    }
  }, [startDate, endDate, isAdmin]);

  const loadProfiles = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, name');
    
    if (data) {
      const profilesMap = data.reduce((acc, profile) => {
        acc[profile.id] = profile;
        return acc;
      }, {} as Record<string, Profile>);
      setProfiles(profilesMap);
    }
  };

  const loadCosts = async () => {
    let query = supabase
      .from('operational_costs')
      .select('*')
      .order('data', { ascending: false });

    if (!isAdmin) {
      query = query.eq('user_id', user?.id);
    }

    if (startDate) {
      query = query.gte('data', startDate);
    }

    if (endDate) {
      query = query.lte('data', endDate);
    }

    const { data, error } = await query;

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar custos',
        description: error.message,
      });
      return;
    }

    if (data) {
      setCosts(data);
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
      const { error } = await supabase.from('operational_costs').insert({
        user_id: user.id,
        descricao: formData.descricao.trim(),
        valor: parseFloat(formData.valor),
        data: formData.data,
      });

      if (error) throw error;

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
      loadCosts();
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
    
    try {
      const { error } = await supabase
        .from('operational_costs')
        .delete()
        .eq('id', deleteTarget.id);

      if (error) throw error;

      toast({
        title: 'Custo removido!',
        description: 'O custo operacional foi removido com sucesso.',
      });

      setDeleteTarget(null);
      loadCosts();
    } catch (error: any) {
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
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Custos Operacionais</h1>
          
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="lg" className="gap-2">
                <Plus className="h-5 w-5" />
                Adicionar Custo
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

        <div className="grid gap-4 md:grid-cols-1">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Custos</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                R$ {formatCurrency(totalCosts)}
              </div>
              <p className="text-xs text-muted-foreground">
                Período selecionado
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Filtros</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-w-xs">
              <Label htmlFor="month">Mês</Label>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger id="month">
                  <SelectValue placeholder="Selecione o mês" />
                </SelectTrigger>
                <SelectContent>
                  {monthOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label.charAt(0).toUpperCase() + option.label.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Lista de Custos</CardTitle>
          </CardHeader>
          <CardContent>
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
