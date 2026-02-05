import { useState, useEffect, useMemo, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { bettingHouseGroups, BettingHouse } from '@/data/bettingHousesData';
import { Building2, Search, AlertTriangle, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CustomHouse {
  id: string;
  name: string;
  url: string | null;
  group_id: string;
}

interface AddHouseAutocompleteProps {
  partnershipId: string;
  existingHouses: string[];
  onSuccess: () => void;
}

export const AddHouseAutocomplete = ({ partnershipId, existingHouses, onSuccess }: AddHouseAutocompleteProps) => {
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [customHouses, setCustomHouses] = useState<CustomHouse[]>([]);
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);
  const [duplicateHouseName, setDuplicateHouseName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Carregar casas customizadas do banco
  useEffect(() => {
    const loadCustomHouses = async () => {
      const { data } = await supabase
        .from('custom_betting_houses')
        .select('id, name, url, group_id');
      if (data) {
        setCustomHouses(data);
      }
    };
    loadCustomHouses();
  }, []);

  // Combinar casas estáticas + customizadas
  const allHouses = useMemo(() => {
    const houses: { id: string; name: string; url?: string; groupName: string }[] = [];
    
    // Casas estáticas
    bettingHouseGroups.forEach(group => {
      group.houses.forEach(house => {
        houses.push({
          id: house.id,
          name: house.name,
          url: house.url,
          groupName: group.name,
        });
      });
    });
    
    // Casas customizadas (não duplicar se já existe)
    customHouses.forEach(custom => {
      const exists = houses.some(h => h.name.toLowerCase() === custom.name.toLowerCase());
      if (!exists) {
        houses.push({
          id: custom.id,
          name: custom.name,
          url: custom.url || undefined,
          groupName: 'Customizada',
        });
      }
    });
    
    return houses;
  }, [customHouses]);

  // Normalizar nome para comparação case-insensitive
  const normalizeHouseName = (name: string) => name.toLowerCase().trim();

  // Verificar se casa já existe na parceria (case-insensitive)
  const isHouseInPartnership = (houseName: string) => {
    const normalized = normalizeHouseName(houseName);
    return existingHouses.some(h => normalizeHouseName(h) === normalized);
  };

  // Filtrar sugestões baseado no input
  const filteredSuggestions = useMemo(() => {
    if (!inputValue.trim()) return [];
    
    const search = normalizeHouseName(inputValue);
    return allHouses
      .filter(house => normalizeHouseName(house.name).includes(search))
      .slice(0, 10);
  }, [inputValue, allHouses]);

  // Fechar sugestões ao clicar fora
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectHouse = async (house: { name: string; url?: string }) => {
    // Verificar se já existe na parceria
    if (isHouseInPartnership(house.name)) {
      setDuplicateHouseName(house.name);
      setDuplicateDialogOpen(true);
      setShowSuggestions(false);
      return;
    }

    await addHouse(house.name);
  };

  const handleSubmitManual = async () => {
    const trimmedName = inputValue.trim();
    if (!trimmedName || trimmedName.length < 2) {
      toast({
        title: 'Erro',
        description: 'O nome da casa deve ter pelo menos 2 caracteres.',
        variant: 'destructive',
      });
      return;
    }

    // Verificar se já existe na parceria
    if (isHouseInPartnership(trimmedName)) {
      setDuplicateHouseName(trimmedName);
      setDuplicateDialogOpen(true);
      return;
    }

    await addHouse(trimmedName);
  };

  const addHouse = async (houseName: string) => {
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('partnership_houses')
        .insert({
          partnership_id: partnershipId,
          house_name: houseName,
          status: 'aguardando_verificacao',
        });

      if (error) throw error;

      toast({
        title: 'Sucesso',
        description: `Casa "${houseName}" adicionada com status "Aguardando Verificação"`,
      });

      setInputValue('');
      setShowSuggestions(false);
      onSuccess();
    } catch (error: any) {
      console.error('Erro ao adicionar casa:', error);
      toast({
        title: 'Erro',
        description: error.message || 'Não foi possível adicionar a casa de apostas',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="relative">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            ref={inputRef}
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value);
              setShowSuggestions(true);
            }}
            onFocus={() => setShowSuggestions(true)}
            placeholder="Digite o nome da casa de apostas..."
            className="pl-9"
            autoFocus
          />
        </div>

        {/* Sugestões */}
        {showSuggestions && filteredSuggestions.length > 0 && (
          <div
            ref={suggestionsRef}
            className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-60 overflow-auto"
          >
            {filteredSuggestions.map((house) => {
              const isInPartnership = isHouseInPartnership(house.name);
              return (
                <button
                  key={house.id}
                  type="button"
                  onClick={() => handleSelectHouse(house)}
                  className={cn(
                    "w-full px-3 py-2 text-left hover:bg-accent flex items-center gap-2 transition-colors",
                    isInPartnership && "opacity-50 bg-muted"
                  )}
                >
                  <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">{house.name}</span>
                      {isInPartnership && (
                        <Badge variant="secondary" className="text-xs shrink-0">
                          Já cadastrada
                        </Badge>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">{house.groupName}</span>
                  </div>
                  {house.url && (
                    <ExternalLink className="h-3 w-3 text-muted-foreground shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Mostrar opção de adicionar manualmente se não encontrou */}
        {showSuggestions && inputValue.trim().length >= 2 && filteredSuggestions.length === 0 && (
          <div
            ref={suggestionsRef}
            className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg p-3"
          >
            <p className="text-sm text-muted-foreground mb-2">
              Nenhuma casa encontrada. Deseja adicionar "{inputValue.trim()}"?
            </p>
            <Button size="sm" onClick={handleSubmitManual} disabled={isLoading}>
              Adicionar como nova
            </Button>
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        A casa será adicionada com status{' '}
        <Badge variant="outline" className="inline-flex">Aguardando Verificação</Badge>
      </p>

      <div className="flex justify-end gap-2">
        <Button 
          onClick={handleSubmitManual} 
          disabled={isLoading || inputValue.trim().length < 2}
        >
          {isLoading ? 'Adicionando...' : 'Adicionar'}
        </Button>
      </div>

      {/* Dialog de casa duplicada */}
      <Dialog open={duplicateDialogOpen} onOpenChange={setDuplicateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              Casa já cadastrada
            </DialogTitle>
            <DialogDescription>
              A casa <strong>"{duplicateHouseName}"</strong> já está cadastrada nesta parceria.
              Não é possível adicionar a mesma casa novamente.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => {
              setDuplicateDialogOpen(false);
              setInputValue('');
            }}>
              Entendido
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
