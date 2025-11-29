import { useEffect, useState } from 'react';
import { Layout } from '@/components/Layout';
import { supabase } from '@/integrations/supabase/client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import { useToast } from '@/hooks/use-toast';
import { UserPlus, Pencil, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatUserName } from '@/lib/utils';

interface User {
  id: string;
  name: string;
  email: string;
  created_at: string;
  role?: string;
}

const roleLabels = {
  admin_master: 'Admin Master',
  admin: 'Admin',
  operador: 'Operador',
};

export default function Usuarios() {
  const { toast } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'operador',
    monthlyGoal: '',
  });
  const [editFormData, setEditFormData] = useState({
    name: '',
    role: 'operador',
    monthlyGoal: '',
  });

  const totalPages = Math.ceil(users.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedUsers = users.slice(startIndex, endIndex);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    const { data: profilesData, error: profilesError } = await supabase
      .from('profiles')
      .select('id, name, email, created_at')
      .order('created_at', { ascending: false });

    if (profilesError) {
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar usuários',
        description: profilesError.message,
      });
      setIsLoading(false);
      return;
    }

    // Buscar roles de cada usuário
    const usersWithRoles = await Promise.all(
      (profilesData || []).map(async (profile) => {
        const { data: roleData } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', profile.id)
          .single();

        return {
          ...profile,
          role: roleData?.role || 'operador',
        };
      })
    );

    setUsers(usersWithRoles);
    setIsLoading(false);
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    // Criar usuário via Supabase Admin (precisa de uma edge function)
    const { data, error } = await supabase.functions.invoke('create-user', {
      body: {
        email: formData.email,
        password: formData.password,
        name: formData.name,
        role: formData.role,
      },
    });

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Erro ao criar usuário',
        description: error.message,
      });
      setIsLoading(false);
      return;
    }

    // Salvar meta mensal se fornecida
    if (formData.monthlyGoal && data?.userId) {
      const goalValue = parseFloat(formData.monthlyGoal.replace(/\D/g, '')) / 100;
      const currentMonth = new Date().toISOString().slice(0, 7) + '-01';
      
      await supabase.from('monthly_goals').upsert({
        user_id: data.userId,
        partnership_id: null,
        month: currentMonth,
        goal_value: goalValue,
      }, {
        onConflict: 'user_id,partnership_id,month',
      });
    }

    toast({
      title: 'Usuário criado!',
      description: 'O novo usuário foi cadastrado com sucesso.',
    });
    setOpen(false);
    setFormData({ name: '', email: '', password: '', role: 'operador', monthlyGoal: '' });
    loadUsers();

    setIsLoading(false);
  };

  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    
    setIsLoading(true);

    // Atualizar perfil
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ name: editFormData.name })
      .eq('id', editingUser.id);

    if (profileError) {
      toast({
        variant: 'destructive',
        title: 'Erro ao atualizar usuário',
        description: profileError.message,
      });
      setIsLoading(false);
      return;
    }

    // Atualizar role
    const { error: roleError } = await supabase
      .from('user_roles')
      .update({ role: editFormData.role as any })
      .eq('user_id', editingUser.id);

    if (roleError) {
      toast({
        variant: 'destructive',
        title: 'Erro ao atualizar role',
        description: roleError.message,
      });
      setIsLoading(false);
      return;
    }

    // Atualizar meta mensal se fornecida
    if (editFormData.monthlyGoal) {
      const goalValue = parseFloat(editFormData.monthlyGoal.replace(/\D/g, '')) / 100;
      const currentMonth = new Date().toISOString().slice(0, 7) + '-01';
      
      await supabase.from('monthly_goals').upsert({
        user_id: editingUser.id,
        partnership_id: null,
        month: currentMonth,
        goal_value: goalValue,
      }, {
        onConflict: 'user_id,partnership_id,month',
      });
    }

    toast({
      title: 'Usuário atualizado!',
      description: 'As informações foram atualizadas com sucesso.',
    });
    
    setEditOpen(false);
    setEditingUser(null);
    loadUsers();
    setIsLoading(false);
  };

  const handleDeleteUser = async () => {
    if (!deleteUserId) return;
    
    setIsLoading(true);

    // Excluir role
    const { error: roleError } = await supabase
      .from('user_roles')
      .delete()
      .eq('user_id', deleteUserId);

    if (roleError) {
      toast({
        variant: 'destructive',
        title: 'Erro ao excluir role',
        description: roleError.message,
      });
      setIsLoading(false);
      return;
    }

    // Excluir perfil
    const { error: profileError } = await supabase
      .from('profiles')
      .delete()
      .eq('id', deleteUserId);

    if (profileError) {
      toast({
        variant: 'destructive',
        title: 'Erro ao excluir usuário',
        description: profileError.message,
      });
      setIsLoading(false);
      return;
    }

    toast({
      title: 'Usuário excluído!',
      description: 'O usuário foi removido com sucesso.',
    });
    
    setDeleteUserId(null);
    loadUsers();
    setIsLoading(false);
  };

  const openEditDialog = async (user: User) => {
    setEditingUser(user);
    
    // Buscar meta atual do usuário
    const currentMonth = new Date().toISOString().slice(0, 7) + '-01';
    const { data: goalData } = await supabase
      .from('monthly_goals')
      .select('goal_value')
      .eq('user_id', user.id)
      .eq('partnership_id', null)
      .eq('month', currentMonth)
      .maybeSingle();
    
    const goalValue = goalData?.goal_value || 0;
    const formattedGoal = goalValue > 0 ? (goalValue * 100).toFixed(0) : '';
    
    setEditFormData({
      name: user.name,
      role: user.role || 'operador',
      monthlyGoal: formattedGoal,
    });
    setEditOpen(true);
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
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Gerenciar Usuários</h1>

          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="lg" className="gap-2">
                <UserPlus className="h-5 w-5" />
                Criar Novo Usuário
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Criar Novo Usuário</DialogTitle>
                <DialogDescription>
                  Somente Admin Master pode criar novos usuários
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={handleCreateUser} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Senha</Label>
                  <Input
                    id="password"
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required
                    minLength={6}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="role">Tipo de Usuário</Label>
                  <Select
                    value={formData.role}
                    onValueChange={(value) => setFormData({ ...formData, role: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="operador">Operador</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="monthlyGoal">Meta Mensal (opcional)</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">R$</span>
                    <Input
                      id="monthlyGoal"
                      type="text"
                      placeholder="0,00"
                      className="pl-10"
                      value={formData.monthlyGoal}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, '');
                        const formatted = (parseInt(value || '0') / 100).toFixed(2).replace('.', ',');
                        setFormData({ ...formData, monthlyGoal: formatted });
                      }}
                    />
                  </div>
                </div>

                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? 'Criando...' : 'Criar Usuário'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Data de Cadastro</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedUsers.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{formatUserName(user.name)}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        user.role === 'admin_master' || user.role === 'admin'
                          ? 'default'
                          : 'secondary'
                      }
                    >
                      {roleLabels[user.role as keyof typeof roleLabels]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {format(new Date(user.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => openEditDialog(user)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setDeleteUserId(user.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        
        {users.length > itemsPerPage && (
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

        {/* Dialog de Edição */}
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar Usuário</DialogTitle>
              <DialogDescription>
                Edite as informações do usuário
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleEditUser} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Nome</Label>
                <Input
                  id="edit-name"
                  value={editFormData.name}
                  onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-role">Tipo de Usuário</Label>
                <Select
                  value={editFormData.role}
                  onValueChange={(value) => setEditFormData({ ...editFormData, role: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="operador">Operador</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-monthlyGoal">Meta Mensal (opcional)</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">R$</span>
                  <Input
                    id="edit-monthlyGoal"
                    type="text"
                    placeholder="0,00"
                    className="pl-10"
                    value={editFormData.monthlyGoal}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, '');
                      const formatted = (parseInt(value || '0') / 100).toFixed(2).replace('.', ',');
                      setEditFormData({ ...editFormData, monthlyGoal: formatted });
                    }}
                  />
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? 'Salvando...' : 'Salvar Alterações'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>

        {/* Dialog de Confirmação de Exclusão */}
        <AlertDialog open={!!deleteUserId} onOpenChange={() => setDeleteUserId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir este usuário? Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteUser}>
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </Layout>
  );
}
