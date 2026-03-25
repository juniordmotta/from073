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
  ExternalLink,
  Home,
  Edit3,
  Trash2,
  Eye,
  EyeOff,
  PlusCircle,
  FolderPlus,
  Pencil,
  Folder,
  MoveRight,
  CheckCircle2,
  StickyNote,
  AlertTriangle
} from 'lucide-react';
import { bettingHouseGroups, BettingHouse, BettingHouseGroup } from '@/data/bettingHousesData';
import { highlightText } from '@/lib/utils/highlightText';

// Função para normalizar nome de casa para comparação
const normalizeHouseName = (name: string): string => {
  return name
    .toLowerCase()
    .replace(/\s*\(br\)\s*/gi, '')
    .replace(/\s+br\s*$/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
};

// Cores fixas para parcerias
const PARTNERSHIP_COLORS = [
  'bg-blue-500', 'bg-emerald-500', 'bg-amber-500', 'bg-purple-500', 
  'bg-pink-500', 'bg-cyan-500', 'bg-orange-500', 'bg-indigo-500',
];

interface Partnership {
  id: string;
  nome_completo: string;
  status: string;
}

interface PartnershipHouse {
  house_name: string;
  partnership_id: string;
  partnership_name: string;
}

interface HiddenHouse {
  id: string;
  house_id: string;
  house_name: string;
  group_id: string;
}

interface CustomHouse {
  id: string;
  original_house_id: string | null;
  group_id: string;
  name: string;
  url: string | null;
  annotation: string | null;
  annotation_color: string | null;
}

interface HouseAnnotation {
  id: string;
  house_id: string;
  annotation: string;
  annotation_color: string;
}

interface CustomGroup {
  id: string;
  nome: string;
  created_by: string;
  created_at: string;
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
  
  // Estados para edição de casa
  const [editingHouse, setEditingHouse] = useState<{ house: BettingHouse; groupId: string } | null>(null);
  const [editedName, setEditedName] = useState('');
  const [editedUrl, setEditedUrl] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  
  // Estados para adicionar nova casa
  const [isAddHouseDialogOpen, setIsAddHouseDialogOpen] = useState(false);
  const [addHouseGroupId, setAddHouseGroupId] = useState<string>('');
  const [newHouseName, setNewHouseName] = useState('');
  const [newHouseUrl, setNewHouseUrl] = useState('');
  const [isAddingHouse, setIsAddingHouse] = useState(false);
  
  // Estados para casas ocultas e customizadas
  const [hiddenHouses, setHiddenHouses] = useState<HiddenHouse[]>([]);
  const [customHouses, setCustomHouses] = useState<CustomHouse[]>([]);
  const [showHidden, setShowHidden] = useState(false);
  const [houseToDelete, setHouseToDelete] = useState<{ house: BettingHouse; groupId: string } | null>(null);

  // Estados para grupos customizados
  const [customGroups, setCustomGroups] = useState<CustomGroup[]>([]);
  const [isAddGroupDialogOpen, setIsAddGroupDialogOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [isAddingGroup, setIsAddingGroup] = useState(false);
  const [groupToDelete, setGroupToDelete] = useState<CustomGroup | null>(null);
  const [editingGroup, setEditingGroup] = useState<CustomGroup | null>(null);
  const [editedGroupName, setEditedGroupName] = useState('');
  const [isSavingGroup, setIsSavingGroup] = useState(false);

  // Estados para mover casa
  const [movingHouse, setMovingHouse] = useState<{ house: BettingHouse; currentGroupId: string } | null>(null);
  const [targetGroupId, setTargetGroupId] = useState<string>('');
  const [isMovingHouse, setIsMovingHouse] = useState(false);

  // Estados para anotações de casas estáticas
  const [houseAnnotations, setHouseAnnotations] = useState<HouseAnnotation[]>([]);
  
  // Estados para anotação nos dialogs
  const [editedAnnotation, setEditedAnnotation] = useState('');
  const [editedAnnotationColor, setEditedAnnotationColor] = useState('#6366f1');
  const [newHouseAnnotation, setNewHouseAnnotation] = useState('');
  const [newHouseAnnotationColor, setNewHouseAnnotationColor] = useState('#6366f1');
  
  // Estado para aviso de casa duplicada ao adicionar ao grupo
  const [duplicateHouseWarning, setDuplicateHouseWarning] = useState('');

  // Estado para casas já cadastradas em parcerias ativas
  const [partnershipHouses, setPartnershipHouses] = useState<PartnershipHouse[]>([]);

  // Carregar dados ao montar
  useEffect(() => {
    loadCustomHouses();
    loadCustomGroups();
    loadPartnershipHouses();
    loadHouseAnnotations();
    loadHiddenHouses();
  }, [user?.id]);

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

  const loadCustomHouses = async () => {
    try {
      const { data, error } = await supabase
        .from('custom_betting_houses')
        .select('id, original_house_id, group_id, name, url, annotation, annotation_color');
      
      if (error) throw error;
      setCustomHouses(data || []);
    } catch (error) {
      console.error('Erro ao carregar casas customizadas:', error);
    }
  };

  const loadCustomGroups = async () => {
    try {
      const { data, error } = await supabase
        .from('custom_betting_groups')
        .select('*')
        .order('nome');
      
      if (error) throw error;
      setCustomGroups(data || []);
    } catch (error) {
      console.error('Erro ao carregar grupos customizados:', error);
    }
  };

  const loadHouseAnnotations = async () => {
    try {
      const { data, error } = await supabase
        .from('house_annotations')
        .select('id, house_id, annotation, annotation_color');
      
      if (error) throw error;
      setHouseAnnotations(data || []);
    } catch (error) {
      console.error('Erro ao carregar anotações:', error);
    }
  };

  // Carregar casas das parcerias ativas do usuário logado
  const loadPartnershipHouses = async () => {
    if (!user?.id) return;
    
    try {
      // Primeiro, buscar parcerias ativas do usuário
      const { data: activePartnerships, error: pError } = await supabase
        .from('partnerships')
        .select('id, nome_completo')
        .eq('user_id', user.id)
        .eq('status', 'ativo');
      
      if (pError) throw pError;
      
      if (!activePartnerships || activePartnerships.length === 0) {
        setPartnershipHouses([]);
        return;
      }
      
      // Buscar casas dessas parcerias
      const partnershipIds = activePartnerships.map(p => p.id);
      const { data: houses, error: hError } = await supabase
        .from('partnership_houses')
        .select('house_name, partnership_id')
        .in('partnership_id', partnershipIds);
      
      if (hError) throw hError;
      
      // Mapear para incluir nome da parceria
      const partnershipMap = new Map(activePartnerships.map(p => [p.id, p.nome_completo]));
      const mappedHouses: PartnershipHouse[] = (houses || []).map(h => ({
        house_name: h.house_name,
        partnership_id: h.partnership_id,
        partnership_name: partnershipMap.get(h.partnership_id) || '',
      }));
      
      setPartnershipHouses(mappedHouses);
    } catch (error) {
      console.error('Erro ao carregar casas das parcerias:', error);
    }
  };

  const hiddenHouseIds = useMemo(() => {
    return new Set(hiddenHouses.map(h => h.house_id));
  }, [hiddenHouses]);

  // Mapa de edições (original_house_id -> customização)
  const editedHousesMap = useMemo(() => {
    const map = new Map<string, CustomHouse>();
    customHouses.filter(h => h.original_house_id).forEach(h => {
      map.set(h.original_house_id!, h);
    });
    return map;
  }, [customHouses]);

  // Casas novas por grupo
  const newHousesByGroup = useMemo(() => {
    const map = new Map<string, CustomHouse[]>();
    customHouses.filter(h => !h.original_house_id).forEach(h => {
      const existing = map.get(h.group_id) || [];
      existing.push(h);
      map.set(h.group_id, existing);
    });
    return map;
  }, [customHouses]);

  // Mapa de parcerias -> cor
  const partnershipColorMap = useMemo(() => {
    const map = new Map<string, string>();
    const uniquePartnershipNames = [...new Set(partnershipHouses.map(ph => ph.partnership_name))];
    uniquePartnershipNames.forEach((name, i) => {
      map.set(name, PARTNERSHIP_COLORS[i % PARTNERSHIP_COLORS.length]);
    });
    return map;
  }, [partnershipHouses]);

  // Mapa de casas por nome -> parcerias que usam (com normalização)
  const housePartnershipsMap = useMemo(() => {
    const map = new Map<string, string[]>();
    partnershipHouses.forEach(ph => {
      const normalizedName = normalizeHouseName(ph.house_name);
      const existing = map.get(normalizedName) || [];
      if (!existing.includes(ph.partnership_name)) {
        existing.push(ph.partnership_name);
      }
      map.set(normalizedName, existing);
    });
    return map;
  }, [partnershipHouses]);

  // Função para contar casas em uso por grupo
  const getGroupUsageCount = (group: BettingHouseGroup): number => {
    return group.houses.filter(house => 
      housePartnershipsMap.has(normalizeHouseName(house.name))
    ).length;
  };

  // Aplicar edições às casas
  const getDisplayHouse = (house: BettingHouse): BettingHouse => {
    const edited = editedHousesMap.get(house.id);
    if (edited) {
      return {
        ...house,
        name: edited.name,
        url: edited.url || house.url,
      };
    }
    return house;
  };

  // Filtrar grupos e casas
  const filteredGroups = useMemo(() => {
    // Começar com grupos originais
    let groups: BettingHouseGroup[] = bettingHouseGroups.map(group => {
      // Aplicar edições às casas existentes
      let houses = group.houses.map(getDisplayHouse);
      
      // Adicionar casas novas do grupo
      const newHouses = newHousesByGroup.get(group.id) || [];
      const newBettingHouses: BettingHouse[] = newHouses.map(h => ({
        id: h.id,
        name: h.name,
        url: h.url || undefined,
      }));
      
      houses = [...houses, ...newBettingHouses];
      
      return { ...group, houses };
    });
    
    // Adicionar grupos customizados
    customGroups.forEach(customGroup => {
      const housesForGroup = newHousesByGroup.get(customGroup.id) || [];
      const bettingHouses: BettingHouse[] = housesForGroup.map(h => ({
        id: h.id,
        name: h.name,
        url: h.url || undefined,
      }));
      
      groups.push({
        id: customGroup.id,
        name: customGroup.nome,
        houses: bettingHouses,
      });
    });
    
    // Filtrar casas ocultas
    if (!showHidden && hiddenHouseIds.size > 0) {
      groups = groups.map(group => ({
        ...group,
        houses: group.houses.filter(house => !hiddenHouseIds.has(house.id))
      })).filter(group => group.houses.length > 0 || customGroups.some(g => g.id === group.id));
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
  }, [searchTerm, hiddenHouseIds, showHidden, editedHousesMap, newHousesByGroup, customGroups]);

  // Carregar apenas parcerias ativas do usuário logado
  const loadPartnerships = async () => {
    if (!user?.id) return;
    
    setIsLoadingPartnerships(true);
    try {
      const { data, error } = await supabase
        .from('partnerships')
        .select('id, nome_completo, status')
        .eq('user_id', user.id)
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

  const handleOpenAddDialog = async (house: BettingHouse) => {
    setSelectedHouse(house);
    setSelectedPartnershipId('');
    
    // Carregar parcerias primeiro
    await loadPartnerships();
  };

  // Efeito para verificar se há apenas 1 parceria após carregamento
  useEffect(() => {
    if (selectedHouse && partnerships.length === 1 && !isLoadingPartnerships) {
      // Só tem 1 parceria, adicionar direto
      handleAddToPartnershipDirect(selectedHouse, partnerships[0].id);
    } else if (selectedHouse && partnerships.length > 1 && !isLoadingPartnerships) {
      // Múltiplas parcerias, abrir dialog
      setIsAddDialogOpen(true);
    }
  }, [partnerships, selectedHouse, isLoadingPartnerships]);

  const handleAddToPartnershipDirect = async (house: BettingHouse, partnershipId: string) => {
    setIsAdding(true);
    try {
      const { data: existingHouse, error: checkError } = await supabase
        .from('partnership_houses')
        .select('id')
        .eq('partnership_id', partnershipId)
        .eq('house_name', house.name)
        .maybeSingle();

      if (checkError) throw checkError;

      if (existingHouse) {
        toast({
          title: 'Casa já existe',
          description: 'Esta casa já está cadastrada nesta parceria.',
          variant: 'destructive',
        });
        setSelectedHouse(null);
        return;
      }

      const { error: insertError } = await supabase
        .from('partnership_houses')
        .insert({
          partnership_id: partnershipId,
          house_name: house.name,
          status: 'aguardando_verificacao',
        });

      if (insertError) throw insertError;

      const partnershipName = partnerships.find(p => p.id === partnershipId)?.nome_completo;
      
      toast({
        title: 'Casa adicionada!',
        description: `${house.name} foi adicionada à parceria "${partnershipName}".`,
      });

      // Atualização instantânea das casas em uso
      loadPartnershipHouses();
      
      setSelectedHouse(null);
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

  const handleAddToPartnership = async () => {
    if (!selectedHouse || !selectedPartnershipId) {
      toast({
        title: 'Erro',
        description: 'Selecione uma parceria.',
        variant: 'destructive',
      });
      return;
    }

    await handleAddToPartnershipDirect(selectedHouse, selectedPartnershipId);
    setIsAddDialogOpen(false);
    setSelectedPartnershipId('');
  };

  // Abrir dialog de edição
  const handleStartEdit = (house: BettingHouse, groupId: string) => {
    setEditingHouse({ house, groupId });
    setEditedName(house.name);
    setEditedUrl(house.url || '');
    // Load annotation
    const customHouse = customHouses.find(h => h.id === house.id || h.original_house_id === house.id);
    const staticAnnotation = houseAnnotations.find(a => a.house_id === house.id);
    setEditedAnnotation(customHouse?.annotation || staticAnnotation?.annotation || '');
    setEditedAnnotationColor(customHouse?.annotation_color || staticAnnotation?.annotation_color || '#6366f1');
  };

  // Salvar edição
  const handleSaveEdit = async () => {
    if (!editingHouse || !user?.id || !editedName.trim()) return;
    
    setIsSavingEdit(true);
    try {
      // Check if the house itself IS a custom house (added as new)
      const isDirectCustomHouse = customHouses.some(h => h.id === editingHouse.house.id);
      // Check if there's an existing edit override (via original_house_id)
      const existingEdit = editedHousesMap.get(editingHouse.house.id);
      
      if (isDirectCustomHouse) {
        // House is already a custom house entry - update it directly
        const { error } = await supabase
          .from('custom_betting_houses')
          .update({
            name: editedName.trim(),
            url: editedUrl.trim() || null,
            annotation: editedAnnotation.trim() || null,
            annotation_color: editedAnnotationColor,
          })
          .eq('id', editingHouse.house.id);
        
        if (error) throw error;
        
        setCustomHouses(prev => prev.map(h => 
          h.id === editingHouse.house.id 
            ? { ...h, name: editedName.trim(), url: editedUrl.trim() || null, annotation: editedAnnotation.trim() || null, annotation_color: editedAnnotationColor }
            : h
        ));
      } else if (existingEdit) {
        // Atualizar edição existente (override de casa estática)
        const { error } = await supabase
          .from('custom_betting_houses')
          .update({
            name: editedName.trim(),
            url: editedUrl.trim() || null,
            annotation: editedAnnotation.trim() || null,
            annotation_color: editedAnnotationColor,
          })
          .eq('id', existingEdit.id);
        
        if (error) throw error;
        
        setCustomHouses(prev => prev.map(h => 
          h.id === existingEdit.id 
            ? { ...h, name: editedName.trim(), url: editedUrl.trim() || null, annotation: editedAnnotation.trim() || null, annotation_color: editedAnnotationColor }
            : h
        ));
      } else {
        // Criar nova edição para casa estática
        const { data, error } = await supabase
          .from('custom_betting_houses')
          .insert({
            original_house_id: editingHouse.house.id,
            group_id: editingHouse.groupId,
            name: editedName.trim(),
            url: editedUrl.trim() || null,
            annotation: editedAnnotation.trim() || null,
            annotation_color: editedAnnotationColor,
            created_by: user.id,
          })
          .select()
          .single();
        
        if (error) throw error;
        
        setCustomHouses(prev => [...prev, data]);
      }

      // Also save annotation for static houses via house_annotations table (only if not custom and no override)
      const isStaticHouse = !isDirectCustomHouse && !existingEdit;
      if (isStaticHouse && editedAnnotation.trim()) {
        await supabase
          .from('house_annotations')
          .upsert({
            house_id: editingHouse.house.id,
            annotation: editedAnnotation.trim(),
            annotation_color: editedAnnotationColor,
            created_by: user.id,
          }, { onConflict: 'house_id' });
        loadHouseAnnotations();
      } else if (isStaticHouse && !editedAnnotation.trim()) {
        await supabase
          .from('house_annotations')
          .delete()
          .eq('house_id', editingHouse.house.id);
        loadHouseAnnotations();
      }
      
      toast({
        title: 'Casa atualizada!',
        description: `Os dados de ${editedName} foram salvos.`,
      });
      
      setEditingHouse(null);
      setEditedName('');
      setEditedUrl('');
    } catch (error: any) {
      console.error('Erro ao salvar edição:', error);
      toast({
        title: 'Erro',
        description: error.message || 'Não foi possível salvar as alterações.',
        variant: 'destructive',
      });
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Verificar se casa já existe em algum grupo
  const checkHouseExistsInCatalog = (name: string): string | null => {
    const normalized = normalizeHouseName(name);
    // Check static houses
    for (const group of bettingHouseGroups) {
      for (const house of group.houses) {
        if (normalizeHouseName(house.name) === normalized && !hiddenHouseIds.has(house.id)) {
          return group.name;
        }
      }
    }
    // Check custom houses
    for (const custom of customHouses) {
      if (normalizeHouseName(custom.name) === normalized) {
        const groupStatic = bettingHouseGroups.find(g => g.id === custom.group_id);
        const groupCustom = customGroups.find(g => g.id === custom.group_id);
        return groupStatic?.name || groupCustom?.nome || 'Outro grupo';
      }
    }
    return null;
  };

  // Adicionar nova casa ao grupo
  const handleAddNewHouse = async () => {
    if (!user?.id || !newHouseName.trim() || !addHouseGroupId) return;
    
    // Check for duplicates
    const existingGroup = checkHouseExistsInCatalog(newHouseName.trim());
    if (existingGroup) {
      setDuplicateHouseWarning(`Casa já existente no grupo "${existingGroup}". Se quiser, poderá movê-la para este grupo.`);
      return;
    }
    
    setIsAddingHouse(true);
    try {
      const { data, error } = await supabase
        .from('custom_betting_houses')
        .insert({
          group_id: addHouseGroupId,
          name: newHouseName.trim(),
          url: newHouseUrl.trim() || null,
          annotation: newHouseAnnotation.trim() || null,
          annotation_color: newHouseAnnotationColor,
          created_by: user.id,
        })
        .select()
        .single();
      
      if (error) throw error;
      
      setCustomHouses(prev => [...prev, data]);
      
      toast({
        title: 'Casa adicionada!',
        description: `${newHouseName} foi adicionada ao catálogo.`,
      });
      
      setIsAddHouseDialogOpen(false);
      setNewHouseName('');
      setNewHouseUrl('');
      setNewHouseAnnotation('');
      setNewHouseAnnotationColor('#6366f1');
      setAddHouseGroupId('');
      setDuplicateHouseWarning('');
    } catch (error: any) {
      console.error('Erro ao adicionar casa:', error);
      toast({
        title: 'Erro',
        description: error.message || 'Não foi possível adicionar a casa.',
        variant: 'destructive',
      });
    } finally {
      setIsAddingHouse(false);
    }
  };

  // Ocultar casa
  const handleHideHouse = async () => {
    if (!houseToDelete || !user?.id) return;
    
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
    }
  };

  // Restaurar casa
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

  const totalHouses = useMemo(() => {
    const baseCount = bettingHouseGroups.reduce((acc, group) => acc + group.houses.length, 0);
    const customCount = customHouses.filter(h => !h.original_house_id).length;
    return baseCount + customCount;
  }, [customHouses]);

  const visibleHouses = useMemo(() => {
    return totalHouses - hiddenHouses.length;
  }, [totalHouses, hiddenHouses.length]);

  const totalGroups = useMemo(() => {
    return bettingHouseGroups.length + customGroups.length;
  }, [customGroups]);

  // Funções para gerenciar grupos
  const handleAddGroup = async () => {
    if (!user?.id || !newGroupName.trim()) return;
    
    setIsAddingGroup(true);
    try {
      const { data, error } = await supabase
        .from('custom_betting_groups')
        .insert({
          nome: newGroupName.trim(),
          created_by: user.id,
        })
        .select()
        .single();
      
      if (error) throw error;
      
      setCustomGroups(prev => [...prev, data].sort((a, b) => a.nome.localeCompare(b.nome)));
      
      toast({
        title: 'Grupo criado!',
        description: `O grupo "${newGroupName}" foi adicionado.`,
      });
      
      setIsAddGroupDialogOpen(false);
      setNewGroupName('');
    } catch (error: any) {
      console.error('Erro ao criar grupo:', error);
      toast({
        title: 'Erro',
        description: error.message || 'Não foi possível criar o grupo.',
        variant: 'destructive',
      });
    } finally {
      setIsAddingGroup(false);
    }
  };

  const handleUpdateGroup = async () => {
    if (!editingGroup || !editedGroupName.trim()) return;
    
    setIsSavingGroup(true);
    try {
      const { error } = await supabase
        .from('custom_betting_groups')
        .update({ nome: editedGroupName.trim() })
        .eq('id', editingGroup.id);
      
      if (error) throw error;
      
      setCustomGroups(prev =>
        prev.map(g =>
          g.id === editingGroup.id ? { ...g, nome: editedGroupName.trim() } : g
        ).sort((a, b) => a.nome.localeCompare(b.nome))
      );
      
      toast({
        title: 'Grupo atualizado!',
        description: `O grupo foi renomeado para "${editedGroupName}".`,
      });
      
      setEditingGroup(null);
      setEditedGroupName('');
    } catch (error: any) {
      console.error('Erro ao atualizar grupo:', error);
      toast({
        title: 'Erro',
        description: error.message || 'Não foi possível atualizar o grupo.',
        variant: 'destructive',
      });
    } finally {
      setIsSavingGroup(false);
    }
  };

  const handleDeleteGroup = async () => {
    if (!groupToDelete) return;
    
    try {
      // Primeiro deletar todas as casas do grupo
      const { error: housesError } = await supabase
        .from('custom_betting_houses')
        .delete()
        .eq('group_id', groupToDelete.id);
      
      if (housesError) throw housesError;
      
      // Depois deletar o grupo
      const { error: groupError } = await supabase
        .from('custom_betting_groups')
        .delete()
        .eq('id', groupToDelete.id);
      
      if (groupError) throw groupError;
      
      setCustomGroups(prev => prev.filter(g => g.id !== groupToDelete.id));
      setCustomHouses(prev => prev.filter(h => h.group_id !== groupToDelete.id));
      
      toast({
        title: 'Grupo excluído!',
        description: `O grupo "${groupToDelete.nome}" foi removido.`,
      });
      
      setGroupToDelete(null);
    } catch (error: any) {
      console.error('Erro ao excluir grupo:', error);
      toast({
        title: 'Erro',
        description: error.message || 'Não foi possível excluir o grupo.',
        variant: 'destructive',
      });
    }
  };

  const isCustomGroup = (groupId: string) => {
    return customGroups.some(g => g.id === groupId);
  };

  const getCustomGroup = (groupId: string) => {
    return customGroups.find(g => g.id === groupId);
  };

  // Mover casa para outro grupo
  const handleMoveHouse = async () => {
    if (!movingHouse || !targetGroupId || !user?.id) return;
    
    setIsMovingHouse(true);
    try {
      const customHouse = customHouses.find(h => h.id === movingHouse.house.id);
      
      // Verificar se a casa é uma cópia de uma casa estática original
      // Usar normalização para comparar nomes (Bet365 == Bet365 (BR) == bet365)
      const normalizedMovingName = normalizeHouseName(movingHouse.house.name);
      
      const isStaticHouseCopy = customHouse && 
        bettingHouseGroups.some(g => g.houses.some(h => 
          normalizeHouseName(h.name) === normalizedMovingName
        ));
      
      // Encontrar a casa estática original (se existir)
      let originalStaticHouse: BettingHouse | null = null;
      let originalGroupId: string | null = null;
      
      if (isStaticHouseCopy) {
        for (const group of bettingHouseGroups) {
          const found = group.houses.find(h => normalizeHouseName(h.name) === normalizedMovingName);
          if (found) {
            originalStaticHouse = found;
            originalGroupId = group.id;
            break;
          }
        }
      }
      
      // Caso especial: movendo de volta para o grupo original de uma casa estática
      if (isStaticHouseCopy && originalGroupId === targetGroupId && originalStaticHouse) {
        // Deletar a cópia customizada
        const { error: deleteError } = await supabase
          .from('custom_betting_houses')
          .delete()
          .eq('id', customHouse!.id);
        
        if (deleteError) throw deleteError;
        
        // Restaurar a casa original (remover do hidden)
        // Deletar por house_id OR por normalização do nome para cobrir todos os casos
        await supabase
          .from('hidden_betting_houses')
          .delete()
          .eq('house_id', originalStaticHouse.id);
        
        // Também tentar deletar por nome normalizado caso o house_id não bata
        await supabase
          .from('hidden_betting_houses')
          .delete()
          .eq('house_name', originalStaticHouse.name);
        
        // Atualizar estados locais
        setCustomHouses(prev => prev.filter(h => h.id !== customHouse!.id));
        setHiddenHouses(prev => prev.filter(h => 
          h.house_id !== originalStaticHouse!.id && 
          normalizeHouseName(h.house_name) !== normalizedMovingName
        ));
        
      } else if (customHouse) {
        // Casa customizada normal: atualizar group_id
        const { error } = await supabase
          .from('custom_betting_houses')
          .update({ group_id: targetGroupId })
          .eq('id', customHouse.id);
        
        if (error) throw error;
        
        setCustomHouses(prev => prev.map(h => 
          h.id === customHouse.id ? { ...h, group_id: targetGroupId } : h
        ));
      } else {
        // Casa original estática: criar entry customizada no novo grupo e ocultar a original
        const { data: newHouse, error: insertError } = await supabase
          .from('custom_betting_houses')
          .insert({
            group_id: targetGroupId,
            name: movingHouse.house.name,
            url: movingHouse.house.url || null,
            created_by: user.id,
          })
          .select()
          .single();
        
        if (insertError) throw insertError;
        
        // Ocultar a casa original
        const { error: hideError } = await supabase
          .from('hidden_betting_houses')
          .insert({
            house_id: movingHouse.house.id,
            house_name: movingHouse.house.name,
            group_id: movingHouse.currentGroupId,
            hidden_by: user.id,
          });
        
        if (hideError) throw hideError;
        
        setCustomHouses(prev => [...prev, newHouse]);
        setHiddenHouses(prev => [...prev, {
          id: crypto.randomUUID(),
          house_id: movingHouse.house.id,
          house_name: movingHouse.house.name,
          group_id: movingHouse.currentGroupId,
        }]);
      }
      
      const targetGroupStatic = bettingHouseGroups.find(g => g.id === targetGroupId);
      const targetGroupCustom = customGroups.find(g => g.id === targetGroupId);
      const targetGroupName = targetGroupStatic?.name || targetGroupCustom?.nome || '';
      
      toast({
        title: 'Casa movida!',
        description: `${movingHouse.house.name} foi movida para "${targetGroupName}".`,
      });
      
      setMovingHouse(null);
      setTargetGroupId('');
    } catch (error: any) {
      console.error('Erro ao mover casa:', error);
      toast({
        title: 'Erro',
        description: error.message || 'Não foi possível mover a casa.',
        variant: 'destructive',
      });
    } finally {
      setIsMovingHouse(false);
    }
  };

  // Lista de todos os grupos disponíveis para mover
  const allGroups = useMemo(() => {
    const staticGroups = bettingHouseGroups.map(g => ({ id: g.id, name: g.name }));
    const customGroupsList = customGroups.map(g => ({ id: g.id, name: g.nome }));
    return [...staticGroups, ...customGroupsList];
  }, [customGroups]);

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
          
          <div className="flex items-center gap-2 flex-wrap">
            {isAdmin && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsAddGroupDialogOpen(true)}
                className="gap-2"
              >
                <FolderPlus className="h-4 w-4" />
                Novo Grupo
              </Button>
            )}
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
              {totalGroups} grupos
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
              <Accordion type="single" collapsible className="w-full space-y-2">
                {filteredGroups.map((group) => (
                  <AccordionItem 
                    key={group.id} 
                    value={group.id}
                    className="border rounded-lg px-4 data-[state=open]:bg-muted/30"
                  >
                    <AccordionTrigger className="hover:no-underline py-4">
                      <div className="flex items-center gap-3 flex-1">
                        <div className={`h-10 w-10 rounded-full flex items-center justify-center ${isCustomGroup(group.id) ? 'bg-secondary' : 'bg-primary/10'}`}>
                          {isCustomGroup(group.id) ? (
                            <Folder className="h-5 w-5 text-muted-foreground" />
                          ) : (
                            <Home className="h-5 w-5 text-primary" />
                          )}
                        </div>
                        <div className="text-left flex-1">
                          <div className="font-medium flex items-center gap-2">
                            {searchTerm ? highlightText(group.name, searchTerm) : group.name}
                            {isCustomGroup(group.id) && (
                              <Badge variant="secondary" className="text-xs">Customizado</Badge>
                            )}
                          </div>
                          <div className="text-sm text-muted-foreground flex items-center gap-2">
                            {group.houses.length} {group.houses.length === 1 ? 'casa' : 'casas'}
                            {getGroupUsageCount(group) > 0 && (
                              <Badge variant="default" className="bg-success hover:bg-success/90 text-xs gap-1">
                                <CheckCircle2 className="h-3 w-3" />
                                {getGroupUsageCount(group)} em uso
                              </Badge>
                            )}
                          </div>
                        </div>
                        {isAdmin && isCustomGroup(group.id) && (
                          <div className="flex items-center gap-1 mr-2" onClick={(e) => e.stopPropagation()}>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={(e) => {
                                e.stopPropagation();
                                const customGroup = getCustomGroup(group.id);
                                if (customGroup) {
                                  setEditingGroup(customGroup);
                                  setEditedGroupName(customGroup.nome);
                                }
                              }}
                              title="Editar grupo"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={(e) => {
                                e.stopPropagation();
                                const customGroup = getCustomGroup(group.id);
                                if (customGroup) {
                                  setGroupToDelete(customGroup);
                                }
                              }}
                              title="Excluir grupo"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="pb-4">
                      <div className="space-y-1.5 mt-2">
                        {group.houses.map((house) => {
                          const isHidden = hiddenHouseIds.has(house.id);
                          const isCustom = customHouses.some(h => h.id === house.id);
                          const isEdited = editedHousesMap.has(house.id);
                          const usedByPartnerships = housePartnershipsMap.get(normalizeHouseName(house.name)) || [];
                          const isUsedByPartnership = usedByPartnerships.length > 0;
                          const customHouseData = customHouses.find(h => h.id === house.id || h.original_house_id === house.id);
                          const staticAnnotation = houseAnnotations.find(a => a.house_id === house.id);
                          const annotation = customHouseData?.annotation || staticAnnotation?.annotation || null;
                          const annotationColor = customHouseData?.annotation_color || staticAnnotation?.annotation_color || '#6366f1';
                          
                          return (
                            <>
                            {/* Desktop layout */}
                            <div
                              key={`desktop-${house.id}`}
                              className={`hidden md:flex items-center justify-between p-3 rounded-lg bg-background border hover:border-primary/50 transition-colors group ${isHidden ? 'opacity-50 border-destructive/50' : ''} ${isUsedByPartnership ? 'border-success/50 bg-success/5' : ''}`}
                            >
                              <div className="flex items-center gap-3 flex-1 min-w-0">
                                <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${isUsedByPartnership ? 'bg-success/20' : 'bg-secondary'}`}>
                                  {isUsedByPartnership ? (
                                    <CheckCircle2 className="h-4 w-4 text-success" />
                                  ) : (
                                    <Building2 className="h-4 w-4 text-muted-foreground" />
                                  )}
                                </div>
                                
                                <div className="flex-1 min-w-0">
                                  <div className="font-medium truncate flex items-center gap-2 flex-wrap">
                                    {searchTerm ? highlightText(house.name, searchTerm) : house.name}
                                    {isUsedByPartnership && (
                                      <span className="flex items-center gap-1 flex-wrap">
                                        {usedByPartnerships.map((partnershipName, idx) => (
                                          <Badge key={idx} variant="default" className={`text-xs gap-1 text-white ${partnershipColorMap.get(partnershipName) || 'bg-success'}`}>
                                            <CheckCircle2 className="h-3 w-3" />
                                            {partnershipName}
                                          </Badge>
                                        ))}
                                      </span>
                                    )}
                                    {isHidden && <Badge variant="destructive" className="text-xs">Oculta</Badge>}
                                    {isCustom && <Badge variant="secondary" className="text-xs">Nova</Badge>}
                                    {isEdited && !isCustom && <Badge variant="outline" className="text-xs">Editada</Badge>}
                                    {annotation && (
                                      <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full text-white shrink-0" style={{ backgroundColor: annotationColor }}>
                                        <StickyNote className="h-3 w-3" />
                                        {annotation}
                                      </span>
                                    )}
                                  </div>
                                  {house.url && (
                                    <a href={house.url.startsWith('http://') || house.url.startsWith('https://') ? house.url : `https://${house.url}`} target="_blank" rel="noopener noreferrer" className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1">
                                      {house.url}
                                      <ExternalLink className="h-3 w-3" />
                                    </a>
                                  )}
                                </div>
                                
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  {isAdmin && isHidden ? (
                                    <Button variant="outline" size="sm" className="h-8 gap-1 text-green-600 hover:text-green-700 hover:bg-green-50" onClick={() => handleRestoreHouse(house)} title="Restaurar casa">
                                      <Eye className="h-4 w-4" />
                                      Restaurar
                                    </Button>
                                  ) : (
                                    <>
                                      {isAdmin && (
                                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleStartEdit(house, group.id)} title="Editar casa">
                                          <Edit3 className="h-4 w-4" />
                                        </Button>
                                      )}
                                      {isAdmin && (
                                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setMovingHouse({ house, currentGroupId: group.id }); setTargetGroupId(''); }} title="Mover para outro grupo">
                                          <MoveRight className="h-4 w-4" />
                                        </Button>
                                      )}
                                      <Button variant="default" size="icon" className="h-8 w-8" onClick={() => handleOpenAddDialog(house)} title="Adicionar à parceria">
                                        <Plus className="h-4 w-4" />
                                      </Button>
                                      {isAdmin && (
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => setHouseToDelete({ house, groupId: group.id })} title="Remover do catálogo">
                                          <Trash2 className="h-4 w-4" />
                                        </Button>
                                      )}
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Mobile layout - compact list style */}
                            <div
                              key={`mobile-${house.id}`}
                              className={`md:hidden rounded-md border bg-background p-2.5 space-y-1.5 ${isHidden ? 'opacity-50 border-destructive/50' : ''} ${isUsedByPartnership ? 'border-success/50 bg-success/5' : ''}`}
                            >
                              {/* Row 1: Name */}
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium leading-snug">
                                    {searchTerm ? highlightText(house.name, searchTerm) : house.name}
                                  </p>
                                  {house.url && (
                                    <a href={house.url.startsWith('http://') || house.url.startsWith('https://') ? house.url : `https://${house.url}`} target="_blank" rel="noopener noreferrer" className="text-[11px] text-muted-foreground hover:text-primary flex items-center gap-1 mt-0.5">
                                      <span className="truncate">{house.url}</span>
                                      <ExternalLink className="h-2.5 w-2.5 shrink-0" />
                                    </a>
                                  )}
                                </div>
                              </div>

                              {/* Row 2: Badges */}
                              {(isUsedByPartnership || isHidden || isCustom || (isEdited && !isCustom) || annotation) && (
                                <div className="flex items-center gap-1 flex-wrap">
                                  {isUsedByPartnership && usedByPartnerships.map((partnershipName, idx) => (
                                    <Badge key={idx} variant="default" className={`text-[10px] h-[18px] gap-0.5 text-white ${partnershipColorMap.get(partnershipName) || 'bg-success'}`}>
                                      <CheckCircle2 className="h-2.5 w-2.5" />
                                      {partnershipName}
                                    </Badge>
                                  ))}
                                  {isHidden && <Badge variant="destructive" className="text-[10px] h-[18px]">Oculta</Badge>}
                                  {isCustom && <Badge variant="secondary" className="text-[10px] h-[18px]">Nova</Badge>}
                                  {isEdited && !isCustom && <Badge variant="outline" className="text-[10px] h-[18px]">Editada</Badge>}
                                  {annotation && (
                                    <span className="inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 rounded-full text-white" style={{ backgroundColor: annotationColor }}>
                                      <StickyNote className="h-2.5 w-2.5" />
                                      {annotation}
                                    </span>
                                  )}
                                </div>
                              )}

                              {/* Row 3: Actions - grouped in a row */}
                              <div className="flex items-center gap-1 pt-0.5 border-t border-border/50">
                                {isAdmin && isHidden ? (
                                  <Button variant="outline" size="sm" className="h-7 text-xs gap-1 text-green-600" onClick={() => handleRestoreHouse(house)}>
                                    <Eye className="h-3 w-3" />
                                    Restaurar
                                  </Button>
                                ) : (
                                  <>
                                    <Button variant="default" size="sm" className="h-7 text-xs gap-1 flex-1" onClick={() => handleOpenAddDialog(house)}>
                                      <Plus className="h-3 w-3" />
                                      Adicionar
                                    </Button>
                                    {isAdmin && (
                                      <>
                                        <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => handleStartEdit(house, group.id)} title="Editar">
                                          <Edit3 className="h-3 w-3" />
                                        </Button>
                                        <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => { setMovingHouse({ house, currentGroupId: group.id }); setTargetGroupId(''); }} title="Mover">
                                          <MoveRight className="h-3 w-3" />
                                        </Button>
                                        <Button variant="outline" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setHouseToDelete({ house, groupId: group.id })} title="Excluir">
                                          <Trash2 className="h-3 w-3" />
                                        </Button>
                                      </>
                                    )}
                                  </>
                                )}
                              </div>
                            </div>
                            </>
                          );
                        })}
                        
                        {/* Botão para adicionar nova casa ao grupo */}
                        {isAdmin && (
                          <Button
                            variant="outline"
                            className="w-full mt-3 gap-2 border-dashed"
                            onClick={() => {
                              setAddHouseGroupId(group.id);
                              setIsAddHouseDialogOpen(true);
                            }}
                          >
                            <PlusCircle className="h-4 w-4" />
                            Adicionar Casa ao Grupo
                          </Button>
                        )}
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

        {/* Dialog para editar casa */}
        <Dialog open={!!editingHouse} onOpenChange={(open) => !open && setEditingHouse(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Editar Casa de Apostas</DialogTitle>
              <DialogDescription>
                Altere os dados da casa de apostas
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="editName">Nome da Casa</Label>
                <Input
                  id="editName"
                  value={editedName}
                  onChange={(e) => setEditedName(e.target.value)}
                  placeholder="Nome da casa de apostas"
                  autoFocus
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="editUrl">URL (opcional)</Label>
                <Input
                  id="editUrl"
                  value={editedUrl}
                  onChange={(e) => setEditedUrl(e.target.value)}
                  placeholder="exemplo.bet.br"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="editAnnotation">Anotação resumida (máx. 15 caracteres)</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="editAnnotation"
                    value={editedAnnotation}
                    onChange={(e) => {
                      if (e.target.value.length <= 15) setEditedAnnotation(e.target.value);
                    }}
                    placeholder="Ex: Boa odd"
                    maxLength={15}
                    className="flex-1"
                  />
                  <div className="flex items-center gap-1.5">
                    {['#6366f1', '#ef4444', '#f59e0b', '#22c55e', '#3b82f6'].map(color => (
                      <button
                        key={color}
                        type="button"
                        className={`h-7 w-7 rounded-full border-2 transition-all ${editedAnnotationColor === color ? 'border-foreground scale-110' : 'border-transparent'}`}
                        style={{ backgroundColor: color }}
                        onClick={() => setEditedAnnotationColor(color)}
                      />
                    ))}
                  </div>
                </div>
                {editedAnnotation && (
                  <span 
                    className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full text-white"
                    style={{ backgroundColor: editedAnnotationColor }}
                  >
                    <StickyNote className="h-3 w-3" />
                    {editedAnnotation}
                  </span>
                )}
              </div>
            </div>
            
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                variant="outline"
                onClick={() => setEditingHouse(null)}
                disabled={isSavingEdit}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleSaveEdit}
                disabled={!editedName.trim() || isSavingEdit}
              >
                {isSavingEdit ? 'Salvando...' : 'Salvar'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog para adicionar nova casa */}
        <Dialog open={isAddHouseDialogOpen} onOpenChange={setIsAddHouseDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Adicionar Nova Casa</DialogTitle>
              <DialogDescription>
                Adicione uma nova casa de apostas ao grupo "{bettingHouseGroups.find(g => g.id === addHouseGroupId)?.name || customGroups.find(g => g.id === addHouseGroupId)?.nome}"
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="newName">Nome da Casa *</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="newName"
                    value={newHouseName}
                    onChange={(e) => {
                      setNewHouseName(e.target.value);
                      setDuplicateHouseWarning('');
                    }}
                    placeholder="Digite o nome da casa de apostas..."
                    autoFocus
                    className="pl-9"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newHouseName.trim()) {
                        handleAddNewHouse();
                      }
                    }}
                  />
                </div>
                {/* Autocomplete suggestions */}
                {newHouseName.trim().length >= 2 && (() => {
                  const search = newHouseName.toLowerCase().trim();
                  const replacedOriginalIds = new Set(
                    customHouses.filter(c => c.original_house_id).map(c => c.original_house_id!)
                  );
                  const suggestions: { name: string; groupName: string; exists: boolean }[] = [];
                  // Static houses
                  bettingHouseGroups.forEach(group => {
                    group.houses.forEach(house => {
                      if (hiddenHouseIds.has(house.id) || replacedOriginalIds.has(house.id)) return;
                      if (house.name.toLowerCase().includes(search)) {
                        const existsInGroup = normalizeHouseName(house.name) === normalizeHouseName(newHouseName);
                        suggestions.push({ name: house.name, groupName: group.name, exists: existsInGroup });
                      }
                    });
                  });
                  // Custom houses (no original_house_id = truly new)
                  customHouses.forEach(custom => {
                    if (custom.name.toLowerCase().includes(search)) {
                      const alreadyAdded = suggestions.some(s => normalizeHouseName(s.name) === normalizeHouseName(custom.name));
                      if (!alreadyAdded) {
                        const groupStatic = bettingHouseGroups.find(g => g.id === custom.group_id);
                        const groupCustom = customGroups.find(g => g.id === custom.group_id);
                        const groupName = custom.original_house_id 
                          ? (bettingHouseGroups.find(g => g.houses.some(h => h.id === custom.original_house_id))?.name || groupStatic?.name || groupCustom?.nome || '')
                          : (groupStatic?.name || groupCustom?.nome || '');
                        suggestions.push({ name: custom.name, groupName, exists: true });
                      }
                    }
                  });
                  const filtered = suggestions.slice(0, 8);
                  if (filtered.length === 0) return null;
                  return (
                    <div className="border rounded-md shadow-lg max-h-48 overflow-auto bg-popover">
                      {filtered.map((s, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => {
                            // Check if exists in catalog
                            const existingGroup = checkHouseExistsInCatalog(s.name);
                            if (existingGroup) {
                              setDuplicateHouseWarning(`Casa já existente no grupo "${existingGroup}". Se quiser, poderá movê-la para este grupo.`);
                              setNewHouseName(s.name);
                            } else {
                              setNewHouseName(s.name);
                              setDuplicateHouseWarning('');
                            }
                          }}
                          className="w-full px-3 py-2 text-left hover:bg-accent flex items-center gap-2 transition-colors text-sm"
                        >
                          <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                          <div className="flex-1 min-w-0">
                            <span className="font-medium truncate block">{s.name}</span>
                            <span className="text-xs text-muted-foreground">{s.groupName}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  );
                })()}
                {duplicateHouseWarning && (
                  <p className="text-sm text-destructive flex items-center gap-1">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    {duplicateHouseWarning}
                  </p>
                )}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="newUrl">URL (opcional)</Label>
                <Input
                  id="newUrl"
                  value={newHouseUrl}
                  onChange={(e) => setNewHouseUrl(e.target.value)}
                  placeholder="exemplo.bet.br"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newHouseName.trim()) {
                      handleAddNewHouse();
                    }
                  }}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="newAnnotation">Anotação resumida (máx. 15 caracteres)</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="newAnnotation"
                    value={newHouseAnnotation}
                    onChange={(e) => {
                      if (e.target.value.length <= 15) setNewHouseAnnotation(e.target.value);
                    }}
                    placeholder="Ex: Boa odd"
                    maxLength={15}
                    className="flex-1"
                  />
                  <div className="flex items-center gap-1.5">
                    {['#6366f1', '#ef4444', '#f59e0b', '#22c55e', '#3b82f6'].map(color => (
                      <button
                        key={color}
                        type="button"
                        className={`h-7 w-7 rounded-full border-2 transition-all ${newHouseAnnotationColor === color ? 'border-foreground scale-110' : 'border-transparent'}`}
                        style={{ backgroundColor: color }}
                        onClick={() => setNewHouseAnnotationColor(color)}
                      />
                    ))}
                  </div>
                </div>
                {newHouseAnnotation && (
                  <span 
                    className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full text-white"
                    style={{ backgroundColor: newHouseAnnotationColor }}
                  >
                    <StickyNote className="h-3 w-3" />
                    {newHouseAnnotation}
                  </span>
                )}
              </div>
            </div>
            
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                variant="outline"
                onClick={() => {
                  setIsAddHouseDialogOpen(false);
                  setNewHouseName('');
                  setNewHouseUrl('');
                  setNewHouseAnnotation('');
                  setNewHouseAnnotationColor('#6366f1');
                  setDuplicateHouseWarning('');
                }}
                disabled={isAddingHouse}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleAddNewHouse}
                disabled={!newHouseName.trim() || isAddingHouse}
              >
                {isAddingHouse ? 'Adicionando...' : 'Adicionar'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog para adicionar novo grupo */}
        <Dialog open={isAddGroupDialogOpen} onOpenChange={setIsAddGroupDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Novo Grupo</DialogTitle>
              <DialogDescription>
                Crie um novo grupo de casas de apostas
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="groupName">Nome do Grupo *</Label>
                <Input
                  id="groupName"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  placeholder="Ex: Clone Pixbet, Casas Premium..."
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newGroupName.trim()) {
                      handleAddGroup();
                    }
                  }}
                />
              </div>
            </div>
            
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                variant="outline"
                onClick={() => {
                  setIsAddGroupDialogOpen(false);
                  setNewGroupName('');
                }}
                disabled={isAddingGroup}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleAddGroup}
                disabled={!newGroupName.trim() || isAddingGroup}
              >
                {isAddingGroup ? 'Criando...' : 'Criar Grupo'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog para editar grupo */}
        <Dialog open={!!editingGroup} onOpenChange={(open) => !open && setEditingGroup(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Editar Grupo</DialogTitle>
              <DialogDescription>
                Altere o nome do grupo
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="editGroupName">Nome do Grupo *</Label>
                <Input
                  id="editGroupName"
                  value={editedGroupName}
                  onChange={(e) => setEditedGroupName(e.target.value)}
                  placeholder="Nome do grupo"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && editedGroupName.trim()) {
                      handleUpdateGroup();
                    }
                  }}
                />
              </div>
            </div>
            
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                variant="outline"
                onClick={() => setEditingGroup(null)}
                disabled={isSavingGroup}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleUpdateGroup}
                disabled={!editedGroupName.trim() || isSavingGroup}
              >
                {isSavingGroup ? 'Salvando...' : 'Salvar'}
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

        {/* Dialog de confirmação para excluir grupo */}
        <ConfirmDeleteDialog
          open={!!groupToDelete}
          onOpenChange={(open) => !open && setGroupToDelete(null)}
          onConfirm={handleDeleteGroup}
          title="Excluir Grupo"
          description={`Tem certeza que deseja excluir o grupo "${groupToDelete?.nome}"? Todas as casas dentro deste grupo também serão removidas. Esta ação não pode ser desfeita.`}
        />

        {/* Dialog para mover casa */}
        <Dialog 
          open={!!movingHouse} 
          onOpenChange={(open) => {
            if (!open) {
              setMovingHouse(null);
              setTargetGroupId('');
            }
          }}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Mover Casa de Apostas</DialogTitle>
              <DialogDescription>
                Selecione o grupo de destino para "{movingHouse?.house.name}"
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Grupo de Destino</Label>
                <Select value={targetGroupId} onValueChange={setTargetGroupId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um grupo" />
                  </SelectTrigger>
                  <SelectContent>
                    {allGroups
                      .filter(g => g.id !== movingHouse?.currentGroupId)
                      .map(group => (
                        <SelectItem key={group.id} value={group.id}>
                          {group.name}
                        </SelectItem>
                      ))
                    }
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                variant="outline"
                onClick={() => {
                  setMovingHouse(null);
                  setTargetGroupId('');
                }}
                disabled={isMovingHouse}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleMoveHouse}
                disabled={!targetGroupId || isMovingHouse}
                className="gap-2"
              >
                <MoveRight className="h-4 w-4" />
                {isMovingHouse ? 'Movendo...' : 'Mover'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default CasasDeApostas;
