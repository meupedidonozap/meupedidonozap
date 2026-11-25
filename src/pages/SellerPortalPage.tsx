import { useMemo, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Loader2, Search, Plus, TrendingUp, CheckCircle2, XCircle } from 'lucide-react';
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
import AttendanceDashboard from '@/components/AttendanceDashboard';
import TeamVisitsPanel from '@/components/TeamVisitsPanel';
import SellerMenu from '@/components/SellerMenu';
import { useOfflineQueue } from '@/hooks/useOfflineQueue';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { WifiOff, RefreshCw } from 'lucide-react';
import { DEFAULT_VISIT_REASONS } from '@/hooks/useCustomerVisits';
import { Pencil, Share2, Lock, FileDown, Eye } from 'lucide-react';
import { isCustomerOrder, canEditOrder, mergeEditedCustomer } from '@/lib/orderOwnership';
import { shareOrderPdf } from '@/lib/shareOrderPdf';
import { useCart } from '@/contexts/CartContext';
import { mapProfile } from '@/hooks/useCustomerProfile';
import { setEditingQuote } from '@/lib/quoteEditing';
import { loadItemsForEdit } from '@/lib/editRecalc';
import { resolveStorePriceTable } from '@/lib/pricing';
import TitlesPanel from '@/components/TitlesPanel';
import InvoicesPanel from '@/components/InvoicesPanel';
import ErpOrdersPanel from '@/components/ErpOrdersPanel';
import SellerPendingOrderDialog from '@/components/SellerPendingOrderDialog';
import ResultsDrilldown from '@/components/results/ResultsDrilldown';
import ClientIntelligencePanel from '@/components/ClientIntelligencePanel';
import { useAuth } from '@/hooks/useAuth';
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import ReleasePaymentDialog from '@/components/ReleasePaymentDialog';
import { mapOrder } from '@/hooks/useOrders';
import { getReleaseIssues } from '@/lib/orderReleaseCheck';
import { getStoreRules, releasePaymentRequired } from '@/lib/storeRules';
import { requestReleaseWhatsApp } from '@/lib/releaseWhatsApp';

type Section = 'atendimento' | 'vendas' | 'clientes' | 'resultados' | 'notas' | 'titulos';
const TITLES: Record<Section, string> = {
  atendimento: 'Atendimento', vendas: 'Vendas', clientes: 'Clientes', resultados: 'Resultados', notas: 'Notas Fiscais', titulos: 'Títulos',
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
  const { user } = useAuth();
  const { selectCustomer } = useSellerContext();
  const { setStoreId: setCartStore, clearCart, addItem } = useCart();
  const [search, setSearch] = useState('');
  const [checkinOpen, setCheckinOpen] = useState(true);
  const [pendingOrderId, setPendingOrderId] = useState<string | null>(null);

  const codes = seller.isAdmin ? [] : seller.sellerCodes;
  const { data: orders = [], isLoading: ordersLoading } = useQuery({
    queryKey: ['seller-orders', store?.id, codes.join(',')],
    enabled: !!store?.id && seller.canSell,
    queryFn: async () => {
      let q = supabase.from('orders').select('id, order_number, customer, total, status, created_at, origem, erp_order_code')
        .eq('store_id', store!.id).order('created_at', { ascending: false }).range(0, 4999);
      if (codes.length) q = q.in('customer->>sellerCode', codes);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  const { queue, syncing, sync } = useOfflineQueue(store?.id);
  const online = useOnlineStatus();
  const allOrders = useMemo(() => {
    const local = queue.map((q) => ({
      id: `local-${q.id}`, order_number: null, customer: q.payload.customer, total: q.total,
      status: q.payload.status, created_at: q.createdAt, _offline: true, _error: q.status === 'error',
    }));
    return [...local, ...orders];
  }, [queue, orders]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return allOrders;
    return allOrders.filter((o: any) => {
      const c = o.customer || {};
      return [c.name, c.city, c.customerCode, String(o.order_number)].some(v => String(v || '').toLowerCase().includes(s));
    });
  }, [allOrders, search]);
  const quotes = filtered.filter((o: any) => o.status === 'orcamento');
  const realOrders = filtered.filter((o: any) => o.status !== 'orcamento');
  const sum = (list: any[]) => list.reduce((a, o) => a + Number(o.total || 0), 0);

  const setStatus = async (id: string, status: 'pendente' | 'cancelado') => {
    const { error } = await supabase.from('orders').update({ status }).eq('id', id).select().single();
    if (error) { toast.error(error.message); return; }
    toast.success(status === 'pendente' ? 'Orçamento finalizado como pedido' : 'Orçamento cancelado');
    qc.invalidateQueries({ queryKey: ['seller-orders'] });
  };

  // Finalizar orçamento (DiColore): 1) virar pedido? 2) liberar p/ transmissão?
  const [finalizeQuote, setFinalizeQuote] = useState<{ id: string; step: 'convert' | 'release' } | null>(null);
  const [finalizeBusy, setFinalizeBusy] = useState(false);
  const [paymentOrder, setPaymentOrder] = useState<any>(null);
  const finalizeAndRelease = async (id: string) => {
    if (!store) return;
    const notify = getStoreRules(store.slug, store.settings).notifyReleaseWhatsapp;
    setFinalizeBusy(true);
    try {
      const { data: auth, error: authErr } = await supabase.auth.getUser();
      if (authErr || !auth.user) throw new Error('Faça login novamente.');
      const { data: row, error } = await supabase.from('orders').select('*').eq('id', id).eq('store_id', store.id).single();
      if (error) throw error;
      if (row.status !== 'orcamento' || row.xml_downloaded_at) throw new Error('Este orçamento já foi finalizado');
      const saved = mapOrder(row);
      const issues = getReleaseIssues({ customer: saved.customer as any, items: saved.items as any, requirePayment: releasePaymentRequired(store.slug, store.settings) });
      const paymentOnly = issues.length > 0 && issues.every(i => i === 'Falta forma de pagamento' || i === 'Falta condição de pagamento');
      if (issues.length === 0) {
        const win = notify && store.slug !== 'dicolore' ? window.open('about:blank', '_blank') : null;
        const { error: relErr } = await supabase.from('orders').update({ status: 'liberado_transmissao' }).eq('id', id).eq('status', 'orcamento').select().single();
        if (relErr) { win?.close(); throw relErr; }
        if (notify && (store.slug === 'dicolore' || win)) {
          const st: any = store.settings || {};
          const c: any = saved.customer || {};
          const wa = String(st.erpReleaseWhatsappByTable?.[String(c.priceTable || '')] || st.erpReleaseWhatsapp || '5547992491139').replace(/\D/g, '');
          requestReleaseWhatsApp(store.slug, `https://wa.me/${wa}?text=${encodeURIComponent(`Olá, o pedido #${saved.orderNumber} do cliente "${c.name || ''}" pode ser transmitido`)}`, win);
        }
        toast.success(`Pedido #${saved.orderNumber} finalizado e liberado p/ transmissão`);
      } else {
        const { error: pErr } = await supabase.from('orders').update({ status: 'pendente' }).eq('id', id).eq('status', 'orcamento').select().single();
        if (pErr) throw pErr;
        if (paymentOnly) { setPaymentOrder({ ...saved, status: 'pendente' }); toast.info('Pedido salvo como Pendente. Informe o pagamento para liberar.'); }
        else toast.error(`Pedido salvo como Pendente. Complete: ${issues.join('; ')}`, { duration: 8000 });
      }
      qc.invalidateQueries({ queryKey: ['seller-orders'] });
      qc.invalidateQueries({ queryKey: ['orders'] });
    } catch (e: any) {
      toast.error(e.message || 'Não foi possível finalizar o orçamento');
    } finally {
      setFinalizeBusy(false);
      setFinalizeQuote(null);
    }
  };

  const [sharingId, setSharingId] = useState<string | null>(null);
  const share = async (id: string, mode: 'auto' | 'preview' | 'download' = 'auto') => {
    if (!store) return;
    setSharingId(id);
    try { await shareOrderPdf(id, store.name, mode); }
    catch (e: any) { toast.error(e.message || 'Não foi possível gerar o PDF'); }
    finally { setSharingId(null); }
  };

  const [editingId, setEditingId] = useState<string | null>(null);
  const editQuote = async (id: string) => {
    if (!store) return;
    setEditingId(id);
    try {
      const { data: order, error } = await supabase.from('orders').select('id, customer, items, status, origem').eq('id', id).single();
      if (error) throw error;
      if (order.status !== 'orcamento') throw new Error('Este orçamento já foi finalizado');
      if (!canEditOrder(order, seller)) throw new Error('Este pedido já foi assumido por outro responsável');
      const claimed = mergeEditedCustomer(order, order.customer, seller);
      if (claimed !== order.customer) {
        const { error: cErr } = await supabase.from('orders').update({ customer: claimed } as any).eq('id', id).select().single();
        if (cErr) throw cErr;
      }
      const c: any = order.customer || {};
      let profile: any = null;
      if (c.customerCode) {
        const { data } = await supabase.from('customer_profiles').select('*').eq('store_id', store.id).eq('customer_code', c.customerCode).limit(1);
        profile = data?.[0];
      }
      if (!profile && c.cpfCnpj) {
        const { data } = await supabase.from('customer_profiles').select('*').eq('store_id', store.id).eq('cpf_cnpj', c.cpfCnpj).limit(1);
        profile = data?.[0];
      }
      if (!profile) throw new Error('Cliente do orçamento não encontrado no cadastro');
      selectCustomer({ ...mapProfile(profile), customerCode: profile.customer_code || undefined });
      setCartStore(store.id);
      clearCart();
      const recalc = await loadItemsForEdit(store.id, (order.items as any[]) || [], resolveStorePriceTable(store.slug, profile.price_table ?? (order.customer as any)?.priceTable));
      for (const it of recalc.items) addItem(it);
      setEditingQuote({ id: order.id, storeId: store.id, customerName: profile.name });
      toast.success('Orçamento carregado no carrinho para edição');
      navigate(`/${store.slug}`);
    } catch (e: any) {
      toast.error(e.message || 'Erro ao abrir orçamento');
    } finally {
      setEditingId(null);
    }
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
        <CardContent className="space-y-3 p-4">
          <div className="flex justify-between gap-3">
            <div className="min-w-0 text-sm">
              <p className="font-semibold uppercase">{c.name}</p>
              <p className="text-muted-foreground">{[c.city, c.uf].filter(Boolean).join(' - ')}</p>
              <p className="text-muted-foreground">Cód: {o._offline ? 'AGUARDANDO REDE' : quote ? 'ORÇAMENTO' : `#${o.order_number}`}{c.customerCode ? ` • Cliente ${c.customerCode}` : ''}</p>
              <p className="text-muted-foreground">{new Date(o.created_at).toLocaleDateString('pt-BR')}</p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-2">
              {o._offline
                ? <Badge variant="destructive" className="gap-1"><WifiOff className="h-3 w-3" /> OFFLINE — Não Integrado</Badge>
                : <Badge variant={stage.variant}>{stage.label}</Badge>}
              <p className="font-bold">{formatCurrency(Number(o.total))}</p>
            </div>
          </div>
          {!o._offline && (
            <div className="grid grid-cols-2 gap-2 border-t pt-3 sm:flex sm:justify-end">
              <Button size="sm" variant="secondary" className="col-span-2 w-full sm:w-auto" disabled={sharingId === o.id} onClick={() => share(o.id, store.slug === 'dicolore' ? 'preview' : 'auto')}>
                {sharingId === o.id ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : store.slug === 'dicolore' ? <Eye className="mr-1 h-4 w-4" /> : <Share2 className="mr-1 h-4 w-4" />}
                {store.slug === 'dicolore' ? 'Ver PDF' : 'Imprimir / Enviar PDF'}
              </Button>
              {store.slug === 'dicolore' && <Button size="sm" variant="outline" className="col-span-2 w-full sm:w-auto" disabled={sharingId === o.id} onClick={() => share(o.id, 'download')}><FileDown className="mr-1 h-4 w-4" />Baixar PDF</Button>}
              {quote && !canEditOrder(o, seller) && (
                <p className="col-span-2 flex items-center justify-center gap-1 text-xs text-muted-foreground sm:self-center">
                  <Lock className="h-3 w-3" /> Pedido de outro responsável — somente visualização
                </p>
              )}
              {quote && canEditOrder(o, seller) && (<>
                <Button size="sm" variant="outline" className="w-full sm:w-auto" disabled={editingId === o.id} onClick={() => editQuote(o.id)}>
                  {editingId === o.id ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Pencil className="mr-1 h-4 w-4" />} Editar
                </Button>
                <Button size="sm" className="w-full sm:w-auto" onClick={() => store.slug === 'dicolore' ? setFinalizeQuote({ id: o.id, step: 'convert' }) : setStatus(o.id, 'pendente')}><CheckCircle2 className="mr-1 h-4 w-4" /> Finalizar</Button>
                <Button size="sm" variant="ghost" className="col-span-2 w-full text-destructive sm:w-auto" onClick={() => setStatus(o.id, 'cancelado')}><XCircle className="mr-1 h-4 w-4" /> Cancelar</Button>
              </>)}
            </div>
          )}
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
          <SellerMenu showClients={store.slug === 'dicolore'} store={store} sellerName={seller.sellerName} roleLabel={seller.isManager ? 'Gerente' : seller.isAdmin && !seller.isSeller ? 'Administrador' : undefined} canAdmin={seller.isAdmin} />
          <h1 className="font-bold">{TITLES[section]}</h1>
        </div>
      </header>

      <main className="container py-4 pb-28">
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
            {queue.length > 0 && (
              <div className="mb-3 flex items-center justify-between gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
                <span className="flex items-center gap-2"><WifiOff className="h-4 w-4" /> {queue.length} registro(s) salvos no aparelho, ainda não integrados.</span>
                <Button size="sm" variant="outline" disabled={!online || syncing} onClick={() => sync()}>
                  <RefreshCw className={`mr-1 h-4 w-4 ${syncing ? 'animate-spin' : ''}`} /> Sincronizar agora
                </Button>
              </div>
            )}
            {ordersLoading && queue.length === 0 && online ? <Loader2 className="mx-auto h-6 w-6 animate-spin" /> : (
              <>
                <AlertDialog open={!!finalizeQuote} onOpenChange={v => { if (!v && !finalizeBusy) setFinalizeQuote(null); }}>
                  <AlertDialogContent>
                    {finalizeQuote?.step === 'convert' ? (<>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Finalizar orçamento</AlertDialogTitle>
                        <AlertDialogDescription>Deseja transformar o orçamento em pedido?</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter className="gap-2">
                        <Button variant="outline" onClick={() => { setFinalizeQuote(null); toast.success('Orçamento mantido salvo'); }}>Não, manter orçamento</Button>
                        <Button onClick={() => setFinalizeQuote(f => f && { ...f, step: 'release' })}>Sim, finalizar pedido</Button>
                      </AlertDialogFooter>
                    </>) : (<>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Liberar p/ transmissão</AlertDialogTitle>
                        <AlertDialogDescription>Deseja LIBERAR P/ TRANSMISSÃO?</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter className="gap-2">
                        <Button variant="outline" disabled={finalizeBusy} onClick={async () => { const id = finalizeQuote!.id; setFinalizeQuote(null); await setStatus(id, 'pendente'); }}>Não, deixar Pendente</Button>
                        <Button disabled={finalizeBusy} onClick={() => finalizeAndRelease(finalizeQuote!.id)}>{finalizeBusy && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}Sim, liberar</Button>
                      </AlertDialogFooter>
                    </>)}
                  </AlertDialogContent>
                </AlertDialog>
                <TabsContent value="orcamentos" className="space-y-2">
                  <p className="text-right text-xs text-muted-foreground">{quotes.length} Orçamentos<br />{formatCurrency(sum(quotes))}</p>
                  {quotes.length === 0 && <p className="py-8 text-center text-muted-foreground">Nenhum orçamento salvo.</p>}
                  {quotes.map((o: any) => <OrderCard key={o.id} o={o} quote />)}
                </TabsContent>
                <TabsContent value="pedidos" className="space-y-2">
                  {store.slug === 'dicolore' ? (
                    <>
                      <ErpOrdersPanel storeId={store.id} allowedSellerCodes={codes} localOrders={allOrders.filter((o: any) => !['orcamento', 'cancelado'].includes(o.status))} onLocalClick={setPendingOrderId} />
                      <SellerPendingOrderDialog orderId={pendingOrderId} store={store} onClose={() => setPendingOrderId(null)} />
                      <ReleasePaymentDialog order={paymentOrder} store={store} viewer={{ isAdmin: seller.isAdmin, isTelevendas: seller.isTelevendas, name: seller.sellerName, erpCode: seller.erpCode }} onClose={() => setPaymentOrder(null)} onReleased={() => qc.invalidateQueries({ queryKey: ['seller-orders'] })} />
                    </>
                  ) : (
                    <>
                      <p className="text-right text-xs text-muted-foreground">{realOrders.length} Pedidos<br />{formatCurrency(sum(realOrders))}</p>
                      {realOrders.length === 0 && <p className="py-8 text-center text-muted-foreground">Nenhum pedido encontrado.</p>}
                      {realOrders.map((o: any) => <OrderCard key={o.id} o={o} />)}
                    </>
                  )}
                </TabsContent>
              </>
            )}
            <Button size="icon" className="fixed bottom-6 right-6 h-14 w-14 rounded-full bg-accent text-accent-foreground shadow-lg hover:bg-accent/90"
              onClick={() => navigate(`/${store.slug}`)} aria-label="Novo pedido">
              <Plus className="h-6 w-6" />
            </Button>
          </Tabs>
        )}

        {section === 'clientes' && (store.slug === 'dicolore'
          ? <ClientIntelligencePanel storeId={store.id} sellerCodes={seller.isAdmin ? [] : seller.sellerCodes} canManage={seller.isAdmin} />
          : <p className="py-8 text-center text-sm text-muted-foreground">Disponível em breve.</p>)}
        {section === 'resultados' && (
          <ResultsDrilldown
            storeId={store.id}
            mode={seller.isAdmin ? 'admin' : seller.isTelevendas ? 'televendas' : 'vendedor'}
            sellerCodes={seller.sellerCodes}
            userId={user?.id}
            userEmail={user?.email}
            company={(store.settings as any)?.titlesCompany}
            erpCode={seller.erpCode}
          />
        )}

        {section === 'titulos' && (
          <TitlesPanel
            storeId={store.id}
            sellerCodes={codes}
            startDate={store.settings.titlesStartDate}
            dateField={store.settings.titlesDateField}
            company={store.settings.titlesCompany}
          />
        )}

        {section === 'notas' && (
          <InvoicesPanel storeId={store.id} startDate={store.settings.titlesStartDate} company={store.settings.titlesCompany} sellerCodes={store.slug === 'dicolore' && !seller.isAdmin ? seller.sellerCodes : undefined} />
        )}

        {section === 'atendimento' && seller.isAdmin && <TeamVisitsPanel storeId={store.id} enhanced={store.slug === 'dicolore'} />}

        {section === 'atendimento' && !seller.isAdmin && store.slug === 'dicolore' && !checkinOpen && (
          <div className="space-y-4"><Button onClick={() => setCheckinOpen(true)}>Fazer check-in</Button><AttendanceDashboard storeId={store.id} scopeCodes={codes} /></div>
        )}
        {section === 'atendimento' && !seller.isAdmin && checkinOpen && (
          <CheckinDialog
            open
            onOpenChange={(o) => { if (!o) { if (store.slug === 'dicolore') setCheckinOpen(false); else navigate(`/${store.slug}`); } }}
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
