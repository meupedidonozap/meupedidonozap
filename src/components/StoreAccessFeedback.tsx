import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function StoreAccessFeedback({ error, retry }: { error?: unknown; retry: () => unknown }) {
  return <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center" role={error ? 'alert' : 'status'}>
    {error ? <><p>Não foi possível carregar seu acesso. Tente novamente.</p><Button variant="outline" onClick={() => void retry()}>Tentar novamente</Button></> : <Loader2 aria-label="Carregando acesso" className="h-8 w-8 animate-spin text-muted-foreground" />}
  </div>;
}