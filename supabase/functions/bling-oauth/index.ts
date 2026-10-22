import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON = Deno.env.get('SUPABASE_ANON_KEY')!;
const CLIENT_ID = Deno.env.get('BLING_CLIENT_ID')!;
const CLIENT_SECRET = Deno.env.get('BLING_CLIENT_SECRET')!;
const admin = createClient(SUPABASE_URL, SERVICE);

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const html = (msg: string) =>
  new Response(`<!doctype html><meta charset="utf-8"><body style="font-family:sans-serif;padding:40px;text-align:center"><h2>${msg}</h2><p>Pode fechar esta janela.</p></body>`, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const url = new URL(req.url);

  // Retorno do Bling após autorização
  if (req.method === 'GET' && url.searchParams.get('code')) {
    const code = url.searchParams.get('code')!;
    const state = url.searchParams.get('state') || '';
    const { data: conn } = await admin.from('bling_connections').select('store_id').eq('pending_state', state).maybeSingle();
    if (!state || !conn) return html('Autorização inválida ou expirada.');
    const r = await fetch('https://api.bling.com.br/Api/v3/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: 'Basic ' + btoa(`${CLIENT_ID}:${CLIENT_SECRET}`) },
      body: new URLSearchParams({ grant_type: 'authorization_code', code }),
    });
    const t = await r.json();
    if (!r.ok || !t.access_token) { console.error('bling token error', r.status, t?.error); return html('Falha ao conectar com o Bling.'); }
    await admin.from('bling_connections').update({
      access_token: t.access_token, refresh_token: t.refresh_token,
      expires_at: new Date(Date.now() + (t.expires_in ?? 21600) * 1000).toISOString(),
      pending_state: null, connected_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }).eq('store_id', conn.store_id);
    return html('Bling conectado com sucesso!');
  }

  // Ações do painel (exigem admin da loja)
  const auth = req.headers.get('Authorization') || '';
  const userClient = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: auth } } });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return json({ error: 'unauthorized' }, 401);
  const body = await req.json().catch(() => ({}));
  const storeId = String(body.store_id || '');
  if (!/^[0-9a-f-]{36}$/.test(storeId)) return json({ error: 'store_id inválido' }, 400);
  const { data: ok } = await admin.rpc('has_store_permission', { _user_id: user.id, _store_id: storeId, _permission: 'can_manage_settings' }).then(
    (r) => r, () => ({ data: false }));
  const { data: isAdm } = await admin.rpc('is_store_admin', { _user_id: user.id, _store_id: storeId });
  const { data: isPlat } = await admin.rpc('is_platform_admin', { _user_id: user.id });
  if (!ok && !isAdm && !isPlat) return json({ error: 'forbidden' }, 403);

  if (body.action === 'status') {
    const { data } = await admin.from('bling_connections').select('connected_at, expires_at').eq('store_id', storeId).maybeSingle();
    return json({ connected: !!data?.connected_at, connected_at: data?.connected_at ?? null });
  }
  if (body.action === 'authorize') {
    const state = crypto.randomUUID();
    await admin.from('bling_connections').upsert({ store_id: storeId, pending_state: state, updated_at: new Date().toISOString() });
    const authUrl = `https://www.bling.com.br/Api/v3/oauth/authorize?response_type=code&client_id=${encodeURIComponent(CLIENT_ID)}&state=${state}`;
    return json({ url: authUrl });
  }
  return json({ error: 'ação inválida' }, 400);
});
