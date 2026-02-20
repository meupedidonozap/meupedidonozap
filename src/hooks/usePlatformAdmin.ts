import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

export function usePlatformAdmin() {
  const { user, loading: authLoading } = useAuth();

  const { data: isAdmin = false, isLoading: adminLoading } = useQuery({
    queryKey: ['platform-admin', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('platform_admins')
        .select('id')
        .eq('user_id', user!.id)
        .maybeSingle();
      return !!data;
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });

  return { user, isAdmin, loading: authLoading || (!!user && adminLoading) };
}
