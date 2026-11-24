import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@3';
import { ensureDicoloreCustomerAccess } from '../_shared/dicoloreCustomerAccess.ts';

const Body = z.object({ codes: z.array(z.string().trim().regex(/^\d+$/)).max(250).optional() }).strict();
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Método não permitido' }, 405);
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const anon = Deno.env.get('SUPABASE_ANON_KEY');
  if (!url || !key || !anon) return json({ error: 'Configuração indisponível' }, 500);
  const authorization = req.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) return json({ error: 'Acesso não autorizado' }, 401);
  const caller = createClient(url, anon, { global: { headers: { Authorization: authorization } } });
  const { data: identity, error: authError } = await caller.auth.getUser();
  if (authError || !identity.user) return json({ error: 'Acesso não autorizado' }, 401);
  const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: store } = await admin.from('stores').select('id').eq('slug', 'dicolore').single();
  if (!store) return json({ error: 'Loja indisponível' }, 404);
  const [platform, storeAdmin] = await Promise.all([
    admin.rpc('is_platform_admin', { _user_id: identity.user.id }),
    admin.rpc('is_store_admin', { _user_id: identity.user.id, _store_id: store.id }),
  ]);
  if (platform.data !== true && storeAdmin.data !== true) return json({ error: 'Acesso não autorizado' }, 403);
  try {
    const body = Body.safeParse(await req.json());
    if (!body.success) return json({ error: 'Informe somente códigos ERP válidos' }, 400);
    const result = await ensureDicoloreCustomerAccess(admin, 'dicolore', body.data.codes, { deadline: Date.now() + 45_000 });
    return json({ success: result.errors.length === 0, ...result });
  } catch {
    return json({ error: 'Não foi possível regularizar os acessos' }, 500);
  }
});