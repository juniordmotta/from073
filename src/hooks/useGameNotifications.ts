import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface Arbitrage {
  id: string;
  descricao: string;
  data_evento: string;
  casa_01_nome: string;
  casa_02_nome: string;
  casa_03_nome?: string;
  status: string;
}

interface UseGameNotificationsProps {
  userId?: string;
  enabled?: boolean;
}

export const useGameNotifications = ({ userId, enabled = true }: UseGameNotificationsProps) => {
  const notifiedGamesRef = useRef<Set<string>>(new Set());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const requestNotificationPermission = async () => {
    if ('Notification' in window && Notification.permission === 'default') {
      await Notification.requestPermission();
    }
  };

  const showNotification = (arb: Arbitrage) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      const casas = [arb.casa_01_nome, arb.casa_02_nome, arb.casa_03_nome].filter(Boolean).join(', ');
      const dataEvento = new Date(arb.data_evento);
      const horario = dataEvento.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

      new Notification('🎯 Jogo Começando Agora!', {
        body: `${arb.descricao}\nHorário: ${horario}\nCasas: ${casas}`,
        icon: '/favicon.ico',
        tag: arb.id,
        requireInteraction: true,
      });
    }
  };

  const checkUpcomingGames = async () => {
    if (!userId || !enabled) return;

    try {
      const now = new Date();
      const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60000);

      const { data, error } = await supabase
        .from('arbitrages')
        .select('id, descricao, data_evento, casa_01_nome, casa_02_nome, casa_03_nome, status')
        .eq('user_id', userId)
        .eq('status', 'aguardando')
        .gte('data_evento', now.toISOString())
        .lte('data_evento', fiveMinutesFromNow.toISOString())
        .limit(10);

      if (error) {
        // Silently fail for operators without access
        console.warn('Erro ao verificar jogos próximos:', error.message);
        return;
      }

      data?.forEach((arb: Arbitrage) => {
        const dataEvento = new Date(arb.data_evento);
        const minutesUntilStart = Math.floor((dataEvento.getTime() - now.getTime()) / 60000);

        // Notificar quando faltarem 0-1 minutos
        if (minutesUntilStart <= 1 && !notifiedGamesRef.current.has(arb.id)) {
          showNotification(arb);
          notifiedGamesRef.current.add(arb.id);
        }
      });

      // Limpar jogos antigos do cache (mais de 10 minutos atrás)
      const tenMinutesAgo = new Date(now.getTime() - 10 * 60000);
      notifiedGamesRef.current.forEach(gameId => {
        const game = data?.find(g => g.id === gameId);
        if (!game || new Date(game.data_evento) < tenMinutesAgo) {
          notifiedGamesRef.current.delete(gameId);
        }
      });
    } catch (error) {
      // Don't log errors that might flood the console
    }
  };

  useEffect(() => {
    if (!enabled || !userId) return;

    // Solicitar permissão para notificações
    requestNotificationPermission();

    // Verificar imediatamente
    checkUpcomingGames();

    // Verificar a cada 60 segundos (reduzido de 30s para menos carga)
    intervalRef.current = setInterval(checkUpcomingGames, 60000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, enabled]);

  return { requestNotificationPermission };
};
