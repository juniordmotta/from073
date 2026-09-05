import { useState, type ReactNode } from 'react';
import { ChevronDown, SlidersHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface MobileFiltersProps {
  children: ReactNode;
  /** Quantidade de filtros ativos, exibida no badge do botão */
  activeCount?: number;
  label?: string;
  className?: string;
}

/**
 * No mobile, esconde os filtros atrás de um botão com seta.
 * No desktop/tablet (md+), renderiza os filhos normalmente, sem alterar nada.
 */
export function MobileFilters({ children, activeCount = 0, label = 'Filtros', className }: MobileFiltersProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className={className}>
      {/* Botão apenas no mobile */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="md:hidden flex w-full items-center justify-between rounded-lg border bg-card px-3 py-2 text-sm font-medium"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
          {label}
          {activeCount > 0 && (
            <Badge className="h-5 px-1.5 text-[10px] bg-yellow-400 text-black hover:bg-yellow-500">{activeCount}</Badge>
          )}
        </span>
        <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform duration-200', open && 'rotate-180')} />
      </button>

      <div
        className={cn(
          'overflow-hidden transition-all duration-300 md:!max-h-none md:!opacity-100 md:!mt-0',
          open ? 'max-h-[80vh] opacity-100 mt-2' : 'max-h-0 opacity-0 md:opacity-100'
        )}
      >
        {children}
      </div>
    </div>
  );
}
