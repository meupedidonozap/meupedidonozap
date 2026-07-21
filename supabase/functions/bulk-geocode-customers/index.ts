import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const GATEWAY_URL = 'https://connector-gateway.lovable.dev/google_maps';

function fullAddress(c: any): string {
  const parts = [
    [c.address, c.number].filter(Boolean).join(', '),
    c.neighborhood,
    [c.city, c.uf].filter(Boolean).join('/'),
    c.cep,
    'Brasil',
  ].filter(Boolean);
  return parts.join(' - ');
}

async function geocode(address: string, keys: { lovable: string; gmaps: string }) {
  const url = `${GATEWAY_URL}/maps/api/geocode/json?address=${encodeURIComponent(address)}&region=br&language=pt-BR`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${keys.lovable}`,
      'X-Connection-Api-Key': keys.gmaps,
    },
  });
  if (!res.ok) return null;
  const data = await res.json();
  if (data.status !== 'OK' || !data.results?.length) return null;
  const loc = data.results[0].geometry.location;
  return { lat: loc.lat as number, lng: loc.lng as number };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const GOOGLE_MAPS_API_KEY = Deno.env.get('GOOGLE_MAPS_API_KEY');

    if (!LOVABLE_API_KEY || !GOOGLE_MAPS_API_KEY) {
      return new Response(JSON.stringify({ error: 'Google Maps não configurado' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: 'Não autenticado' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json().catch(() => ({}));
    const storeId: string | undefined = body?.storeId;
    if (!storeId) {
      return new Response(JSON.stringify({ error: 'storeId obrigatório' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);

    // Authorize: platform admin OR store admin OR owner
    const [{ data: platform }, { data: storeAdmin }, { data: store }] = await Promise.all([
      admin.from('platform_admins').select('id').eq('user_id', user.id).maybeSingle(),
      admin.from('store_admins').select('id').eq('store_id', storeId).eq('user_id', user.id).maybeSingle(),
      admin.from('stores').select('user_id').eq('id', storeId).maybeSingle(),
    ]);
    const isAuthorized = !!platform || !!storeAdmin || (store?.user_id === user.id);
    if (!isAuthorized) {
      return new Response(JSON.stringify({ error: 'Sem permissão' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: customers, error: qErr } = await admin
      .from('customer_profiles')
      .select('id, address, number, neighborhood, city, uf, cep')
      .eq('store_id', storeId)
      .is('geo_lat', null);
    if (qErr) throw qErr;

    let ok = 0, failed = 0, skipped = 0;
    const failedIds: string[] = [];

    for (const c of customers ?? []) {
      if (!c.address || !c.city) { skipped++; continue; }
      const addr = fullAddress(c);
      try {
        const geo = await geocode(addr, { lovable: LOVABLE_API_KEY, gmaps: GOOGLE_MAPS_API_KEY });
        if (!geo) {
          // Fallback: cidade + UF apenas
          const fallback = await geocode(`${c.city}${c.uf ? '/' + c.uf : ''}, Brasil`, {
            lovable: LOVABLE_API_KEY, gmaps: GOOGLE_MAPS_API_KEY,
          });
          if (!fallback) { failed++; failedIds.push(c.id); continue; }
          await admin.from('customer_profiles').update({ geo_lat: fallback.lat, geo_lng: fallback.lng }).eq('id', c.id);
          ok++;
        } else {
          await admin.from('customer_profiles').update({ geo_lat: geo.lat, geo_lng: geo.lng }).eq('id', c.id);
          ok++;
        }
      } catch (e) {
        console.error('[bulk-geocode] err', c.id, e);
        failed++; failedIds.push(c.id);
      }
      // ~10 req/s throttle
      await new Promise((r) => setTimeout(r, 100));
    }

    return new Response(JSON.stringify({
      total: customers?.length ?? 0,
      ok, failed, skipped, failedIds: failedIds.slice(0, 200),
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error('[bulk-geocode-customers] error', e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});