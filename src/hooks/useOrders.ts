import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getCustomerError } from '@/lib/customerValidation';
import { supabase } from '@/integrations/supabase/client';
import type { Order, CustomerInfo, CartItem, PaymentMethod, DeliveryShift, OrderStatus } from '@/types';

export function mapOrder(row: any): Order {
  return {
    id: row.id,
    storeId: row.store_id,
    userId: row.user_id ?? null,
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
    paymentStatus: row.payment_status || 'not_required',
    paymentError: row.payment_error || null,
    paymentManualRecord: row.payment_manual_record || undefined,
    paymentSessionId: row.payment_session_id || undefined,
    paymentEnvironment: row.payment_environment || undefined,
    paidAt: row.paid_at || undefined,
    shippingService: row.shipping_service || undefined,
    shippingCode: row.shipping_code || undefined,
    shippingDeadline: row.shipping_deadline ?? undefined,
    superfreteId: row.superfrete_id || undefined,
    superfreteStatus: row.superfrete_status || undefined,
    superfreteError: row.superfrete_error || undefined,
    shippingTracking: row.shipping_tracking || undefined,
    xmlDownloadedAt: row.xml_downloaded_at || undefined,
    erpOrderCode: row.erp_order_code || undefined,
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
      const customerError = getCustomerError(order.customer);
      if (customerError) throw new Error(customerError);
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
        payment_status: order.paymentStatus || 'not_required',
        payment_session_id: order.paymentSessionId || null,
        payment_environment: order.paymentEnvironment || null,
        paid_at: order.paidAt || null,
        shipping_service: order.shippingService || null,
        shipping_code: order.shippingCode || null,
        shipping_deadline: order.shippingDeadline ?? null,
        client_order_id: (order as any).clientOrderId || null,
      }).select().single();
      if (error && (error as any).code === '23505' && (order as any).clientOrderId) {
        // Mesmo carrinho já salvo: devolve o pedido existente em vez de duplicar.
        const { data: existing } = await supabase.from('orders').select('*')
          .eq('store_id', order.storeId).eq('client_order_id', (order as any).clientOrderId).maybeSingle();
        if (existing) return { ...existing, __duplicate: true } as any;
      }
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
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['orders'] }); qc.invalidateQueries({ queryKey: ['seller-orders'] }); },
  });
}

export function useUpdateOrderStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: OrderStatus }) => {
      const { error } = await supabase.from('orders').update({ status }).eq('id', id);
      if (error) throw error;
      if (status === 'cancelado') {
        const { data } = await supabase.functions.invoke('superfrete-label', { body: { action: 'cancel', orderId: id } });
        if (data?.error) throw new Error(`Pedido cancelado, mas o SuperFrete recusou o cancelamento da etiqueta: ${data.error}`);
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['orders'] }); qc.invalidateQueries({ queryKey: ['seller-orders'] }); },
  });
}

/** Marca o XML como baixado (bloqueia edição) e opcionalmente muda o status. */
export function useMarkOrderXmlDownloaded() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status?: OrderStatus }) => {
      const update: any = { xml_downloaded_at: new Date().toISOString() };
      if (status) update.status = status;
      const { error } = await supabase.from('orders').update(update).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['orders'] }); qc.invalidateQueries({ queryKey: ['seller-orders'] }); },
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
