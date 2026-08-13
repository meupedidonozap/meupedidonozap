import { CloudUpload, Loader2, Trash2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useOfflineQueue } from '@/hooks/useOfflineQueue';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { formatCurrency } from '@/lib/formatters';
import { toast } from 'sonner';

interface Props {
  storeId: string | undefined;
  /** Quando true, não renderiza nada se a fila estiver vazia */
  hideWhenEmpty?: boolean;
}

export default function PendingOrdersCard({ storeId, hideWhenEmpty = true }: Props) {
  const { queue, syncing, sync, remove } = useOfflineQueue(storeId);
  const online = useOnlineStatus();

  if (hideWhenEmpty && queue.length === 0) return null;

  return (
    <div className="rounded-lg border border-amber-400/60 bg-amber-50 p-3 dark:bg-amber-950/30">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <CloudUpload className="h-4 w-4" />
          Pedidos pendentes de envio
          <Badge variant="secondary">{queue.length}</Badge>
        </p>
        <Button
          size="sm"
          variant="outline"
          disabled={syncing || !online || queue.length === 0}
          onClick={async () => {
            const sent = await sync();
            if (sent) toast.success(`${sent} pedido(s) enviado(s)`);
            else if (online) toast.info('Nada foi enviado. Verifique os erros da fila.');
          }}
        >
          {syncing ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : null}
          Tentar enviar agora
        </Button>
      </div>

      {queue.length === 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">Nenhum pedido na fila.</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {queue.map((q) => (
            <li key={q.id} className="flex items-start justify-between gap-2 rounded-md border bg-background p-2 text-xs">
              <div className="min-w-0">
                <p className="truncate font-medium">{q.customerName || 'Cliente'}</p>
                <p className="text-muted-foreground">
                  {new Date(q.createdAt).toLocaleString('pt-BR')} · {formatCurrency(q.total)}
                </p>
                {q.status === 'error' && (
                  <p className="mt-1 flex items-start gap-1 text-destructive">
                    <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                    <span className="break-words">{q.lastError || 'Falha ao enviar'}</span>
                  </p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Badge variant={q.status === 'error' ? 'destructive' : 'secondary'}>
                  {q.status === 'sending' ? 'Enviando' : q.status === 'error' ? 'Erro' : 'Na fila'}
                </Badge>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  onClick={async () => {
                    await remove(q.id);
                    toast.success('Pedido removido da fila');
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}