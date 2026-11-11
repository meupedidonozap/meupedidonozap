import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { resolveCustomerLocation } from '../_shared/customerLocation.ts';

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  try {
    const url = Deno.env.get('SUPABASE_URL');
    const anon = Deno.env.get('SUPABASE_ANON_KEY');
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !anon || !key) return json({ error: 'Serviço indisponível' }, 503);
    const client = createClient(url, anon, { global: { headers: { Authorization: req.headers.get('Authorization') || '' } } });
    const { data: { user } } = await client.auth.getUser();
    if (!user) return json({ error: 'Sessão inválida' }, 401);
    const { profileId } = await req.json();
    // RLS authorizes the exact profile; no data supplied by the browser is trusted.
    const { data: profile, error } = await client.from('customer_profiles').select('*').eq('id', profileId).single();
    if (error || !profile) return json({ error: 'Cadastro indisponível' }, 403);
    const admin = createClient(url, key);
    const { data: store } = await admin.from('stores').select('slug').eq('id', profile.store_id).single();
    if (store?.slug !== 'dicolore') return json({ error: 'Loja não autorizada' }, 403);
    const location = await resolveCustomerLocation(profile);
    if (!location.city || !location.uf) return json({ error: 'Não foi possível consultar a cidade do cadastro. Tente novamente.' }, 422);
    const { data: saved, error: saveError } = await admin.from('customer_profiles').update(location)
      .eq('id', profile.id).eq('store_id', profile.store_id).eq('cep', profile.cep)
      .select('city,uf').single();
    if (saveError || !saved) return json({ error: 'Não foi possível atualizar a localização' }, 409);
    return json(saved);
  } catch { return json({ error: 'Não foi possível consultar a localização' }, 500); }
});