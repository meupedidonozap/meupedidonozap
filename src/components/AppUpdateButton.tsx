import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { refreshApplication } from '@/lib/appUpdates';
import { cn } from '@/lib/utils';

export default function AppUpdateButton({ menu = false }: { menu?: boolean }) {
  const [updating, setUpdating] = useState(false);
  const update = async () => {
    setUpdating(true);
    try { await refreshApplication(); }
    catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível atualizar. Tente novamente.');
      setUpdating(false);
    }
  };
  return (
    <Button variant={menu ? 'ghost' : 'default'} size={menu ? 'default' : 'sm'}
      onClick={update} disabled={updating}
      className={cn('shrink-0 gap-2', menu && 'h-auto w-full justify-start px-4 py-3')}>
      <RefreshCw className={cn(menu ? 'h-5 w-5' : 'h-4 w-4', updating && 'animate-spin')} />
      {updating ? 'Atualizando…' : menu ? 'Atualizar aplicativo' : 'Atualizar agora'}
    </Button>
  );
}