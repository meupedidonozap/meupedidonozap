import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Order, CustomerInfo, CartItem, PaymentMethod, DeliveryShift, OrderStatus } from '@/types';

function mapOrder(row: any): Order {
  return {
    id: row.id,
    storeId: row.store_id,
    orderNumber: row.order_number,
    customer: row.customer as CustomerInfo,
    items: row.items as CartItem[],
    subtotal: Number(row.subtotal),
    discount: Number(row.discount),
    deliveryFee: Number(row.delivery_fee),
    total: Number(row.total),
    paymentMethod: row.payment_method as PaymentMethod,
    deliveryShift: row.delivery_shift as DeliveryShift,
    observations: row.observations || undefined,
    status: row.status as OrderStatus,
    createdAt: row.created_at,
  };
}

export function useOrders(storeId: string | undefined) {
  return useQuery({
    queryKey: ['orders', storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('store_id', storeId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []).map(mapOrder);
    },
    enabled: !!storeId,
    staleTime: 30_000,
  });
}

export function useCreateOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (order: Omit<Order, 'id' | 'orderNumber' | 'createdAt'>) => {
      // Get current user id if logged in
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id || null;

      const { data, error } = await supabase.from('orders').insert({
        store_id: order.storeId,
        customer: order.customer as any,
        items: order.items as any,
        subtotal: order.subtotal,
        discount: order.discount,
        delivery_fee: order.deliveryFee,
        total: order.total,
        payment_method: order.paymentMethod,
        delivery_shift: order.deliveryShift,
        observations: order.observations || null,
        status: order.status,
        user_id: userId,
      }).select().single();
      if (error) throw error;
      return mapOrder(data);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['orders'] }),
  });
}

export function useUpdateOrderStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: OrderStatus }) => {
      const { error } = await supabase.from('orders').update({ status }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['orders'] }),
  });
}

export function useUpdateOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status, total, subtotal }: { id: string; status?: OrderStatus; total?: number; subtotal?: number }) => {
      const update: any = {};
      if (status) update.status = status;
      if (total !== undefined) update.total = total;
      if (subtotal !== undefined) update.subtotal = subtotal;
      const { error } = await supabase.from('orders').update(update).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['orders'] }),
  });
}
