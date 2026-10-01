import { useMemo, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Loader2, Search, Plus, FileText, Receipt, TrendingUp, CheckCircle2, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useStoreBySlug } from '@/hooks/useStores';
import { useSellerMode } from '@/hooks/useSellerMode';
import { useSellerContext } from '@/contexts/SellerContext';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency } from '@/lib/formatters';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import CheckinDialog from '@/components/CheckinDialog';
import SellerMenu from '@/components/SellerMenu';
import { DEFAULT_VISIT_REASONS } from '@/hooks/useCustomerVisits';

type Section = 'atendimento' | 'vendas' | 'resultados' | 'notas' | 'titulos';
const TITLES: Record<Section, string> = {
  atendimento: 'Atendimento', vendas: 'Vendas', resultados: 'Resultados', notas: 'Notas Fiscais', titulos: 'Títulos',
};

export function sellerOrderStage(status: string): { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' } {
  if (status === 'orcamento') return { label: 'Orçamento', variant: 'outline' };
  if (status === 'cancelado') return { label: 'Cancelado', variant: 'destructive' };
  if (status === 'enviado' || status === 'entregue') return { label: 'Faturado', variant: 'default' };
  if (status === 'liberado_transmissao' || status === 'confirmado' || status === 'preparando') return { label: 'Separado', variant: 'secondary' };
  return { label: 'Não Faturado', variant: 'outline' };
}

export default function SellerPortalPage() {
  const { slug, section: rawSection } = useParams<{ slug: string; section: string }>();
  const section = (rawSection && rawSection in TITLES ? rawSection : 'vendas') as Section;
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: store, isLoading } = useStoreBySlug(slug || '');
  const seller = useSellerMode(store?.id);
  const { selectCustomer } = useSellerContext();
  const [search, setSearch] = useState('');

  const codes = seller.isAdmin ? [] : seller.sellerCodes;
  const { data: orders = [], isLoading: ordersLoading } = useQuery({
    queryKey: ['seller-orders', store?.id, codes.join(',')],
    enabled: !!store?.id && seller.canSell,
    queryFn: async () => {
      let q = supabase.from('orders').select('id, order_number, customer, total, status, created_at')
        .eq('store_id', store!.id).order('created_at', { ascending: false }).range(0, 4999);
      if (codes.length) q = q.in('customer->>sellerCode', codes);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return orders;
    return orders.filter((o: any) => {
      const c = o.customer || {};
      return [c.name, c.city, c.customerCode, String(o.order_number)].some(v => String(v || '').toLowerCase().includes(s));
    });
  }, [orders, search]);
  const quotes = filtered.filter((o: any) => o.status === 'orcamento');
  const realOrders = filtered.filter((o: any) => o.status !== 'orcamento');
  const sum = (list: any[]) => list.reduce((a, o) => a + Number(o.total || 0), 0);

  const setStatus = async (id: string, status: 'pendente' | 'cancelado') => {
    const { error } = await supabase.from('orders').update({ status }).eq('id', id).select().single();
    if (error) { toast.error(error.message); return; }
    toast.success(status === 'pendente' ? 'Orçamento finalizado como pedido' : 'Orçamento cancelado');
    qc.invalidateQueries({ queryKey: ['seller-orders'] });
  };

  if (isLoading || seller.loading) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  if (!store || !seller.canSell) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
        <h1 className="text-xl font-bold">Acesso exclusivo para vendedores</h1>
        <Button asChild><Link to={`/${slug}`}>Voltar à loja</Link></Button>
      </div>
    );
  }

  const OrderCard = ({ o, quote }: { o: any; quote?: boolean }) => {
    const c = o.customer || {};
    const stage = sellerOrderStage(o.status);
    return (
      <Card>
        <CardContent className="flex justify-between gap-3 p-4">
          <div className="min-w-0 text-sm">
            <p className="font-semibold uppercase">{c.name}</p>
            <p className="text-muted-foreground">{[c.city, c.uf].filter(Boolean).join(' - ')}</p>
            <p className="text-muted-foreground">Cód: {quote ? 'ORÇAMENTO' : `#${o.order_number}`}{c.customerCode ? ` • Cliente ${c.customerCode}` : ''}</p>
            <p className="text-muted-foreground">{new Date(o.created_at).toLocaleDateString('pt-BR')}</p>
          </div>
          <div className="flex shrink-0 flex-col items-end justify-between gap-2">
            <Badge variant={stage.variant}>{stage.label}</Badge>
            <p className="font-bold">{formatCurrency(Number(o.total))}</p>
            {quote && (
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" onClick={() => setStatus(o.id, 'cancelado')}><XCircle className="h-4 w-4" /></Button>
                <Button size="sm" onClick={() => setStatus(o.id, 'pendente')}><CheckCircle2 className="mr-1 h-4 w-4" /> Finalizar</Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  const now = new Date();
  const monthOrders = orders.filter((o: any) => {
    const d = new Date(o.created_at);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const mOrders = monthOrders.filter((o: any) => !['orcamento', 'cancelado'].includes(o.status));
  const mQuotes = monthOrders.filter((o: any) => o.status === 'orcamento');
  const mBilled = mOrders.filter((o: any) => sellerOrderStage(o.status).label === 'Faturado');

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="sticky top-0 z-40 border-b bg-card">
        <div className="container flex h-14 items-center gap-2">
          <Button variant="ghost" size="icon" asChild><Link to={`/${store.slug}`}><ArrowLeft className="h-5 w-5" /></Link></Button>
          <SellerMenu store={store} sellerName={seller.sellerName} />
          <h1 className="font-bold">{TITLES[section]}</h1>
        </div>
      </header>

      <main className="container py-4">
        {section === 'vendas' && (
          <Tabs defaultValue="orcamentos">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="orcamentos">Orçamentos</TabsTrigger>
              <TabsTrigger value="pedidos">Pedidos</TabsTrigger>
            </TabsList>
            <div className="relative my-3">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-9" placeholder="Pesquisar cliente, cidade, código..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            {ordersLoading ? <Loader2 className="mx-auto h-6 w-6 animate-spin" /> : (
              <>
                <TabsContent value="orcamentos" className="space-y-2">
                  <p className="text-right text-xs text-muted-foreground">{quotes.length} Orçamentos<br />{formatCurrency(sum(quotes))}</p>
                  {quotes.length === 0 && <p className="py-8 text-center text-muted-foreground">Nenhum orçamento salvo.</p>}
                  {quotes.map((o: any) => <OrderCard key={o.id} o={o} quote />)}
                </TabsContent>
                <TabsContent value="pedidos" className="space-y-2">
                  <p className="text-right text-xs text-muted-foreground">{realOrders.length} Pedidos<br />{formatCurrency(sum(realOrders))}</p>
                  {realOrders.length === 0 && <p className="py-8 text-center text-muted-foreground">Nenhum pedido encontrado.</p>}
                  {realOrders.map((o: any) => <OrderCard key={o.id} o={o} />)}
                </TabsContent>
              </>
            )}
            <Button size="icon" className="fixed bottom-6 right-6 h-14 w-14 rounded-full bg-accent text-accent-foreground shadow-lg hover:bg-accent/90"
              onClick={() => navigate(`/${store.slug}`)} aria-label="Novo pedido">
              <Plus className="h-6 w-6" />
            </Button>
          </Tabs>
        )}

        {section === 'resultados' && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { t: 'Pedidos do mês', v: String(mOrders.length) },
              { t: 'Total vendido no mês', v: formatCurrency(sum(mOrders)) },
              { t: 'Faturado no mês', v: formatCurrency(sum(mBilled)) },
              { t: 'Orçamentos em aberto', v: `${mQuotes.length} • ${formatCurrency(sum(mQuotes))}` },
            ].map(k => (
              <Card key={k.t}><CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm text-muted-foreground"><TrendingUp className="h-4 w-4" />{k.t}</CardTitle></CardHeader>
                <CardContent className="text-2xl font-bold">{k.v}</CardContent></Card>
            ))}
          </div>
        )}

        {(section === 'notas' || section === 'titulos') && (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
              {section === 'notas' ? <FileText className="h-10 w-10 text-muted-foreground" /> : <Receipt className="h-10 w-10 text-muted-foreground" />}
              <p className="font-semibold">{section === 'notas' ? 'Notas Fiscais' : 'Títulos'} dos clientes da sua carteira</p>
              <p className="max-w-md text-sm text-muted-foreground">Tela pronta. A consulta será ligada à base de dados do ERP na próxima etapa (parâmetros e busca).</p>
            </CardContent>
          </Card>
        )}

        {section === 'atendimento' && (
          <CheckinDialog
            open
            onOpenChange={(o) => { if (!o) navigate(`/${store.slug}`); }}
            storeId={store.id}
            sellerCodes={codes}
            unvisitedPeriodDays={Number((store.settings as any)?.unvisitedPeriodDays) || 30}
            visitReasons={((store.settings as any)?.visitReasons as string[])?.length ? (store.settings as any).visitReasons : DEFAULT_VISIT_REASONS}
            maxDistanceMeters={Number((store.settings as any)?.maxCheckinDistanceMeters) || 300}
            onCustomerSelected={(c) => { selectCustomer(c); }}
          />
        )}
      </main>
    </div>
  );
}
