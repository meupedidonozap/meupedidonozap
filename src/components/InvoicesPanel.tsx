import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CalendarDays, FileText, Loader2, Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency } from '@/lib/formatters';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type Period = 'hoje' | 'todos' | 'mes' | '90dias';

const fmtDate = (value?: string | null) => value ? value.split('-').reverse().join('/') : '-';

const localDay = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

function periodStart(period: Period): string | undefined {
  if (period === 'todos') return undefined;
  const date = new Date();
  if (period === 'mes') date.setDate(1);
  else if (period === '90dias') date.setDate(date.getDate() - 90);
  return localDay(date);
}

export default function InvoicesPanel({ storeId, customerCode, startDate }: {
  storeId: string;
  customerCode?: string;
  startDate?: string;
}) {
  const [search, setSearch] = useState('');
  const [period, setPeriod] = useState<Period>('hoje');
  const [status, setStatus] = useState('todos');
  const hasSearch = search.trim().length > 0;
  const selectedStart = useMemo(() => {
    // Com pesquisa, procura em todo o histórico permitido.
    const quickStart = hasSearch ? undefined : periodStart(period);
    if (!startDate) return quickStart;
    if (!quickStart) return startDate;
    return quickStart > startDate ? quickStart : startDate;
  }, [period, startDate, hasSearch]);

  const [term, setTerm] = useState('');
  useEffect(() => {
    const id = setTimeout(() => setTerm(search.trim().replace(/[,()%*]/g, ' ').trim()), 400);
    return () => clearTimeout(id);
  }, [search]);

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ['customer-invoices', storeId, customerCode, selectedStart, term],
    queryFn: async () => {
      // Busca direta no banco: com termo, procura em todo o histórico.
      let orFilter = '';
      if (term) {
        const parts = [`numero.eq.${term}`, `pedido_codigo.eq.${term}`, `cliente_codigo.eq.${term}`, `chave_nfe.eq.${term}`];
        if (!customerCode && term.length >= 3) {
          const { data: cs } = await supabase.from('customer_profiles').select('customer_code')
            .eq('store_id', storeId).neq('customer_code', '')
            .or(`name.ilike.%${term}%,city.ilike.%${term}%`).limit(200);
          const cc = [...new Set((cs || []).map((c) => c.customer_code).filter(Boolean))];
          if (cc.length) parts.push(`cliente_codigo.in.(${cc.map((c) => `"${c}"`).join(',')})`);
        }
        orFilter = parts.join(',');
      }
      const rows: Array<Record<string, any>> = [];
      const pageSize = 1000;
      for (let from = 0; from < 10000; from += pageSize) {
        let query = supabase.from('customer_invoices').select('*')
          .eq('store_id', storeId)
          .order('data_emissao', { ascending: false })
          .range(from, from + pageSize - 1);
        if (customerCode) query = query.eq('cliente_codigo', customerCode);
        if (selectedStart) query = query.gte('data_emissao', selectedStart);
        if (orFilter) query = query.or(orFilter);
        const { data, error } = await query;
        if (error) throw error;
        rows.push(...(data || []));
        if (!data || data.length < pageSize) break;
      }
      return rows;
    },
  });

  const customerCodes = useMemo(
    () => [...new Set(invoices.map((invoice) => invoice.cliente_codigo).filter(Boolean))],
    [invoices],
  );
  const { data: customerNames = {} } = useQuery({
    queryKey: ['invoice-customer-names', storeId, customerCodes.join(',')],
    enabled: customerCodes.length > 0 && !customerCode,
    queryFn: async () => {
      const names: Record<string, { name: string; city: string }> = {};
      for (let i = 0; i < customerCodes.length; i += 300) {
        const { data } = await supabase.from('customer_profiles').select('customer_code, name, city')
          .eq('store_id', storeId).in('customer_code', customerCodes.slice(i, i + 300));
        (data || []).forEach((customer) => {
          names[customer.customer_code] = { name: customer.name, city: customer.city };
        });
      }
      return names;
    },
  });

  const list = useMemo(() => {
    const term = search.trim().toLowerCase();
    return invoices.filter((invoice) => {
      if (status !== 'todos' && invoice.status !== status) return false;
      if (!term) return true;
      const customer = customerNames[invoice.cliente_codigo];
      return [invoice.numero, invoice.serie, invoice.pedido_codigo, invoice.cliente_codigo,
        invoice.chave_nfe, invoice.status, customer?.name, customer?.city]
        .some((value) => String(value || '').toLowerCase().includes(term));
    });
  }, [invoices, search, customerNames, status]);

  const statuses = useMemo(
    () => [...new Set(invoices.map((invoice) => invoice.status).filter(Boolean))].sort(),
    [invoices],
  );

  const total = list.reduce((sum, invoice) => sum + Number(invoice.valor_total_nota_fiscal || 0), 0);
  const products = list.reduce((sum, invoice) => sum + Number(invoice.total_quantidade_un_1_faturada || 0), 0);

  return (
    <div className="space-y-4">
      {startDate && (
        <p className="text-xs text-muted-foreground">Exibindo notas emitidas a partir de {fmtDate(startDate)}.</p>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Notas fiscais</p><p className="text-xl font-bold">{list.length}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Valor faturado</p><p className="text-xl font-bold">{formatCurrency(total)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Quantidade faturada</p><p className="text-xl font-bold">{products.toLocaleString('pt-BR')}</p></CardContent></Card>
      </div>

      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_220px]">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" value={search} onChange={(event) => setSearch(event.target.value)}
            placeholder={customerCode ? 'Buscar por nota, pedido ou chave da NFe' : 'Buscar por cliente, código, nota, pedido ou chave'} />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger aria-label="Filtrar por status"><SelectValue placeholder="Todos os status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            {statuses.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Tabs value={period} onValueChange={(value) => setPeriod(value as Period)}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="hoje">Hoje</TabsTrigger>
          <TabsTrigger value="mes">Este mês</TabsTrigger>
          <TabsTrigger value="90dias">90 dias</TabsTrigger>
          <TabsTrigger value="todos">Todas</TabsTrigger>
        </TabsList>
      </Tabs>
      {hasSearch && <p className="text-xs text-muted-foreground">Pesquisando em todo o histórico de notas.</p>}

      {isLoading ? (
        <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : list.length === 0 ? (
        <Card><CardContent className="flex flex-col items-center gap-2 py-10 text-center text-sm text-muted-foreground">
          <FileText className="h-8 w-8" />Nenhuma nota fiscal encontrada.
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {list.map((invoice) => {
            const customer = customerNames[invoice.cliente_codigo];
            return (
              <Card key={invoice.id}>
                <CardContent className="grid gap-4 p-4 sm:grid-cols-[minmax(0,1fr)_auto]">
                  <div className="min-w-0 text-sm">
                    {!customerCode && <p className="font-semibold uppercase">{customer?.name || `Cliente ${invoice.cliente_codigo}`}</p>}
                    {!customerCode && customer?.city && <p className="text-muted-foreground">{customer.city}</p>}
                    <p className="font-medium">NF {invoice.numero}{invoice.serie ? ` • Série ${invoice.serie}` : ''}</p>
                    <p className="text-muted-foreground">Cliente {invoice.cliente_codigo}{invoice.pedido_codigo ? ` • Pedido ${invoice.pedido_codigo}` : ''}</p>
                    <p className="flex items-center gap-1 text-muted-foreground"><CalendarDays className="h-3.5 w-3.5" /> Emissão: {fmtDate(invoice.data_emissao)}{invoice.data_entrega ? ` • Entrega: ${fmtDate(invoice.data_entrega)}` : ''}</p>
                    {invoice.mensagem_nota_fiscal && <p className="mt-2 whitespace-pre-wrap text-muted-foreground">{invoice.mensagem_nota_fiscal}</p>}
                    {invoice.chave_nfe && <p className="mt-2 break-all text-xs text-muted-foreground">Chave NFe: {invoice.chave_nfe}</p>}
                    <details className="mt-2 text-xs text-muted-foreground">
                      <summary className="cursor-pointer font-medium text-foreground">Ver detalhes fiscais</summary>
                      <div className="mt-2 grid gap-1 sm:grid-cols-2">
                        <span>Condição de pagamento: {invoice.condicao_pagamento_codigo || '-'}</span>
                        <span>Transportadora: {invoice.transportadora_codigo || '-'}</span>
                        <span>Tipo de frete: {invoice.tipo_frete || '-'}</span>
                        <span>Peso líquido: {Number(invoice.peso_total_liquido || 0).toLocaleString('pt-BR')} kg</span>
                        <span>Peso bruto: {Number(invoice.peso_total_bruto || 0).toLocaleString('pt-BR')} kg</span>
                        <span>Despesas: {formatCurrency(Number(invoice.valor_total_despesas))}</span>
                        <span>Seguro: {formatCurrency(Number(invoice.valor_total_seguro))}</span>
                        <span>Base ICMS: {formatCurrency(Number(invoice.base_icms))}</span>
                        <span>Base ST: {formatCurrency(Number(invoice.base_st))}</span>
                      </div>
                    </details>
                  </div>
                  <div className="flex shrink-0 flex-col items-start gap-1 sm:items-end">
                    {invoice.status && <Badge variant="outline">{invoice.status}</Badge>}
                    <p className="text-lg font-bold">{formatCurrency(Number(invoice.valor_total_nota_fiscal))}</p>
                    <p className="text-xs text-muted-foreground">Produtos: {formatCurrency(Number(invoice.valor_total_produtos))}</p>
                    <p className="text-xs text-muted-foreground">Qtd.: {Number(invoice.total_quantidade_un_1_faturada || 0).toLocaleString('pt-BR')}</p>
                    {Number(invoice.valor_total_desconto) > 0 && <p className="text-xs text-muted-foreground">Desconto: {formatCurrency(Number(invoice.valor_total_desconto))}</p>}
                    {Number(invoice.valor_total_frete) > 0 && <p className="text-xs text-muted-foreground">Frete: {formatCurrency(Number(invoice.valor_total_frete))}</p>}
                    {(Number(invoice.valor_total_ipi) > 0 || Number(invoice.valor_total_st) > 0 || Number(invoice.valor_total_icms) > 0) && (
                      <p className="text-xs text-muted-foreground">IPI {formatCurrency(Number(invoice.valor_total_ipi))} • ST {formatCurrency(Number(invoice.valor_total_st))} • ICMS {formatCurrency(Number(invoice.valor_total_icms))}</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}