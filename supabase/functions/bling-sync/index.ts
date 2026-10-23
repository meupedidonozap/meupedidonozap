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

const wait = (ms: number) => new Promise((s) => setTimeout(s, ms));
const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

// "Cor:Lilás;Tamanho:P" -> { color, size }
export function parseVariation(nome: string) {
  let color: string | null = null, size: string | null = null;
  const extra: string[] = [];
  for (const part of String(nome || '').split(';')) {
    const [k, ...rest] = part.split(':');
    const v = rest.join(':').trim();
    if (!v) continue;
    const key = norm(k);
    if (key.startsWith('cor')) color = v;
    else if (key.startsWith('tam') || key === 'numero' || key === 'num') size = v;
    else extra.push(v);
  }
  if (!color && !size && extra.length) color = extra.join(' / ');
  else if (extra.length) size = [size, ...extra].filter(Boolean).join(' / ');
  return { color, size };
}

function commonPrefix(codes: string[]) {
  if (!codes.length) return '';
  let p = codes[0];
  for (const c of codes) while (!c.startsWith(p)) p = p.slice(0, -1);
  return p.replace(/[-_. ]+$/, '');
}

function imageLinks(midia: any): string[] {
  const im = midia?.imagens ?? {};
  return [...(im.internas ?? []), ...(im.externas ?? [])].map((i: any) => String(i?.link || '')).filter(Boolean);
}

async function sha1(s: string) {
  const h = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(s));
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Baixa a foto do Bling (links internos expiram) e guarda no armazenamento da loja; evita repetidas.
async function addImages(storeId: string, productId: string, links: string[], label: string | null, state: { added: number }) {
  if (!links.length) return;
  const { data: imgs } = await admin.from('product_images').select('image_url, sort_order').eq('product_id', productId);
  const have = new Set((imgs ?? []).map((i: any) => i.image_url));
  let order = Math.max(-1, ...(imgs ?? []).map((i: any) => i.sort_order ?? 0)) + 1;
  for (const link of links) {
    const key = await sha1(link.split('?')[0]);
    const path = `${storeId}/bling/${key}.jpg`;
    const { data: pub } = admin.storage.from('product-images').getPublicUrl(path);
    if (have.has(pub.publicUrl)) continue;
    try {
      const r = await fetch(link);
      if (!r.ok) continue;
      const buf = new Uint8Array(await r.arrayBuffer());
      const { error } = await admin.storage.from('product-images').upload(path, buf, { upsert: true, contentType: r.headers.get('content-type') || 'image/jpeg' });
      if (error) { console.error('upload', error.message); continue; }
    } catch (e) { console.error('foto', (e as Error).message); continue; }
    await admin.from('product_images').insert({ product_id: productId, image_url: pub.publicUrl, sort_order: order++, label });
    have.add(pub.publicUrl);
    state.added++;
  }
  const { data: p } = await admin.from('products').select('image_url').eq('id', productId).maybeSingle();
  if (!p?.image_url) {
    const { data: first } = await admin.from('product_images').select('image_url').eq('product_id', productId).order('sort_order').limit(1).maybeSingle();
    if (first) await admin.from('products').update({ image_url: first.image_url }).eq('id', productId);
  }
}

async function syncProducts(storeId: string, withImages = false) {
  const token = await getToken(storeId);
  const all: any[] = [];
  for (let page = 1; page <= 50; page++) {
    // criterio=5: todos (ativos e inativos) para espelhar a situação do Bling
    const b = await bling(token, `/produtos?pagina=${page}&limite=100&criterio=5`);
    const rows = b?.data ?? [];
    all.push(...rows);
    if (rows.length < 100) break;
    await wait(350);
  }
  const stockByCode = new Map<string, number>();
  for (const it of all) if (it.codigo) stockByCode.set(String(it.codigo).trim(), Math.max(0, Math.round(Number(it.estoque?.saldoVirtualTotal ?? 0))));

  const { data: existing } = await admin.from('products').select('id, code, bling_code, is_active, has_variants').eq('store_id', storeId);
  const byBling = new Map<string, any>(), byCode = new Map<string, any>();
  for (const p of existing ?? []) {
    if (p.bling_code) byBling.set(String(p.bling_code).trim(), p);
    if (p.code) byCode.set(String(p.code).trim(), p);
  }
  const { data: vars } = await admin.from('product_variants').select('id, sku, product_id, products!inner(store_id)').eq('products.store_id', storeId);
  const varBySku = new Map<string, any>();
  for (const v of vars ?? []) if (v.sku) varBySku.set(String(v.sku).trim(), v);

  let created = 0, stockUpdated = 0, skipped = 0, statusChanged = 0, variantsUpdated = 0, oldDeactivated = 0;
  const img = { added: 0 };
  const variantCodes = new Set<string>();

  // 1) Produtos com variação: um produto pai + variantes
  for (const it of all.filter((x) => x.formato === 'V' && x.situacao !== 'E')) {
    let det: any;
    try { det = (await bling(token, `/produtos/${it.id}`))?.data; } catch (e) { console.error('det', it.id, (e as Error).message); skipped++; continue; }
    await wait(350);
    const variacoes: any[] = (det?.variacoes ?? []).filter((v: any) => v?.codigo && v.situacao !== 'E');
    if (!variacoes.length) continue;
    const vcodes = variacoes.map((v) => String(v.codigo).trim());
    vcodes.forEach((c) => variantCodes.add(c));
    // saldo das variações que não vieram na listagem
    const missing = variacoes.filter((v) => !stockByCode.has(String(v.codigo).trim()) && v.id);
    if (missing.length) {
      try {
        const q = missing.map((v) => `idsProdutos[]=${v.id}`).join('&');
        const s = await bling(token, `/estoques/saldos?${q}`);
        for (const r of s?.data ?? []) {
          const v = missing.find((m) => String(m.id) === String(r.produto?.id));
          if (v) stockByCode.set(String(v.codigo).trim(), Math.max(0, Math.round(Number(r.saldoVirtualTotal ?? 0))));
        }
      } catch (e) { console.error('saldos', (e as Error).message); }
      await wait(350);
    }
    const parentCode = String(det.codigo || it.codigo || '').trim() || commonPrefix(vcodes) || vcodes[0];
    const active = (det.situacao ?? it.situacao ?? 'A') === 'A';
    const price = Number(det.preco ?? it.preco ?? variacoes[0]?.preco ?? 0) || 0;
    const totalStock = variacoes.reduce((s, v) => s + ((v.situacao ?? 'A') === 'A' ? (stockByCode.get(String(v.codigo).trim()) ?? 0) : 0), 0);
    let parent = byBling.get(parentCode) ?? byCode.get(parentCode);
    if (parent) {
      if (parent.is_active !== active) statusChanged++;
      await admin.from('products').update({ bling_code: parentCode, has_variants: true, is_active: active, stock: totalStock }).eq('id', parent.id);
      stockUpdated++;
    } else {
      const { data: ins, error } = await admin.from('products').insert({
        store_id: storeId, code: parentCode, bling_code: parentCode, name: String(det.nome ?? it.nome ?? parentCode).slice(0, 250),
        description: String(det.descricaoCurta ?? '').replace(/<[^>]+>/g, '').slice(0, 2000), base_price: price, price_table_4: price,
        stock: totalStock, has_variants: true, is_active: active,
      }).select('id, code, bling_code, is_active, has_variants').single();
      if (error) { console.error('insert pai', parentCode, error.message); skipped++; continue; }
      parent = ins; created++; byCode.set(parentCode, ins); byBling.set(parentCode, ins);
    }
    for (const v of variacoes) {
      const sku = String(v.codigo).trim();
      const { color, size } = parseVariation(v.variacao?.nome ?? v.nome ?? '');
      const vActive = (v.situacao ?? 'A') === 'A';
      const vprice = Number(v.preco ?? 0) || price;
      const stock = vActive ? (stockByCode.get(sku) ?? 0) : 0;
      const ex = varBySku.get(sku);
      if (ex) {
        await admin.from('product_variants').update({ product_id: parent.id, color, size, stock, price: vprice, price_table_4: vprice }).eq('id', ex.id);
      } else {
        const { data: nv, error } = await admin.from('product_variants').insert({ product_id: parent.id, sku, color, size, stock, price: vprice, price_table_4: vprice }).select('id, sku, product_id').single();
        if (error) { console.error('variante', sku, error.message); continue; }
        varBySku.set(sku, nv);
      }
      variantsUpdated++;
      // produto avulso antigo com o mesmo código da variação: inativa (não apaga, preserva histórico)
      const old = byCode.get(sku) ?? byBling.get(sku);
      if (old && old.id !== parent.id && old.is_active) {
        await admin.from('products').update({ is_active: false }).eq('id', old.id);
        old.is_active = false; oldDeactivated++;
      }
      if (withImages) await addImages(storeId, parent.id, imageLinks(v.midia), color || size, img);
    }
    if (withImages) await addImages(storeId, parent.id, imageLinks(det.midia), null, img);
  }

  // 2) Produtos simples
  for (const it of all) {
    const code = String(it.codigo ?? '').trim();
    if (!code || it.formato === 'V' || variantCodes.has(code)) { continue; }
    if (it.situacao === 'E') { skipped++; continue; } // excluído no Bling
    const blingActive = (it.situacao ?? 'A') === 'A'; // Bling manda no status Ativo/Inativo
    const stock = stockByCode.get(code) ?? 0;
    const v = varBySku.get(code);
    if (v) { await admin.from('product_variants').update({ stock }).eq('id', v.id); stockUpdated++; continue; }
    let found = byBling.get(code) ?? byCode.get(code);
    if (found) {
      if (found.is_active !== blingActive) statusChanged++;
      await admin.from('products').update({ stock, bling_code: code, is_active: blingActive }).eq('id', found.id);
      stockUpdated++;
    } else {
      const { data: ins, error } = await admin.from('products').insert({
        store_id: storeId, code, bling_code: code, name: String(it.nome ?? code).slice(0, 250),
        description: '', base_price: Number(it.preco ?? 0) || 0, price_table_4: Number(it.preco ?? 0) || 0, stock, is_active: blingActive,
      }).select('id').single();
      if (error) { console.error('insert', code, error.message); skipped++; continue; }
      created++; found = ins;
    }
    if (withImages) {
      const links = imageLinks(it.midia);
      let l = links;
      if (!l.length) {
        try { l = imageLinks((await bling(token, `/produtos/${it.id}`))?.data?.midia); } catch (_) { l = []; }
        await wait(350);
      }
      await addImages(storeId, found.id, l, null, img);
    }
  }
  return { total: all.length, created, stockUpdated, statusChanged, skipped, variantsUpdated, imagesAdded: img.added, oldDeactivated };
}

async function syncCustomers(storeId: string) {
  const token = await getToken(storeId);
  const { data: profiles } = await admin.from('customer_profiles').select('id, cpf_cnpj, customer_code').eq('store_id', storeId);
  const byDoc = new Map<string, string>();
  const byCode = new Map<string, string>();
  for (const p of profiles ?? []) {
    const d = (p.cpf_cnpj || '').replace(/\D/g, '');
    if (d) byDoc.set(d, p.id);
    if (p.customer_code) byCode.set(String(p.customer_code).trim(), p.id);
  }
  let updated = 0, created = 0, total = 0, failed = 0;
  for (let page = 1; page <= 50; page++) {
    const b = await bling(token, `/contatos?pagina=${page}&limite=100`);
    const rows = b?.data ?? [];
    total += rows.length;
    for (const c of rows) {
      let det: any = c;
      try { det = (await bling(token, `/contatos/${c.id}`))?.data ?? c; } catch (_) { /* usa resumo */ }
      await new Promise((s) => setTimeout(s, 350));
      const doc = String(det.numeroDocumento ?? '').replace(/\D/g, '');
      const code = String(det.codigo || c.id || '').trim();
      const e = det.endereco?.geral ?? {};
      const tel = String(det.celular || det.telefone || '').replace(/\D/g, '');
      const data: Record<string, unknown> = {
        name: String(det.nome || '').slice(0, 250),
        cpf_cnpj: doc,
        customer_code: code,
        is_active: String(det.situacao || 'A').toUpperCase() !== 'I',
      };
      if (tel) data.whatsapp = tel;
      if (det.ie) data.ie = String(det.ie);
      if (e.cep) data.cep = String(e.cep).replace(/\D/g, '');
      if (e.uf) data.uf = String(e.uf);
      if (e.municipio) data.city = String(e.municipio);
      if (e.bairro) data.neighborhood = String(e.bairro);
      if (e.endereco) data.address = String(e.endereco);
      if (e.numero) data.number = String(e.numero);
      if (e.complemento) data.complement = String(e.complemento);
      const id = (doc && byDoc.get(doc)) || byCode.get(code);
      if (id) {
        const { error } = await admin.from('customer_profiles').update(data).eq('id', id);
        if (error) { console.error('upd', code, error.message); failed++; } else updated++;
      } else {
        const { data: ins, error } = await admin.from('customer_profiles').insert({ store_id: storeId, ...data }).select('id').single();
        if (error) { console.error('ins', code, error.message); failed++; }
        else { created++; if (doc) byDoc.set(doc, ins.id); byCode.set(code, ins.id); }
      }
    }
    if (rows.length < 100) break;
  }
  return { total, created, updated, failed };
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
