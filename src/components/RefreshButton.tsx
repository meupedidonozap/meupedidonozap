import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface RefreshButtonProps {
  /** Optional list of queryKey prefixes to invalidate. If omitted, invalidates all queries. */
  queryKeys?: string[];
  className?: string;
  variant?: 'default' | 'outline' | 'ghost' | 'secondary';
  size?: 'default' | 'sm' | 'icon';
  label?: string;
}

export default function RefreshButton({
  queryKeys,
  className,
  variant = 'outline',
  size = 'sm',
  label = 'Atualizar',
}: RefreshButtonProps) {
  const qc = useQueryClient();
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    try {
      if (queryKeys && queryKeys.length > 0) {
        await Promise.all(
          queryKeys.map((key) => qc.invalidateQueries({ queryKey: [key] }))
        );
      } else {
        await qc.invalidateQueries();
      }
      toast.success('Dados atualizados');
    } catch {
      toast.error('Erro ao atualizar dados');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      onClick={handleClick}
      disabled={loading}
      className={cn('gap-2', className)}
    >
      <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
      {size !== 'icon' && <span>{label}</span>}
    </Button>
  );
}