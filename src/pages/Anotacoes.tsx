import { useState, useMemo, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useDebounce } from '@/hooks/useDebounce';
import { highlightText } from '@/lib/utils/highlightText';
import { cn, formatCurrency } from '@/lib/utils';
import { format, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Plus, Search, CalendarIcon, X, Pencil, Trash2, FileText, StickyNote } from 'lucide-react';

interface Note {
  id: string;
  user_id: string;
  titulo: string;
  conteudo: string | null;
  valor: number | null;
  data: string;
  created_at: string;
  updated_at: string;
}

export default function Anotacoes() {
  const { user } = useAuth();
  const { toast } = useToast();

  // State
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 300);

  // Date filter state
  const [startDate, setStartDate] = useState<Date | undefined>(startOfMonth(new Date()));
  const [endDate, setEndDate] = useState<Date | undefined>(new Date());
  const [dateDialogOpen, setDateDialogOpen] = useState(false);
  const [tempStartDate, setTempStartDate] = useState<Date | undefined>(startDate);
  const [tempEndDate, setTempEndDate] = useState<Date | undefined>(endDate);

  // Form dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [formData, setFormData] = useState({
    titulo: '',
    conteudo: '',
    valor: '',
    data: format(new Date(), 'yyyy-MM-dd'),
  });

  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [noteToDelete, setNoteToDelete] = useState<Note | null>(null);

  // Fetch notes
  const fetchNotes = async () => {
    if (!user?.id) return;

    setLoading(true);
    try {
      let query = supabase
        .from('notes')
        .select('*')
        .order('data', { ascending: false });

      if (startDate) {
        query = query.gte('data', format(startDate, 'yyyy-MM-dd'));
      }
      if (endDate) {
        query = query.lte('data', format(endDate, 'yyyy-MM-dd'));
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching notes:', error);
        return;
      }

      setNotes(data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotes();
  }, [user?.id, startDate, endDate]);

  // Filtered notes
  const filteredNotes = useMemo(() => {
    if (!debouncedSearch.trim()) return notes;

    const term = debouncedSearch.toLowerCase();
    return notes.filter(
      (note) =>
        note.titulo.toLowerCase().includes(term) ||
        (note.conteudo && note.conteudo.toLowerCase().includes(term))
    );
  }, [notes, debouncedSearch]);

  // Date filter handlers
  const handleApplyDateFilter = () => {
    setStartDate(tempStartDate);
    setEndDate(tempEndDate);
    setDateDialogOpen(false);
  };

  const handleClearDateFilter = () => {
    setStartDate(undefined);
    setEndDate(undefined);
    setTempStartDate(undefined);
    setTempEndDate(undefined);
  };

  const handleQuickFilter = (days: number | 'month') => {
    const today = new Date();
    if (days === 'month') {
      setStartDate(startOfMonth(today));
      setEndDate(today);
    } else if (days === 0) {
      setStartDate(today);
      setEndDate(today);
    } else {
      const start = new Date();
      start.setDate(today.getDate() - days);
      setStartDate(start);
      setEndDate(today);
    }
  };

  // Form handlers
  const openCreateDialog = () => {
    setEditingNote(null);
    setFormData({
      titulo: '',
      conteudo: '',
      valor: '',
      data: format(new Date(), 'yyyy-MM-dd'),
    });
    setDialogOpen(true);
  };

  const openEditDialog = (note: Note) => {
    setEditingNote(note);
    setFormData({
      titulo: note.titulo,
      conteudo: note.conteudo || '',
      valor: note.valor ? note.valor.toString() : '',
      data: note.data,
    });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!user?.id || !formData.titulo.trim()) {
      toast({
        title: 'Erro',
        description: 'O título é obrigatório.',
        variant: 'destructive',
      });
      return;
    }

    const noteData = {
      titulo: formData.titulo.trim(),
      conteudo: formData.conteudo.trim() || null,
      valor: formData.valor ? parseFloat(formData.valor.replace(',', '.')) : null,
      data: formData.data,
      user_id: user.id,
    };

    try {
      if (editingNote) {
        const { error } = await supabase
          .from('notes')
          .update(noteData)
          .eq('id', editingNote.id);

        if (error) throw error;

        setNotes((prev) =>
          prev.map((n) => (n.id === editingNote.id ? { ...n, ...noteData } : n))
        );

        toast({ title: 'Anotação atualizada!' });
      } else {
        const { data, error } = await supabase
          .from('notes')
          .insert(noteData)
          .select()
          .single();

        if (error) throw error;

        setNotes((prev) => [data, ...prev]);
        toast({ title: 'Anotação criada!' });
      }

      setDialogOpen(false);
    } catch (error) {
      console.error('Error saving note:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível salvar a anotação.',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async () => {
    if (!noteToDelete) return;

    try {
      const { error } = await supabase.from('notes').delete().eq('id', noteToDelete.id);

      if (error) throw error;

      setNotes((prev) => prev.filter((n) => n.id !== noteToDelete.id));
      setDeleteDialogOpen(false);
      setNoteToDelete(null);
      toast({ title: 'Anotação excluída!' });
    } catch (error) {
      console.error('Error deleting note:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível excluir a anotação.',
        variant: 'destructive',
      });
    }
  };

  const formatDateDisplay = () => {
    if (!startDate && !endDate) return 'Selecionar Data';
    if (startDate && endDate) {
      return `${format(startDate, 'dd/MM/yy')} - ${format(endDate, 'dd/MM/yy')}`;
    }
    if (startDate) return `A partir de ${format(startDate, 'dd/MM/yy')}`;
    return `Até ${format(endDate!, 'dd/MM/yy')}`;
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <StickyNote className="h-8 w-8 text-primary" />
              Anotações
            </h1>
            <p className="text-muted-foreground">
              Registre valores, nomes e informações importantes
            </p>
          </div>
          <Button onClick={openCreateDialog} className="gap-2">
            <Plus className="h-4 w-4" />
            Nova Anotação
          </Button>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center">
              {/* Search */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar por título ou conteúdo..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Date Filter */}
              <div className="flex items-center gap-2 flex-wrap">
                <Popover open={dateDialogOpen} onOpenChange={setDateDialogOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="gap-2 min-w-[180px]">
                      <CalendarIcon className="h-4 w-4" />
                      {formatDateDisplay()}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-4" align="end">
                    <div className="space-y-4">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                          <Label className="text-xs">Data Início</Label>
                          <Calendar
                            mode="single"
                            selected={tempStartDate}
                            onSelect={setTempStartDate}
                            locale={ptBR}
                            className="rounded-md border pointer-events-auto"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Data Fim</Label>
                          <Calendar
                            mode="single"
                            selected={tempEndDate}
                            onSelect={setTempEndDate}
                            locale={ptBR}
                            className="rounded-md border pointer-events-auto"
                          />
                        </div>
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => setDateDialogOpen(false)}>
                          Cancelar
                        </Button>
                        <Button size="sm" onClick={handleApplyDateFilter}>
                          Aplicar
                        </Button>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>

                {(startDate || endDate) && (
                  <Button variant="ghost" size="icon" onClick={handleClearDateFilter}>
                    <X className="h-4 w-4" />
                  </Button>
                )}

                {/* Quick filters */}
                <div className="hidden md:flex items-center gap-1">
                  <Button variant="ghost" size="sm" onClick={() => handleQuickFilter(0)}>
                    Hoje
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleQuickFilter(7)}>
                    7 dias
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleQuickFilter(30)}>
                    30 dias
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleQuickFilter('month')}>
                    Mês Atual
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Notes List */}
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="py-10 text-center text-muted-foreground">
                Carregando anotações...
              </div>
            ) : filteredNotes.length === 0 ? (
              <div className="py-10 text-center text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhuma anotação encontrada</p>
                <Button variant="link" onClick={openCreateDialog}>
                  Criar primeira anotação
                </Button>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {filteredNotes.map((note) => (
                  <div
                    key={note.id}
                    className="flex items-start gap-4 p-4 hover:bg-muted/50 transition-colors group"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold truncate">
                          {debouncedSearch
                            ? highlightText(note.titulo, debouncedSearch)
                            : note.titulo}
                        </h3>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {format(parseISO(note.data), 'dd/MM/yyyy')}
                        </span>
                      </div>
                      {note.conteudo && (
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {debouncedSearch
                            ? highlightText(note.conteudo, debouncedSearch)
                            : note.conteudo}
                        </p>
                      )}
                    </div>
                    {note.valor !== null && (
                      <div className="text-right shrink-0">
                        <span className="font-semibold text-primary">
                          {formatCurrency(note.valor)}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => openEditDialog(note)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => {
                          setNoteToDelete(note);
                          setDeleteDialogOpen(true);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingNote ? 'Editar Anotação' : 'Nova Anotação'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="titulo">Título *</Label>
              <Input
                id="titulo"
                value={formData.titulo}
                onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
                placeholder="Digite o título..."
                autoFocus
              />
            </div>
            <div>
              <Label htmlFor="conteudo">Conteúdo</Label>
              <Textarea
                id="conteudo"
                value={formData.conteudo}
                onChange={(e) => setFormData({ ...formData, conteudo: e.target.value })}
                placeholder="Digite o conteúdo da anotação..."
                rows={4}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="valor">Valor (R$)</Label>
                <Input
                  id="valor"
                  value={formData.valor}
                  onChange={(e) => setFormData({ ...formData, valor: e.target.value })}
                  placeholder="0,00"
                />
              </div>
              <div>
                <Label htmlFor="data">Data</Label>
                <Input
                  id="data"
                  type="date"
                  value={formData.data}
                  onChange={(e) => setFormData({ ...formData, data: e.target.value })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit}>
              {editingNote ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Exclusão</DialogTitle>
          </DialogHeader>
          <p>
            Tem certeza que deseja excluir a anotação{' '}
            <strong>"{noteToDelete?.titulo}"</strong>?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
