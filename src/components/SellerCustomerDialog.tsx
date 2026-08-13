import { useMemo, useState } from 'react';
import { Search, UserPlus, Loader2 } from 'lucide-react';
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

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storeId: string;
  /** Códigos de representante do vendedor. Vazio = vê todos (admin). */
  sellerCodes: string[];
  onSelected: (customer: SellerCustomer) => void;
}

export default function SellerCustomerDialog({ open, onOpenChange, storeId, sellerCodes, onSelected }: Props) {
  const { data: profiles = [], isLoading } = useStoreCustomerProfiles(storeId);
  const createCustomer = useCreateCustomerProfileAdmin();
  const [search, setSearch] = useState('');
  const [mode, setMode] = useState<'existing' | 'new'>('existing');
  const [form, setForm] = useState({
    name: '', whatsapp: '', cpfCnpj: '', cep: '', uf: '', city: '',
    neighborhood: '', address: '', number: '', complement: '',
    priceTable: '4', sellerCode: sellerCodes[0] || '',
  });

  const scoped = useMemo(() => {
    const codes = new Set(sellerCodes.map(c => c.trim()));
    const base = (profiles as any[]).filter(p => p.isActive !== false);
    if (codes.size === 0) return base;
    return base.filter(p => codes.has(String(p.sellerCode || '').trim()));
  }, [profiles, sellerCodes]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return scoped.slice(0, 300);
    const digits = term.replace(/\D/g, '');
    return scoped.filter((c: any) => {
      const hay = [c.name, c.customerCode, c.cpfCnpj, c.whatsapp, c.city, c.uf, c.address]
        .filter(Boolean).join(' ').toLowerCase();
      if (hay.includes(term)) return true;
      return digits.length >= 3 && hay.replace(/\D/g, '').includes(digits);
    }).slice(0, 300);
  }, [scoped, search]);

  const handleCreate = async () => {
    if (!form.name.trim()) { toast.error('Informe o nome do cliente'); return; }
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
        sellerCode: form.sellerCode || sellerCodes[0] || '',
        priceTable: Number(form.priceTable) as 1 | 4 | 9,
      });
      toast.success('Cliente cadastrado');
      onSelected(created as SellerCustomer);
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || 'Erro ao cadastrar cliente');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Selecionar cliente</DialogTitle></DialogHeader>

        <Tabs value={mode} onValueChange={v => setMode(v as any)}>
          <TabsList className="w-full">
            <TabsTrigger value="existing" className="flex-1">Minha carteira</TabsTrigger>
            <TabsTrigger value="new" className="flex-1"><UserPlus className="mr-1 h-4 w-4" /> Novo cliente</TabsTrigger>
          </TabsList>

          <TabsContent value="existing" className="mt-3">
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="Nome, código, WhatsApp ou CNPJ/CPF..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <ScrollArea className="h-[320px] rounded-md border">
              {isLoading ? (
                <div className="flex h-24 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>
              ) : filtered.length === 0 ? (
                <p className="p-4 text-center text-sm text-muted-foreground">Nenhum cliente encontrado na sua carteira</p>
              ) : (
                <div className="divide-y">
                  {filtered.map((c: any) => (
                    <button
                      key={c.id}
                      className="w-full p-3 text-left transition-colors hover:bg-muted/50"
                      onClick={() => { onSelected(c as SellerCustomer); onOpenChange(false); }}
                    >
                      <p className="text-sm font-medium">{c.name || '—'}</p>
                      <p className="text-xs text-muted-foreground">
                        {c.customerCode ? `#${c.customerCode} • ` : ''}{c.whatsapp || '—'}
                        {c.city ? ` • ${c.city}/${c.uf}` : ''} • Tabela {c.priceTable ?? 4}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="new" className="mt-3 space-y-3">
            <div className="grid gap-1"><Label className="text-sm">Nome *</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value.toUpperCase() }))} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div className="grid gap-1"><Label className="text-sm">WhatsApp</Label>
                <Input value={form.whatsapp} onChange={e => setForm(f => ({ ...f, whatsapp: formatPhone(e.target.value) }))} /></div>
              <div className="grid gap-1"><Label className="text-sm">CPF/CNPJ</Label>
                <Input value={form.cpfCnpj} onChange={e => setForm(f => ({ ...f, cpfCnpj: formatCPFCNPJ(e.target.value) }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="grid gap-1"><Label className="text-sm">CEP</Label>
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
                    <SelectItem value="4">Tabela 4</SelectItem>
                    <SelectItem value="9">Tabela 9</SelectItem>
                  </SelectContent>
                </Select></div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2 grid gap-1"><Label className="text-sm">Endereço</Label>
                <Input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} /></div>
              <div className="grid gap-1"><Label className="text-sm">Nº</Label>
                <Input value={form.number} onChange={e => setForm(f => ({ ...f, number: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="grid gap-1"><Label className="text-sm">Bairro</Label>
                <Input value={form.neighborhood} onChange={e => setForm(f => ({ ...f, neighborhood: e.target.value }))} /></div>
              <div className="grid gap-1"><Label className="text-sm">Cidade</Label>
                <Input value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} /></div>
              <div className="grid gap-1"><Label className="text-sm">UF</Label>
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
              Cadastrar e selecionar
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
