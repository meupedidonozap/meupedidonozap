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
    origem: row.origem || 'web',
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
        .order('created_at', { ascending: false })
        .range(0, 4999);
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
      // Get current user id if logged in (server-validated)
      const { data: { user: authUser } } = await supabase.auth.getUser();
      const userId = authUser?.id || null;

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
        origem: (order as any).origem || 'web',
      }).select().single();
      if (error) {
        // Log diagnostic record (best-effort, never blocks the error)
        try {
          await (supabase as any).from('order_create_errors').insert({
            store_id: order.storeId,
            user_id: userId,
            error_message: error.message || String(error),
            error_code: (error as any).code || null,
            payload_summary: {
              items_count: Array.isArray(order.items) ? order.items.length : 0,
              total: order.total,
              payment_method: order.paymentMethod,
              origem: (order as any).origem || 'web',
              status: order.status,
            },
            user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
          });
        } catch (_) {}
        throw error;
      }
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

export function useDeleteOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string; storeId?: string }) => {
      // Limpa itens vinculados a este pedido nas comandas das mesas
      // (tab_items.paid_order_id), para que o pedido suma da mesa também.
      const { error: tabErr } = await (supabase as any)
        .from('tab_items')
        .delete()
        .eq('paid_order_id', id);
      if (tabErr) throw tabErr;
      const { error } = await supabase.from('orders').delete().eq('id', id);
      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orders'] });
      qc.invalidateQueries({ queryKey: ['tab_items'] });
    },
  });
}

export function useUpdateOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status, total, subtotal, items, discount, observations, customer }: { id: string; status?: OrderStatus; total?: number; subtotal?: number; items?: CartItem[]; discount?: number; observations?: string | null; customer?: CustomerInfo }) => {
      const update: any = {};
      if (status) update.status = status;
      if (total !== undefined) update.total = total;
      if (subtotal !== undefined) update.subtotal = subtotal;
      if (items !== undefined) update.items = items as any;
      if (discount !== undefined) update.discount = discount;
      if (observations !== undefined) update.observations = observations;
      if (customer !== undefined) update.customer = customer as any;
      const { data, error } = await supabase.from('orders').update(update).eq('id', id).select().maybeSingle();
      if (error) throw error;
      return data ? mapOrder(data) : null;
    },
    onSuccess: (updated) => {
      if (updated) {
        qc.setQueryData<Order[]>(['orders', updated.storeId], (old) =>
          old ? old.map(o => o.id === updated.id ? updated : o) : [updated]
        );
      }
      qc.invalidateQueries({ queryKey: ['orders'] });
    },
  });
}
