import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency } from '@/lib/formatters';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

type Props = {
  storeId: string;
  /** Pedidos criados aqui que ainda não voltaram do ERP */
  localOrders?: any[];
};

const STATUS: Record<string, { label: string; cls: string }> = {
  N: { label: 'Sem OF e sem NF', cls: 'bg-destructive' },
  S: { label: 'Com OF e sem NF', cls: 'bg-primary' },
  F: { label: 'Com OF e com NF', cls: 'bg-accent' },
  L: { label: 'Aguardando integração', cls: 'bg-muted-foreground' },
};

const fmtDate = (d?: string | null) => (d ? d.slice(0, 10).split('-').reverse().join('/') : '');
const clean = (s: string) => s.replace(/[%*(),[\]]/g, '').trim();

export default function ErpOrdersPanel({ storeId, localOrders = [] }: Props) {
  const [search, setSearch] = useState('');
  const [term, setTerm] = useState('');
  const [open, setOpen] = useState<any | null>(null);
  useEffect(() => { const t = setTimeout(() => setTerm(clean(search)), 400); return () => clearTimeout(t); }, [search]);

  const { data: orders = [], isLoading, error, refetch } = useQuery({
    queryKey: ['erp-orders', storeId, term],
    queryFn: async () => {
      let codes: string[] | null = null;
      if (term.length >= 3 && !/^\d+$/.test(term)) {
        const { data } = await supabase.from('customer_profiles').select('customer_code')
          .eq('store_id', storeId).or(`name.ilike.%${term}%,city.ilike.%${term}%`).limit(500);
        codes = (data || []).map((d) => d.customer_code).filter(Boolean);
        if (!codes.length) return [];
      }
      const all: any[] = [];
      for (let from = 0; from < 5000; from += 1000) {
        let q = supabase.from('erp_orders').select('*').eq('store_id', storeId)
          .order('data_emissao', { ascending: false }).range(from, from + 999);
        if (codes) q = q.in('cliente_codigo', codes);
        else if (term) q = q.or(`codigo.ilike.%${term}%,codigo_importacao.eq.${term},cliente_codigo.eq.${term},nota_fiscal_numero.eq.${term}`);
        const { data, error } = await q;
        if (error) throw error;
        all.push(...(data || []));
        if (!data || data.length < 1000) break;
      }
      return all;
    },
  });

  const clientCodes = useMemo(() => [...new Set(orders.map((o: any) => o.cliente_codigo).filter(Boolean))], [orders]);
  const { data: clients = {} } = useQuery({
    queryKey: ['erp-orders-clients', storeId, clientCodes.join(',')],
    enabled: clientCodes.length > 0,
    queryFn: async () => {
      const map: Record<string, any> = {};
      for (let i = 0; i < clientCodes.length; i += 300) {
        const { data } = await supabase.from('customer_profiles').select('customer_code, name, city, uf')
          .eq('store_id', storeId).in('customer_code', clientCodes.slice(i, i + 300));
        (data || []).forEach((c) => { map[c.customer_code.trim()] = c; });
      }
      return map;
    },
  });

  const rows = useMemo(() => {
    const erpCodes = new Set(orders.map((o: any) => String(o.codigo)));
    const s = term.toLowerCase();
    const pending = localOrders
      .filter((o) => !erpCodes.has(String(o.order_number)))
      .filter((o) => !s || [o.customer?.name, o.customer?.city, o.customer?.customerCode, String(o.order_number)]
        .some((v) => String(v || '').toLowerCase().includes(s)))
      .map((o) => ({
        id: o.id, _local: true, codigo: o._offline ? 'OFFLINE' : String(o.order_number ?? ''),
        cliente_codigo: o.customer?.customerCode || '', data_emissao: o.created_at,
        valor_total: Number(o.total || 0), status: 'L',
        _name: o.customer?.name, _city: [o.customer?.city, o.customer?.uf].filter(Boolean).join(' - '),
      }));
    return [...pending, ...orders];
  }, [orders, localOrders, term]);

  const total = rows.reduce((a, o: any) => a + Number(o.valor_total || 0), 0);

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-9" placeholder="Pesquisar cliente, cidade, pedido, NF..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <div className="flex flex-wrap gap-3">
          {(['N', 'S', 'F'] as const).map((k) => (
            <span key={k} className="flex items-center gap-1"><span className={`h-2.5 w-2.5 rounded-full ${STATUS[k].cls}`} />{STATUS[k].label}</span>
          ))}
        </div>
        <p className="text-right">{rows.length.toLocaleString('pt-BR')} Pedidos<br />{formatCurrency(total)}</p>
      </div>

      {isLoading ? <Loader2 className="mx-auto h-6 w-6 animate-spin" /> : error ? (
        <p className="py-8 text-center text-sm text-destructive">Não foi possível carregar os pedidos. <button className="underline" onClick={() => refetch()}>Tentar novamente</button></p>
      ) : rows.length === 0 ? (
        <p className="py-8 text-center text-muted-foreground">Nenhum pedido encontrado.</p>
      ) : rows.map((o: any) => {
        const c = (clients as any)[String(o.cliente_codigo).trim()];
        const st = STATUS[o.status] || STATUS.N;
        return (
          <Card key={o.id} className={o._local ? '' : 'cursor-pointer hover:bg-muted/40'} onClick={() => !o._local && setOpen({ ...o, _client: c })}>
            <CardContent className="flex justify-between gap-3 p-4">
              <div className="min-w-0 text-sm">
                <p className="font-semibold uppercase">{c?.name || o._name || `Cliente ${o.cliente_codigo}`}</p>
                <p className="text-muted-foreground">{c ? [c.city, c.uf].filter(Boolean).join(' - ') : o._city}</p>
                <p className="text-muted-foreground">Pedido: {o.codigo} • Cliente {o.cliente_codigo}</p>
                <p className="text-muted-foreground">{fmtDate(o.data_emissao)}</p>
              </div>
              <div className="flex shrink-0 flex-col items-end justify-between gap-1">
                {o.nota_fiscal_numero && <span className="text-xs text-muted-foreground">NF {o.nota_fiscal_numero}</span>}
                <span title={st.label} className={`h-3 w-3 rounded-full ${st.cls}`} />
                <p className="font-bold">{formatCurrency(Number(o.valor_total))}</p>
              </div>
            </CardContent>
          </Card>
        );
      })}

      <OrderDetail order={open} onClose={() => setOpen(null)} />
    </div>
  );
}

function OrderDetail({ order, onClose }: { order: any | null; onClose: () => void }) {
  const { data: items = [], isLoading } = useQuery({
    queryKey: ['erp-order-items', order?.store_id, order?.external_key],
    enabled: !!order,
    queryFn: async () => {
      const { data, error } = await supabase.from('erp_order_items').select('*')
        .eq('store_id', order.store_id).eq('order_key', order.external_key).order('produto_codigo');
      if (error) throw error;
      return data || [];
    },
  });
  const st = order ? STATUS[order.status] || STATUS.N : null;
  return (
    <Dialog open={!!order} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        {order && (
          <>
            <DialogHeader><DialogTitle>Pedido {order.codigo}</DialogTitle></DialogHeader>
            <div className="grid gap-1 text-sm sm:grid-cols-2">
              <p><b>Cliente:</b> {order._client?.name || '-'} ({order.cliente_codigo})</p>
              <p><b>Emissão:</b> {fmtDate(order.data_emissao)}</p>
              <p><b>OF:</b> {order.ordem_faturamento || '—'}</p>
              <p><b>NF:</b> {order.nota_fiscal_numero || '—'}{order.data_faturamento ? ` (${fmtDate(order.data_faturamento)})` : ''}</p>
              <p className="flex items-center gap-2"><b>Status:</b> <span className={`h-2.5 w-2.5 rounded-full ${st!.cls}`} />{st!.label}</p>
              <p><b>Pedido ERP:</b> {order.codigo_importacao}</p>
              <p><b>Total:</b> {formatCurrency(Number(order.valor_total))}</p>
              {Number(order.valor_faturado) > 0 && <p><b>Faturado:</b> {formatCurrency(Number(order.valor_faturado))}</p>}
            </div>
            {order.observacao && <p className="rounded bg-muted p-2 text-xs">{order.observacao}</p>}
            {isLoading ? <Loader2 className="mx-auto h-5 w-5 animate-spin" /> : items.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">Itens ainda não sincronizados.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr className="border-b text-left text-muted-foreground">
                    <th className="p-1">Código</th><th className="p-1">Produto</th><th className="p-1 text-right">Qtd</th>
                    <th className="p-1 text-right">Fat.</th><th className="p-1 text-right">Unit.</th><th className="p-1 text-right">Total</th>
                  </tr></thead>
                  <tbody>{items.map((it: any) => (
                    <tr key={it.id} className="border-b">
                      <td className="p-1">{it.produto_codigo}</td><td className="p-1">{it.produto_descricao || ''}</td>
                      <td className="p-1 text-right">{Number(it.quantidade)}</td><td className="p-1 text-right">{Number(it.quantidade_faturada)}</td>
                      <td className="p-1 text-right">{formatCurrency(Number(it.valor_unitario))}</td>
                      <td className="p-1 text-right">{formatCurrency(Number(it.valor_total))}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
