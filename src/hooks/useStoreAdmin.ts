import { useIsRestoring, useQuery } from '@tanstack/react-query';
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
  can_change_price_table: boolean;
  can_manage_categories: boolean;
  can_view_atendimento: boolean;
  can_view_discounts: boolean;
  can_manage_discounts: boolean;
  can_manage_customers: boolean;
  can_view_wishlist: boolean;
  can_manage_technical_materials: boolean;
}

const FULL_PERMS: StorePermissions = {
  can_view_service_orders: true,
  can_manage_service_orders: true,
  can_view_orders: true,
  can_manage_orders: true,
  can_manage_products: true,
  can_view_customers: true,
  can_manage_tables: true,
  can_change_price_table: true,
  can_manage_categories: true,
  can_view_atendimento: true,
  can_view_discounts: true,
  can_manage_discounts: true,
  can_manage_customers: true,
  can_view_wishlist: true,
  can_manage_technical_materials: true,
};

const NO_PERMS: StorePermissions = {
  can_view_service_orders: false,
  can_manage_service_orders: false,
  can_view_orders: false,
  can_manage_orders: false,
  can_manage_products: false,
  can_view_customers: false,
  can_manage_tables: false,
  can_change_price_table: false,
  can_manage_categories: false,
  can_view_atendimento: false,
  can_view_discounts: false,
  can_manage_discounts: false,
  can_manage_customers: false,
  can_view_wishlist: false,
  can_manage_technical_materials: false,
};

/** One authorized response defines both permissions and commercial identity. */
export async function loadStoreAccess(storeId: string, userId: string) {
  const [platformResult, adminResult, staffResult] = await Promise.all([
    supabase.from('platform_admins').select('user_id').eq('user_id', userId).maybeSingle(),
    supabase.from('store_admins').select('id').eq('store_id', storeId).eq('user_id', userId).maybeSingle(),
    supabase.from('store_users')
      .select('name, erp_code, role, seller_codes, can_view_service_orders, can_manage_service_orders, can_view_orders, can_manage_orders, can_manage_products, can_view_customers, can_manage_tables, can_change_price_table, can_manage_categories, can_view_atendimento, can_view_discounts, can_manage_discounts, can_manage_customers, can_view_wishlist, can_manage_technical_materials, is_active')
      .eq('store_id', storeId).eq('user_id', userId).eq('is_active', true).order('id').limit(1),
  ]);
  if (platformResult.error) throw platformResult.error;
  if (adminResult.error) throw adminResult.error;
  if (staffResult.error) throw staffResult.error;
  const staff = staffResult.data?.[0];
  const isAdmin = !!(platformResult.data || adminResult.data);
  const staffSellerCodes = (staff?.seller_codes || []).map(c => String(c).trim()).filter(Boolean);
  const permissions = isAdmin ? FULL_PERMS : staff
    ? Object.fromEntries((Object.keys(NO_PERMS) as (keyof StorePermissions)[]).map(key => [key, !!staff[key]])) as unknown as StorePermissions
    : NO_PERMS;
  return {
    isAdmin,
    isStoreUser: !isAdmin && !!staff,
    permissions,
    sellerCodes: isAdmin ? [] : staffSellerCodes,
    staffSellerCodes,
    role: staff?.role || '',
    sellerName: staff?.name || '',
    erpCode: String(staff?.erp_code || '').trim(),
  };
}

export function useStoreAdmin(storeId: string | undefined) {
  const { user, loading: authLoading } = useAuth();
  const restoring = useIsRestoring();
  const { data, isPending, error, refetch } = useQuery({
    // Ignore previously persisted partial identities; this result lives in memory only.
    queryKey: ['store-access', storeId, user?.id, 'identity-v2'],
    queryFn: async () => {
      if (!user || !storeId) throw new Error('Acesso sem usuário ou loja');
      return loadStoreAccess(storeId, user.id);
    },
    enabled: !!user && !!storeId,
    staleTime: 60 * 1000,
    retry: 3,
    networkMode: 'online',
    refetchOnWindowFocus: true,
  });
  // A previous user's response must not survive an account change or logout.
  const access = user ? data : undefined;
  const permissions = access?.permissions ?? NO_PERMS;
  const hasAnyPermission = Object.values(permissions).some(Boolean);
  const hasAccess = !!access && (access.isAdmin || (access.isStoreUser && (hasAnyPermission || access.sellerCodes.length > 0)));
  return {
    user,
    isAdmin: access?.isAdmin ?? false,
    isStoreUser: access?.isStoreUser ?? false,
    hasAccess,
    permissions,
    sellerCodes: access?.sellerCodes ?? [],
    staffSellerCodes: access?.staffSellerCodes ?? [],
    role: access?.role || '',
    sellerName: access?.sellerName || '',
    erpCode: access?.erpCode || '',
    accessError: !access ? error : null,
    retryAccess: refetch,
    loading: authLoading || (!!user && !!storeId && (restoring || isPending)),
  };
}
