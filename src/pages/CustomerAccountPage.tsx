import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useStoreBySlug } from '@/hooks/useStores';
import { useCustomerProfile } from '@/hooks/useCustomerProfile';
import { useCustomerAddresses } from '@/hooks/useCustomerAddresses';
import { isManagedCustomerStore } from '@/lib/customerDataAccess';
import { supabase } from '@/integrations/supabase/client';
import CustomerAuthDialog from '@/components/CustomerAuthDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getCustomerError } from '@/lib/customerValidation';
import { fetchAddressByCep } from '@/lib/cepLookup';
import { toast } from 'sonner';

const emptyAddress = { label: '', cep: '', uf: '', city: '', neighborhood: '', address: '', number: '', complement: '' };
export default function CustomerAccountPage() {
  const { slug } = useParams();
  const { user, loading } = useAuth();
  const { data: store } = useStoreBySlug(slug || '');
  const { data: profile } = useCustomerProfile(user?.id, store?.id);
  const { data: addresses = [] } = useCustomerAddresses(user?.id, store?.id, slug);
  const [edit, setEdit] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [address, setAddress] = useState(emptyAddress);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const qc = useQueryClient();
  const saveAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!store || !user) return;
    const invalid = getCustomerError({ ...profile, ...address, cpfCnpj: profile?.cpfCnpj || '', name: profile?.name || '', whatsapp: profile?.whatsapp || '' });
    if (invalid) { toast.error(invalid); return; }
    setBusy(true);
    try {
      const { data: { user: verified } } = await supabase.auth.getUser();
      if (!verified) throw new Error('Faça login novamente.');
      const payload = { ...address, label: address.label.trim() || 'Endereço', store_id: store.id, user_id: verified.id };
      const result = editingId
        ? await supabase.from('customer_addresses').update(payload).eq('id', editingId).select().single()
        : await supabase.from('customer_addresses').insert(payload).select().single();
      if (result.error) throw result.error;
      await qc.invalidateQueries({ queryKey: ['customer-addresses'] });
      setAddress(emptyAddress); setEditingId(null); toast.success('Endereço salvo.');
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Não foi possível salvar.'); }
    finally { setBusy(false); }
  };
  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) { toast.error('Use no mínimo 8 caracteres, com letras e números.'); return; }
    if (password !== confirm) { toast.error('As senhas não são iguais.'); return; }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) toast.error('Não foi possível alterar a senha. Use uma senha forte, não utilizada anteriormente ou vazada.');
    else { setPassword(''); setConfirm(''); toast.success('Senha alterada.'); }
  };
  if (!store || loading) return <p className="p-6">Carregando…</p>;
  if (isManagedCustomerStore(slug)) return <div className="p-6"><Button asChild variant="outline"><Link to={`/${slug}`}>Voltar à loja</Link></Button><p className="mt-4">Seu cadastro é mantido pela loja. Solicite alterações ao seu representante.</p></div>;
  return <main className="mx-auto max-w-2xl space-y-8 px-4 py-6"><header className="flex items-center justify-between gap-4"><h1 className="text-2xl font-bold">Meus dados</h1><Button asChild variant="outline"><Link to={`/${slug}`}>Voltar à loja</Link></Button></header>
    {!user ? <Button onClick={() => setEdit(true)}>Entrar</Button> : <>
      <section className="space-y-3 border-b pb-6"><h2 className="text-lg font-semibold">Cadastro e endereço principal</h2><p>{profile?.name}</p><p>{profile?.address}, {profile?.number} {profile?.complement}</p><p>{profile?.city} / {profile?.uf} · {profile?.cep}</p><Button onClick={() => setEdit(true)}>Editar meus dados</Button></section>
      <section className="space-y-4 border-b pb-6"><h2 className="text-lg font-semibold">Meus endereços</h2>{addresses.map(a => <div key={a.id} className="flex justify-between gap-3 border-b pb-3"><div><p className="font-medium">{a.label}</p><p className="text-sm">{a.address}, {a.number} · {a.city}/{a.uf}</p></div><Button variant="outline" onClick={() => { setAddress({ label: a.label, cep: a.cep, uf: a.uf, city: a.city, neighborhood: a.neighborhood, address: a.address, number: a.number, complement: a.complement }); setEditingId(a.id); }}>Editar</Button></div>)}
        <form onSubmit={saveAddress} className="grid gap-3 sm:grid-cols-2"><h3 className="font-semibold sm:col-span-2">{editingId ? 'Editar endereço' : 'Adicionar endereço'}</h3>
        {Object.keys(emptyAddress).map(key => { const k = key as keyof typeof emptyAddress; const labels = { label: 'Nome do endereço', cep: 'CEP', uf: 'UF', city: 'Cidade', neighborhood: 'Bairro', address: 'Rua', number: 'Número', complement: 'Complemento (opcional)' }; return <div key={k} className="space-y-1"><Label htmlFor={`account-${k}`}>{labels[k]}</Label><Input id={`account-${k}`} value={address[k]} maxLength={k === 'uf' ? 2 : 250} onChange={async e => { const value = k === 'uf' ? e.target.value.toUpperCase() : e.target.value; setAddress(a => ({ ...a, [k]: value })); if (k === 'cep' && value.replace(/\D/g, '').length === 8) { const found = await fetchAddressByCep(value.replace(/\D/g, '')); if (found) setAddress(a => ({ ...a, ...found })); } }} /></div>; })}
        <Button disabled={busy} type="submit">Salvar endereço</Button>{editingId && <Button type="button" variant="outline" onClick={() => { setEditingId(null); setAddress(emptyAddress); }}>Cancelar</Button>}</form>
      </section>
      <form onSubmit={changePassword} className="space-y-3"><h2 className="text-lg font-semibold">Alterar senha</h2><p className="text-sm text-muted-foreground">No mínimo 8 caracteres com letras e números. Prefira maiúsculas, minúsculas e símbolos; evite senhas comuns.</p><Label htmlFor="account-password">Nova senha</Label><Input id="account-password" autoComplete="new-password" type="password" value={password} onChange={e => setPassword(e.target.value)} /><Label htmlFor="account-confirm">Confirmar nova senha</Label><Input id="account-confirm" type="password" autoComplete="new-password" value={confirm} onChange={e => setConfirm(e.target.value)} /><Button disabled={busy}>Alterar senha</Button></form>
    </>}
    <CustomerAuthDialog open={edit} onOpenChange={setEdit} storeId={store.id} storeSlug={slug} startAtProfile={!!user} />
  </main>;
}