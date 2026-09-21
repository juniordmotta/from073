import { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Target, Pencil } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { Progress } from '@/components/ui/progress';
import { useGoalNotifications } from '@/hooks/useGoalNotifications';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { withSupabaseRetry } from '@/lib/supabaseRetry';

interface MonthlyGoalCardProps {
  userId: string;
  selectedUserIds?: string[]; // Array de IDs de usuários filtrados
  partnershipId?: string;
  currentProfit: number;
  compact?: boolean;
}

export function MonthlyGoalCard({ userId, selectedUserIds, partnershipId, currentProfit, compact = false }: MonthlyGoalCardProps) {
  const { toast } = useToast();
  const { userRole } = useAuth();
  const [goalValue, setGoalValue] = useState<number>(0);
  const [editOpen, setEditOpen] = useState(false);
  const [editGoalValue, setEditGoalValue] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const isAdmin = userRole?.role === 'admin' || userRole?.role === 'admin_master';
  
  // Verificar se pode editar: admin pode editar qualquer um, usuário só pode editar o próprio
  const canEdit = isAdmin || (selectedUserIds?.length === 1 && selectedUserIds[0] === userId) || (!selectedUserIds && true);

  // Calcular o mês atual de forma dinâmica
  const getCurrentMonth = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  };

  // Usar useMemo em vez de estado para o mês atual
  const currentMonth = useMemo(() => getCurrentMonth(), []);

  useEffect(() => {
    fetchGoal();
  }, [userId, selectedUserIds, partnershipId, currentMonth]);

  const fetchGoal = async () => {
    try {
      // Se tiver selectedUserIds vazio, não faz query
      if (selectedUserIds && selectedUserIds.length === 0) {
        setGoalValue(0);
        return;
      }
      
      // Se tiver selectedUserIds, buscar metas de todos os usuários selecionados
      const userIdsToFetch = selectedUserIds && selectedUserIds.length > 0 
        ? selectedUserIds 
        : [userId];

      // Verificar se todos os IDs são válidos
      if (userIdsToFetch.some(id => !id)) {
        setGoalValue(0);
        return;
      }

      let query = supabase
        .from('monthly_goals')
        .select('goal_value, user_id')
        .in('user_id', userIdsToFetch)
        .eq('month', currentMonth);

      // Filtrar por partnership_id ou metas gerais (NULL)
      if (partnershipId) {
        query = query.eq('partnership_id', partnershipId);
      } else {
        query = query.is('partnership_id', null);
      }

      const { data, error } = await withSupabaseRetry(() => query);

      if (error) {
        console.warn('Erro ao buscar meta:', error.message);
        setGoalValue(0);
        return;
      }
      
      if (data && data.length > 0) {
        // Somar todas as metas dos usuários selecionados
        const totalGoal = data.reduce((sum, goal) => sum + Number(goal.goal_value), 0);
        setGoalValue(totalGoal);
      } else {
        setGoalValue(0);
      }
    } catch (error) {
      console.error('Erro ao buscar meta:', error);
      setGoalValue(0);
    }
  };

  const handleOpenEdit = () => {
    const formattedGoal = goalValue > 0 ? goalValue.toFixed(2).replace('.', ',') : '';
    setEditGoalValue(formattedGoal);
    setEditOpen(true);
  };

  const handleSaveGoal = async () => {
    setIsSaving(true);
    try {
      const numericValue = editGoalValue 
        ? parseFloat(editGoalValue.replace(/\D/g, '')) / 100 
        : 0;

      // Se múltiplos usuários selecionados, atualizar cada um
      const userIdsToUpdate = selectedUserIds && selectedUserIds.length > 0 
        ? selectedUserIds 
        : [userId];

      // Dividir o valor igualmente entre os usuários selecionados
      const valuePerUser = numericValue / userIdsToUpdate.length;

      for (const uid of userIdsToUpdate) {
        const { error } = await supabase.from('monthly_goals').upsert({
          user_id: uid,
          partnership_id: partnershipId || null,
          month: currentMonth,
          goal_value: valuePerUser,
        }, {
          onConflict: 'user_id,partnership_id,month',
        });

        if (error) throw error;
      }

      toast({
        title: 'Meta atualizada!',
        description: partnershipId 
          ? 'A meta da parceria foi salva com sucesso.' 
          : 'A meta mensal foi salva com sucesso.',
      });

      setEditOpen(false);
      fetchGoal();
    } catch (error: any) {
      console.error('Erro ao salvar meta:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao salvar meta',
        description: error.message,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const progressPercent = goalValue > 0 ? Math.min((currentProfit / goalValue) * 100, 100) : 0;
  const remaining = goalValue - currentProfit;

  // Calcular ritmo da meta
  const paceInfo = useMemo(() => {
    if (goalValue <= 0) return null;
    const now = new Date();
    const currentDay = now.getDate();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const dailyTarget = goalValue / daysInMonth;
    const expectedByToday = dailyTarget * currentDay;
    const diff = currentProfit - expectedByToday;
    const isOnTrack = diff >= 0;
    return {
      expectedByToday,
      diff,
      isOnTrack,
      dailyTarget,
      currentDay,
      daysInMonth,
    };
  }, [goalValue, currentProfit]);

  // Hook de notificações
  useGoalNotifications({
    goalValue,
    currentProfit,
    userId,
    partnershipId,
  });

  // Formatar nome do mês atual
  const monthName = new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  const capitalizedMonth = monthName.charAt(0).toUpperCase() + monthName.slice(1);
  
  // Título baseado no contexto
  const cardTitle = partnershipId ? 'Meta da Parceria' : 'Meta do Mês';
  const dialogTitle = partnershipId ? 'Editar Meta da Parceria' : 'Editar Meta do Mês';

  if (compact) {
    return (
      <>
        <Card className="min-w-0 p-2.5 md:p-3">
          <div className="flex items-center justify-between mb-1">
            <div className="flex min-w-0 items-center gap-1.5 md:gap-2">
              <Target className="h-3 w-3 text-primary" />
              <span className="truncate text-[10px] text-muted-foreground md:text-xs">{cardTitle}</span>
            </div>
            {canEdit && (
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-6 w-6 p-0"
                onClick={handleOpenEdit}
                title="Editar meta"
              >
                <Pencil className="h-3 w-3" />
              </Button>
            )}
          </div>
          <div className="hidden text-[10px] text-muted-foreground mb-1 md:block">{capitalizedMonth}</div>
          <div className="truncate text-base font-bold md:text-xl">R$ {formatCurrency(goalValue)}</div>
          {goalValue > 0 && (
            <>
              <p className={`text-[10px] font-medium ${remaining > 0 ? 'text-muted-foreground' : 'text-success'}`}>
                {progressPercent.toFixed(1)}% da meta
              </p>
              {paceInfo && (
                <p className={`hidden text-[10px] font-medium md:block ${paceInfo.isOnTrack ? 'text-success' : 'text-destructive'}`}>
                  {paceInfo.isOnTrack ? `✅ +R$ ${formatCurrency(Math.abs(paceInfo.diff))} acima` : `⚠️ Faltam R$ ${formatCurrency(Math.abs(paceInfo.diff))} p/ dia ${paceInfo.currentDay}`}
                </p>
              )}
            </>
          )}
        </Card>

        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{dialogTitle}</DialogTitle>
              <DialogDescription>
                {capitalizedMonth}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); handleSaveGoal(); }} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="goal-value-compact">Meta Mensal</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">R$</span>
                  <Input
                    id="goal-value-compact"
                    type="text"
                    placeholder="0,00"
                    className="pl-10"
                    value={editGoalValue}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, '');
                      const formatted = (parseInt(value || '0') / 100).toFixed(2).replace('.', ',');
                      setEditGoalValue(formatted);
                    }}
                    autoFocus
                  />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={isSaving}>
                {isSaving ? 'Salvando...' : 'Salvar Meta'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              {cardTitle}
            </CardTitle>
            {canEdit && (
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-7 w-7 p-0"
                onClick={handleOpenEdit}
                title="Editar meta"
              >
                <Pencil className="h-4 w-4" />
              </Button>
            )}
          </div>
          <div className="text-xs text-muted-foreground mt-1">{capitalizedMonth}</div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <div className="text-2xl font-bold">R$ {formatCurrency(goalValue)}</div>
            <div className="text-xs text-muted-foreground">Meta mensal</div>
          </div>
          
          {goalValue > 0 && (
            <>
              <Progress value={progressPercent} className="h-2" />
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <div className="text-xs text-muted-foreground">Realizado</div>
                  <div className="font-medium">R$ {formatCurrency(currentProfit)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">
                    {remaining > 0 ? 'Falta' : 'Excedente'}
                  </div>
                  <div className={`font-medium ${remaining > 0 ? 'text-warning' : 'text-success'}`}>
                    R$ {formatCurrency(Math.abs(remaining))}
                  </div>
                </div>
              </div>
              <div className="text-center text-sm font-medium">
                <span className={remaining > 0 ? 'text-muted-foreground' : 'text-success'}>
                  {progressPercent.toFixed(1)}% da meta
                </span>
              </div>
              {paceInfo && (
                <div className={`text-center text-xs font-medium p-2 rounded-md ${paceInfo.isOnTrack ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}`}>
                  {paceInfo.isOnTrack ? (
                    <>✅ +R$ {formatCurrency(Math.abs(paceInfo.diff))} acima da meta</>
                  ) : (
                    <>⚠️ Atrasado — precisa de R$ {formatCurrency(Math.abs(paceInfo.diff))} para estar no dia {paceInfo.currentDay}</>
                  )}
                  <div className="text-[10px] mt-1 opacity-70">
                    Meta diária: R$ {formatCurrency(paceInfo.dailyTarget)} • Esperado até hoje: R$ {formatCurrency(paceInfo.expectedByToday)}
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialogTitle}</DialogTitle>
            <DialogDescription>
              {capitalizedMonth}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); handleSaveGoal(); }} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="goal-value-full">Meta Mensal</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">R$</span>
                <Input
                  id="goal-value-full"
                  type="text"
                  placeholder="0,00"
                  className="pl-10"
                  value={editGoalValue}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '');
                    const formatted = (parseInt(value || '0') / 100).toFixed(2).replace('.', ',');
                    setEditGoalValue(formatted);
                  }}
                  autoFocus
                />
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={isSaving}>
              {isSaving ? 'Salvando...' : 'Salvar Meta'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
