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
const toStock = (n: unknown) => Math.max(0, Math.round(Number(n ?? 0) || 0));

// "Cor:Lilás;Tamanho:P" -> { color, size }
function parseVariation(nome: string) {
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

async function listAll(token: string) {
  const all: any[] = [];
  for (let page = 1; page <= 100; page++) {
    const b = await bling(token, `/produtos?pagina=${page}&limite=100&criterio=5`);
    const rows = b?.data ?? [];
    all.push(...rows);
    if (rows.length < 100) break;
    await wait(350);
  }
  return all;
}

async function saldos(token: string, ids: (string | number)[]) {
  const out = new Map<string, number>();
  for (let i = 0; i < ids.length; i += 50) {
    const q = ids.slice(i, i + 50).map((id) => `idsProdutos[]=${id}`).join('&');
    try {
      const s = await bling(token, `/estoques/saldos?${q}`);
      for (const r of s?.data ?? []) out.set(String(r.produto?.id), toStock(r.saldoVirtualTotal));
    } catch (e) { console.error('saldos', (e as Error).message); }
    await wait(350);
  }
  return out;
}

type ImgJob = { productId: string; links: string[]; label: string | null };

// Processa até 10 produtos do Bling (pelo id). Retorna códigos das variações e fotos a baixar.
async function productsBatch(storeId: string, ids: string[]) {
  const token = await getToken(storeId);
  let created = 0, updated = 0, variants = 0, failed = 0;
  const variantCodes: string[] = [], images: ImgJob[] = [], errors: string[] = [];
  for (const id of ids) {
    let det: any;
    try { det = (await bling(token, `/produtos/${id}`))?.data; } catch (e) { failed++; errors.push(`${id}: ${(e as Error).message}`); continue; }
    await wait(350);
    if (!det || det.situacao === 'E') continue;
    const active = (det.situacao ?? 'A') === 'A';
    const price = Number(det.preco ?? 0) || 0;
    const desc = String(det.descricaoCurta ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 2000);
    const unit = String(det.unidade || '').trim().slice(0, 10) || undefined;
    const variacoes: any[] = det.formato === 'V' ? (det.variacoes ?? []).filter((v: any) => v?.codigo && v.situacao !== 'E') : [];

    if (det.formato === 'V' && variacoes.length) {
      const vcodes = variacoes.map((v) => String(v.codigo).trim());
      variantCodes.push(...vcodes);
      const st = await saldos(token, variacoes.map((v) => v.id).filter(Boolean));
      const code = String(det.codigo || '').trim() || commonPrefix(vcodes) || vcodes[0];
      const stockOf = (v: any) => ((v.situacao ?? 'A') === 'A' ? (st.get(String(v.id)) ?? toStock(v.estoque?.saldoVirtualTotal)) : 0);
      const total = variacoes.reduce((s, v) => s + stockOf(v), 0);
      const parentPrice = price || Number(variacoes[0]?.preco ?? 0) || 0;
      const { data: ex } = await admin.from('products').select('id').eq('store_id', storeId).or(`bling_code.eq.${code},code.eq.${code}`).limit(1).maybeSingle();
      let pid = ex?.id as string | undefined;
      if (pid) {
        await admin.from('products').update({ bling_code: code, has_variants: true, is_active: active, stock: total }).eq('id', pid);
        updated++;
      } else {
        const { data: ins, error } = await admin.from('products').insert({
          store_id: storeId, code, bling_code: code, name: String(det.nome ?? code).slice(0, 250), description: desc,
          base_price: parentPrice, price_table_4: parentPrice, stock: total, has_variants: true, is_active: active, ...(unit ? { unit } : {}),
        }).select('id').single();
        if (error) { failed++; errors.push(`${code}: ${error.message}`); continue; }
        pid = ins.id; created++;
      }
      const { data: curVars } = await admin.from('product_variants').select('id, sku').eq('product_id', pid);
      const bySku = new Map((curVars ?? []).map((v: any) => [String(v.sku).trim(), v.id]));
      for (const v of variacoes) {
        const sku = String(v.codigo).trim();
        const { color, size } = parseVariation(v.variacao?.nome ?? v.nome ?? '');
        const vp = Number(v.preco ?? 0) || parentPrice;
        const row = { product_id: pid, sku, color, size, stock: stockOf(v), price: vp, price_table_4: vp };
        const vid = bySku.get(sku);
        const { error } = vid ? await admin.from('product_variants').update(row).eq('id', vid) : await admin.from('product_variants').insert(row);
        if (error) { errors.push(`${sku}: ${error.message}`); continue; }
        variants++;
        const l = imageLinks(v.midia);
        if (l.length) images.push({ productId: pid!, links: l, label: color || size });
      }
      // produto avulso com o código de uma variação: inativa
      await admin.from('products').update({ is_active: false }).eq('store_id', storeId).neq('id', pid).in('code', vcodes);
      const pl = imageLinks(det.midia);
      if (pl.length) images.unshift({ productId: pid!, links: pl, label: null });
      continue;
    }

    // simples / composto
    const code = String(det.codigo || '').trim();
    if (!code) continue;
    const stock = toStock(det.estoque?.saldoVirtualTotal ?? (await saldos(token, [id])).get(String(id)));
    const { data: ex } = await admin.from('products').select('id').eq('store_id', storeId).or(`bling_code.eq.${code},code.eq.${code}`).limit(1).maybeSingle();
    let pid = ex?.id as string | undefined;
    if (pid) {
      await admin.from('products').update({ bling_code: code, stock, is_active: active }).eq('id', pid);
      updated++;
    } else {
      const { data: ins, error } = await admin.from('products').insert({
        store_id: storeId, code, bling_code: code, name: String(det.nome ?? code).slice(0, 250), description: desc,
        base_price: price, price_table_4: price, stock, is_active: active, ...(unit ? { unit } : {}),
      }).select('id').single();
      if (error) { failed++; errors.push(`${code}: ${error.message}`); continue; }
      pid = ins.id; created++;
    }
    const pl = imageLinks(det.midia);
    if (pl.length) images.push({ productId: pid!, links: pl, label: null });
  }
  return { created, updated, variants, failed, variantCodes, images, errors: errors.slice(0, 10) };
}

// Baixa as fotos (links do Bling expiram) e guarda no MPZ; ignora as que já existem.
async function imagesBatch(storeId: string, jobs: ImgJob[]) {
  let added = 0;
  for (const job of jobs.slice(0, 8)) {
    const { data: p } = await admin.from('products').select('id, image_url').eq('id', job.productId).eq('store_id', storeId).maybeSingle();
    if (!p) continue;
    const { data: imgs } = await admin.from('product_images').select('image_url, sort_order').eq('product_id', p.id);
    const have = new Set((imgs ?? []).map((i: any) => i.image_url));
    let order = Math.max(-1, ...(imgs ?? []).map((i: any) => i.sort_order ?? 0)) + 1;
    for (const link of job.links.slice(0, 10)) {
      const path = `${storeId}/bling/${await sha1(link.split('?')[0])}.jpg`;
      const url = admin.storage.from('product-images').getPublicUrl(path).data.publicUrl;
      if (have.has(url)) continue;
      try {
        const r = await fetch(link, { signal: AbortSignal.timeout(15000) });
        if (!r.ok) continue;
        const buf = new Uint8Array(await r.arrayBuffer());
        const { error } = await admin.storage.from('product-images').upload(path, buf, { upsert: true, contentType: r.headers.get('content-type') || 'image/jpeg' });
        if (error) { console.error('upload', error.message); continue; }
      } catch (e) { console.error('foto', (e as Error).message); continue; }
      await admin.from('product_images').insert({ product_id: p.id, image_url: url, sort_order: order++, label: job.label });
      have.add(url); added++;
      if (!p.image_url) { await admin.from('products').update({ image_url: url }).eq('id', p.id); p.image_url = url; }
    }
  }
  return { added };
}

// Agendado: só estoque e situação, a partir da listagem (rápido).
async function cronStock(storeId: string) {
  const token = await getToken(storeId);
  const all = await listAll(token);
  const { data: prods } = await admin.from('products').select('id, code, bling_code, is_active, has_variants').eq('store_id', storeId);
  const byCode = new Map<string, any>();
  for (const p of prods ?? []) { if (p.code) byCode.set(String(p.code).trim(), p); if (p.bling_code) byCode.set(String(p.bling_code).trim(), p); }
  const { data: vars } = await admin.from('product_variants').select('id, sku, stock, products!inner(store_id)').eq('products.store_id', storeId);
  const varBySku = new Map<string, any>();
  for (const v of vars ?? []) if (v.sku) varBySku.set(String(v.sku).trim(), v);
  let updated = 0;
  for (const it of all) {
    const code = String(it.codigo ?? '').trim();
    if (!code || it.situacao === 'E') continue;
    const stock = (it.situacao ?? 'A') === 'A' ? toStock(it.estoque?.saldoVirtualTotal) : 0;
    const v = varBySku.get(code);
    if (v) { if (v.stock !== stock) { await admin.from('product_variants').update({ stock }).eq('id', v.id); updated++; } continue; }
    const p = byCode.get(code);
    if (!p) continue;
    const active = (it.situacao ?? 'A') === 'A';
    if (p.has_variants) { if (p.is_active !== active) { await admin.from('products').update({ is_active: active }).eq('id', p.id); updated++; } continue; }
    await admin.from('products').update({ stock, is_active: active }).eq('id', p.id); updated++;
  }
  return { total: all.length, updated };
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
        try { out[c.store_id] = await cronStock(c.store_id); } catch (e) { out[c.store_id] = { error: (e as Error).message }; }
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
    if (action === 'list') {
      const all = await listAll(await getToken(storeId));
      return json({ items: all.filter((x) => x.situacao !== 'E').map((x) => ({ id: String(x.id), codigo: String(x.codigo ?? '').trim(), formato: x.formato })) });
    }
    if (action === 'products_batch') {
      const ids = (Array.isArray(body.ids) ? body.ids : []).map(String).filter((x: string) => /^\d+$/.test(x)).slice(0, 10);
      return json(await productsBatch(storeId, ids));
    }
    if (action === 'images_batch') return json(await imagesBatch(storeId, Array.isArray(body.jobs) ? body.jobs : []));
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
    return json({ error: (e as Error).message });
  }
});
