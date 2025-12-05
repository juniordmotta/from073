import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Target } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { Progress } from '@/components/ui/progress';
import { useGoalNotifications } from '@/hooks/useGoalNotifications';

interface MonthlyGoalCardProps {
  userId: string;
  selectedUserIds?: string[]; // Array de IDs de usuários filtrados
  partnershipId?: string;
  currentProfit: number;
  compact?: boolean;
}

export function MonthlyGoalCard({ userId, selectedUserIds, partnershipId, currentProfit, compact = false }: MonthlyGoalCardProps) {
  const [goalValue, setGoalValue] = useState<number>(0);

  const currentMonth = new Date().toISOString().slice(0, 7) + '-01'; // YYYY-MM-01

  useEffect(() => {
    fetchGoal();
  }, [userId, selectedUserIds, partnershipId, currentMonth]);

  const fetchGoal = async () => {
    try {
      // Se tiver selectedUserIds, buscar metas de todos os usuários selecionados
      const userIdsToFetch = selectedUserIds && selectedUserIds.length > 0 
        ? selectedUserIds 
        : [userId];

      const { data, error } = await supabase
        .from('monthly_goals')
        .select('goal_value, user_id')
        .in('user_id', userIdsToFetch)
        .eq('month', currentMonth)
        .is('partnership_id', null);

      if (error) throw error;
      
      if (data && data.length > 0) {
        // Somar todas as metas dos usuários selecionados
        const totalGoal = data.reduce((sum, goal) => sum + Number(goal.goal_value), 0);
        setGoalValue(totalGoal);
      } else {
        setGoalValue(0);
      }
    } catch (error) {
      console.error('Erro ao buscar meta:', error);
    }
  };

  const progressPercent = goalValue > 0 ? Math.min((currentProfit / goalValue) * 100, 100) : 0;
  const remaining = goalValue - currentProfit;

  // Hook de notificações
  useGoalNotifications({
    goalValue,
    currentProfit,
    userId,
    partnershipId,
  });

  if (compact) {
    return (
      <Card className="p-3">
        <div className="flex items-center gap-2 mb-1">
          <Target className="h-3 w-3 text-primary" />
          <span className="text-xs text-muted-foreground">Meta do Mês</span>
        </div>
        <div className="text-xl font-bold">R$ {formatCurrency(goalValue)}</div>
        {goalValue > 0 && (
          <p className={`text-[10px] font-medium ${remaining > 0 ? 'text-muted-foreground' : 'text-success'}`}>
            {progressPercent.toFixed(1)}% da meta
          </p>
        )}
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Target className="h-4 w-4 text-primary" />
          Meta do Mês
        </CardTitle>
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
          </>
        )}
      </CardContent>
    </Card>
  );
}
