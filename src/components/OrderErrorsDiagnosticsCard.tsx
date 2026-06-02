import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw, Trash2 } from 'lucide-react';
import { formatDateTime } from '@/lib/formatters';
import { toast } from 'sonner';

interface Props { storeId: string }

interface ErrorRow {
  id: string;
  created_at: string;
  error_message: string;
  error_code: string | null;
  payload_summary: any;
  user_agent: string | null;
}

export default function OrderErrorsDiagnosticsCard({ storeId }: Props) {
  const qc = useQueryClient();
  const [showAll, setShowAll] = useState(false);

  const { data: rows = [], isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['order-create-errors', storeId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('order_create_errors')
        .select('*')
        .eq('store_id', storeId)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data || []) as ErrorRow[];
    },
    enabled: !!storeId,
    staleTime: 15_000,
  });

  const clearAll = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any)
        .from('order_create_errors')
        .delete()
        .eq('store_id', storeId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Diagnóstico limpo');
      qc.invalidateQueries({ queryKey: ['order-create-errors', storeId] });
    },
    onError: (e: any) => toast.error(e?.message || 'Falha ao limpar'),
  });

  const visible = showAll ? rows : rows.slice(0, 10);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-yellow-600" />
          Diagnóstico de Pedidos
        </CardTitle>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isRefetching}>
            <RefreshCw className={`h-4 w-4 ${isRefetching ? 'animate-spin' : ''}`} />
          </Button>
          {rows.length > 0 && (
            <Button variant="outline" size="sm" onClick={() => { if (confirm('Limpar todos os registros de erro?')) clearAll.mutate(); }}>
              <Trash2 className="h-4 w-4 mr-1" /> Limpar
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-green-700">Nenhum erro registrado nos últimos pedidos. Tudo certo.</p>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              Últimos {rows.length} erro(s) ao gravar pedido nesta loja. Use para identificar falhas no checkout / Mesa.
            </p>
            <div className="rounded-md border divide-y">
              {visible.map((r) => (
                <div key={r.id} className="p-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium text-red-700 break-words">{r.error_message || '(sem mensagem)'}</span>
                    <span className="text-xs text-muted-foreground">{formatDateTime(r.created_at)}</span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    {r.error_code && <span>código: <code>{r.error_code}</code></span>}
                    {r.payload_summary?.items_count != null && <span>itens: {r.payload_summary.items_count}</span>}
                    {r.payload_summary?.total != null && <span>total: R$ {Number(r.payload_summary.total).toFixed(2)}</span>}
                    {r.payload_summary?.origem && <span>origem: {r.payload_summary.origem}</span>}
                  </div>
                </div>
              ))}
            </div>
            {rows.length > 10 && (
              <Button variant="ghost" size="sm" onClick={() => setShowAll((v) => !v)}>
                {showAll ? 'Mostrar menos' : `Mostrar todos (${rows.length})`}
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}