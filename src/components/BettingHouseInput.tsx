 import { useState, useEffect, useMemo, useRef } from 'react';
 import { Input } from '@/components/ui/input';
 import { supabase } from '@/integrations/supabase/client';
 import { bettingHouseGroups } from '@/data/bettingHousesData';
 import { Building2 } from 'lucide-react';
 import { cn } from '@/lib/utils';
 
interface CustomHouse {
  id: string;
  name: string;
  url: string | null;
  group_id: string;
  original_house_id: string | null;
}

interface BettingHouseInputProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  className?: string;
  partnershipId?: string; // Se fornecido, inclui casas específicas da parceria
}

// Função para normalizar nome de casa de apostas para deduplicação
// Remove "(BR)", "(br)", "BR", transforma em minúsculas, remove espaços extras
const normalizeForComparison = (name: string): string => {
  return name
    .toLowerCase()
    .replace(/\s*\(br\)\s*/gi, '') // Remove (BR) e (br) com espaços
    .replace(/\s+br\s*$/gi, '')    // Remove "BR" no final
    .replace(/\s+/g, ' ')          // Normaliza espaços múltiplos
    .trim();
};

export const BettingHouseInput = ({
  id,
  value,
  onChange,
  placeholder = "Ex: Bet365",
  required = false,
  className,
  partnershipId,
}: BettingHouseInputProps) => {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [customHouses, setCustomHouses] = useState<CustomHouse[]>([]);
  const [partnershipHouses, setPartnershipHouses] = useState<string[]>([]);
  const [hiddenHouseIds, setHiddenHouseIds] = useState<Set<string>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Carregar casas customizadas do catálogo e casas ocultas
  useEffect(() => {
    const loadCatalogData = async () => {
      // Carregar casas customizadas
      const { data: customData } = await supabase
        .from('custom_betting_houses')
        .select('id, name, url, group_id, original_house_id');
      if (customData) {
        setCustomHouses(customData);
      }
      
      // Carregar casas ocultas
      const { data: hiddenData } = await supabase
        .from('hidden_betting_houses')
        .select('house_id');
      if (hiddenData) {
        setHiddenHouseIds(new Set(hiddenData.map(h => h.house_id)));
      }
    };
    loadCatalogData();
  }, []);

  // Carregar casas específicas da parceria (se fornecido)
  useEffect(() => {
    if (!partnershipId) {
      setPartnershipHouses([]);
      return;
    }
    
    const loadPartnershipHouses = async () => {
      const { data } = await supabase
        .from('partnership_houses')
        .select('house_name')
        .eq('partnership_id', partnershipId);
      if (data) {
        setPartnershipHouses(data.map(h => h.house_name));
      }
    };
    loadPartnershipHouses();
  }, [partnershipId]);

  // Combinar casas do catálogo (estáticas + customizadas) com deduplicação
  // Apenas casas visíveis no catálogo "Casas de Apostas"
  const catalogHouses = useMemo(() => {
    const housesMap = new Map<string, { id: string; name: string; groupName: string; source: 'catalog' }>();
    
    // Collect original_house_ids from custom houses to skip their static originals
    const replacedOriginalIds = new Set(
      customHouses.filter(c => c.original_house_id).map(c => c.original_house_id!)
    );
    
    // Casas estáticas (apenas não ocultas e não substituídas por customizadas)
    bettingHouseGroups.forEach(group => {
      group.houses.forEach(house => {
        if (hiddenHouseIds.has(house.id)) return;
        if (replacedOriginalIds.has(house.id)) return; // Skip if replaced by custom
        
        const normalizedKey = normalizeForComparison(house.name);
        if (!housesMap.has(normalizedKey)) {
          housesMap.set(normalizedKey, {
            id: house.id,
            name: house.name,
            groupName: group.name,
            source: 'catalog',
          });
        }
      });
    });
    
    // Casas customizadas do catálogo (apenas se não existir versão similar)
    customHouses.forEach(custom => {
      const normalizedKey = normalizeForComparison(custom.name);
      if (!housesMap.has(normalizedKey)) {
        // Find the original group name if it replaced a static house
        let groupName = 'Customizada';
        if (custom.original_house_id) {
          for (const group of bettingHouseGroups) {
            if (group.houses.some(h => h.id === custom.original_house_id)) {
              groupName = group.name;
              break;
            }
          }
        }
        housesMap.set(normalizedKey, {
          id: custom.id,
          name: custom.name,
          groupName,
          source: 'catalog',
        });
      }
    });
    
    return housesMap;
  }, [customHouses, hiddenHouseIds]);

  // Combinar catálogo + casas específicas da parceria
  const allHouses = useMemo(() => {
    const housesMap = new Map(catalogHouses);
    
    // Adicionar casas da parceria (podem não estar no catálogo)
    partnershipHouses.forEach(houseName => {
      const normalizedKey = normalizeForComparison(houseName);
      if (!housesMap.has(normalizedKey)) {
        housesMap.set(normalizedKey, {
          id: `partnership-${houseName}`,
          name: houseName,
          groupName: 'Parceria',
          source: 'catalog' as const,
        });
      }
    });
    
    return Array.from(housesMap.values());
  }, [catalogHouses, partnershipHouses]);
 
  // Filtrar sugestões baseado no input (usa normalização para busca também)
  const filteredSuggestions = useMemo(() => {
    if (!value.trim()) return [];
    
    const searchNormalized = normalizeForComparison(value);
    return allHouses
      .filter(house => normalizeForComparison(house.name).includes(searchNormalized))
      .slice(0, 8);
  }, [value, allHouses]);
 
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
 
   const handleSelectHouse = (houseName: string) => {
     onChange(houseName);
     setShowSuggestions(false);
   };
 
   return (
     <div className="relative">
       <Input
         ref={inputRef}
         id={id}
         value={value}
         onChange={(e) => {
           onChange(e.target.value);
           setShowSuggestions(true);
         }}
         onFocus={() => setShowSuggestions(true)}
         placeholder={placeholder}
         required={required}
         className={className}
         autoComplete="off"
       />
 
       {/* Sugestões */}
       {showSuggestions && filteredSuggestions.length > 0 && (
         <div
           ref={suggestionsRef}
           className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-48 overflow-auto"
         >
           {filteredSuggestions.map((house) => (
             <button
               key={house.id}
               type="button"
               onClick={() => handleSelectHouse(house.name)}
               className={cn(
                 "w-full px-3 py-2 text-left hover:bg-accent flex items-center gap-2 transition-colors"
               )}
             >
               <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
               <div className="flex-1 min-w-0">
                 <span className="font-medium truncate block">{house.name}</span>
                 <span className="text-xs text-muted-foreground">{house.groupName}</span>
               </div>
             </button>
           ))}
         </div>
       )}
     </div>
   );
 };