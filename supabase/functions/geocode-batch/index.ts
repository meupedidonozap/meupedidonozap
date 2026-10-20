import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const GATEWAY_URL = 'https://connector-gateway.lovable.dev/google_maps';
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const digits = (s: string | null) => (s || '').replace(/\D/g, '');

async function geocode(address: string) {
  const url = `${GATEWAY_URL}/maps/api/geocode/json?address=${encodeURIComponent(address)}&region=br&language=pt-BR`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${Deno.env.get('LOVABLE_API_KEY')}`,
      'X-Connection-Api-Key': Deno.env.get('GOOGLE_MAPS_API_KEY')!,
    },
  });
  if (!res.ok) throw new Error(`gateway ${res.status}`);
  return await res.json();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const auth = req.headers.get('Authorization') || '';
    const url = Deno.env.get('SUPABASE_URL')!;
    const userClient = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } });
    const { data: u } = await userClient.auth.getUser();
    if (!u?.user) return json({ error: 'não autenticado' }, 401);

    const body = await req.json().catch(() => ({}));
    const storeId = String(body.storeId || '');
    const action = String(body.action || 'stats');
    if (!/^[0-9a-f-]{36}$/.test(storeId)) return json({ error: 'storeId inválido' }, 400);

    const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const [{ data: isSA }, { data: isPA }] = await Promise.all([
      admin.rpc('is_store_admin', { _user_id: u.user.id, _store_id: storeId }),
      admin.rpc('is_platform_admin', { _user_id: u.user.id }).then((r) => r, () => ({ data: false })),
    ]);
    if (!isSA && !isPA) return json({ error: 'sem permissão' }, 403);

    if (action === 'retry') {
      await admin.from('customer_profiles').update({ geo_status: null, geo_error: null })
        .eq('store_id', storeId).is('geo_lat', null).in('geo_status', ['nao_encontrado', 'erro']);
    }

    if (action === 'run') {
      const started = Date.now();
      let processed = 0;
      while (Date.now() - started < 40000) {
        const { data: rows } = await admin.from('customer_profiles')
          .select('id,address,number,neighborhood,city,uf,cep')
          .eq('store_id', storeId).eq('is_active', true).is('geo_lat', null).is('geo_status', null)
          .limit(10);
        if (!rows?.length) break;
        await Promise.all(rows.map(async (c) => {
          const now = new Date().toISOString();
          if (!c.address?.trim() || !c.city?.trim() || !c.uf?.trim()) {
            await admin.from('customer_profiles').update({ geo_status: 'incompleto', geo_error: 'Falta logradouro, cidade ou UF', geo_attempted_at: now }).eq('id', c.id);
            return;
          }
          const addr = [`${c.address}${c.number ? ', ' + c.number : ''}`, c.neighborhood, `${c.city} - ${c.uf}`, c.cep, 'Brasil'].filter(Boolean).join(', ');
          try {
            const d = await geocode(addr);
            if (d.status !== 'OK' || !d.results?.length) {
              await admin.from('customer_profiles').update({ geo_status: 'nao_encontrado', geo_error: d.status, geo_attempted_at: now }).eq('id', c.id);
              return;
            }
            const r = d.results[0];
            const pc = digits(r.address_components?.find((x: any) => x.types?.includes('postal_code'))?.long_name);
            const cep = digits(c.cep);
            const divergent = (cep.length >= 5 && pc.length >= 5 && cep.slice(0, 5) !== pc.slice(0, 5)) || r.partial_match;
            await admin.from('customer_profiles').update({
              geo_lat: r.geometry.location.lat, geo_lng: r.geometry.location.lng,
              geo_status: divergent ? 'divergente' : 'ok',
              geo_error: divergent ? `Conferir: Google achou CEP ${pc || '?'}` : null,
              geo_formatted: r.formatted_address, geo_attempted_at: now,
            }).eq('id', c.id);
          } catch (e) {
            await admin.from('customer_profiles').update({ geo_status: 'erro', geo_error: (e as Error).message, geo_attempted_at: now }).eq('id', c.id);
          }
        }));
        processed += rows.length;
      }
      const stats = await getStats(admin, storeId);
      return json({ processed, ...stats });
    }

    return json(await getStats(admin, storeId));
  } catch (e) {
    console.error('[geocode-batch]', e);
    return json({ error: (e as Error).message }, 500);
  }
});

async function getStats(admin: any, storeId: string) {
  const base = () => admin.from('customer_profiles').select('id', { count: 'exact', head: true }).eq('store_id', storeId).eq('is_active', true);
  const [withGeo, pending, incompleto, naoEnc, erro, diverg] = await Promise.all([
    base().not('geo_lat', 'is', null),
    base().is('geo_lat', null).is('geo_status', null),
    base().eq('geo_status', 'incompleto'),
    base().eq('geo_status', 'nao_encontrado'),
    base().eq('geo_status', 'erro'),
    base().eq('geo_status', 'divergente'),
  ]);
  return {
    located: withGeo.count ?? 0, pending: pending.count ?? 0, incompleto: incompleto.count ?? 0,
    naoEncontrado: naoEnc.count ?? 0, erro: erro.count ?? 0, divergente: diverg.count ?? 0,
  };
}
