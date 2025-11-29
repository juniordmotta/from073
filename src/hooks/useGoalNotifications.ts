import { useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';

interface UseGoalNotificationsProps {
  goalValue: number;
  currentProfit: number;
  userId: string;
  partnershipId?: string;
}

export function useGoalNotifications({ goalValue, currentProfit, userId, partnershipId }: UseGoalNotificationsProps) {
  const { toast } = useToast();
  
  useEffect(() => {
    if (goalValue <= 0) return;
    
    const currentMonth = new Date().toISOString().slice(0, 7);
    const storageKey = `goal_notifications_${userId}_${partnershipId || 'general'}_${currentMonth}`;
    
    // Recuperar notificações já mostradas neste mês
    const notifiedMilestones = JSON.parse(localStorage.getItem(storageKey) || '[]') as number[];
    
    const progressPercent = (currentProfit / goalValue) * 100;
    
    // Definir os marcos de notificação
    const milestones = [
      { percent: 50, message: '🎯 Metade da meta atingida! Continue assim!' },
      { percent: 75, message: '🚀 75% da meta alcançados! Você está quase lá!' },
      { percent: 100, message: '🎉 Parabéns! Meta mensal atingida!' },
    ];
    
    // Verificar qual marco foi atingido
    for (const milestone of milestones) {
      if (progressPercent >= milestone.percent && !notifiedMilestones.includes(milestone.percent)) {
        // Adicionar marco às notificações já mostradas
        const updatedMilestones = [...notifiedMilestones, milestone.percent];
        localStorage.setItem(storageKey, JSON.stringify(updatedMilestones));
        
        // Mostrar notificação
        toast({
          title: milestone.message,
          description: `Meta: R$ ${goalValue.toFixed(2)} | Realizado: R$ ${currentProfit.toFixed(2)} (${progressPercent.toFixed(1)}%)`,
          duration: 5000,
        });
        
        // Mostrar apenas uma notificação por vez
        break;
      }
    }
  }, [goalValue, currentProfit, userId, partnershipId, toast]);
}
