import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import webpush from "npm:web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const VAPID_PUBLIC = "BJ6oIN09KH0dVoehG1bB8w1ebT4B6vWQ2AeAEpdfv8sEWkhu3vhTOMHebadvnRujYhAF7pWKgZSZOtyaozsU3jk";

function digits(s: string | undefined | null): string {
  return String(s ?? "").replace(/\D/g, "");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE_KEY");
    const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") || "mailto:contato@meupedidonozap.com.br";
    if (!VAPID_PRIVATE) throw new Error("VAPID_PRIVATE_KEY not configured");
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);

    const { order_id } = await req.json();
    if (!order_id) return new Response(JSON.stringify({ error: "order_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Load order
    const { data: order, error: oErr } = await supabase
      .from("orders")
      .select("id, store_id, order_number, customer, total, user_id, status")
      .eq("id", order_id)
      .maybeSingle();
    if (oErr || !order) throw new Error("order not found: " + (oErr?.message || ""));

    // Load store slug for click URL
    const { data: store } = await supabase.from("stores").select("slug, name").eq("id", order.store_id).maybeSingle();

    // Resolve seller_code from customer profile
    const customer = (order.customer || {}) as any;
    const phone = digits(customer.whatsapp || customer.phone);
    let sellerCode = "";
    if (order.user_id) {
      const { data: cp } = await supabase
        .from("customer_profiles")
        .select("seller_code")
        .eq("store_id", order.store_id)
        .eq("user_id", order.user_id)
        .maybeSingle();
      sellerCode = (cp?.seller_code || "").trim();
    }
    if (!sellerCode && phone) {
      const { data: cps } = await supabase
        .from("customer_profiles")
        .select("seller_code, whatsapp")
        .eq("store_id", order.store_id)
        .ilike("whatsapp", `%${phone.slice(-8)}%`)
        .limit(5);
      sellerCode = ((cps || []).find((c: any) => (c.seller_code || "").trim() !== "")?.seller_code || "").trim();
    }

    if (!sellerCode) {
      return new Response(JSON.stringify({ ok: true, skipped: "no seller_code" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Recipients (vendedor + televendas)
    const { data: recipients, error: rErr } = await supabase.rpc("get_order_recipients", {
      p_store_id: order.store_id,
      p_seller_code: sellerCode,
    });
    if (rErr) throw rErr;
    const sellerIds = (recipients || []).map((r: any) => r.id);
    if (sellerIds.length === 0) {
      return new Response(JSON.stringify({ ok: true, skipped: "no recipients" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Push subscriptions
    const { data: subs } = await supabase
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .eq("store_id", order.store_id)
      .in("seller_id", sellerIds)
      .eq("is_active", true);

    if (!subs || subs.length === 0) {
      return new Response(JSON.stringify({ ok: true, recipients: sellerIds.length, sent: 0, skipped: "no subscriptions" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const totalBR = Number(order.total || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    const slug = (store?.slug || "").toLowerCase();
    const orderNumFmt = `#${String(order.order_number).padStart(5, "0")}`;
    const customerName = (customer.name || "Cliente").toString().trim();

    let title = `🛎️ Novo pedido #${order.order_number} — REVISAR`;
    let body = `${customerName} · ${totalBR}`;
    let tag = `order-${order.id}`;

    // Follow Up exclusivo da Dicolore: somente quando o pedido está pendente
    if (slug === "dicolore" && String(order.status) === "pendente") {
      title = `Novo pedido ${orderNumFmt} — avaliar`;
      body = `Olá, o(a) cliente "${customerName}" enviou o pedido ${orderNumFmt} para a sua avaliação.`;
      tag = `dicolore-followup-${order.id}`;
    }

    const payload = JSON.stringify({
      title,
      body,
      url: `/${store?.slug || ""}/admin`,
      tag,
    });

    let sent = 0;
    const dead: string[] = [];
    await Promise.all(
      subs.map(async (s: any) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            payload,
          );
          sent++;
        } catch (e: any) {
          const code = e?.statusCode;
          if (code === 404 || code === 410) dead.push(s.id);
          console.error("push fail", s.endpoint, code, e?.body);
        }
      }),
    );

    if (dead.length > 0) {
      await supabase.from("push_subscriptions").update({ is_active: false }).in("id", dead);
    }

    return new Response(JSON.stringify({ ok: true, recipients: sellerIds.length, sent, dead: dead.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("notify-new-order error", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});