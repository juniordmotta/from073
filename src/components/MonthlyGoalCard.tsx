import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Pencil, Check, X, Target } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Progress } from '@/components/ui/progress';
import { useGoalNotifications } from '@/hooks/useGoalNotifications';

interface MonthlyGoalCardProps {
  userId: string;
  partnershipId?: string;
  currentProfit: number;
  compact?: boolean;
}

export function MonthlyGoalCard({ userId, partnershipId, currentProfit, compact = false }: MonthlyGoalCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [goalValue, setGoalValue] = useState<number>(0);
  const [editValue, setEditValue] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const currentMonth = new Date().toISOString().slice(0, 7) + '-01'; // YYYY-MM-01

  useEffect(() => {
    fetchGoal();
  }, [userId, partnershipId, currentMonth]);

  const fetchGoal = async () => {
    try {
      const { data, error } = await supabase
        .from('monthly_goals')
        .select('goal_value')
        .eq('user_id', userId)
        .eq('month', currentMonth)
        .eq('partnership_id', partnershipId || null)
        .maybeSingle();

      if (error) throw error;
      
      if (data) {
        setGoalValue(data.goal_value);
      }
    } catch (error) {
      console.error('Erro ao buscar meta:', error);
    }
  };

  const handleSave = async () => {
    const newValue = parseFloat(editValue);
    if (isNaN(newValue) || newValue < 0) {
      toast({
        title: 'Valor inválido',
        description: 'Por favor, insira um valor válido',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('monthly_goals')
        .upsert({
          user_id: userId,
          partnership_id: partnershipId || null,
          month: currentMonth,
          goal_value: newValue,
        }, {
          onConflict: 'user_id,partnership_id,month',
        });

      if (error) throw error;

      setGoalValue(newValue);
      setIsEditing(false);
      toast({
        title: 'Meta atualizada',
        description: 'Meta mensal atualizada com sucesso',
      });
    } catch (error) {
      console.error('Erro ao salvar meta:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível salvar a meta',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = () => {
    setEditValue(goalValue.toString());
    setIsEditing(true);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditValue('');
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
        {isEditing ? (
          <div className="space-y-1">
            <Input
              type="number"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="h-8 text-sm"
              disabled={loading}
            />
            <div className="flex gap-1">
              <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={handleSave} disabled={loading}>
                <Check className="h-3 w-3" />
              </Button>
              <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={handleCancel} disabled={loading}>
                <X className="h-3 w-3" />
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-1">
              <span className="text-xl font-bold">R$ {formatCurrency(goalValue)}</span>
              <Button size="icon" variant="ghost" className="h-5 w-5 p-0" onClick={handleEdit}>
                <Pencil className="h-3 w-3" />
              </Button>
            </div>
            {goalValue > 0 && (
              <p className="text-[10px] text-muted-foreground">
                {progressPercent.toFixed(1)}% • {remaining > 0 ? `Falta R$ ${formatCurrency(remaining)}` : 'Atingida!'}
              </p>
            )}
          </>
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
        {isEditing ? (
          <div className="space-y-2">
            <Input
              type="number"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              placeholder="Digite a meta"
              disabled={loading}
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSave} disabled={loading} className="flex-1">
                <Check className="h-4 w-4 mr-1" />
                Salvar
              </Button>
              <Button size="sm" variant="outline" onClick={handleCancel} disabled={loading}>
                <X className="h-4 w-4 mr-1" />
                Cancelar
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold">R$ {formatCurrency(goalValue)}</div>
                <div className="text-xs text-muted-foreground">Meta mensal</div>
              </div>
              <Button size="icon" variant="outline" onClick={handleEdit}>
                <Pencil className="h-4 w-4" />
              </Button>
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
          </>
        )}
      </CardContent>
    </Card>
  );
}
