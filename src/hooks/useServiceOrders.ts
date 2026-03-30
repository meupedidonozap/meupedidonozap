import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { ServiceOrder, ServiceOrderExtraItem, ServiceOrderStatus, CartItem, CustomerInfo } from '@/types';

function mapRow(row: any): ServiceOrder {
  return {
    id: row.id,
    storeId: row.store_id,
    orderId: row.order_id || undefined,
    osNumber: row.os_number,
    customer: row.customer as CustomerInfo,
    items: row.items as CartItem[],
    extraItems: (row.extra_items || []) as ServiceOrderExtraItem[],
    subtotal: Number(row.subtotal),
    discount: Number(row.discount),
    total: Number(row.total),
    status: row.status as ServiceOrderStatus,
    observations: row.observations || undefined,
    paidAt: row.paid_at || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    userId: row.user_id || undefined,
  };
}

export function useServiceOrders(storeId: string | undefined) {
  return useQuery({
    queryKey: ['service-orders', storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('service_orders')
        .select('*')
        .eq('store_id', storeId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []).map(mapRow);
    },
    enabled: !!storeId,
  });
}

export function useCreateServiceOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      storeId: string;
      orderId?: string;
      orderNumber?: number;
      customer: CustomerInfo;
      items: CartItem[];
      subtotal: number;
      discount: number;
      total: number;
      userId?: string;
      observations?: string;
    }) => {
      const insertData: any = {
        store_id: params.storeId,
        order_id: params.orderId || null,
        customer: params.customer as any,
        items: params.items as any,
        extra_items: [] as any,
        subtotal: params.subtotal,
        discount: params.discount,
        total: params.total,
        user_id: params.userId || null,
        observations: params.observations || null,
        status: 'aberta',
      };
      if (params.orderNumber !== undefined) {
        insertData.os_number = params.orderNumber;
      }
      const { data, error } = await supabase
        .from('service_orders')
        .insert(insertData)
        .select()
        .single();
      if (error) throw error;
      return mapRow(data);
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['service-orders', data.storeId] });
    },
  });
}

export function useUpdateServiceOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      id: string;
      storeId: string;
      items?: CartItem[];
      extraItems?: ServiceOrderExtraItem[];
      subtotal?: number;
      discount?: number;
      total?: number;
      status?: ServiceOrderStatus;
      observations?: string;
      paidAt?: string | null;
    }) => {
      const update: any = {};
      if (params.items !== undefined) update.items = params.items;
      if (params.extraItems !== undefined) update.extra_items = params.extraItems;
      if (params.subtotal !== undefined) update.subtotal = params.subtotal;
      if (params.discount !== undefined) update.discount = params.discount;
      if (params.total !== undefined) update.total = params.total;
      if (params.status !== undefined) update.status = params.status;
      if (params.observations !== undefined) update.observations = params.observations;
      if (params.paidAt !== undefined) update.paid_at = params.paidAt;

      const { data, error } = await supabase
        .from('service_orders')
        .update(update)
        .eq('id', params.id)
        .select()
        .single();
      if (error) throw error;
      return mapRow(data);
    },
    onSuccess: (updated) => {
      // Immediate cache update
      qc.setQueryData<ServiceOrder[]>(['service-orders', updated.storeId], (old) =>
        old ? old.map(so => so.id === updated.id ? updated : so) : [updated]
      );
      qc.invalidateQueries({ queryKey: ['service-orders', updated.storeId] });
    },
  });
}

export function useDeleteServiceOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, storeId }: { id: string; storeId: string }) => {
      const { error } = await supabase
        .from('service_orders')
        .delete()
        .eq('id', id);
      if (error) throw error;
      return { storeId };
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['service-orders', data.storeId] });
    },
  });
}
