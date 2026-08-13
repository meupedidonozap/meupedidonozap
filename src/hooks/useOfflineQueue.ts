import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  listQueueForStore,
  removeFromQueue,
  subscribeQueue,
  updateQueued,
  isOnline,
  type QueuedOrder,
} from '@/lib/offlineQueue';

async function sendOne(item: QueuedOrder): Promise<void> {
  const order = item.payload;
  const { data: { user: authUser } } = await supabase.auth.getUser();
  const userId = authUser?.id || null;

  // Idempotência: se já foi gravado antes (retry), não duplica
  const { data: existing } = await (supabase as any)
    .from('orders')
    .select('id')
    .eq('store_id', order.storeId)
    .eq('client_order_id', item.id)
    .maybeSingle();
  if (existing) return;

  const { error } = await (supabase as any).from('orders').insert({
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
    origem: order.origem || 'web',
    client_order_id: item.id,
  });
  if (error) {
    // 23505 = violação de unicidade → pedido já existe no servidor
    if ((error as any).code === '23505') return;
    throw error;
  }
}

export function useOfflineQueue(storeId: string | undefined) {
  const qc = useQueryClient();
  const [queue, setQueue] = useState<QueuedOrder[]>([]);
  const [syncing, setSyncing] = useState(false);
  const running = useRef(false);

  const refresh = useCallback(async () => {
    setQueue(await listQueueForStore(storeId));
  }, [storeId]);

  useEffect(() => {
    void refresh();
    return subscribeQueue(() => { void refresh(); });
  }, [refresh]);

  const sync = useCallback(async () => {
    if (running.current || !isOnline()) return;
    running.current = true;
    setSyncing(true);
    try {
      const pending = (await listQueueForStore(storeId)).filter((q) => q.status !== 'sending');
      let sent = 0;
      for (const item of pending) {
        await updateQueued(item.id, { status: 'sending' });
        try {
          await sendOne(item);
          await removeFromQueue(item.id);
          sent++;
        } catch (err: any) {
          await updateQueued(item.id, {
            status: 'error',
            attempts: (item.attempts || 0) + 1,
            lastError: err?.message || String(err),
          });
        }
      }
      if (sent > 0) qc.invalidateQueries({ queryKey: ['orders'] });
      return sent;
    } finally {
      running.current = false;
      setSyncing(false);
      void refresh();
    }
  }, [qc, refresh, storeId]);

  // Sincroniza ao montar, ao voltar a conexão e periodicamente
  useEffect(() => {
    void sync();
    const onOnline = () => { void sync(); };
    window.addEventListener('online', onOnline);
    const t = setInterval(() => { void sync(); }, 30_000);
    return () => {
      window.removeEventListener('online', onOnline);
      clearInterval(t);
    };
  }, [sync]);

  return { queue, syncing, sync, refresh, remove: removeFromQueue };
}