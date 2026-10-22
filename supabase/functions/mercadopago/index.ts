// Mercado Pago: cria cobrança PIX/cartão para um pedido e recebe a notificação de pagamento.
// Cada loja usa seu próprio Access Token, guardado como segredo MP_ACCESS_TOKEN_<SLUG>.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const tokenFor = (slug: string) => Deno.env.get(`MP_ACCESS_TOKEN_${slug.toUpperCase().replace(/[^A-Z0-9]/g, "_")}`);
const FN_URL = `${Deno.env.get("SUPABASE_URL")}/functions/v1/mercadopago`;

async function mp(token: string, path: string, init: RequestInit = {}) {
  const r = await fetch(`https://api.mercadopago.com${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init.headers || {}) },
  });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(body?.message || `Mercado Pago ${r.status}`);
  return body;
}

async function applyPayment(slug: string, paymentId: string) {
  const token = tokenFor(slug);
  if (!token) return;
  const p = await mp(token, `/v1/payments/${encodeURIComponent(paymentId)}`);
  const orderId = String(p.external_reference || "");
  if (!orderId) return;
  const { data: order } = await db.from("orders").select("id,total,store_id,payment_status,stores!inner(slug)").eq("id", orderId).maybeSingle();
  if (!order || (order as any).stores.slug !== slug) return;
  if (p.status === "approved" && Math.abs(Number(p.transaction_amount) - Number(order.total)) < 0.01) {
    await db.from("orders").update({ payment_status: "paid", paid_at: p.date_approved || new Date().toISOString(), payment_session_id: String(p.id), payment_environment: "mercadopago" }).eq("id", orderId);
  } else if (["rejected", "cancelled", "refunded", "charged_back"].includes(p.status) && order.payment_status !== "paid") {
    await db.from("orders").update({ payment_status: "failed" }).eq("id", orderId);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const url = new URL(req.url);
  try {
    // Notificação do Mercado Pago (webhook). Sempre confirmamos consultando a API.
    if (url.searchParams.get("notify")) {
      const slug = url.searchParams.get("notify")!;
      let id = url.searchParams.get("data.id") || url.searchParams.get("id");
      let type = url.searchParams.get("type") || url.searchParams.get("topic");
      try { const b = await req.json(); id = b?.data?.id ?? id; type = b?.type ?? type; } catch { /* sem corpo */ }
      if (id && (!type || type === "payment")) await applyPayment(slug, String(id));
      return json({ ok: true });
    }

    const { action, orderId, method } = await req.json();
    const { data: order } = await db.from("orders").select("id,order_number,total,payment_status,customer,store_id,stores!inner(slug,name)").eq("id", orderId).maybeSingle();
    if (!order) return json({ error: "Pedido não encontrado" }, 404);
    const store = (order as any).stores;
    const token = tokenFor(store.slug);
    if (!token) return json({ error: "Mercado Pago não configurado para esta loja" }, 400);

    if (action === "info") {
      return json({ orderNumber: order.order_number, total: Number(order.total), paymentStatus: order.payment_status, storeName: store.name });
    }
    if (action === "status") {
      let lastStatus: string | null = null;
      if (order.payment_status !== "paid") {
        const s = await mp(token, `/v1/payments/search?external_reference=${order.id}&sort=date_created&criteria=desc`);
        lastStatus = s.results?.[0]?.status ?? null;
        for (const p of s.results || []) if (p.status === "approved") { await applyPayment(store.slug, String(p.id)); break; }
      }
      const { data: o } = await db.from("orders").select("payment_status").eq("id", order.id).single();
      return json({ paymentStatus: o?.payment_status, lastStatus });
    }
    if (action !== "create") return json({ error: "Ação inválida" }, 400);
    if (order.payment_status === "paid") return json({ error: "Pedido já pago" }, 400);

    const amount = Math.round(Number(order.total) * 100) / 100;
    const description = `${store.name} - Pedido #${order.order_number}`;
    const notification_url = `${FN_URL}?notify=${encodeURIComponent(store.slug)}`;
    const cust = (order.customer as any) || {};

    if (method === "pix") {
      const email = (cust.email && String(cust.email).includes("@")) ? cust.email : `pedido${order.order_number}@meupedidonozap.online`;
      const p = await mp(token, "/v1/payments", {
        method: "POST",
        headers: { "X-Idempotency-Key": `pix-${order.id}` },
        body: JSON.stringify({
          transaction_amount: amount, description, payment_method_id: "pix",
          external_reference: order.id, notification_url,
          payer: { email, first_name: String(cust.name || "Cliente").slice(0, 60) },
        }),
      });
      await db.from("orders").update({ payment_status: "pending", payment_method: "pix" }).eq("id", order.id);
      const td = p.point_of_interaction?.transaction_data || {};
      return json({ qrCode: td.qr_code, qrCodeBase64: td.qr_code_base64, amount });
    }

    // Cartão: checkout seguro do Mercado Pago
    const pref = await mp(token, "/checkout/preferences", {
      method: "POST",
      body: JSON.stringify({
        items: [{ title: description, quantity: 1, unit_price: amount, currency_id: "BRL" }],
        external_reference: order.id, notification_url,
        payment_methods: { excluded_payment_types: [{ id: "ticket" }, { id: "bank_transfer" }] },
        back_urls: (() => { const u = `https://meupedidonozap.online/${store.slug}/pagar/${order.id}?retorno=1`; return { success: u, failure: u, pending: u }; })(),
        auto_return: "approved",
      }),
    });
    await db.from("orders").update({ payment_status: "pending", payment_method: "cartao" }).eq("id", order.id);
    return json({ checkoutUrl: pref.init_point, amount });
  } catch (e) {
    console.error(e);
    return json({ error: (e as Error).message }, 500);
  }
});
