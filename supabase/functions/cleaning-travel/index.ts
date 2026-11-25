import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@3';

const addressSchema = z.object({
  cep: z.string().regex(/^\d{8}$/), uf: z.string().regex(/^[A-Z]{2}$/),
  city: z.string().trim().min(1).max(100), neighborhood: z.string().trim().min(1).max(100),
  address: z.string().trim().min(1).max(200), number: z.string().trim().min(1).max(20),
  complement: z.string().trim().max(200).default(''),
});
const bodySchema = z.object({ store_id: z.string().uuid(), site_address: addressSchema });
const fullAddress = (a: z.infer<typeof addressSchema>) => `${a.address}, ${a.number}, ${a.neighborhood}, ${a.city} - ${a.uf}, ${a.cep}, Brasil`;
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Método inválido.' }, 405);
  try {
    const url = Deno.env.get('SUPABASE_URL');
    const anon = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !anon || !serviceKey) return json({ error: 'Serviço de deslocamento indisponível.' }, 503);
    const authHeader = req.headers.get('Authorization') || '';
    const userClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) return json({ error: 'Entre na loja para calcular o deslocamento.' }, 401);
    const input = bodySchema.safeParse(await req.json());
    if (!input.success) return json({ error: 'Complete o endereço do local, incluindo CEP e número.' }, 400);
    const service = createClient(url, serviceKey, { auth: { persistSession: false } });
    const { data: store, error: storeError } = await service.from('stores').select('id,settings').eq('id', input.data.store_id).eq('slug', 'limpa-telhas-brusque').eq('is_active', true).single();
    if (storeError || !store) return json({ error: 'Loja não disponível.' }, 403);
    const base = addressSchema.safeParse(store.settings?.cleaningEstimate?.base_address);
    if (!base.success) return json({ error: 'A empresa ainda não cadastrou a base de saída.' }, 409);
    const address = input.data.site_address;
    const { data: cached } = await service.from('cleaning_travel_estimates').select('id,one_way_meters').eq('store_id', store.id).eq('user_id', user.id).eq('base_address', JSON.stringify(base.data)).eq('site_address', JSON.stringify(address)).gt('expires_at', new Date().toISOString()).order('created_at', { ascending: false }).limit(1).maybeSingle();
    const output = (v: { id: string; one_way_meters: number }) => ({ ...v, total_km: v.one_way_meters / 1000 * 2, total: Math.round(v.one_way_meters / 1000 * 2 * 1.2 * 100) / 100 });
    if (cached) return json(output(cached));
    const key = Deno.env.get('GOOGLE_MAPS_API_KEY');
    const lovable = Deno.env.get('LOVABLE_API_KEY');
    if (!key || !lovable) return json({ error: 'Google Maps não configurado para calcular o deslocamento.' }, 503);
    const response = await fetch('https://connector-gateway.lovable.dev/google_maps/routes/directions/v2:computeRoutes', {
      method: 'POST', headers: { Authorization: `Bearer ${lovable}`, 'X-Connection-Api-Key': key, 'Content-Type': 'application/json', 'X-Goog-FieldMask': 'routes.distanceMeters,routes.duration' },
      body: JSON.stringify({ origin: { address: fullAddress(base.data) }, destination: { address: fullAddress(address) }, travelMode: 'DRIVE', routingPreference: 'TRAFFIC_UNAWARE', computeAlternativeRoutes: false, languageCode: 'pt-BR', units: 'METRIC' }),
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) {
      const details = await response.text();
      // Do not return addresses, connection credentials, or upstream request URLs.
      if (response.status === 403) {
        let reason = '';
        try { reason = JSON.parse(details)?.error?.details?.find((d: { reason?: string }) => d.reason)?.reason || ''; } catch { /* Non-JSON denial */ }
        const error = reason === 'API_KEY_HTTP_REFERRER_BLOCKED' ? 'Google Maps: a chave do servidor está restrita a sites. Ajuste as restrições da chave do servidor no Google Cloud Console.' : reason === 'API_KEY_SERVICE_BLOCKED' ? 'Google Maps: habilite Routes API nas APIs permitidas para a chave do servidor no Google Cloud Console.' : 'Google Maps recusou o cálculo. Confira as permissões de Routes API.';
        return json({ error, status: 403 }, 403);
      }
      return json({ error: response.status === 429 ? 'Limite de consultas de trajeto atingido. Tente mais tarde.' : 'Google Maps não conseguiu calcular o trajeto. Tente novamente.', status: response.status }, response.status);
    }
    const result = await response.json();
    const route = result.routes?.[0];
    const meters = route?.distanceMeters ?? 0;
    if (!route || !/^\d+(\.\d+)?s$/.test(route.duration || '') || !Number.isInteger(meters) || meters < 0 || meters > 2000000) return json({ error: 'Trajeto não encontrado para esse endereço. Confira rua, cidade e número.' }, 422);
    const { data, error } = await service.from('cleaning_travel_estimates').insert({ store_id: store.id, user_id: user.id, base_address: base.data, site_address: address, one_way_meters: meters }).select('id,one_way_meters').single();
    if (error || !data) return json({ error: 'Não foi possível salvar a estimativa. Tente novamente.' }, 500);
    return json(output(data));
  } catch {
    return json({ error: 'Não foi possível calcular o trajeto agora. Tente novamente.' }, 503);
  }
});
