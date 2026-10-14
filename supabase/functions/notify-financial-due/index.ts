import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import webpush from "npm:web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const VAPID_PUBLIC = "BJ6oIN09KH0dVoehG1bB8w1ebT4B6vWQ2AeAEpdfv8sEWkhu3vhTOMHebadvnRujYhAF7pWKgZSZOtyaozsU3jk";

const norm = (c: unknown) => String(c ?? "").trim().replace(/^0+/, "");
const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtDate = (d: string) => d.split("-").reverse().join("/");

// Data de hoje em São Paulo (UTC-3)
function todaySP(offsetDays = 0): string {
  const d = new Date(Date.now() - 3 * 3600_000 + offsetDays * 86400_000);
  return d.toISOString().slice(0, 10);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const json = (b: unknown, status = 200) =>
    new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE_KEY");
    if (!VAPID_PRIVATE) throw new Error("VAPID_PRIVATE_KEY not configured");
    webpush.setVapidDetails(Deno.env.get("VAPID_SUBJECT") || "mailto:contato@meupedidonozap.com.br", VAPID_PUBLIC, VAPID_PRIVATE);

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const today = todaySP(0);
    const dueSoonDate = todaySP(2);      // vence daqui a 2 dias
    const overdueLimit = todaySP(-2);    // vencido há mais de 2 dias

    // Assinaturas de clientes ativas
    const { data: subs } = await supabase
      .from("push_subscriptions")
      .select("id, store_id, endpoint, p256dh, auth, customer_profile_id")
      .eq("kind", "customer").eq("is_active", true);
    if (!subs?.length) return json({ ok: true, sent: 0, reason: "no customer subscriptions" });

    const profileIds = [...new Set(subs.map((s: any) => s.customer_profile_id).filter(Boolean))];
    const { data: profiles } = await supabase
      .from("customer_profiles").select("id, store_id, customer_code, name").in("id", profileIds);
    const profById = new Map((profiles || []).map((p: any) => [p.id, p]));
    const storeIds = [...new Set((profiles || []).map((p: any) => p.store_id))];
    const { data: stores } = await supabase.from("stores").select("id, slug").in("id", storeIds);
    const slugById = new Map((stores || []).map((s: any) => [s.id, s.slug]));

    let sent = 0;
    const dead: string[] = [];

    for (const storeId of storeIds) {
      const storeProfiles = (profiles || []).filter((p: any) => p.store_id === storeId && norm(p.customer_code));
      if (!storeProfiles.length) continue;
      const codes = new Set(storeProfiles.map((p: any) => norm(p.customer_code)));

      const { data: titles } = await supabase
        .from("customer_titles")
        .select("id, cliente_codigo, valor_saldo, data_vencimento, parcela, nota_fiscal_numero")
        .eq("store_id", storeId).is("data_quitacao", null).gt("valor_saldo", 0)
        .or(`data_vencimento.eq.${dueSoonDate},data_vencimento.lt.${overdueLimit}`);

      const relevant = (titles || []).filter((t: any) => codes.has(norm(t.cliente_codigo)));
      if (!relevant.length) continue;

      const { data: logged } = await supabase.from("financial_notification_log")
        .select("title_id, kind").eq("sent_on", today).in("title_id", relevant.map((t: any) => t.id));
      const already = new Set((logged || []).map((l: any) => `${l.title_id}|${l.kind}`));

      for (const prof of storeProfiles) {
        const mine = relevant.filter((t: any) => norm(t.cliente_codigo) === norm(prof.customer_code));
        const dueSoon = mine.filter((t: any) => t.data_vencimento === dueSoonDate && !already.has(`${t.id}|due_soon`));
        const overdue = mine.filter((t: any) => t.data_vencimento < overdueLimit && !already.has(`${t.id}|overdue`));
        const mySubs = subs.filter((s: any) => s.customer_profile_id === prof.id);
        if (!mySubs.length) continue;

        const msgs: Array<{ kind: string; items: any[]; title: string; body: string }> = [];
        if (dueSoon.length) {
          const tot = dueSoon.reduce((a: number, t: any) => a + Number(t.valor_saldo || 0), 0);
          msgs.push({ kind: "due_soon", items: dueSoon, title: "Parcela vence em 2 dias",
            body: `Olá! ${dueSoon.length > 1 ? `${dueSoon.length} parcelas somando ` : "Sua parcela de "}${brl(tot)} vence em ${fmtDate(dueSoonDate)}. Toque para ver o boleto.` });
        }
        if (overdue.length) {
          const tot = overdue.reduce((a: number, t: any) => a + Number(t.valor_saldo || 0), 0);
          msgs.push({ kind: "overdue", items: overdue, title: "Parcela em atraso",
            body: `Consta${overdue.length > 1 ? `m ${overdue.length} parcelas vencidas` : " parcela vencida"} há mais de 2 dias, total ${brl(tot)}. Toque para regularizar.` });
        }

        for (const m of msgs) {
          const payload = JSON.stringify({ title: m.title, body: m.body, url: `/${slugById.get(storeId) || ""}/meus-titulos`, tag: `fin-${m.kind}-${prof.id}` });
          let ok = false;
          for (const s of mySubs) {
            try {
              await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload);
              sent++; ok = true;
            } catch (e: any) {
              if (e?.statusCode === 404 || e?.statusCode === 410) dead.push(s.id);
              console.error("push fail", e?.statusCode);
            }
          }
          if (ok) {
            await supabase.from("financial_notification_log").upsert(
              m.items.map((t: any) => ({ store_id: storeId, title_id: t.id, kind: m.kind, sent_on: today })),
              { onConflict: "title_id,kind,sent_on", ignoreDuplicates: true },
            );
          }
        }
      }
    }
    if (dead.length) await supabase.from("push_subscriptions").update({ is_active: false }).in("id", dead);
    return json({ ok: true, sent, dead: dead.length });
  } catch (err) {
    console.error("notify-financial-due error", err);
    return json({ error: String(err) }, 500);
  }
});
