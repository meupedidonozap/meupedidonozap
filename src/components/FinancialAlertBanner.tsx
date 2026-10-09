import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface Props {
  storeId?: string;
  slug?: string;
  customerCode?: string;
  customerName?: string;
  isSellerMode?: boolean;
}

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/** Aviso (não bloqueante) de parcelas vencidas do cliente ativo. */
export default function FinancialAlertBanner({ storeId, slug, customerCode, customerName, isSellerMode }: Props) {
  const code = (customerCode || '').trim();
  const { data } = useQuery({
    queryKey: ['overdue-titles', storeId, code],
    enabled: !!storeId && !!code,
    staleTime: 60_000,
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from('customer_titles')
        .select('valor_saldo, valor_total, valor_pago, data_vencimento, status, data_quitacao')
        .eq('store_id', storeId!)
        .eq('cliente_codigo', code)
        .lt('data_vencimento', today)
        .is('data_quitacao', null)
        .neq('status', 'PAGO');
      if (error) throw error;
      const rows = (data || []).filter((t: any) => {
        const saldo = Number(t.valor_saldo ?? Number(t.valor_total) - Number(t.valor_pago));
        return saldo > 0;
      });
      const total = rows.reduce((s: number, t: any) => s + Number(t.valor_saldo || 0), 0);
      const oldest = rows.map((t: any) => t.data_vencimento).sort()[0] as string | undefined;
      return { count: rows.length, total, oldest };
    },
  });

  if (!data || data.count === 0) return null;
  const oldest = data.oldest ? new Date(data.oldest + 'T00:00:00').toLocaleDateString('pt-BR') : '';

  return (
    <div className="container mt-3">
      <div className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm">
        <AlertTriangle className="h-5 w-5 shrink-0 text-destructive" />
        <div className="flex-1">
          <p className="font-semibold text-destructive">
            {isSellerMode ? `Cliente ${customerName || code} possui pendências financeiras` : 'Você possui pendências financeiras'}
          </p>
          <p className="text-muted-foreground">
            {data.count} parcela(s) em atraso · {brl(data.total)}{oldest && ` · vencida desde ${oldest}`}. O pedido pode continuar normalmente.
          </p>
          {!isSellerMode && slug && (
            <Link to={`/${slug}/titulos`} className="font-medium text-primary underline">Ver meus títulos</Link>
          )}
        </div>
      </div>
    </div>
  );
}
