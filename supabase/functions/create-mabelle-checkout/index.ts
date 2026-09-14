import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { z } from 'npm:zod@3.25.76';
import { createStripeClient, type StripeEnv } from '../_shared/stripe.ts';

const BodySchema = z.object({
  storeId: z.string().uuid(),
  environment: z.enum(['sandbox', 'live']),
  returnUrl: z.string().url(),
  paymentMethod: z.enum(['pix', 'cartao']),
  deliveryShift: z.enum(['manha', 'tarde', 'noite']),
  observations: z.string().max(1000).optional(),
  customer: z.object({
    name: z.string().min(2).max(160), cpfCnpj: z.string().max(24), whatsapp: z.string().min(8).max(24),
    cep: z.string().max(12), uf: z.string().max(2), city: z.string().max(120), neighborhood: z.string().max(120),
    address: z.string().max(200), number: z.string().max(30), complement: z.string().max(120).optional(), priceTable: z.number().optional(),
  }),
  items: z.array(z.object({ productId: z.string().uuid(), variantId: z.string().uuid().optional(), quantity: z.number().int().min(1).max(999) })).min(1).max(200),
  shipping: z.object({ code: z.string().max(30), name: z.string().max(50), price: z.number().min(0), deadline: z.number().int().min(0).max(120) }).optional(),
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'Método inválido' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  try {
    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) return new Response(JSON.stringify({ error: 'Dados do pedido inválidos' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    const input = parsed.data;
    const authHeader = req.headers.get('Authorization');
    const client = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    const { data: { user } } = await client.auth.getUser(authHeader?.replace('Bearer ', ''));
    if (!user) return new Response(JSON.stringify({ error: 'Entre na sua conta para pagar' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const { data: store } = await client.from('stores').select('id, slug, name, settings').eq('id', input.storeId).eq('slug', 'mabelle').eq('is_active', true).maybeSingle();
    if (!store || store.settings?.onlinePayments !== true) throw new Error('Pagamento online indisponível');

    const productIds = [...new Set(input.items.map(item => item.productId))];
    const { data: products, error: productsError } = await client.from('products').select('id, code, name, group_id, base_price, is_active, stock, has_variants, product_variants(id, price, stock)').eq('store_id', store.id).in('id', productIds);
    if (productsError || !products || products.length !== productIds.length) throw new Error('Um produto não está mais disponível');

    let subtotalCents = 0;
    const orderItems = input.items.map(item => {
      const product = products.find(candidate => candidate.id === item.productId);
      if (!product?.is_active) throw new Error('Um produto não está mais disponível');
      const variant = item.variantId ? product.product_variants?.find((candidate: any) => candidate.id === item.variantId) : undefined;
      if (item.variantId && !variant) throw new Error('Uma variação não está mais disponível');
      const price = Number(variant?.price ?? product.base_price);
      if (!(price > 0)) throw new Error('Um produto está sem preço válido');
      if (store.settings?.useStockIntegration === true && Number(variant?.stock ?? product.stock) < item.quantity) throw new Error(`Estoque insuficiente para ${product.name}`);
      subtotalCents += Math.round(price * 100) * item.quantity;
      return { productId: product.id, variantId: variant?.id, groupId: product.group_id ?? undefined, code: product.code, name: product.name, price, quantity: item.quantity };
    });
    const rules = Array.isArray(store.settings?.discountRules) ? store.settings.discountRules : [];
    const groups = new Map<string, typeof orderItems>();
    for (const item of orderItems) {
      if (!item.groupId) continue;
      const key = String(item.groupId).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
      groups.set(key, [...(groups.get(key) ?? []), item]);
    }
    let discountCents = 0;
    for (const [group, groupedItems] of groups) {
      const quantity = groupedItems.reduce((sum, item) => sum + item.quantity, 0);
      const rule = rules.filter((candidate: any) => candidate.type === 'group' && candidate.priceTable == null && String(candidate.groupId ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim() === group && Number(candidate.minQuantity ?? 0) <= quantity).sort((a: any, b: any) => Number(b.minQuantity ?? 0) - Number(a.minQuantity ?? 0))[0];
      if (!rule) continue;
      const percentage = Number(rule.discountPercent ?? 0);
      for (const item of groupedItems) discountCents += Math.round(item.price * 100) * item.quantity * percentage / 100;
    }
    discountCents = Math.round(discountCents);
    const shippingCents = Math.round((input.shipping?.price ?? 0) * 100);
    const totalCents = subtotalCents - discountCents + shippingCents;
    if (totalCents < 50) throw new Error('Valor do pedido inválido');

    const { data: order, error: orderError } = await client.from('orders').insert({
      store_id: store.id, user_id: user.id, customer: input.customer, items: orderItems,
      subtotal: subtotalCents / 100, discount: discountCents / 100, delivery_fee: shippingCents / 100, total: totalCents / 100,
      payment_method: input.paymentMethod, payment_status: 'pending', payment_environment: input.environment,
      delivery_shift: input.deliveryShift, observations: input.observations ?? null, status: 'pendente', origem: 'pagamento_online',
      shipping_service: input.shipping?.name ?? null, shipping_code: input.shipping?.code ?? null, shipping_deadline: input.shipping?.deadline ?? null,
    }).select('id, order_number').single();
    if (orderError || !order) throw orderError ?? new Error('Não foi possível criar o pedido');

    const stripe = createStripeClient(input.environment as StripeEnv);
    const customers = await stripe.customers.search({ query: `metadata['userId']:'${user.id}'`, limit: 1 });
    const customerId = customers.data[0]?.id ?? (await stripe.customers.create({ email: user.email, name: input.customer.name, metadata: { userId: user.id } })).id;
    const session = await stripe.checkout.sessions.create({
      line_items: [{ price_data: { currency: 'brl', product_data: { name: `Pedido Mabelle #${order.order_number}`, tax_code: 'txcd_99999999' }, unit_amount: totalCents }, quantity: 1 }],
      mode: 'payment', ui_mode: 'embedded_page', return_url: input.returnUrl, customer: customerId,
      payment_method_types: input.paymentMethod === 'pix' ? ['pix'] : ['card'],
      automatic_tax: { enabled: true },
      payment_intent_data: { description: `Pedido Mabelle #${order.order_number}`, metadata: { orderId: order.id, userId: user.id } },
      metadata: { orderId: order.id, userId: user.id, storeId: store.id, paymentMethod: input.paymentMethod },
      expires_at: Math.floor(Date.now() / 1000) + 1800,
    });
    await client.from('orders').update({ payment_session_id: session.id }).eq('id', order.id);
    return new Response(JSON.stringify({ clientSecret: session.client_secret }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('create-mabelle-checkout:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Erro ao iniciar pagamento' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});