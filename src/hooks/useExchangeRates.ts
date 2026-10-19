import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { Rates } from '@/lib/currency';
export function useExchangeRates() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['exchange-rates', user?.id], enabled: Boolean(user), staleTime: 15 * 60 * 1000, refetchInterval: 15 * 60 * 1000,
    queryFn: async (): Promise<Rates> => {
      const { data, error } = await supabase.functions.invoke('exchange-rates');
      if (error || !data?.brl || !(data.brl.USD > 0) || !(data.brl.EUR > 0)) throw new Error('Cotação indisponível');
      return data;
    },
  });
}