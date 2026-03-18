import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffect } from 'react';

// Track a visit once per session
export function useTrackVisit(storeId: string | undefined) {
  const mutation = useMutation({
    mutationFn: async (sid: string) => {
      await supabase.from('store_visits').insert({
        store_id: sid,
        page: window.location.pathname,
        user_agent: navigator.userAgent.slice(0, 200),
        ip_hash: '',
      });
    },
  });

  useEffect(() => {
    if (!storeId) return;
    const key = `visited_${storeId}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, '1');
    mutation.mutate(storeId);
  }, [storeId]);
}

export interface VisitsByDay {
  date: string;
  count: number;
}

export interface VisitsByHour {
  hour: number;
  count: number;
}

export function useStoreVisits(storeId: string | undefined, startDate?: Date, endDate?: Date) {
  const totalQuery = useQuery({
    queryKey: ['store-visits-total', storeId],
    queryFn: async () => {
      const { count } = await supabase
        .from('store_visits')
        .select('*', { count: 'exact', head: true })
        .eq('store_id', storeId!);
      return count ?? 0;
    },
    enabled: !!storeId,
  });

  const dailyQuery = useQuery({
    queryKey: ['store-visits-daily', storeId, startDate?.toISOString(), endDate?.toISOString()],
    queryFn: async () => {
      let query = supabase
        .from('store_visits')
        .select('visited_at')
        .eq('store_id', storeId!)
        .order('visited_at', { ascending: true });

      if (startDate) {
        query = query.gte('visited_at', startDate.toISOString());
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query = query.lte('visited_at', end.toISOString());
      }

      const { data } = await query;
      if (!data) return { byDay: [] as VisitsByDay[], byHour: [] as VisitsByHour[] };

      // Aggregate by day
      const dayMap = new Map<string, number>();
      const hourMap = new Map<number, number>();

      for (const row of data) {
        const d = new Date(row.visited_at);
        const dayKey = d.toISOString().slice(0, 10);
        dayMap.set(dayKey, (dayMap.get(dayKey) || 0) + 1);
        const h = d.getHours();
        hourMap.set(h, (hourMap.get(h) || 0) + 1);
      }

      const byDay: VisitsByDay[] = Array.from(dayMap.entries())
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => a.date.localeCompare(b.date));

      const byHour: VisitsByHour[] = Array.from({ length: 24 }, (_, i) => ({
        hour: i,
        count: hourMap.get(i) || 0,
      }));

      return { byDay, byHour };
    },
    enabled: !!storeId,
  });

  return {
    total: totalQuery.data ?? 0,
    byDay: dailyQuery.data?.byDay ?? [],
    byHour: dailyQuery.data?.byHour ?? [],
    isLoading: totalQuery.isLoading || dailyQuery.isLoading,
  };
}
