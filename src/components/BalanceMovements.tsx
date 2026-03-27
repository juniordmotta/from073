import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatCurrency } from '@/lib/utils';
import { ArrowDownLeft, ArrowUpRight, RefreshCw, History } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';

interface Movement {
  id: string;
  tipo: string;
  valor: number;
  saldo_anterior: number;
  saldo_novo: number;
  descricao: string | null;
  created_at: string;
}

interface BalanceMovementsProps {
  partnershipId: string;
}

const tipoConfig: Record<string, { label: string; icon: typeof ArrowDownLeft; color: string }> = {
  deposito: { label: 'Depósito', icon: ArrowUpRight, color: 'text-success' },
  debito: { label: 'Débito', icon: ArrowDownLeft, color: 'text-destructive' },
  ajuste_manual: { label: 'Ajuste Manual', icon: RefreshCw, color: 'text-primary' },
};

export function BalanceMovements({ partnershipId }: BalanceMovementsProps) {
  const [movements, setMovements] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const loadMovements = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('balance_movements')
        .select('*')
        .eq('partnership_id', partnershipId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setMovements((data as Movement[]) || []);
    } catch (err) {
      console.error('Erro ao carregar movimentações:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) loadMovements();
  }, [open, partnershipId]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-muted-foreground">
          <History className="h-3 w-3" />
          Extrato
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-4 w-4" />
            Extrato Bancário
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh]">
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b">
                  <div className="space-y-1">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-3 w-40" />
                  </div>
                  <Skeleton className="h-5 w-20" />
                </div>
              ))}
            </div>
          ) : movements.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Nenhuma movimentação registrada
            </p>
          ) : (
            <div className="space-y-0.5">
              {movements.map((mov) => {
                const config = tipoConfig[mov.tipo] || tipoConfig.ajuste_manual;
                const Icon = config.icon;
                return (
                  <div key={mov.id} className="flex items-center justify-between py-2.5 px-1 border-b last:border-0">
                    <div className="flex items-start gap-2 min-w-0 flex-1">
                      <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${config.color}`} />
                      <div className="min-w-0">
                        <p className="text-xs font-medium">{config.label}</p>
                        {mov.descricao && (
                          <p className="text-[10px] text-muted-foreground truncate max-w-[200px]">{mov.descricao}</p>
                        )}
                        <p className="text-[10px] text-muted-foreground">
                          {format(new Date(mov.created_at), "dd/MM/yy 'às' HH:mm", { locale: ptBR })}
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`text-sm font-bold ${config.color}`}>
                        {mov.tipo === 'debito' ? '-' : '+'}R$ {formatCurrency(Math.abs(mov.valor))}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        Saldo: R$ {formatCurrency(mov.saldo_novo)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
