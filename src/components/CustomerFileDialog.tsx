import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BadgeCheck, Loader2, MapPin, Navigation, Phone } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { formatCPFCNPJ } from '@/lib/formatters';
import { customerTaxProfile } from '@/lib/customerTaxProfile';

/** Basta o id: a ficha lê o cadastro completo, respeitando o acesso de quem está logado. */
export interface CustomerFileData { id: string; name?: string | null }

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const txt = (v: unknown) => String(v ?? '').trim();
const dateBr = (v: unknown) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(txt(v));
  return m && m[1] > '1900' ? `${m[3]}/${m[2]}/${m[1]}` : '';
};

function Row({ l, v }: { l: string; v?: ReactNode }) {
  return (
    <div className="flex justify-between gap-3 text-sm">
      <span className="shrink-0 text-muted-foreground">{l}</span>
      <span className="text-right font-medium break-words">{v || '—'}</span>
    </div>
  );
}

export default function CustomerFileDialog({ customer, storeId, onClose }: { customer: CustomerFileData | null; storeId: string; onClose: () => void }) {
  const id = customer?.id || '';
  const { data: c, isLoading: loadingProfile, isError } = useQuery({
    queryKey: ['customer-file', storeId, id],
    enabled: !!id && !!storeId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from('customer_profiles').select('*').eq('store_id', storeId).eq('id', id).maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });
  const code = txt(c?.customer_code);
  const { data: fin, isLoading } = useQuery({
    queryKey: ['customer-file-fin', storeId, code],
    enabled: !!c && !!code,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from('customer_titles')
        .select('valor_saldo, valor_total, valor_pago, valor_pago_liquido, data_vencimento, status, data_quitacao')
        .eq('store_id', storeId).eq('cliente_codigo', code).limit(2000);
      if (error) throw error;
      const today = new Date().toISOString().slice(0, 10);
      const r = { venc: { n: 0, v: 0 }, aVencer: { n: 0, v: 0 }, pagos: { n: 0, v: 0 } };
      for (const t of (data || []) as any[]) {
        if (t.status === 'PAGO' || t.data_quitacao) { r.pagos.n++; r.pagos.v += Number(t.valor_pago_liquido ?? t.valor_pago ?? t.valor_total ?? 0); continue; }
        const saldo = Number(t.valor_saldo ?? (Number(t.valor_total) - Number(t.valor_pago || 0)));
        if (saldo <= 0) continue;
        const b = t.data_vencimento && t.data_vencimento < today ? r.venc : r.aVencer;
        b.n++; b.v += saldo;
      }
      return r;
    },
  });
  if (!customer) return null;

  const body = () => {
    if (loadingProfile) return <div className="flex h-32 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>;
    if (isError || !c) return <p className="py-6 text-center text-sm text-muted-foreground">Não foi possível carregar o cadastro deste cliente.</p>;
    const tax = customerTaxProfile({ cpfCnpj: c.cpf_cnpj, ie: c.ie, fisicaJuridica: c.fisica_juridica });
    const addr = [[c.address, c.number].filter(Boolean).join(', '), c.complement, c.neighborhood, [c.city, c.uf].filter(Boolean).join('/'), c.cep].map(txt).filter(Boolean).join(' - ');
    const delivery = [[c.endereco_entrega_rua, c.endereco_entrega_numero].filter(Boolean).join(', '), c.endereco_entrega_complemento, c.endereco_entrega_bairro, [c.endereco_entrega_cidade, c.endereco_entrega_uf].filter(Boolean).join('/'), c.endereco_entrega_cep].map(txt).filter(Boolean).join(' - ');
    const hasGeo = c.geo_lat != null && c.geo_lng != null;
    const q = encodeURIComponent(addr + ' - Brasil');
    const gmaps = hasGeo ? `https://www.google.com/maps/dir/?api=1&destination=${c.geo_lat},${c.geo_lng}` : `https://www.google.com/maps/dir/?api=1&destination=${q}`;
    const waze = hasGeo ? `https://waze.com/ul?ll=${c.geo_lat},${c.geo_lng}&navigate=yes` : `https://waze.com/ul?q=${q}&navigate=yes`;
    const phone = txt(c.whatsapp).replace(/\D/g, '');
    const fantasia = txt(c.nome_fantasia);
    const frete = c.frete_codigo === '0' ? 'CIF (remetente)' : c.frete_codigo === '1' ? 'FOB (destinatário)' : '';
    return (
      <>
        <section className="space-y-1.5">
          <p className="font-semibold">{code ? `${code} - ` : ''}{c.name}</p>
          {tax.highlight && (
            <div className="flex items-start gap-2 rounded-md bg-success p-2 text-success-foreground">
              <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="text-sm font-bold">PJ com Inscrição Estadual</p>
                <p className="text-xs">IE {tax.ie} — cliente com direito a desconto.</p>
              </div>
            </div>
          )}
          <Row l="Razão social" v={c.name} />
          <Row l="Nome fantasia" v={fantasia} />
          <Row l="Código" v={code || 'PROSPECT'} />
          <Row l="Situação" v={c.is_active === false ? 'Inativo' : 'Ativo'} />
          <Row l="Tipo de pessoa" v={tax.person === 'PJ' ? 'Jurídica' : tax.person === 'PF' ? 'Física' : ''} />
          <Row l={tax.person === 'PF' ? 'CPF' : tax.person === 'PJ' ? 'CNPJ' : 'CPF/CNPJ'} v={c.cpf_cnpj ? formatCPFCNPJ(c.cpf_cnpj) : ''} />
          <Row l="Inscrição Estadual" v={tax.ie} />
          <Row l="RG" v={txt(c.rg)} />
        </section>

        <section className="space-y-1.5 border-t pt-3">
          <p className="text-sm font-semibold">Contato</p>
          <div className="flex justify-between gap-3 text-sm"><span className="text-muted-foreground">Telefone principal</span>
            {phone ? <a className="font-medium text-primary underline" href={`https://wa.me/${phone.length <= 11 ? '55' + phone : phone}`} target="_blank" rel="noreferrer"><Phone className="mr-1 inline h-3 w-3" />{c.whatsapp}</a> : <span>—</span>}
          </div>
          <Row l="Telefone adicional" v={txt(c.telefone_geral_2)} />
          <Row l="E-mail" v={txt(c.email_nfe)} />
        </section>

        <section className="space-y-2 border-t pt-3">
          <p className="flex items-center gap-1 text-sm font-semibold"><MapPin className="h-4 w-4" /> Endereço</p>
          <p className="text-sm">{addr || 'Endereço não cadastrado'}</p>
          {delivery && delivery !== addr && <p className="text-sm"><span className="text-muted-foreground">Entrega: </span>{delivery}</p>}
          {(addr || hasGeo) && (
            <div className="grid grid-cols-2 gap-2">
              <Button asChild variant="outline" size="sm"><a href={gmaps} target="_blank" rel="noreferrer"><Navigation className="mr-1 h-4 w-4" />Google Maps</a></Button>
              <Button asChild variant="outline" size="sm"><a href={waze} target="_blank" rel="noreferrer"><Navigation className="mr-1 h-4 w-4" />Waze</a></Button>
            </div>
          )}
        </section>

        <section className="space-y-1.5 border-t pt-3">
          <p className="text-sm font-semibold">Condições comerciais</p>
          <Row l="Vendedor" v={txt(c.seller_code)} />
          <Row l="Tabela de preço" v={c.price_table} />
          <Row l="Condição de pagamento" v={txt(c.condicao_pagamento_codigo)} />
          <Row l="Forma de pagamento" v={txt(c.forma_pagamento_codigo)} />
          <Row l="Transportadora" v={txt(c.transportadora)} />
          <Row l="Frete" v={frete} />
          <Row l="Limite de crédito" v={c.total_limite_credito != null ? brl(Number(c.total_limite_credito)) : ''} />
          <Row l="Última compra" v={dateBr(c.data_ultima_compra)} />
          <Row l="Observações" v={txt(c.observacao)} />
        </section>

        <section className="space-y-2 border-t pt-3">
          <p className="text-sm font-semibold">Resumo financeiro</p>
          {!code ? <p className="text-sm text-muted-foreground">Cliente sem código no ERP.</p>
            : isLoading ? <Loader2 className="h-4 w-4 animate-spin" />
            : fin && (
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-md border border-destructive/40 p-2"><p className="text-xs text-muted-foreground">Vencidos</p><p className="text-sm font-bold text-destructive">{brl(fin.venc.v)}</p><p className="text-xs">{fin.venc.n} títulos</p></div>
                <div className="rounded-md border p-2"><p className="text-xs text-muted-foreground">A vencer</p><p className="text-sm font-bold">{brl(fin.aVencer.v)}</p><p className="text-xs">{fin.aVencer.n} títulos</p></div>
                <div className="rounded-md border p-2"><p className="text-xs text-muted-foreground">Pagos</p><p className="text-sm font-bold text-primary">{brl(fin.pagos.v)}</p><p className="text-xs">{fin.pagos.n} títulos</p></div>
              </div>
            )}
        </section>
      </>
    );
  };

  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Ficha do cliente</DialogTitle></DialogHeader>
        {body()}
      </DialogContent>
    </Dialog>
  );
}
