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

// Tradução dos motivos de recusa do Mercado Pago (status_detail).
const REASONS: Record<string, string> = {
  cc_rejected_insufficient_amount: "Limite ou saldo insuficiente no cartão",
  cc_rejected_high_risk: "Recusado pela análise de segurança (verifique se o cartão está no nome/CPF do comprador)",
  cc_rejected_call_for_authorize: "O banco exige autorização: libere a compra no app do banco e tente de novo",
  cc_rejected_bad_filled_security_code: "Código de segurança (CVV) incorreto",
  cc_rejected_bad_filled_date: "Data de validade incorreta",
  cc_rejected_bad_filled_card_number: "Número do cartão incorreto",
  cc_rejected_bad_filled_other: "Dados do cartão incorretos",
  cc_rejected_blacklist: "Cartão não aceito para compras online",
  cc_rejected_card_disabled: "Cartão bloqueado ou não ativado: ligue para o banco",
  cc_rejected_duplicated_payment: "Pagamento duplicado: já existe uma tentativa igual",
  cc_rejected_max_attempts: "Limite de tentativas atingido: use outro cartão",
  cc_rejected_invalid_installments: "Parcelamento não aceito por este cartão",
  cc_rejected_card_type_not_allowed: "Tipo de cartão não aceito",
  cc_rejected_other_reason: "Recusado pelo banco emissor do cartão",
  cc_amount_rate_limit_exceeded: "Limite do cartão excedido",
  rejected_by_bank: "Recusado pelo banco emissor do cartão",
  rejected_by_regulations: "Recusado por regras do banco",
  rejected_insufficient_data: "Dados do comprador incompletos",
  expired: "Pagamento expirado",
  by_payer: "Cancelado pelo comprador",
};
const reasonFor = (p: any) => p?.status_detail ? (REASONS[p.status_detail] || `Recusado (${p.status_detail})`) : "Pagamento não aprovado";

async function applyPayment(slug: string, paymentId: string) {
  const token = tokenFor(slug);
  if (!token) return;
  const p = await mp(token, `/v1/payments/${encodeURIComponent(paymentId)}`);
  const orderId = String(p.external_reference || "");
  if (!orderId) return;
  const { data: order } = await db.from("orders").select("id,total,store_id,payment_status,stores!inner(slug)").eq("id", orderId).maybeSingle();
  if (!order || (order as any).stores.slug !== slug) return;
  if (p.status === "approved" && Math.abs(Number(p.transaction_amount) - Number(order.total)) < 0.01) {
    await db.from("orders").update({ payment_status: "paid", paid_at: p.date_approved || new Date().toISOString(), payment_session_id: String(p.id), payment_environment: "mercadopago", payment_error: null }).eq("id", orderId);
  } else if (["rejected", "cancelled", "refunded", "charged_back"].includes(p.status) && order.payment_status !== "paid") {
    await db.from("orders").update({ payment_status: "failed", payment_error: reasonFor(p) }).eq("id", orderId);
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
        const last = s.results?.[0];
        lastStatus = last?.status ?? null;
        const approved = (s.results || []).find((p: any) => p.status === "approved");
        if (approved) await applyPayment(store.slug, String(approved.id));
        else if (last) await applyPayment(store.slug, String(last.id));
      }
      const { data: o } = await db.from("orders").select("payment_status,payment_error").eq("id", order.id).single();
      return json({ paymentStatus: o?.payment_status, lastStatus, reason: o?.payment_error ?? null });
    }
    if (action === "abandon") {
      // Cliente saiu do checkout sem pagar: cancela o pedido (devolve estoque) para refazer pelo carrinho.
      if (order.payment_status === "paid") return json({ error: "Pedido já pago" }, 400);
      const s = await mp(token, `/v1/payments/search?external_reference=${order.id}&sort=date_created&criteria=desc`);
      const live = (s.results || []).find((p: any) => ["approved", "in_process", "pending", "authorized"].includes(p.status));
      if (live) return json({ error: "Há um pagamento em andamento para este pedido" }, 409);
      await db.from("orders").update({ payment_status: "canceled", status: "cancelado", payment_error: "Cliente abandonou o pagamento antes de concluir" }).eq("id", order.id).neq("payment_status", "paid");
      return json({ ok: true });
    }
    if (action === "refund") {
      // Só administradores da loja podem estornar.
      const auth = req.headers.get("Authorization") || "";
      const { data: u } = await db.auth.getUser(auth.replace(/^Bearer\s+/i, ""));
      const uid = u?.user?.id;
      if (!uid) return json({ error: "Não autorizado" }, 401);
      const { data: ok } = await db.rpc("has_store_permission", { _user_id: uid, _store_id: order.store_id, _permission: "can_manage_orders" });
      if (!ok) return json({ error: "Sem permissão" }, 403);
      if (order.payment_status !== "paid") return json({ error: "Pedido não está pago" }, 400);
      const s = await mp(token, `/v1/payments/search?external_reference=${order.id}&sort=date_created&criteria=desc`);
      const pay = (s.results || []).find((p: any) => p.status === "approved");
      if (!pay) return json({ error: "Pagamento aprovado não encontrado no Mercado Pago" }, 404);
      await mp(token, `/v1/payments/${pay.id}/refunds`, { method: "POST", body: "{}", headers: { "X-Idempotency-Key": `refund-${order.id}` } });
      await db.from("orders").update({ payment_status: "refunded", status: "cancelado" }).eq("id", order.id);
      return json({ ok: true, refundedPaymentId: String(pay.id) });
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
    await db.from("orders").update({ payment_status: "pending", payment_method: "cartao", payment_error: null }).eq("id", order.id);
    return json({ checkoutUrl: pref.init_point, amount });
  } catch (e) {
    console.error(e);
    return json({ error: (e as Error).message }, 500);
  }
});
