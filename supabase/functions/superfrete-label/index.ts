import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const SF = 'https://api.superfrete.com';
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
const digits = (s: unknown) => String(s ?? '').replace(/\D/g, '');

async function viaCep(cep: string) {
  try {
    const r = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
    const d = await r.json();
    return d?.erro ? null : d;
  } catch { return null; }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const auth = req.headers.get('Authorization') || '';
    if (!auth.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401);
    const url = Deno.env.get('SUPABASE_URL')!;
    const userClient = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } });
    const { data: claims } = await userClient.auth.getClaims(auth.slice(7));
    const uid = claims?.claims?.sub;
    if (!uid) return json({ error: 'Unauthorized' }, 401);

    const body = await req.json().catch(() => ({}));
    const action = body?.action === 'info' ? 'info' : 'create';
    const orderId = String(body?.orderId || '');
    if (!/^[0-9a-f-]{36}$/i.test(orderId)) return json({ error: 'orderId inválido' }, 400);

    const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: order } = await admin.from('orders').select('*').eq('id', orderId).maybeSingle();
    if (!order) return json({ error: 'Pedido não encontrado' }, 404);
    const { data: isAdm } = await admin.rpc('has_any_store_access', { _user_id: uid, _store_id: order.store_id });
    if (order.user_id !== uid && !isAdm) return json({ error: 'Sem permissão' }, 403);

    const token = Deno.env.get('SUPERFRETE_TOKEN');
    if (!token) return json({ error: 'SuperFrete não configurado' }, 400);
    const headers = {
      Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json',
      'User-Agent': 'MeuPedidoNoZap (contato@meupedidonozap.online)',
    };

    if (action === 'info') {
      if (!order.superfrete_id) return json({ error: 'Pedido ainda não enviado ao SuperFrete' }, 400);
      const r = await fetch(`${SF}/api/v0/order/info/${order.superfrete_id}`, { headers });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) return json({ error: d?.message || `Erro ${r.status}` }, 400);
      const upd = { superfrete_status: d?.status ?? order.superfrete_status, shipping_tracking: d?.tracking || order.shipping_tracking };
      await admin.from('orders').update(upd).eq('id', orderId);
      return json({ ok: true, ...upd });
    }

    const code = String(order.shipping_code || '');
    const service = Number(code.replace('SF-', ''));
    if (!code.startsWith('SF-') || !service) return json({ skipped: 'Pedido sem frete SuperFrete' });
    if (order.superfrete_id && !body?.force) return json({ ok: true, id: order.superfrete_id });

    const { data: store } = await admin.from('stores').select('name,phone,email,settings').eq('id', order.store_id).single();
    const ship = (store?.settings as any)?.shipping || {};
    const originCep = digits(ship.originCep);
    const o = await viaCep(originCep);
    const c: any = order.customer || {};
    const destCep = digits(c.cep);
    const d = c.address ? null : await viaCep(destCep);

    const recipientDocument = digits(c.cpfCnpj || c.cpf_cnpj);
    const recipientPhone = digits(c.whatsapp || c.phone);
    const validationError = recipientDocument.length !== 11 && recipientDocument.length !== 14
      ? 'CPF/CNPJ do cliente obrigatório (11 ou 14 dígitos) para gerar a etiqueta do Super Frete.'
      : recipientPhone.length !== 10 && recipientPhone.length !== 11
        ? 'WhatsApp do cliente com DDD obrigatório (10 ou 11 dígitos) para gerar a etiqueta do Super Frete.'
        : null;
    if (validationError) {
      await admin.from('orders').update({ superfrete_error: validationError, superfrete_status: 'erro' }).eq('id', orderId);
      return json({ error: validationError }, 400);
    }

    const payload = {
      from: {
        name: store?.name, address: ship.originAddress || o?.logradouro || 'Endereço', number: ship.originNumber || 'S/N',
        district: ship.originDistrict || o?.bairro || 'Centro', city: o?.localidade, state_abbr: o?.uf, postal_code: originCep,
        document: digits((store?.settings as any)?.cnpj) || undefined,
      },
      to: {
        name: c.name, address: c.address || d?.logradouro, number: c.number || 'S/N', complement: c.complement || undefined,
        district: c.neighborhood || d?.bairro || 'Centro', city: c.city || d?.localidade, state_abbr: c.uf || d?.uf,
        postal_code: destCep, document: recipientDocument, phone: recipientPhone,
        email: c.email || c.createdByUserEmail || undefined,
      },
      service,
      products: (order.items as any[] || []).map((i) => ({
        name: String(i.name || 'Produto').slice(0, 80), quantity: Number(i.quantity) || 1, unitary_value: Number(i.price ?? i.unitPrice) || 0,
      })),
      volumes: {
        height: Math.max(Number(ship.defaultHeight) || 2, 2), width: Math.max(Number(ship.defaultWidth) || 11, 11),
        length: Math.max(Number(ship.defaultLength) || 16, 16), weight: Math.max(Number(ship.defaultWeight) || 0.3, 0.3),
      },
      options: { insurance_value: 0, receipt: false, own_hand: false, non_commercial: true, tags: [{ tag: `MPZ-${order.order_number}` }] },
      tag: `MPZ-${order.order_number}`,
      platform: 'Meu Pedido no Zap',
    };

    const r = await fetch(`${SF}/api/v0/cart`, { method: 'POST', headers, body: JSON.stringify(payload) });
    const res = await r.json().catch(() => ({}));
    if (!r.ok || !res?.id) {
      const msg = res?.message || res?.error || JSON.stringify(res?.errors || res).slice(0, 300) || `Erro ${r.status}`;
      await admin.from('orders').update({ superfrete_error: msg, superfrete_status: 'erro' }).eq('id', orderId);
      return json({ error: msg }, 400);
    }
    await admin.from('orders').update({ superfrete_id: String(res.id), superfrete_status: res.status || 'pending', superfrete_error: null }).eq('id', orderId);
    return json({ ok: true, id: res.id });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
