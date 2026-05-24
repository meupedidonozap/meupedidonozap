import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface StorePermissions {
  can_view_service_orders: boolean;
  can_manage_service_orders: boolean;
  can_view_orders: boolean;
  can_manage_orders: boolean;
  can_manage_products: boolean;
  can_view_customers: boolean;
  can_manage_tables: boolean;
}

const FULL_PERMS: StorePermissions = {
  can_view_service_orders: true,
  can_manage_service_orders: true,
  can_view_orders: true,
  can_manage_orders: true,
  can_manage_products: true,
  can_view_customers: true,
  can_manage_tables: true,
};

const NO_PERMS: StorePermissions = {
  can_view_service_orders: false,
  can_manage_service_orders: false,
  can_view_orders: false,
  can_manage_orders: false,
  can_manage_products: false,
  can_view_customers: false,
  can_manage_tables: false,
};

export function useStoreAdmin(storeId: string | undefined) {
  const { user, loading: authLoading } = useAuth();

  const { data, isLoading: accessLoading } = useQuery({
    queryKey: ['store-access', storeId, user?.id],
    queryFn: async () => {
      if (!user || !storeId) {
        return { isAdmin: false, isStoreUser: false, permissions: NO_PERMS, sellerCodes: [] as string[] };
      }
      // Check primary admin
      const { data: adminRow } = await supabase
        .from('store_admins')
        .select('id')
        .eq('store_id', storeId)
        .eq('user_id', user.id)
        .maybeSingle();
      if (adminRow) {
        return { isAdmin: true, isStoreUser: false, permissions: FULL_PERMS, sellerCodes: [] as string[] };
      }
      // Check secondary store user
      const { data: storeUser } = await supabase
        .from('store_users')
        .select('can_view_service_orders, can_manage_service_orders, can_view_orders, can_manage_orders, can_manage_products, can_view_customers, can_manage_tables, is_active, seller_codes')
        .eq('store_id', storeId)
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle();
      if (storeUser) {
        return {
          isAdmin: false,
          isStoreUser: true,
          permissions: {
            can_view_service_orders: !!storeUser.can_view_service_orders,
            can_manage_service_orders: !!storeUser.can_manage_service_orders,
            can_view_orders: !!storeUser.can_view_orders,
            can_manage_orders: !!storeUser.can_manage_orders,
            can_manage_products: !!storeUser.can_manage_products,
            can_view_customers: !!storeUser.can_view_customers,
            can_manage_tables: !!(storeUser as any).can_manage_tables,
          },
          sellerCodes: (((storeUser as any).seller_codes) ?? []) as string[],
        };
      }
      return { isAdmin: false, isStoreUser: false, permissions: NO_PERMS, sellerCodes: [] as string[] };
    },
    enabled: !!user && !!storeId,
    staleTime: 5 * 60 * 1000,
  });

  const access = data ?? { isAdmin: false, isStoreUser: false, permissions: NO_PERMS, sellerCodes: [] as string[] };
  // hasAccess = is admin OR is active store user with at least one permission
  const hasAnyPermission = Object.values(access.permissions).some(Boolean);
  const hasAccess = access.isAdmin || (access.isStoreUser && hasAnyPermission);

  return {
    user,
    isAdmin: access.isAdmin,
    isStoreUser: access.isStoreUser,
    hasAccess,
    permissions: access.permissions,
    sellerCodes: access.sellerCodes,
    loading: authLoading || accessLoading,
  };
}
