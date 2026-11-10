import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import webpush from "npm:web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const VAPID_PUBLIC = "BJ6oIN09KH0dVoehG1bB8w1ebT4B6vWQ2AeAEpdfv8sEWkhu3vhTOMHebadvnRujYhAF7pWKgZSZOtyaozsU3jk";

// Envia push "produto disponível" para quem pediu Avise-me, quando o produto tem estoque.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const json = (b: unknown, status = 200) =>
    new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  try {
    const body = await req.json().catch(() => ({}));
    const productId = String(body?.product_id || "");
    if (!/^[0-9a-f-]{36}$/i.test(productId)) return json({ error: "product_id inválido" }, 400);

    const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE_KEY");
    if (!VAPID_PRIVATE) throw new Error("VAPID_PRIVATE_KEY not configured");
    webpush.setVapidDetails(Deno.env.get("VAPID_SUBJECT") || "mailto:contato@meupedidonozap.com.br", VAPID_PUBLIC, VAPID_PRIVATE);
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: product } = await sb.from("products").select("id, name, stock, is_active, store_id").eq("id", productId).maybeSingle();
    if (!product || !product.is_active || Number(product.stock) <= 0) return json({ ok: true, sent: 0, reason: "sem estoque" });
    const { data: store } = await sb.from("stores").select("slug").eq("id", product.store_id).maybeSingle();

    const { data: wishes } = await sb.from("product_wishlist")
      .select("id, user_id, customer_profile_id").eq("product_id", productId).is("push_notified_at", null);
    if (!wishes?.length) return json({ ok: true, sent: 0 });

    const profileIds = wishes.map((w: any) => w.customer_profile_id).filter(Boolean);
    const userIds = wishes.map((w: any) => w.user_id).filter(Boolean);
    let subs: any[] = [];
    if (profileIds.length || userIds.length) {
      const ors = [
        profileIds.length ? `customer_profile_id.in.(${profileIds.join(",")})` : "",
        userIds.length ? `user_id.in.(${userIds.join(",")})` : "",
      ].filter(Boolean).join(",");
      const { data } = await sb.from("push_subscriptions").select("id, endpoint, p256dh, auth, user_id, customer_profile_id")
        .eq("kind", "customer").eq("is_active", true).eq("store_id", product.store_id).or(ors);
      subs = data || [];
    }

    const payload = JSON.stringify({
      title: "Produto disponível!",
      body: `Olá, o produto "${product.name}" que você queria já está disponível para compra.`,
      url: `/${store?.slug || ""}`,
      tag: `wish-${productId}`,
    });
    let sent = 0; const dead: string[] = []; const notified: string[] = [];
    for (const w of wishes) {
      const mine = subs.filter((s) => (w.customer_profile_id && s.customer_profile_id === w.customer_profile_id) || (w.user_id && s.user_id === w.user_id));
      for (const s of mine) {
        try { await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload); sent++; }
        catch (e: any) { if (e?.statusCode === 404 || e?.statusCode === 410) dead.push(s.id); }
      }
      notified.push(w.id);
    }
    if (notified.length) await sb.from("product_wishlist").update({ push_notified_at: new Date().toISOString() }).in("id", notified);
    if (dead.length) await sb.from("push_subscriptions").update({ is_active: false }).in("id", dead);
    return json({ ok: true, sent, requests: notified.length });
  } catch (err) {
    console.error("notify-wishlist error", err);
    return json({ error: String(err) }, 500);
  }
});
