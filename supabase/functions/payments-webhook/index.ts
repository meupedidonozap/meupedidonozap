import { createClient } from 'npm:@supabase/supabase-js@2';
import { verifyWebhook, type StripeEnv } from '../_shared/stripe.ts';

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  const rawEnv = new URL(req.url).searchParams.get('env');
  if (rawEnv !== 'sandbox' && rawEnv !== 'live') return new Response(JSON.stringify({ received: true, ignored: 'invalid env' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  try {
    const event = await verifyWebhook(req, rawEnv as StripeEnv);
    const object = event.data.object;
    const orderId = object.metadata?.orderId;
    if (orderId) {
      const client = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
      if (event.type === 'checkout.session.completed' && object.payment_status !== 'unpaid') {
        await client.from('orders').update({ payment_status: 'paid', paid_at: new Date().toISOString(), status: 'confirmado' }).eq('id', orderId).eq('payment_environment', rawEnv);
      } else if (event.type === 'checkout.session.async_payment_succeeded' || event.type === 'payment_intent.succeeded') {
        await client.from('orders').update({ payment_status: 'paid', paid_at: new Date().toISOString(), status: 'confirmado' }).eq('id', orderId).eq('payment_environment', rawEnv);
      } else if (event.type === 'checkout.session.async_payment_failed' || event.type === 'payment_intent.payment_failed') {
        const code = object.last_payment_error?.decline_code || object.last_payment_error?.code;
        const reason = code === 'insufficient_funds' ? 'Limite ou saldo insuficiente no cartão.'
          : ['incorrect_cvc','invalid_cvc'].includes(code) ? 'Código de segurança (CVV) incorreto.'
          : code === 'expired_card' ? 'Cartão vencido.'
          : 'Pagamento recusado pelo banco ou pela análise de segurança. Confira os dados do titular, incluindo nome e CPF. O provedor não confirmou divergência de CPF.';
        await client.from('orders').update({ payment_status: 'failed', payment_error: reason }).eq('id', orderId).eq('payment_environment', rawEnv).neq('payment_status','paid');
      } else if (event.type === 'checkout.session.expired') {
        await client.from('orders').update({ payment_status: 'expired', status: 'cancelado' }).eq('id', orderId).eq('payment_environment', rawEnv);
      } else if (event.type === 'charge.refunded') {
        await client.from('orders').update({ payment_status: 'refunded' }).eq('id', orderId).eq('payment_environment', rawEnv);
      }
    }
    return new Response(JSON.stringify({ received: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('payments-webhook:', error);
    return new Response('Webhook error', { status: 400 });
  }
});