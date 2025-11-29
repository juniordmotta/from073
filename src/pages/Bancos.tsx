import { useEffect, useState } from 'react';
import { Layout } from '@/components/Layout';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Plus, Pencil, Trash2, Building2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Bank {
  id: string;
  user_id: string;
  nome: string;
  created_at: string;
}

const Bancos = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [banks, setBanks] = useState<Bank[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingBank, setEditingBank] = useState<Bank | null>(null);
  const [formData, setFormData] = useState({ nome: '' });

  useEffect(() => {
    if (user) {
      fetchBanks();
    }
  }, [user]);

  const fetchBanks = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('banks')
        .select('*')
        .eq('user_id', user.id)
        .order('nome', { ascending: true });

      if (error) throw error;
      setBanks(data || []);
    } catch (error) {
      console.error('Erro ao buscar bancos:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar os bancos',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!formData.nome.trim()) {
      toast({
        title: 'Erro',
        description: 'Nome do banco é obrigatório',
        variant: 'destructive',
      });
      return;
    }

    try {
      if (editingBank) {
        const { error } = await supabase
          .from('banks')
          .update({ nome: formData.nome })
          .eq('id', editingBank.id);

        if (error) throw error;

        toast({
          title: 'Banco atualizado',
          description: 'Banco atualizado com sucesso',
        });
      } else {
        const { error } = await supabase
          .from('banks')
          .insert([{ user_id: user.id, nome: formData.nome }]);

        if (error) throw error;

        toast({
          title: 'Banco criado',
          description: 'Banco criado com sucesso',
        });
      }

      setIsDialogOpen(false);
      resetForm();
      fetchBanks();
    } catch (error) {
      console.error('Erro ao salvar banco:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível salvar o banco',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (bank: Bank) => {
    if (!confirm(`Tem certeza que deseja excluir o banco "${bank.nome}"?`)) return;

    try {
      const { error } = await supabase
        .from('banks')
        .delete()
        .eq('id', bank.id);

      if (error) throw error;

      toast({
        title: 'Banco excluído',
        description: 'Banco excluído com sucesso',
      });
      fetchBanks();
    } catch (error) {
      console.error('Erro ao excluir banco:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível excluir o banco',
        variant: 'destructive',
      });
    }
  };

  const openEditDialog = (bank: Bank) => {
    setEditingBank(bank);
    setFormData({ nome: bank.nome });
    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({ nome: '' });
    setEditingBank(null);
  };

  return (
    <Layout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Building2 className="h-8 w-8 text-primary" />
              Gerenciar Bancos
            </h1>
            <p className="text-muted-foreground mt-1">
              Adicione e gerencie os bancos que você utiliza
            </p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Adicionar Banco
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingBank ? 'Editar Banco' : 'Adicionar Banco'}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="nome">Nome do Banco *</Label>
                  <Input
                    id="nome"
                    value={formData.nome}
                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                    placeholder="Ex: Banco do Brasil, Nubank, etc."
                    required
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsDialogOpen(false);
                      resetForm();
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit">
                    {editingBank ? 'Atualizar' : 'Criar'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome do Banco</TableHead>
                <TableHead>Data de Criação</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : banks.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                    Nenhum banco cadastrado
                  </TableCell>
                </TableRow>
              ) : (
                banks.map((bank) => (
                  <TableRow key={bank.id}>
                    <TableCell className="font-medium">{bank.nome}</TableCell>
                    <TableCell>
                      {format(new Date(bank.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(bank)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(bank)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      </div>
    </Layout>
  );
};

export default Bancos;
