import { useState, useMemo, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useDebounce } from '@/hooks/useDebounce';
import { highlightText } from '@/lib/utils/highlightText';
import { cn, formatCurrency } from '@/lib/utils';
import { format, startOfMonth, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Plus, Search, CalendarIcon, X, Pencil, Trash2, FileText, StickyNote, Tag, Check, DollarSign } from 'lucide-react';
import { MobileFilters } from '@/components/MobileFilters';

interface NoteCategory {
  id: string;
  user_id: string;
  nome: string;
  cor: string;
  created_at: string;
  updated_at: string;
}

interface Note {
  id: string;
  user_id: string;
  titulo: string;
  conteudo: string | null;
  valor: number | null;
  data: string;
  category_id: string | null;
  created_at: string;
  updated_at: string;
  note_categories?: NoteCategory | null;
}

const CATEGORY_COLORS = [
  '#6366f1', // Indigo
  '#8b5cf6', // Violet
  '#a855f7', // Purple
  '#d946ef', // Fuchsia
  '#ec4899', // Pink
  '#f43f5e', // Rose
  '#ef4444', // Red
  '#f97316', // Orange
  '#f59e0b', // Amber
  '#eab308', // Yellow
  '#84cc16', // Lime
  '#22c55e', // Green
  '#14b8a6', // Teal
  '#06b6d4', // Cyan
  '#0ea5e9', // Sky
  '#3b82f6', // Blue
];

export default function Anotacoes() {
  const { user } = useAuth();
  const { toast } = useToast();

  // State
  const [notes, setNotes] = useState<Note[]>([]);
  const [categories, setCategories] = useState<NoteCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 300);

  // Date filter state
  const [startDate, setStartDate] = useState<Date | undefined>(startOfMonth(new Date()));
  const [endDate, setEndDate] = useState<Date | undefined>(new Date());
  const [dateDialogOpen, setDateDialogOpen] = useState(false);
  const [tempStartDate, setTempStartDate] = useState<Date | undefined>(startDate);
  const [tempEndDate, setTempEndDate] = useState<Date | undefined>(endDate);

  // Category filter state
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  // Form dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [formData, setFormData] = useState({
    titulo: '',
    conteudo: '',
    valor: '',
    data: format(new Date(), 'yyyy-MM-dd'),
    category_id: '',
  });

  // New category dialog state
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryColor, setNewCategoryColor] = useState(CATEGORY_COLORS[0]);

  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [noteToDelete, setNoteToDelete] = useState<Note | null>(null);

  // Manage categories dialog
  const [manageCategoriesOpen, setManageCategoriesOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<NoteCategory | null>(null);
  const [editCategoryName, setEditCategoryName] = useState('');
  const [editCategoryColor, setEditCategoryColor] = useState('');

  // Fetch categories
  const fetchCategories = async () => {
    if (!user?.id) return;

    try {
      const { data, error } = await supabase
        .from('note_categories')
        .select('*')
        .order('nome');

      if (error) {
        console.error('Error fetching categories:', error);
        return;
      }

      setCategories(data || []);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  // Fetch notes
  const fetchNotes = async () => {
    if (!user?.id) return;

    setLoading(true);
    try {
      let query = supabase
        .from('notes')
        .select('*, note_categories(*)')
        .eq('user_id', user.id)
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
    fetchCategories();
  }, [user?.id]);

  useEffect(() => {
    fetchNotes();
  }, [user?.id, startDate, endDate]);

  // Filtered notes
  const filteredNotes = useMemo(() => {
    let result = notes;

    // Filter by search term
    if (debouncedSearch.trim()) {
      const term = debouncedSearch.toLowerCase();
      result = result.filter(
        (note) =>
          note.titulo.toLowerCase().includes(term) ||
          (note.conteudo && note.conteudo.toLowerCase().includes(term))
      );
    }

    // Filter by category
    if (categoryFilter !== 'all') {
      if (categoryFilter === 'none') {
        result = result.filter((note) => !note.category_id);
      } else {
        result = result.filter((note) => note.category_id === categoryFilter);
      }
    }

    return result;
  }, [notes, debouncedSearch, categoryFilter]);

  const totalAdded = useMemo(
    () => filteredNotes.reduce((total, note) => total + Number(note.valor || 0), 0),
    [filteredNotes]
  );

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
      category_id: '__none__',
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
      category_id: note.category_id || '__none__',
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

    const categoryId = formData.category_id && formData.category_id !== '__none__' 
      ? formData.category_id 
      : null;

    const noteData = {
      titulo: formData.titulo.trim(),
      conteudo: formData.conteudo.trim() || null,
      valor: formData.valor ? parseFloat(formData.valor.replace(',', '.')) : null,
      data: formData.data,
      category_id: categoryId,
      user_id: user.id,
    };

    try {
      if (editingNote) {
        const { error } = await supabase
          .from('notes')
          .update(noteData)
          .eq('id', editingNote.id);

        if (error) throw error;

        // Refetch to get updated category data
        await fetchNotes();
        toast({ title: 'Anotação atualizada!' });
      } else {
        const { error } = await supabase
          .from('notes')
          .insert(noteData);

        if (error) throw error;

        await fetchNotes();
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

  // Category handlers
  const handleCreateCategory = async () => {
    if (!user?.id || !newCategoryName.trim()) {
      toast({
        title: 'Erro',
        description: 'O nome da categoria é obrigatório.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const { data, error } = await supabase
        .from('note_categories')
        .insert({
          nome: newCategoryName.trim(),
          cor: newCategoryColor,
          user_id: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      setCategories((prev) => [...prev, data].sort((a, b) => a.nome.localeCompare(b.nome)));
      setFormData({ ...formData, category_id: data.id });
      setCategoryDialogOpen(false);
      setNewCategoryName('');
      setNewCategoryColor(CATEGORY_COLORS[0]);
      toast({ title: 'Categoria criada!' });
    } catch (error) {
      console.error('Error creating category:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível criar a categoria.',
        variant: 'destructive',
      });
    }
  };

  const handleUpdateCategory = async () => {
    if (!editingCategory || !editCategoryName.trim()) return;

    try {
      const { error } = await supabase
        .from('note_categories')
        .update({
          nome: editCategoryName.trim(),
          cor: editCategoryColor,
        })
        .eq('id', editingCategory.id);

      if (error) throw error;

      setCategories((prev) =>
        prev.map((c) =>
          c.id === editingCategory.id
            ? { ...c, nome: editCategoryName.trim(), cor: editCategoryColor }
            : c
        )
      );
      await fetchNotes();
      setEditingCategory(null);
      toast({ title: 'Categoria atualizada!' });
    } catch (error) {
      console.error('Error updating category:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível atualizar a categoria.',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteCategory = async (categoryId: string) => {
    try {
      const { error } = await supabase.from('note_categories').delete().eq('id', categoryId);

      if (error) throw error;

      setCategories((prev) => prev.filter((c) => c.id !== categoryId));
      await fetchNotes();
      toast({ title: 'Categoria excluída!' });
    } catch (error) {
      console.error('Error deleting category:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível excluir a categoria.',
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

  const getCategoryById = (id: string | null) => {
    if (!id) return null;
    return categories.find((c) => c.id === id);
  };

  return (
    <Layout>
      <div className="mobile-section-page space-y-4 md:space-y-6">
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
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setManageCategoriesOpen(true)} className="gap-2">
              <Tag className="h-4 w-4" />
              Categorias
            </Button>
            <Button onClick={openCreateDialog} className="gap-2">
              <Plus className="h-4 w-4" />
              Nova Anotação
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card className="mobile-dashboard-card">
          <CardContent className="p-3 md:pt-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-4">
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

              <MobileFilters label="Filtros" className="mobile-standard-filters md:contents">
              <div className="mobile-standard-filter-panel flex flex-col gap-3 md:contents">
              {/* Category Filter */}
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas categorias</SelectItem>
                  <SelectItem value="none">Sem categoria</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{ backgroundColor: cat.cor }}
                        />
                        {cat.nome}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

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
              </MobileFilters>
            </div>
            <div className="mt-4 flex items-center justify-between gap-3 border-t pt-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <DollarSign className="h-4 w-4" />
                <span>Total adicionado</span>
              </div>
              <span className="text-base font-bold text-primary">
                R$ {formatCurrency(totalAdded)}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Notes List */}
        <Card className="mobile-dashboard-card">
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
                    className="mobile-note-row flex items-start gap-3 p-3 md:gap-4 md:p-4 hover:bg-muted/50 transition-colors group"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3 className="font-semibold truncate">
                          {debouncedSearch
                            ? highlightText(note.titulo, debouncedSearch)
                            : note.titulo}
                        </h3>
                        {note.note_categories && (
                          <Badge
                            variant="secondary"
                            className="text-xs shrink-0"
                            style={{
                              backgroundColor: `${note.note_categories.cor}20`,
                              color: note.note_categories.cor,
                              borderColor: note.note_categories.cor,
                            }}
                          >
                            {note.note_categories.nome}
                          </Badge>
                        )}
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
                    <div className="flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity shrink-0">
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

            {/* Category Selection */}
            <div>
              <Label htmlFor="category">Categoria</Label>
              <div className="flex gap-2">
                <Select
                  value={formData.category_id}
                  onValueChange={(value) => setFormData({ ...formData, category_id: value })}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Selecione uma categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Sem categoria</SelectItem>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full shrink-0"
                            style={{ backgroundColor: cat.cor }}
                          />
                          {cat.nome}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setCategoryDialogOpen(true)}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
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

      {/* New Category Dialog */}
      <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nova Categoria</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="categoryName">Nome da Categoria *</Label>
              <Input
                id="categoryName"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="Ex: Trabalho, Pessoal, Finanças..."
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateCategory();
                }}
              />
            </div>
            <div>
              <Label>Cor</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {CATEGORY_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={cn(
                      'w-8 h-8 rounded-full border-2 transition-all flex items-center justify-center',
                      newCategoryColor === color
                        ? 'border-foreground scale-110'
                        : 'border-transparent hover:scale-105'
                    )}
                    style={{ backgroundColor: color }}
                    onClick={() => setNewCategoryColor(color)}
                  >
                    {newCategoryColor === color && (
                      <Check className="h-4 w-4 text-white" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCategoryDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreateCategory}>
              Criar Categoria
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manage Categories Dialog */}
      <Dialog open={manageCategoriesOpen} onOpenChange={setManageCategoriesOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Gerenciar Categorias</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {categories.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">
                Nenhuma categoria criada ainda.
              </p>
            ) : (
              <div className="divide-y divide-border max-h-[300px] overflow-y-auto">
                {categories.map((category) => (
                  <div key={category.id} className="flex items-center gap-3 py-3">
                    {editingCategory?.id === category.id ? (
                      <>
                        <Input
                          value={editCategoryName}
                          onChange={(e) => setEditCategoryName(e.target.value)}
                          className="flex-1"
                          autoFocus
                        />
                        <Popover>
                          <PopoverTrigger asChild>
                            <button
                              className="w-8 h-8 rounded-full border-2 shrink-0"
                              style={{ backgroundColor: editCategoryColor }}
                            />
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-3">
                            <div className="flex flex-wrap gap-2 max-w-[200px]">
                              {CATEGORY_COLORS.map((color) => (
                                <button
                                  key={color}
                                  type="button"
                                  className={cn(
                                    'w-6 h-6 rounded-full border-2 transition-all',
                                    editCategoryColor === color
                                      ? 'border-foreground'
                                      : 'border-transparent'
                                  )}
                                  style={{ backgroundColor: color }}
                                  onClick={() => setEditCategoryColor(color)}
                                />
                              ))}
                            </div>
                          </PopoverContent>
                        </Popover>
                        <Button size="sm" onClick={handleUpdateCategory}>
                          Salvar
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setEditingCategory(null)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <div
                          className="w-4 h-4 rounded-full shrink-0"
                          style={{ backgroundColor: category.cor }}
                        />
                        <span className="flex-1">{category.nome}</span>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => {
                            setEditingCategory(category);
                            setEditCategoryName(category.nome);
                            setEditCategoryColor(category.cor);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => handleDeleteCategory(category.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}

            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={() => {
                setManageCategoriesOpen(false);
                setCategoryDialogOpen(true);
              }}
            >
              <Plus className="h-4 w-4" />
              Nova Categoria
            </Button>
          </div>
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
