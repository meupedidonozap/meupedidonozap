import { Bell, BellOff, BellRing } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import {
  pushSupported,
  useDisablePush,
  useEnablePush,
  useMyPushSubscription,
  useMyPushRole,
  useMySellerId,
} from '@/hooks/usePushNotifications';

interface Props {
  storeId: string | undefined;
}

export function PushNotificationsCard({ storeId }: Props) {
  const { data: sellerId, isLoading: loadingSeller } = useMySellerId(storeId);
  const { data: role, isLoading: loadingRole } = useMyPushRole(storeId);
  const kind: 'seller' | 'admin' = sellerId ? 'seller' : 'admin';
  const eligible = !!sellerId || role === 'admin';
  const { data: status } = useMyPushSubscription(storeId, eligible);
  const enable = useEnablePush(storeId, sellerId, kind);
  const disable = useDisablePush();

  if (loadingSeller || loadingRole) return null;
  if (!eligible) return null; // nem vendedor nem admin

  const supported = pushSupported();
  const subscribed = !!status?.subscribed;

  return (
    <Card className="border-primary/40">
      <CardContent className="flex flex-col sm:flex-row sm:items-center gap-3 p-4">
        <div className="flex items-start gap-3 flex-1">
          {subscribed ? (
            <BellRing className="h-5 w-5 text-primary mt-0.5" />
          ) : (
            <Bell className="h-5 w-5 text-muted-foreground mt-0.5" />
          )}
          <div className="flex-1">
            <div className="font-semibold text-sm">
              {subscribed ? 'Notificações de novos pedidos ativadas' : 'Receba aviso de novos pedidos'}
            </div>
            <div className="text-xs text-muted-foreground">
              {!supported
                ? 'Seu navegador não suporta notificações push. Use Chrome/Edge/Firefox ou instale o app na tela inicial.'
                : subscribed
                  ? kind === 'admin'
                    ? 'Você será avisado neste dispositivo de todos os pedidos pendentes desta loja.'
                    : 'Você será avisado neste dispositivo sempre que cair um pedido para o seu cliente.'
                  : kind === 'admin'
                    ? 'Ative para receber uma notificação no computador/celular de todos os pedidos pendentes desta loja.'
                    : 'Ative para receber uma notificação no navegador/celular quando entrar um pedido pendente para o seu cliente.'}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          {subscribed ? (
            <Button
              variant="outline"
              size="sm"
              disabled={disable.isPending}
              onClick={async () => {
                try {
                  await disable.mutateAsync();
                  toast({ title: 'Notificações desativadas neste dispositivo' });
                } catch (e: any) {
                  toast({ title: 'Erro ao desativar', description: e.message, variant: 'destructive' });
                }
              }}
            >
              <BellOff className="h-4 w-4 mr-1" /> Desativar
            </Button>
          ) : (
            <Button
              size="sm"
              disabled={!supported || enable.isPending}
              onClick={async () => {
                try {
                  await enable.mutateAsync();
                  toast({ title: 'Pronto!', description: 'Notificações ativadas neste dispositivo.' });
                } catch (e: any) {
                  toast({ title: 'Não foi possível ativar', description: e.message, variant: 'destructive' });
                }
              }}
            >
              <Bell className="h-4 w-4 mr-1" /> Ativar notificações
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}