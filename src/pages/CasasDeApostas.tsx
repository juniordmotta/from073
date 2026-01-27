import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { ConfirmDeleteDialog } from '@/components/ConfirmDeleteDialog';
import { 
  Search, 
  Plus, 
  Building2, 
  ChevronRight, 
  ExternalLink,
  Home,
  Edit3,
  Check,
  X,
  Trash2,
  Eye,
  EyeOff
} from 'lucide-react';
import { bettingHouseGroups, BettingHouse, BettingHouseGroup } from '@/data/bettingHousesData';
import { highlightText } from '@/lib/utils/highlightText';

interface Partnership {
  id: string;
  nome_completo: string;
  status: string;
}

interface HiddenHouse {
  id: string;
  house_id: string;
  house_name: string;
  group_id: string;
}

const CasasDeApostas = () => {
  const { user, userRole } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  
  const isAdmin = userRole?.role === 'admin' || userRole?.role === 'admin_master';
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedHouse, setSelectedHouse] = useState<BettingHouse | null>(null);
  const [selectedPartnershipId, setSelectedPartnershipId] = useState<string>('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [partnerships, setPartnerships] = useState<Partnership[]>([]);
  const [isLoadingPartnerships, setIsLoadingPartnerships] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  
  // Estados para edição de nome
  const [editingHouseId, setEditingHouseId] = useState<string | null>(null);
  const [editedName, setEditedName] = useState('');
  
  // Estados para casas ocultas
  const [hiddenHouses, setHiddenHouses] = useState<HiddenHouse[]>([]);
  const [showHidden, setShowHidden] = useState(false);
  const [houseToDelete, setHouseToDelete] = useState<{ house: BettingHouse; groupId: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Carregar casas ocultas ao montar
  useEffect(() => {
    if (isAdmin) {
      loadHiddenHouses();
    }
  }, [isAdmin]);

  const loadHiddenHouses = async () => {
    try {
      const { data, error } = await supabase
        .from('hidden_betting_houses')
        .select('id, house_id, house_name, group_id');
      
      if (error) throw error;
      setHiddenHouses(data || []);
    } catch (error) {
      console.error('Erro ao carregar casas ocultas:', error);
    }
  };

  const hiddenHouseIds = useMemo(() => {
    return new Set(hiddenHouses.map(h => h.house_id));
  }, [hiddenHouses]);

  // Filtrar grupos e casas baseado na busca e casas ocultas
  const filteredGroups = useMemo(() => {
    let groups = bettingHouseGroups;
    
    // Filtrar casas ocultas (a menos que showHidden esteja ativo)
    if (!showHidden && hiddenHouseIds.size > 0) {
      groups = groups.map(group => ({
        ...group,
        houses: group.houses.filter(house => !hiddenHouseIds.has(house.id))
      })).filter(group => group.houses.length > 0);
    }
    
    if (!searchTerm.trim()) {
      return groups;
    }
    
    const normalizedSearch = searchTerm.toLowerCase().trim();
    
    return groups
      .map(group => {
        const groupMatches = group.name.toLowerCase().includes(normalizedSearch);
        const matchingHouses = group.houses.filter(house => 
          house.name.toLowerCase().includes(normalizedSearch)
        );
        
        if (groupMatches) {
          return group;
        } else if (matchingHouses.length > 0) {
          return { ...group, houses: matchingHouses };
        }
        return null;
      })
      .filter((group): group is BettingHouseGroup => group !== null);
  }, [searchTerm, hiddenHouseIds, showHidden]);

  // Carregar parcerias do usuário
  const loadPartnerships = async () => {
    if (!user?.id) return;
    
    setIsLoadingPartnerships(true);
    try {
      const { data, error } = await supabase
        .from('partnerships')
        .select('id, nome_completo, status')
        .eq('status', 'ativo')
        .order('nome_completo');
      
      if (error) throw error;
      setPartnerships(data || []);
    } catch (error) {
      console.error('Erro ao carregar parcerias:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar as parcerias.',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingPartnerships(false);
    }
  };

  // Abrir dialog para adicionar casa à parceria
  const handleOpenAddDialog = (house: BettingHouse) => {
    setSelectedHouse(house);
    setSelectedPartnershipId('');
    setIsAddDialogOpen(true);
    loadPartnerships();
  };

  // Adicionar casa à parceria
  const handleAddToPartnership = async () => {
    if (!selectedHouse || !selectedPartnershipId) {
      toast({
        title: 'Erro',
        description: 'Selecione uma parceria.',
        variant: 'destructive',
      });
      return;
    }

    setIsAdding(true);
    try {
      // Verificar se a casa já existe na parceria
      const { data: existingHouse, error: checkError } = await supabase
        .from('partnership_houses')
        .select('id')
        .eq('partnership_id', selectedPartnershipId)
        .eq('house_name', selectedHouse.name)
        .maybeSingle();

      if (checkError) throw checkError;

      if (existingHouse) {
        toast({
          title: 'Casa já existe',
          description: 'Esta casa já está cadastrada nesta parceria.',
          variant: 'destructive',
        });
        return;
      }

      // Adicionar casa com status "aguardando_verificacao"
      const { error: insertError } = await supabase
        .from('partnership_houses')
        .insert({
          partnership_id: selectedPartnershipId,
          house_name: selectedHouse.name,
          status: 'aguardando_verificacao',
        });

      if (insertError) throw insertError;

      const partnershipName = partnerships.find(p => p.id === selectedPartnershipId)?.nome_completo;
      
      toast({
        title: 'Casa adicionada!',
        description: `${selectedHouse.name} foi adicionada à parceria "${partnershipName}" com status "Aguardando Verificação".`,
      });

      setIsAddDialogOpen(false);
      setSelectedHouse(null);
      setSelectedPartnershipId('');
    } catch (error: any) {
      console.error('Erro ao adicionar casa:', error);
      toast({
        title: 'Erro',
        description: error.message || 'Não foi possível adicionar a casa.',
        variant: 'destructive',
      });
    } finally {
      setIsAdding(false);
    }
  };

  // Iniciar edição de nome
  const handleStartEdit = (house: BettingHouse) => {
    setEditingHouseId(house.id);
    setEditedName(house.name);
  };

  // Cancelar edição
  const handleCancelEdit = () => {
    setEditingHouseId(null);
    setEditedName('');
  };

  // Salvar edição (apenas visual, não persiste)
  const handleSaveEdit = () => {
    // Como os dados são estáticos, apenas mostramos uma mensagem
    toast({
      title: 'Funcionalidade em desenvolvimento',
      description: 'A edição de nomes será salva no banco de dados em uma versão futura.',
    });
    setEditingHouseId(null);
    setEditedName('');
  };

  // Contar total de casas (visíveis)
  const totalHouses = useMemo(() => {
    return bettingHouseGroups.reduce((acc, group) => acc + group.houses.length, 0);
  }, []);

  const visibleHouses = useMemo(() => {
    return totalHouses - hiddenHouses.length;
  }, [totalHouses, hiddenHouses.length]);

  // Ocultar casa do catálogo
  const handleHideHouse = async () => {
    if (!houseToDelete || !user?.id) return;
    
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('hidden_betting_houses')
        .insert({
          house_id: houseToDelete.house.id,
          house_name: houseToDelete.house.name,
          group_id: houseToDelete.groupId,
          hidden_by: user.id,
        });

      if (error) throw error;

      setHiddenHouses(prev => [...prev, {
        id: crypto.randomUUID(),
        house_id: houseToDelete.house.id,
        house_name: houseToDelete.house.name,
        group_id: houseToDelete.groupId,
      }]);

      toast({
        title: 'Casa removida!',
        description: `${houseToDelete.house.name} foi removida do catálogo.`,
      });

      setHouseToDelete(null);
    } catch (error: any) {
      console.error('Erro ao ocultar casa:', error);
      toast({
        title: 'Erro',
        description: error.message || 'Não foi possível remover a casa.',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  // Restaurar casa ao catálogo
  const handleRestoreHouse = async (house: BettingHouse) => {
    if (!user?.id) return;
    
    try {
      const { error } = await supabase
        .from('hidden_betting_houses')
        .delete()
        .eq('house_id', house.id);

      if (error) throw error;

      setHiddenHouses(prev => prev.filter(h => h.house_id !== house.id));

      toast({
        title: 'Casa restaurada!',
        description: `${house.name} foi restaurada ao catálogo.`,
      });
    } catch (error: any) {
      console.error('Erro ao restaurar casa:', error);
      toast({
        title: 'Erro',
        description: error.message || 'Não foi possível restaurar a casa.',
        variant: 'destructive',
      });
    }
  };

  return (
    <Layout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Building2 className="h-7 w-7 text-primary" />
              Casas de Apostas
            </h1>
            <p className="text-muted-foreground">
              Gerencie as casas de apostas e adicione-as às suas parcerias
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            {isAdmin && hiddenHouses.length > 0 && (
              <Button
                variant={showHidden ? "default" : "outline"}
                size="sm"
                onClick={() => setShowHidden(!showHidden)}
                className="gap-2"
              >
                {showHidden ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                {showHidden ? 'Mostrando ocultas' : `${hiddenHouses.length} ocultas`}
              </Button>
            )}
            <Badge variant="secondary" className="text-sm">
              {bettingHouseGroups.length} grupos
            </Badge>
            <Badge variant="outline" className="text-sm">
              {visibleHouses} casas
            </Badge>
            {hiddenHouses.length > 0 && (
              <Badge variant="destructive" className="text-sm">
                {hiddenHouses.length} ocultas
              </Badge>
            )}
          </div>
        </div>

        {/* Search */}
        <Card>
          <CardContent className="pt-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar casa de apostas ou grupo..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        {/* Lista de Grupos */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Grupos de Casas</CardTitle>
            <CardDescription>
              Clique em um grupo para ver as casas disponíveis
            </CardDescription>
          </CardHeader>
          <CardContent>
            {filteredGroups.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhuma casa encontrada para "{searchTerm}"</p>
              </div>
            ) : (
              <Accordion type="multiple" className="w-full space-y-2">
                {filteredGroups.map((group) => (
                  <AccordionItem 
                    key={group.id} 
                    value={group.id}
                    className="border rounded-lg px-4 data-[state=open]:bg-muted/30"
                  >
                    <AccordionTrigger className="hover:no-underline py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <Home className="h-5 w-5 text-primary" />
                        </div>
                        <div className="text-left">
                          <div className="font-medium">
                            {searchTerm ? highlightText(group.name, searchTerm) : group.name}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {group.houses.length} {group.houses.length === 1 ? 'casa' : 'casas'}
                          </div>
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="pb-4">
                      <div className="space-y-2 mt-2">
                        {group.houses.map((house) => {
                          const isHidden = hiddenHouseIds.has(house.id);
                          return (
                          <div
                            key={house.id}
                            className={`flex items-center justify-between p-3 rounded-lg bg-background border hover:border-primary/50 transition-colors group ${isHidden ? 'opacity-50 border-destructive/50' : ''}`}
                          >
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center shrink-0">
                                <Building2 className="h-4 w-4 text-muted-foreground" />
                              </div>
                              
                              {editingHouseId === house.id ? (
                                <div className="flex items-center gap-2 flex-1">
                                  <Input
                                    value={editedName}
                                    onChange={(e) => setEditedName(e.target.value)}
                                    className="h-8"
                                    autoFocus
                                  />
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 shrink-0"
                                    onClick={handleSaveEdit}
                                  >
                                    <Check className="h-4 w-4 text-green-500" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 shrink-0"
                                    onClick={handleCancelEdit}
                                  >
                                    <X className="h-4 w-4 text-red-500" />
                                  </Button>
                                </div>
                              ) : (
                                <>
                                  <div className="flex-1 min-w-0">
                                    <div className="font-medium truncate flex items-center gap-2">
                                      {searchTerm ? highlightText(house.name, searchTerm) : house.name}
                                      {isHidden && (
                                        <Badge variant="destructive" className="text-xs">Oculta</Badge>
                                      )}
                                    </div>
                                    {house.url && (
                                      <a
                                        href={`https://${house.url}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1"
                                      >
                                        {house.url}
                                        <ExternalLink className="h-3 w-3" />
                                      </a>
                                    )}
                                  </div>
                                  
                                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    {isAdmin && isHidden ? (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-8 gap-1 text-green-600 hover:text-green-700 hover:bg-green-50"
                                        onClick={() => handleRestoreHouse(house)}
                                        title="Restaurar casa"
                                      >
                                        <Eye className="h-4 w-4" />
                                        Restaurar
                                      </Button>
                                    ) : (
                                      <>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-8 w-8"
                                          onClick={() => handleStartEdit(house)}
                                          title="Editar nome"
                                        >
                                          <Edit3 className="h-4 w-4" />
                                        </Button>
                                        <Button
                                          variant="default"
                                          size="icon"
                                          className="h-8 w-8"
                                          onClick={() => handleOpenAddDialog(house)}
                                          title="Adicionar à parceria"
                                        >
                                          <Plus className="h-4 w-4" />
                                        </Button>
                                        {isAdmin && (
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                            onClick={() => setHouseToDelete({ house, groupId: group.id })}
                                            title="Remover do catálogo"
                                          >
                                            <Trash2 className="h-4 w-4" />
                                          </Button>
                                        )}
                                      </>
                                    )}
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                          );
                        })}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            )}
          </CardContent>
        </Card>

        {/* Dialog para adicionar casa à parceria */}
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Adicionar Casa à Parceria</DialogTitle>
              <DialogDescription>
                Selecione a parceria onde deseja adicionar "{selectedHouse?.name}"
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Casa selecionada</Label>
                <div className="p-3 rounded-lg bg-muted flex items-center gap-3">
                  <Building2 className="h-5 w-5 text-primary" />
                  <span className="font-medium">{selectedHouse?.name}</span>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label>Parceria</Label>
                <Select
                  value={selectedPartnershipId}
                  onValueChange={setSelectedPartnershipId}
                  disabled={isLoadingPartnerships}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={
                      isLoadingPartnerships 
                        ? "Carregando parcerias..." 
                        : "Selecione uma parceria"
                    } />
                  </SelectTrigger>
                  <SelectContent>
                    {partnerships.length === 0 ? (
                      <div className="p-2 text-center text-muted-foreground text-sm">
                        Nenhuma parceria ativa encontrada
                      </div>
                    ) : (
                      partnerships.map((partnership) => (
                        <SelectItem key={partnership.id} value={partnership.id}>
                          {partnership.nome_completo}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                <p className="text-sm text-yellow-600 dark:text-yellow-400">
                  A casa será adicionada com o status <strong>"Aguardando Verificação"</strong>
                </p>
              </div>
            </div>
            
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                variant="outline"
                onClick={() => setIsAddDialogOpen(false)}
                disabled={isAdding}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleAddToPartnership}
                disabled={!selectedPartnershipId || isAdding}
              >
                {isAdding ? 'Adicionando...' : 'Adicionar'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog de confirmação para remover casa */}
        <ConfirmDeleteDialog
          open={!!houseToDelete}
          onOpenChange={(open) => !open && setHouseToDelete(null)}
          onConfirm={handleHideHouse}
          title="Remover Casa do Catálogo"
          description={`Tem certeza que deseja remover "${houseToDelete?.house.name}" do catálogo? A casa ficará oculta para todos os usuários. Esta ação pode ser revertida pelos administradores.`}
        />
      </div>
    </Layout>
  );
};

export default CasasDeApostas;
