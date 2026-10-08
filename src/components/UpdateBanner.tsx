import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function UpdateBanner() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const on = () => setShow(true);
    window.addEventListener('mpz:update-available', on);
    return () => window.removeEventListener('mpz:update-available', on);
  }, []);
  if (!show) return null;
  return (
    <div className="fixed inset-x-3 top-3 z-[9999] mx-auto flex max-w-md items-center justify-between gap-3 rounded-lg border bg-card p-3 text-sm shadow-lg">
      <span className="font-medium">Nova versão disponível!</span>
      <Button size="sm" onClick={() => window.location.reload()}>
        <RefreshCw className="mr-1 h-4 w-4" /> Atualizar agora
      </Button>
    </div>
  );
}
