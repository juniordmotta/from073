import { useEffect, useState, useMemo } from 'react';
import { Layout } from '@/components/Layout';
import { supabase } from '@/integrations/supabase/client';
import { useIsMobile } from '@/hooks/use-mobile';
import { useDebounce } from '@/hooks/useDebounce';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
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
import { UserPlus, Pencil, Trash2, History, Search, Filter, X } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatUserName } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

interface User {
  id: string;
  name: string;
  email: string;
  created_at: string;
  role?: string;
  monthly_goal?: number;
}

const roleLabels = {
  admin_master: 'Admin Master',
  admin: 'Admin',
  operador: 'Operador',
};

export default function Usuarios() {
  const { toast } = useToast();
  const isMobile = useIsMobile();
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
  });
  const [editFormData, setEditFormData] = useState({
    name: '',
    role: 'operador',
  });
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyData, setHistoryData] = useState<any[]>([]);
  const [historyFilter, setHistoryFilter] = useState<string>('all');
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const debouncedSearch = useDebounce(searchTerm, 300);

  // Filtrar usuários com base na busca e filtro de role
  const filteredUsers = useMemo(() => {
    let filtered = users;
    
    // Filtro de busca
    if (debouncedSearch) {
      const search = debouncedSearch.toLowerCase();
      filtered = filtered.filter(u => 
        u.name.toLowerCase().includes(search) ||
        u.email.toLowerCase().includes(search)
      );
    }
    
    // Filtro de role
    if (roleFilter !== 'all') {
      filtered = filtered.filter(u => u.role === roleFilter);
    }
    
    return filtered;
  }, [users, debouncedSearch, roleFilter]);

  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedUsers = filteredUsers.slice(startIndex, endIndex);

  const clearFilters = () => {
    setSearchTerm('');
    setRoleFilter('all');
  };

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (debouncedSearch) count++;
    if (roleFilter !== 'all') count++;
    return count;
  }, [debouncedSearch, roleFilter]);

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

    // Buscar roles e metas de cada usuário
    const currentMonth = new Date().toISOString().slice(0, 7) + '-01';
    const usersWithRolesAndGoals = await Promise.all(
      (profilesData || []).map(async (profile) => {
        const { data: roleData } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', profile.id)
          .single();

        const { data: goalData, error: goalError } = await supabase
          .from('monthly_goals')
          .select('goal_value')
          .eq('user_id', profile.id)
          .is('partnership_id', null)
          .eq('month', currentMonth)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (goalError) {
          console.error('Erro ao buscar meta para usuário', profile.id, ':', goalError);
        }

        console.log('Meta carregada para', profile.name, ':', goalData?.goal_value);

        return {
          ...profile,
          role: roleData?.role || 'operador',
          monthly_goal: goalData?.goal_value || 0,
        };
      })
    );

    setUsers(usersWithRolesAndGoals);
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

    console.log('Usuário criado:', data);

    toast({
      title: 'Usuário criado!',
      description: 'O novo usuário foi cadastrado com sucesso.',
    });
    setOpen(false);
    setFormData({ name: '', email: '', password: '', role: 'operador' });
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

  const openEditDialog = (user: User) => {
    setEditingUser(user);
    setEditFormData({
      name: user.name,
      role: user.role || 'operador',
    });
    setEditOpen(true);
  };

  const loadHistory = async () => {
    setIsLoadingHistory(true);
    let query = supabase
      .from('users_history')
      .select('*')
      .order('changed_at', { ascending: false })
      .limit(100);

    if (historyFilter !== 'all') {
      query = query.eq('user_id', historyFilter);
    }

    const { data: historyData, error } = await query;

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar histórico',
        description: error.message,
      });
      setIsLoadingHistory(false);
      return;
    }

    // Buscar informações dos usuários
    if (historyData && historyData.length > 0) {
      const changedByIds = [...new Set(historyData.map(h => h.changed_by))];
      const affectedUserIds = [...new Set(historyData.map(h => h.user_id))];
      const allUserIds = [...new Set([...changedByIds, ...affectedUserIds])];

      const { data: usersData } = await supabase
        .from('profiles')
        .select('id, name')
        .in('id', allUserIds);

      // Combinar os dados
      const enrichedHistory = historyData.map(item => ({
        ...item,
        changed_by_profile: usersData?.find(u => u.id === item.changed_by),
        affected_user_profile: usersData?.find(u => u.id === item.user_id),
      }));

      setHistoryData(enrichedHistory);
    } else {
      setHistoryData([]);
    }

    setIsLoadingHistory(false);
  };

  const openHistoryDialog = () => {
    setHistoryOpen(true);
    loadHistory();
  };

  useEffect(() => {
    if (historyOpen) {
      loadHistory();
    }
  }, [historyFilter]);

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
          <h1 className="text-3xl font-bold">Gerenciar Usuários</h1>

          <div className="flex gap-2">
            <Button 
              size={isMobile ? "sm" : "lg"} 
              variant="outline" 
              className="gap-2"
              onClick={openHistoryDialog}
            >
              <History className="h-5 w-5" />
              {!isMobile && "Histórico"}
            </Button>

            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size={isMobile ? "sm" : "lg"} className="gap-2">
                  <UserPlus className="h-5 w-5" />
                  {isMobile ? "Novo" : "Criar Usuário"}
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
                    autoFocus
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


                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? 'Criando...' : 'Criar Usuário'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
          </div>
        </div>

        {/* Seção de Filtros e Busca */}
        <Card className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Campo de Busca */}
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome ou email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Filtro de Role */}
            <div className="w-full md:w-48">
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos os tipos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os tipos</SelectItem>
                  <SelectItem value="admin_master">Admin Master</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="operador">Operador</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Botão de Limpar Filtros */}
            {activeFiltersCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="gap-2"
              >
                <X className="h-4 w-4" />
                Limpar ({activeFiltersCount})
              </Button>
            )}
          </div>
        </Card>

        {/* Visualização Desktop */}
        <div className="hidden md:block rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Meta Mensal</TableHead>
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
                    {user.monthly_goal && user.monthly_goal > 0 ? (
                      <span className="font-medium">R$ {(user.monthly_goal).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
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

        {/* Visualização Mobile/Tablet em Cards */}
        <div className="md:hidden space-y-4">
          {paginatedUsers.map((user) => (
            <Card key={user.id} className="p-4">
              <div className="space-y-3">
                {/* Header do Card */}
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg">{formatUserName(user.name)}</h3>
                    <p className="text-sm text-muted-foreground">{user.email}</p>
                  </div>
                  <Badge
                    variant={
                      user.role === 'admin_master' || user.role === 'admin'
                        ? 'default'
                        : 'secondary'
                    }
                  >
                    {roleLabels[user.role as keyof typeof roleLabels]}
                  </Badge>
                </div>

                {/* Informações */}
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Meta Mensal:</span>
                    {user.monthly_goal && user.monthly_goal > 0 ? (
                      <span className="font-medium">R$ {(user.monthly_goal).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Data de Cadastro:</span>
                    <span className="font-medium">
                      {format(new Date(user.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                    </span>
                  </div>
                </div>

                {/* Ações */}
                <div className="flex gap-2 pt-2 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => openEditDialog(user)}
                  >
                    <Pencil className="h-4 w-4 mr-2" />
                    Editar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => setDeleteUserId(user.id)}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Excluir
                  </Button>
                </div>
              </div>
            </Card>
          ))}
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
                  autoFocus
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

        {/* Dialog de Histórico de Alterações */}
        <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
          <DialogContent className="max-w-4xl max-h-[80vh]">
            <DialogHeader>
              <DialogTitle>Histórico de Alterações de Usuários</DialogTitle>
              <DialogDescription>
                Visualize todas as alterações realizadas nos perfis dos usuários
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Label htmlFor="history-filter">Filtrar por Usuário:</Label>
                <Select value={historyFilter} onValueChange={setHistoryFilter}>
                  <SelectTrigger className="w-64">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os Usuários</SelectItem>
                    {users.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {formatUserName(user.name)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <ScrollArea className="h-[500px] pr-4">
                {isLoadingHistory ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                  </div>
                ) : historyData.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Nenhum histórico encontrado
                  </div>
                ) : (
                  <div className="space-y-3">
                    {historyData.map((item) => {
                      const fieldLabels = {
                        name: 'Nome',
                        email: 'E-mail',
                        role: 'Função',
                        monthly_goal: 'Meta Mensal',
                      };
                      
                      const formatValue = (value: string | null, field: string) => {
                        if (!value) return '-';
                        if (field === 'role') {
                          return roleLabels[value as keyof typeof roleLabels] || value;
                        }
                        if (field === 'monthly_goal') {
                          return `R$ ${parseFloat(value).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                        }
                        return value;
                      };

                      return (
                        <div
                          key={item.id}
                          className="rounded-lg border p-4 space-y-2"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="font-semibold text-sm">
                                {item.affected_user_profile?.name || 'Usuário não encontrado'}
                              </div>
                              <div className="text-xs text-muted-foreground mt-1">
                                Campo alterado: <span className="font-medium">{fieldLabels[item.field_changed as keyof typeof fieldLabels] || item.field_changed}</span>
                              </div>
                            </div>
                            <div className="text-right text-xs text-muted-foreground">
                              {format(new Date(item.changed_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-3 text-xs">
                            <div className="rounded bg-muted/50 p-2">
                              <div className="text-muted-foreground mb-1">Valor Anterior:</div>
                              <div className="font-medium break-words">
                                {formatValue(item.old_value, item.field_changed)}
                              </div>
                            </div>
                            <div className="rounded bg-muted/50 p-2">
                              <div className="text-muted-foreground mb-1">Valor Novo:</div>
                              <div className="font-medium break-words">
                                {formatValue(item.new_value, item.field_changed)}
                              </div>
                            </div>
                          </div>

                          <div className="text-xs text-muted-foreground">
                            Alterado por: <span className="font-medium">{formatUserName(item.changed_by_profile?.name) || 'Usuário desconhecido'}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </ScrollArea>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
