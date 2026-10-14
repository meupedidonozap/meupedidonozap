import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, BellRing } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { pushSupported, VAPID_PUBLIC_KEY } from '@/hooks/usePushNotifications';

function toUint8(b64: string) {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

/** Cliente ativa avisos de parcelas (vencendo em 2 dias / atrasadas há mais de 2 dias). */
export default function CustomerPushCard({ storeId }: { storeId: string }) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const { data: active } = useQuery({
    queryKey: ['customer-push', storeId],
    queryFn: async () => {
      if (!pushSupported() || Notification.permission !== 'granted') return false;
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = reg ? await reg.pushManager.getSubscription() : null;
      if (!sub) return false;
      const { data } = await supabase.from('push_subscriptions').select('is_active, kind').eq('endpoint', sub.endpoint).maybeSingle();
      return !!(data && (data as any).is_active && (data as any).kind === 'customer');
    },
  });

  if (!pushSupported()) return null;

  const enable = async () => {
    setBusy(true);
    try {
      if (window.top !== window.self) throw new Error('Abra o site em uma aba própria (ou pelo app instalado) para ativar.');
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') throw new Error('Permissão negada. Libere as notificações nas configurações do navegador.');
      let reg = await navigator.serviceWorker.getRegistration();
      if (!reg) reg = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;
      const sub = (await reg.pushManager.getSubscription()) ||
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toUint8(VAPID_PUBLIC_KEY) }));
      const keys = (sub.toJSON().keys || {}) as any;
      const { error } = await supabase.rpc('upsert_customer_push_subscription' as any, {
        p_store_id: storeId, p_endpoint: sub.endpoint, p_p256dh: keys.p256dh, p_auth: keys.auth, p_user_agent: navigator.userAgent,
      });
      if (error) throw new Error('Não foi possível ativar os avisos neste aparelho.');
      toast({ title: 'Avisos ativados', description: 'Você será avisado sobre parcelas a vencer e em atraso.' });
      qc.invalidateQueries({ queryKey: ['customer-push', storeId] });
    } catch (e: any) {
      toast({ title: 'Não foi possível ativar', description: e.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mb-4 flex items-center gap-3 rounded-lg border bg-card p-3 text-sm">
      {active ? <BellRing className="h-5 w-5 text-primary" /> : <Bell className="h-5 w-5 text-muted-foreground" />}
      <div className="flex-1">
        <p className="font-medium">{active ? 'Avisos de parcelas ativados' : 'Receba avisos das suas parcelas'}</p>
        <p className="text-muted-foreground">2 dias antes do vencimento e quando houver atraso de mais de 2 dias.</p>
      </div>
      {!active && <Button size="sm" onClick={enable} disabled={busy}>{busy ? 'Ativando…' : 'Ativar'}</Button>}
    </div>
  );
}
