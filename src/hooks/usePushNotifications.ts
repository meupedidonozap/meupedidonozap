import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export const VAPID_PUBLIC_KEY =
  'BJ6oIN09KH0dVoehG1bB8w1ebT4B6vWQ2AeAEpdfv8sEWkhu3vhTOMHebadvnRujYhAF7pWKgZSZOtyaozsU3jk';

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export function pushSupported(): boolean {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

/** Resolve the seller_id for the logged-in store user (vendedor / televendas). */
export function useMySellerId(storeId: string | undefined) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['my-seller-id', storeId, user?.id],
    queryFn: async () => {
      if (!storeId || !user) return null;
      const { data: su } = await supabase
        .from('store_users')
        .select('seller_id, name, role, seller_codes')
        .eq('store_id', storeId)
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle();
      if (!su) return null;
      if ((su as any).seller_id) return (su as any).seller_id as string;

      const { data: sellers } = await supabase
        .from('store_sellers')
        .select('id, name, code')
        .eq('store_id', storeId)
        .eq('is_active', true);
      const list = (sellers || []) as Array<{ id: string; name: string | null; code: string | null }>;

      // 1) Match by seller_codes (most reliable)
      const codes: string[] = Array.isArray((su as any).seller_codes) ? (su as any).seller_codes : [];
      const cleanCodes = codes.map((c) => String(c ?? '').trim()).filter(Boolean);
      if (cleanCodes.length > 0) {
        const byCode = list.find((s) => cleanCodes.includes(String(s.code ?? '').trim()));
        if (byCode) return byCode.id;
      }

      // 2) Fallback by name, normalized (remove "rep", "representante", "televendas", "tv", accents)
      const norm = (s: string) =>
        (s || '')
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toLowerCase()
          .replace(/\btele\s*vendas\b/g, '')
          .replace(/\btv\b/g, '')
          .replace(/\brepresentante\b/g, '')
          .replace(/\breps?\b/g, '')
          .replace(/\s+/g, ' ')
          .trim();
      const cleanName = norm(su.name || '');
      if (!cleanName) return null;
      const match = list.find((s) => norm(s.name || '') === cleanName);
      return match?.id || null;
    },
    enabled: !!storeId && !!user,
  });
}

export function useMyPushSubscription(storeId: string | undefined, sellerId: string | null | undefined) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['my-push-sub', storeId, sellerId, user?.id],
    queryFn: async () => {
      if (!storeId || !sellerId || !user) return { permission: 'default' as NotificationPermission, subscribed: false };
      if (!pushSupported()) return { permission: 'denied' as NotificationPermission, subscribed: false };
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = reg ? await reg.pushManager.getSubscription() : null;
      let dbActive = false;
      if (sub) {
        const { data } = await supabase
          .from('push_subscriptions')
          .select('id, is_active')
          .eq('endpoint', sub.endpoint)
          .maybeSingle();
        dbActive = !!(data && (data as any).is_active);
      }
      return {
        permission: Notification.permission,
        subscribed: !!sub && dbActive,
      };
    },
    enabled: !!storeId && !!sellerId,
  });
}

export function useEnablePush(storeId: string | undefined, sellerId: string | null | undefined) {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async () => {
      if (!pushSupported()) throw new Error('Notificações push não são suportadas neste navegador.');
      if (!storeId || !sellerId || !user) throw new Error('Usuário não está vinculado a um vendedor.');

      const permission = await Notification.requestPermission();
      if (permission !== 'granted') throw new Error('Permissão de notificações negada.');

      let reg = await navigator.serviceWorker.getRegistration();
      if (!reg) reg = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;

      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        });
      }

      const json = sub.toJSON();
      const endpoint = sub.endpoint;
      const p256dh = (json.keys as any)?.p256dh;
      const auth = (json.keys as any)?.auth;
      if (!p256dh || !auth) throw new Error('Falha ao obter chaves da inscrição.');

      // Upsert seguro via RPC (resolve casos em que o mesmo aparelho já tinha
      // uma inscrição cadastrada por outro usuário e a RLS escondia a linha).
      const { error: rpcError } = await supabase.rpc('upsert_push_subscription', {
        p_store_id: storeId,
        p_seller_id: sellerId,
        p_endpoint: endpoint,
        p_p256dh: p256dh,
        p_auth: auth,
        p_user_agent: navigator.userAgent,
      });
      if (rpcError) {
        const msg = (rpcError.message || '').toLowerCase();
        if (msg.includes('duplicate') || msg.includes('unique')) {
          throw new Error('Este aparelho já tinha uma inscrição. Tente desativar e ativar novamente.');
        }
        throw new Error('Não foi possível ativar as notificações neste aparelho. Tente novamente.');
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-push-sub'] }),
  });
}

export function useDisablePush(storeId: string | undefined, sellerId: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!pushSupported()) return;
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = reg ? await reg.pushManager.getSubscription() : null;
      if (sub) {
        await supabase.from('push_subscriptions').update({ is_active: false }).eq('endpoint', sub.endpoint);
        try { await sub.unsubscribe(); } catch { /* ignore */ }
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-push-sub'] }),
  });
}