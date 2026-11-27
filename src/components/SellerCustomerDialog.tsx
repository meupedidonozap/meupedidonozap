import { useEffect, useMemo, useRef, useState } from 'react';
import { loadCustomerDraft, saveCustomerDraft, clearCustomerDraft } from '@/lib/customerDraft';
import { Search, UserPlus, Loader2, ShoppingCart, FileText } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import CustomerFileDialog from '@/components/CustomerFileDialog';
import { customerTaxProfile } from '@/lib/customerTaxProfile';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { useStoreCustomerProfiles, useCreateCustomerProfileAdmin } from '@/hooks/useCustomerProfiles';
import { formatCPFCNPJ, formatPhone, formatCEP } from '@/lib/formatters';
import { fetchAddressByCep } from '@/lib/cepLookup';
import type { SellerCustomer } from '@/contexts/SellerContext';
import { resolveStorePriceTable } from '@/lib/pricing';
import { lookupCnpj } from '@/lib/cnpjLookup';
import { supabase } from '@/integrations/supabase/client';
import { getCustomerRegistrationError } from '@/lib/customerValidation';
import { useQueryClient } from '@tanstack/react-query';
import { mapProfile } from '@/hooks/useCustomerProfile';
import { useDicoloreRefresh } from '@/hooks/useDicoloreRefresh';
import { CUSTOMER_DATA, FINANCIAL_DATA, STOCK_DATA, refreshDicoloreData } from '@/lib/dicoloreRefresh';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storeId: string;
  /** Slug da loja (define a tabela de preço padrão). */
  storeSlug?: string;
  /** Códigos de representante do vendedor. Vazio = vê todos (admin). */
  sellerCodes: string[];
  onSelected: (customer: SellerCustomer) => void;
  /** Só o cadastro de novo cliente (usado na tela de check-in). */
  createOnly?: boolean;
}

export default function SellerCustomerDialog({ open, onOpenChange: parentOnOpenChange, storeId, storeSlug, sellerCodes, onSelected, createOnly = false }: Props) {
  const defaultPriceTable = resolveStorePriceTable(storeSlug);
  const { data: profiles = [], isLoading } = useStoreCustomerProfiles(storeId, !createOnly && (storeSlug !== 'dicolore' || open), storeSlug === 'dicolore' ? sellerCodes : []);
  const rich = storeSlug === 'dicolore';
  const [fileOf, setFileOf] = useState<{ id: string; name?: string } | null>(null);
  const client = useQueryClient();
  const [selecting, setSelecting] = useState(false);
  useDicoloreRefresh(storeId, CUSTOMER_DATA, open && !createOnly);
  const createCustomer = useCreateCustomerProfileAdmin();
  const [draft] = useState(() => loadCustomerDraft(storeId));
  const [search, setSearch] = useState(draft?.search ?? '');
  const [mode, setMode] = useState<'existing' | 'new'>(createOnly ? 'new' : draft?.mode ?? 'existing');
  const [cnpjLoading, setCnpjLoading] = useState(false);
  const [duplicate, setDuplicate] = useState<string | null>(null);

  const checkDuplicate = async (doc: string): Promise<string | null> => {
    const d = doc.replace(/\D/g, '');
    if (d.length !== 11 && d.length !== 14) { setDuplicate(null); return null; }
    const { data } = await (supabase.rpc as any)('find_customer_by_document', { p_store_id: storeId, p_doc: d });
    const row = Array.isArray(data) ? data[0] : null;
    if (!row) { setDuplicate(null); return null; }
    const seller = row.seller_name || (row.seller_code ? `código ${row.seller_code}` : 'nenhum vendedor');
    const msg = `Cliente já cadastrado (${row.name}${row.customer_code ? ` #${row.customer_code}` : ''}) - vinculado ao Vendedor ${seller}`;
    setDuplicate(msg);
    return msg;
  };
  const emptyForm = {
    name: '', whatsapp: '', cpfCnpj: '', ie: '', cep: '', uf: '', city: '',
    neighborhood: '', address: '', number: '', complement: '',
    priceTable: String(defaultPriceTable), sellerCode: sellerCodes[0] || '',
  };
  const [form, setForm] = useState<typeof emptyForm>(() => ({ ...emptyForm, ...(draft?.form || {}) }));

  // Guarda o rascunho para não perder o que foi digitado ao sair para outro app.
  const latest = useRef({ form, mode, search, open });
  latest.current = { form, mode, search, open };
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => saveCustomerDraft(storeId, latest.current), 300);
    return () => clearTimeout(t);
  }, [form, mode, search, open, storeId]);
  useEffect(() => {
    const flush = () => { if (latest.current.open) saveCustomerDraft(storeId, latest.current); };
    const onVis = () => { if (document.visibilityState === 'hidden') flush(); };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('pagehide', flush);
    return () => { document.removeEventListener('visibilitychange', onVis); window.removeEventListener('pagehide', flush); };
  }, [storeId]);

  const onOpenChange = (o: boolean) => {
    if (!o) {
      clearCustomerDraft(storeId);
      setForm(emptyForm); setSearch(''); setMode(createOnly ? 'new' : 'existing'); setDuplicate(null);
    }
    parentOnOpenChange(o);
  };

  const scoped = useMemo(() => {
    const codes = new Set(sellerCodes.map(c => c.trim()));
    // Inativos ficam fora da lista inicial, mas podem ser encontrados pela pesquisa para emitir pedido.
    const base = (profiles as any[]).filter(p => storeSlug === 'dicolore' || p.isActive !== false);
    if (codes.size === 0) return base;
    return base.filter(p => codes.has(String(p.sellerCode || '').trim()));
  }, [profiles, sellerCodes, storeSlug]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return scoped.filter((p: any) => p.isActive !== false).slice(0, 300);
    const digits = term.replace(/\D/g, '');
    return scoped.filter((c: any) => {
      const hay = [c.name, c.nomeFantasia, c.customerCode, c.cpfCnpj, c.ie, c.whatsapp, c.city, c.uf, c.address]
        .filter(Boolean).join(' ').toLowerCase();
      if (hay.includes(term)) return true;
      return digits.length >= 3 && hay.replace(/\D/g, '').includes(digits);
    }).slice(0, 300);
  }, [scoped, search]);

  const handleCreate = async () => {
    const customerError = getCustomerRegistrationError(form, storeSlug);
    if (customerError) { toast.error(customerError); return; }
    const dup = await checkDuplicate(form.cpfCnpj);
    if (dup) { toast.error(dup); return; }
    try {
      const created = await createCustomer.mutateAsync({
        storeId,
        name: form.name.trim().toUpperCase(),
        whatsapp: form.whatsapp,
        cpfCnpj: form.cpfCnpj,
        cep: form.cep,
        uf: form.uf,
        city: form.city,
        neighborhood: form.neighborhood,
        address: form.address,
        number: form.number,
        complement: form.complement,
        ie: form.ie,
        sellerCode: form.sellerCode || sellerCodes[0] || '',
        priceTable: Number(form.priceTable) as 1 | 3 | 4 | 8 | 9 | 11,
      });
      toast.success('Cliente cadastrado');
      onSelected(created as SellerCustomer);
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || 'Erro ao cadastrar cliente');
    }
  };

  const handleSelect = async (customer: SellerCustomer) => {
    if (selecting) return;
    if (storeSlug !== 'dicolore') { onSelected(customer); onOpenChange(false); return; }
    setSelecting(true);
    try {
      const { data, error } = await supabase.from('customer_profiles').select('*')
        .eq('store_id', storeId).eq('id', customer.id).single();
      if (error) throw error;
      const fresh = mapProfile(data);
      if (sellerCodes.length && !sellerCodes.map(code => code.trim()).includes((fresh.sellerCode || '').trim())) {
        throw new Error('Este cliente não pertence mais à sua carteira. Selecione outro cliente.');
      }
      client.setQueryData(['selected-customer-profile', storeId, fresh.id], fresh);
      await refreshDicoloreData(client, storeSlug, storeId, FINANCIAL_DATA, false);
      onSelected(fresh);
      void refreshDicoloreData(client, storeSlug, storeId, STOCK_DATA);
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível atualizar o cliente. Tente novamente.');
    } finally { setSelecting(false); }
  };

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{createOnly ? 'Novo cliente' : 'Selecionar cliente'}</DialogTitle></DialogHeader>

        <Tabs value={mode} onValueChange={v => setMode(v as any)}>
          <TabsList className={createOnly ? 'hidden' : 'w-full'}>
            <TabsTrigger value="existing" className="flex-1">Minha carteira</TabsTrigger>
            <TabsTrigger value="new" className="flex-1"><UserPlus className="mr-1 h-4 w-4" /> Novo cliente</TabsTrigger>
          </TabsList>

          <TabsContent value="existing" className="mt-3">
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="Nome, código, WhatsApp ou CNPJ/CPF..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <ScrollArea className={`${rich ? 'h-[55vh] min-h-[320px]' : 'h-[320px]'} rounded-md border`}>
              {isLoading ? (
                <div className="flex h-24 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>
              ) : filtered.length === 0 ? (
                <p className="p-4 text-center text-sm text-muted-foreground">Nenhum cliente encontrado na sua carteira</p>
              ) : (
                <div className="divide-y">
                  {filtered.map((c: any) => rich ? (() => {
                    const tax = customerTaxProfile(c);
                    const fantasia = String(c.nomeFantasia || '').trim();
                    const addr = [[c.address, c.number].filter(Boolean).join(', '), c.neighborhood, [c.city, c.uf].filter(Boolean).join('/'), c.cep].filter(Boolean).join(' - ');
                    return (
                      <div key={c.id} className="space-y-2 p-3">
                        <div role="button" tabIndex={0} className="cursor-pointer rounded hover:bg-muted/50" onClick={() => setFileOf(c)} onKeyDown={e => e.key === 'Enter' && setFileOf(c)}>
                          <p className="text-sm font-semibold text-primary underline-offset-2 hover:underline">
                            {c.name || '—'}
                            {!String(c.customerCode || '').trim() && <Badge variant="secondary" className="ml-2 text-[10px]">PROSPECT</Badge>}
                            {c.isActive === false && <Badge variant="outline" className="ml-2 text-[10px]">INATIVO</Badge>}
                          </p>
                          {fantasia && fantasia !== c.name && <p className="text-xs text-muted-foreground">Fantasia: {fantasia}</p>}
                          <p className="text-xs text-muted-foreground">
                            {c.customerCode ? `#${c.customerCode} • ` : ''}{tax.person === 'PJ' ? 'CNPJ ' : tax.person === 'PF' ? 'CPF ' : ''}{c.cpfCnpj ? formatCPFCNPJ(c.cpfCnpj) : '—'}
                          </p>
                          <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <span>IE: {tax.ie || '—'}</span>
                            {tax.highlight && <Badge className="bg-success text-[10px] text-success-foreground hover:bg-success">PJ com IE • desconto</Badge>}
                          </p>
                          <p className="text-xs text-muted-foreground">{addr || 'Endereço não cadastrado'}</p>
                          <p className="text-xs text-muted-foreground">{c.whatsapp || 'Sem telefone'} • Tabela {resolveStorePriceTable(storeSlug, c.priceTable)}</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button size="sm" disabled={selecting} onClick={() => void handleSelect(c as SellerCustomer)}>
                            <ShoppingCart className="mr-1 h-4 w-4" /> Selecionar
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setFileOf(c)}>
                            <FileText className="mr-1 h-4 w-4" /> Ver ficha
                          </Button>
                        </div>
                      </div>
                    );
                  })() : (
                    <Button variant="ghost"
                      key={c.id}
                      className="h-auto w-full flex-col items-start whitespace-normal p-3 text-left transition-colors hover:bg-muted/50"
                      disabled={selecting}
                      onClick={() => void handleSelect(c as SellerCustomer)}
                    >
                      <p className="text-sm font-medium">{c.name || '—'}</p>
                      <p className="text-xs text-muted-foreground">
                        {c.customerCode ? `#${c.customerCode} • ` : 'PROSPECT • '}{c.whatsapp || '—'}
                        {c.city ? ` • ${c.city}/${c.uf}` : ''} • Tabela {resolveStorePriceTable(storeSlug, c.priceTable)}
                      </p>
                    </Button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="new" className="mt-3 space-y-3">
            <div className="grid gap-1"><Label className="text-sm">{storeSlug === 'dicolore' ? 'CPF/CNPJ (opcional)' : 'CPF/CNPJ *'}</Label>
              <div className="relative">
                <Input
                  value={form.cpfCnpj}
                  placeholder="Digite o CNPJ para buscar os dados"
                  onChange={async e => {
                    const formatted = formatCPFCNPJ(e.target.value);
                    setForm(f => ({ ...f, cpfCnpj: formatted }));
                    const digits = formatted.replace(/\D/g, '');
                    const dup = await checkDuplicate(formatted);
                    if (dup) { toast.error(dup); return; }
                    if (digits.length === 14) {
                      setCnpjLoading(true);
                      try {
                        const d = await lookupCnpj(digits);
                        if (!d) throw new Error();
                        setForm(f => ({
                          ...f,
                          name: d.name || f.name,
                          ie: d.ie || f.ie,
                          whatsapp: f.whatsapp || (d.phone ? formatPhone(d.phone) : ''),
                          cep: d.cep ? formatCEP(d.cep) : f.cep,
                          uf: d.uf || f.uf, city: d.city || f.city,
                          neighborhood: d.neighborhood || f.neighborhood,
                          address: d.address || f.address,
                          number: d.number || f.number,
                          complement: d.complement || f.complement,
                        }));
                        toast.success(d.ie ? 'Dados do CNPJ e Inscrição Estadual preenchidos' : 'Dados do CNPJ preenchidos');
                      } catch {
                        toast.error('Não foi possível buscar este CNPJ. Preencha manualmente.');
                      } finally {
                        setCnpjLoading(false);
                      }
                    }
                  }}
                />
                {cnpjLoading && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />}
              </div>
              {duplicate && <p className="rounded-md bg-destructive/10 p-2 text-xs font-medium text-destructive">{duplicate}</p>}
            </div>
            <div className="grid gap-1"><Label className="text-sm">Inscrição Estadual</Label>
              <Input value={form.ie} placeholder="IE ou ISENTO" onChange={e => setForm(f => ({ ...f, ie: e.target.value }))} /></div>
            <div className="grid gap-1"><Label className="text-sm">Nome *</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value.toUpperCase() }))} /></div>
            <div className="grid gap-1"><Label className="text-sm">WhatsApp *</Label>
              <Input value={form.whatsapp} onChange={e => setForm(f => ({ ...f, whatsapp: formatPhone(e.target.value) }))} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div className="grid gap-1"><Label className="text-sm">CEP *</Label>
                <Input value={form.cep} onChange={async e => {
                  const formatted = formatCEP(e.target.value);
                  setForm(f => ({ ...f, cep: formatted }));
                  const cleaned = formatted.replace(/\D/g, '');
                  if (cleaned.length === 8) {
                    const r = await fetchAddressByCep(cleaned);
                    if (r) setForm(f => ({ ...f, uf: r.uf, city: r.city, neighborhood: r.neighborhood, address: r.address }));
                  }
                }} /></div>
              <div className="grid gap-1"><Label className="text-sm">Tabela de preço</Label>
                <Select value={form.priceTable} onValueChange={v => setForm(f => ({ ...f, priceTable: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Tabela 1</SelectItem>
                    <SelectItem value="3">Tabela 3</SelectItem>
                    <SelectItem value="4">Tabela 4</SelectItem>
                    <SelectItem value="8">Tabela 8</SelectItem>
                    <SelectItem value="9">Tabela 9</SelectItem>
                    <SelectItem value="11">Tabela 11</SelectItem>
                  </SelectContent>
                </Select></div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2 grid gap-1"><Label className="text-sm">Endereço *</Label>
                <Input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} /></div>
              <div className="grid gap-1"><Label className="text-sm">Nº *</Label>
                <Input value={form.number} onChange={e => setForm(f => ({ ...f, number: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="grid gap-1"><Label className="text-sm">Bairro *</Label>
                <Input value={form.neighborhood} onChange={e => setForm(f => ({ ...f, neighborhood: e.target.value }))} /></div>
              <div className="grid gap-1"><Label className="text-sm">Cidade *</Label>
                <Input value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} /></div>
              <div className="grid gap-1"><Label className="text-sm">UF *</Label>
                <Input value={form.uf} maxLength={2} onChange={e => setForm(f => ({ ...f, uf: e.target.value.toUpperCase() }))} /></div>
            </div>
            {sellerCodes.length > 1 && (
              <div className="grid gap-1"><Label className="text-sm">Representante</Label>
                <Select value={form.sellerCode} onValueChange={v => setForm(f => ({ ...f, sellerCode: v }))}>
                  <SelectTrigger><SelectValue placeholder="Código" /></SelectTrigger>
                  <SelectContent>{sellerCodes.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select></div>
            )}
            <Button className="w-full" onClick={handleCreate} disabled={createCustomer.isPending}>
              {createCustomer.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
              {createOnly ? 'Cadastrar cliente' : 'Cadastrar e selecionar'}
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
    <CustomerFileDialog customer={fileOf} storeId={storeId} onClose={() => setFileOf(null)} />
    </>
  );
}
