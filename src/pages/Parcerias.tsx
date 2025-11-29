import { useEffect, useState } from 'react';
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
import { useToast } from '@/hooks/use-toast';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatCurrency } from '@/lib/utils';

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

const Parcerias = () => {
  const { user, userRole } = useAuth();
  const { toast } = useToast();
  const [partnerships, setPartnerships] = useState<Partnership[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPartnership, setEditingPartnership] = useState<Partnership | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [users, setUsers] = useState<{ id: string; name: string; email: string }[]>([]);

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
    fetchPartnerships();
    if (isAdmin) {
      fetchUsers();
    }
  }, [user, selectedUserId]);

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, email')
        .order('name');

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Erro ao buscar usuários:', error);
    }
  };

  const fetchPartnerships = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('partnerships')
        .select('*')
        .order('created_at', { ascending: false });

      // Se for admin e tiver filtro, filtrar por usuário
      if (isAdmin && selectedUserId) {
        query = query.eq('user_id', selectedUserId);
      } else if (!isAdmin) {
        // Se não for admin, só mostrar suas próprias parcerias
        query = query.eq('user_id', user?.id);
      }

      const { data, error } = await query;

      if (error) throw error;

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const partnershipData = {
        ...formData,
        valor_banca: parseFloat(formData.valor_banca),
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
    setFormData({
      nome_completo: partnership.nome_completo,
      cpf: partnership.cpf,
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

  return (
    <Layout>
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Parcerias</h1>
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
                    <Label htmlFor="cpf">CPF</Label>
                    <Input
                      id="cpf"
                      value={formData.cpf}
                      onChange={(e) => setFormData({ ...formData, cpf: e.target.value })}
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
                    <Label htmlFor="bancos_cadastrados">Bancos Cadastrados</Label>
                    <Input
                      id="bancos_cadastrados"
                      value={formData.bancos_cadastrados}
                      onChange={(e) => setFormData({ ...formData, bancos_cadastrados: e.target.value })}
                      required
                    />
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

        {isAdmin && (
          <div className="flex gap-4 items-end">
            <div className="space-y-2 flex-1">
              <Label htmlFor="user-filter">Filtrar por Usuário</Label>
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos os usuários" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todos os usuários</SelectItem>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name} ({user.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

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
                        {partnership.profiles?.name || partnership.profiles?.email}
                      </TableCell>
                    )}
                    <TableCell>{partnership.nome_completo}</TableCell>
                    <TableCell>{partnership.cpf}</TableCell>
                    <TableCell className="max-w-xs truncate">{partnership.endereco}</TableCell>
                    <TableCell>{formatCurrency(partnership.valor_banca)}</TableCell>
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
      </div>
    </Layout>
  );
};

export default Parcerias;
