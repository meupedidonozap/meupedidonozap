import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON = Deno.env.get('SUPABASE_ANON_KEY')!;
const CLIENT_ID = Deno.env.get('BLING_CLIENT_ID')!;
const CLIENT_SECRET = Deno.env.get('BLING_CLIENT_SECRET')!;
const admin = createClient(SUPABASE_URL, SERVICE);
const API = 'https://api.bling.com.br/Api/v3';

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

async function getToken(storeId: string): Promise<string> {
  const { data: c } = await admin.from('bling_connections').select('*').eq('store_id', storeId).maybeSingle();
  if (!c?.access_token) throw new Error('Bling não conectado');
  if (c.expires_at && new Date(c.expires_at).getTime() - Date.now() > 120000) return c.access_token;
  const r = await fetch(`${API}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: 'Basic ' + btoa(`${CLIENT_ID}:${CLIENT_SECRET}`) },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: c.refresh_token }),
  });
  const t = await r.json();
  if (!r.ok || !t.access_token) throw new Error('Falha ao renovar acesso ao Bling — reconecte');
  await admin.from('bling_connections').update({
    access_token: t.access_token, refresh_token: t.refresh_token ?? c.refresh_token,
    expires_at: new Date(Date.now() + (t.expires_in ?? 21600) * 1000).toISOString(), updated_at: new Date().toISOString(),
  }).eq('store_id', storeId);
  return t.access_token;
}

async function bling(token: string, path: string) {
  for (let i = 0; i < 3; i++) {
    const r = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } });
    if (r.status === 429) { await new Promise((s) => setTimeout(s, 1200)); continue; }
    const b = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(`Bling ${r.status}: ${b?.error?.description || b?.error?.message || 'erro'}`);
    return b;
  }
  throw new Error('Bling: limite de requisições');
}

async function syncProducts(storeId: string) {
  const token = await getToken(storeId);
  const all: any[] = [];
  for (let page = 1; page <= 50; page++) {
    // criterio=5: todos (ativos e inativos) para espelhar a situação do Bling
    const b = await bling(token, `/produtos?pagina=${page}&limite=100&criterio=5`);
    const rows = b?.data ?? [];
    all.push(...rows);
    if (rows.length < 100) break;
    await new Promise((s) => setTimeout(s, 350));
  }
  const { data: existing } = await admin.from('products').select('id, code, bling_code, is_active').eq('store_id', storeId);
  const byBling = new Map<string, any>(), byCode = new Map<string, any>();
  for (const p of existing ?? []) {
    if (p.bling_code) byBling.set(String(p.bling_code).trim(), p);
    if (p.code) byCode.set(String(p.code).trim(), p);
  }
  const { data: vars } = await admin.from('product_variants').select('id, sku, products!inner(store_id)').eq('products.store_id', storeId);
  const varBySku = new Map<string, string>();
  for (const v of vars ?? []) if (v.sku) varBySku.set(String(v.sku).trim(), v.id);

  let created = 0, stockUpdated = 0, skipped = 0, statusChanged = 0;
  for (const it of all) {
    const code = String(it.codigo ?? '').trim();
    if (!code || it.formato === 'V') { skipped++; continue; } // pai de variação: filhos vêm com código próprio
    if (it.situacao === 'E') { skipped++; continue; } // excluído no Bling
    const blingActive = (it.situacao ?? 'A') === 'A'; // Bling manda no status Ativo/Inativo
    const stock = Math.max(0, Math.round(Number(it.estoque?.saldoVirtualTotal ?? 0)));
    const varId = varBySku.get(code);
    if (varId) { await admin.from('product_variants').update({ stock }).eq('id', varId); stockUpdated++; continue; }
    const found = byBling.get(code) ?? byCode.get(code);
    if (found) {
      if (found.is_active !== blingActive) statusChanged++;
      await admin.from('products').update({ stock, bling_code: code, is_active: blingActive }).eq('id', found.id);
      stockUpdated++;
      continue;
    }
    const { error } = await admin.from('products').insert({
      store_id: storeId, code, bling_code: code, name: String(it.nome ?? code).slice(0, 250),
      description: '', base_price: Number(it.preco ?? 0) || 0, stock, is_active: blingActive,
    });
    if (error) { console.error('insert', code, error.message); skipped++; } else created++;
  }
  return { total: all.length, created, stockUpdated, skipped };
}

async function syncCustomers(storeId: string) {
  const token = await getToken(storeId);
  const { data: profiles } = await admin.from('customer_profiles').select('id, cpf_cnpj').eq('store_id', storeId);
  const byDoc = new Map<string, string>();
  for (const p of profiles ?? []) { const d = (p.cpf_cnpj || '').replace(/\D/g, ''); if (d) byDoc.set(d, p.id); }
  let updated = 0, total = 0;
  for (let page = 1; page <= 50; page++) {
    const b = await bling(token, `/contatos?pagina=${page}&limite=100`);
    const rows = b?.data ?? [];
    total += rows.length;
    for (const c of rows) {
      const doc = String(c.numeroDocumento ?? '').replace(/\D/g, '');
      const id = byDoc.get(doc);
      if (!id) continue; // só atualiza quem já existe
      const patch: Record<string, unknown> = {};
      if (c.nome) patch.name = c.nome;
      const tel = String(c.celular || c.telefone || '').replace(/\D/g, '');
      if (tel) patch.whatsapp = tel;
      if (Object.keys(patch).length) { await admin.from('customer_profiles').update(patch).eq('id', id); updated++; }
    }
    if (rows.length < 100) break;
    await new Promise((s) => setTimeout(s, 350));
  }
  return { total, updated };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || '');
    // Execução agendada: sincroniza estoque de todas as lojas conectadas
    if (action === 'cron') {
      const { data: conns } = await admin.from('bling_connections').select('store_id').not('access_token', 'is', null);
      const out: Record<string, unknown> = {};
      for (const c of conns ?? []) {
        try { out[c.store_id] = await syncProducts(c.store_id); } catch (e) { out[c.store_id] = { error: (e as Error).message }; }
      }
      return json(out);
    }
    const auth = req.headers.get('Authorization') || '';
    const userClient = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: auth } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: 'unauthorized' }, 401);
    const storeId = String(body.store_id || '');
    if (!/^[0-9a-f-]{36}$/.test(storeId)) return json({ error: 'store_id inválido' }, 400);
    const { data: isAdm } = await admin.rpc('is_store_admin', { _user_id: user.id, _store_id: storeId });
    const { data: isPlat } = await admin.rpc('is_platform_admin', { _user_id: user.id });
    if (!isAdm && !isPlat) return json({ error: 'forbidden' }, 403);
    if (action === 'products') return json(await syncProducts(storeId));
    if (action === 'customers') return json(await syncCustomers(storeId));
    if (action === 'set_status') {
      const pid = String(body.product_id || '');
      const { data: p } = await admin.from('products').select('code, bling_code').eq('id', pid).eq('store_id', storeId).maybeSingle();
      if (!p) return json({ error: 'produto não encontrado' }, 404);
      const code = String(p.bling_code || p.code || '').trim();
      if (!code) return json({ skipped: 'produto sem código Bling' });
      const token = await getToken(storeId);
      const found = await bling(token, `/produtos?codigos[]=${encodeURIComponent(code)}&criterio=5`);
      const bid = found?.data?.[0]?.id;
      if (!bid) return json({ skipped: 'produto não existe no Bling' });
      const r = await fetch(`${API}/produtos/${bid}/situacoes`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ situacao: body.active ? 'A' : 'I' }),
      });
      if (!r.ok) { const b = await r.json().catch(() => ({})); return json({ error: `Bling ${r.status}: ${b?.error?.description || 'erro'}` }, 502); }
      return json({ ok: true });
    }
    return json({ error: 'ação inválida' }, 400);
  } catch (e) {
    console.error(e);
    return json({ error: (e as Error).message }, 500);
  }
});
