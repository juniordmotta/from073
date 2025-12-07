import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Pencil, Trash2, Building2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ValidatedInput } from '@/components/ui/validated-input';
import { bankSchema } from '@/lib/validations/forms';
import { ConfirmDeleteDialog } from '@/components/ConfirmDeleteDialog';

interface Bank {
  id: string;
  user_id: string;
  nome: string;
  created_at: string;
}

interface BanksDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  onBanksUpdate: () => void;
}

export function BanksDialog({ isOpen, onOpenChange, userId, onBanksUpdate }: BanksDialogProps) {
  const { toast } = useToast();
  const [banks, setBanks] = useState<Bank[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingBank, setEditingBank] = useState<Bank | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Bank | null>(null);
  const [formData, setFormData] = useState({ nome: '' });
  const [touched, setTouched] = useState({ nome: false });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen) {
      fetchBanks();
    }
  }, [isOpen, userId]);

  // Validação em tempo real
  useEffect(() => {
    const result = bankSchema.safeParse(formData);
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

  const fetchBanks = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('banks')
        .select('*')
        .eq('user_id', userId)
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

    // Marcar todos os campos como tocados
    setTouched({ nome: true });

    // Validar antes de submeter
    const result = bankSchema.safeParse(formData);
    if (!result.success) {
      return;
    }

    try {
      if (editingBank) {
        const { error } = await supabase
          .from('banks')
          .update({ nome: formData.nome.trim() })
          .eq('id', editingBank.id);

        if (error) throw error;

        toast({
          title: 'Banco atualizado',
          description: 'Banco atualizado com sucesso',
        });
      } else {
        const { error } = await supabase
          .from('banks')
          .insert([{ user_id: userId, nome: formData.nome.trim() }]);

        if (error) throw error;

        toast({
          title: 'Banco criado',
          description: 'Banco criado com sucesso',
        });
      }

      setShowForm(false);
      resetForm();
      fetchBanks();
      onBanksUpdate();
    } catch (error) {
      console.error('Erro ao salvar banco:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível salvar o banco',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;

    try {
      const { error } = await supabase
        .from('banks')
        .delete()
        .eq('id', deleteTarget.id);

      if (error) throw error;

      toast({
        title: 'Banco excluído',
        description: 'Banco excluído com sucesso',
      });

      setDeleteTarget(null);
      fetchBanks();
      onBanksUpdate();
    } catch (error) {
      console.error('Erro ao excluir banco:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível excluir o banco',
        variant: 'destructive',
      });
    }
  };

  const openEditForm = (bank: Bank) => {
    setEditingBank(bank);
    setFormData({ nome: bank.nome });
    setTouched({ nome: false });
    setShowForm(true);
  };

  const resetForm = () => {
    setFormData({ nome: '' });
    setEditingBank(null);
    setShowForm(false);
    setTouched({ nome: false });
    setErrors({});
  };

  const isFormValid = Object.keys(errors).length === 0 && formData.nome.trim().length > 0;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            Gerenciar Bancos
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {!showForm ? (
            <>
              <div className="flex justify-between items-center">
                <p className="text-sm text-muted-foreground">
                  Gerencie os bancos que você utiliza nas parcerias
                </p>
                <Button onClick={() => setShowForm(true)} size="sm">
                  <Plus className="mr-2 h-4 w-4" />
                  Adicionar Banco
                </Button>
              </div>

              <div className="rounded-md border">
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
                                onClick={() => openEditForm(bank)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setDeleteTarget(bank)}
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
              </div>
            </>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <ValidatedInput
                id="nome"
                label="Nome do Banco"
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                onBlur={() => setTouched({ ...touched, nome: true })}
                placeholder="Ex: Banco do Brasil, Nubank, etc."
                required
                autoFocus
                error={errors.nome}
                touched={touched.nome}
                showSuccess
              />
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={!isFormValid}>
                  {editingBank ? 'Atualizar' : 'Criar'}
                </Button>
              </div>
            </form>
          )}
        </div>

        <ConfirmDeleteDialog
          open={!!deleteTarget}
          onOpenChange={(open) => !open && setDeleteTarget(null)}
          onConfirm={handleDelete}
          itemName={deleteTarget?.nome}
        />
      </DialogContent>
    </Dialog>
  );
}
