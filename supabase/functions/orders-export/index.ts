// Entrega pedidos DiColore "Liberado p/ Transmissão" em JSON para o integrador
// Python local (Gestor001A) e recebe a confirmação de gravação no ERP.
// Autenticação: header x-sync-token = TITLES_SYNC_TOKEN.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const ALLOWED_SLUGS = new Set(["dicolore"]);
const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

function rate(kitUnit: number, comps: { quantity: number; fullPrice: number }[]): number[] {
  const target = r2(kitUnit);
  const w = comps.map((c) => (c.fullPrice > 0 ? c.fullPrice : 0) * c.quantity);
  const sum = w.reduce((a, b) => a + b, 0);
  const qSum = comps.reduce((a, c) => a + c.quantity, 0) || 1;
  let acc = 0;
  return comps.map((c, i) => {
    if (i === comps.length - 1) return r2(r2(target - acc) / c.quantity);
    const share = sum > 0 ? (w[i] / sum) * target : (c.quantity / qSum) * target;
    const u = r2(share / c.quantity);
    acc = r2(acc + u * c.quantity);
    return u;
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const token = Deno.env.get("TITLES_SYNC_TOKEN");
  if (!token || req.headers.get("x-sync-token") !== token) return json({ error: "unauthorized" }, 401);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const url = new URL(req.url);

  try {
    if (req.method === "GET") {
      const slug = url.searchParams.get("store_slug") || "dicolore";
      if (!ALLOWED_SLUGS.has(slug)) return json({ error: "store not allowed" }, 403);
      const limit = Math.min(Number(url.searchParams.get("limit") || 50), 200);
      const { data: store } = await admin.from("stores").select("id, slug, settings").eq("slug", slug).single();
      if (!store) return json({ error: "store not found" }, 404);

      const { data: orders, error } = await admin.from("orders")
        .select("id, order_number, customer, items, subtotal, discount, delivery_fee, total, observations, created_at, status")
        .eq("store_id", store.id).eq("status", "liberado_transmissao").is("erp_sent_at", null)
        .order("created_at", { ascending: true }).limit(limit);
      if (error) throw error;
      if (!orders?.length) return json({ orders: [] });

      // Produtos (comissão pela categoria, kits)
      const ids = new Set<string>();
      orders.forEach((o: any) => (o.items || []).forEach((i: any) => i.productId && ids.add(i.productId)));
      const { data: kits } = await admin.from("product_kit_items")
        .select("kit_product_id, component_product_id, quantity, sort_order").in("kit_product_id", [...ids]);
      (kits || []).forEach((k: any) => ids.add(k.component_product_id));
      const { data: prods } = await admin.from("products")
        .select("id, code, name, base_price, category_id, categories(commission_percent)").in("id", [...ids]);
      const pmap = new Map((prods || []).map((p: any) => [p.id, p]));
      const kitMap = new Map<string, any[]>();
      (kits || []).sort((a: any, b: any) => a.sort_order - b.sort_order).forEach((k: any) => {
        const arr = kitMap.get(k.kit_product_id) || [];
        arr.push(k); kitMap.set(k.kit_product_id, arr);
      });
      const commission = (pid: string) => Number(pmap.get(pid)?.categories?.commission_percent) || 0;

      // Perfis dos clientes (código ERP, tabela)
      const codes = [...new Set(orders.map((o: any) => String(o.customer?.customerCode || "").trim()).filter(Boolean))];
      const { data: profiles } = codes.length
        ? await admin.from("customer_profiles").select("customer_code, cpf_cnpj, seller_code, price_table, ie, transportadora")
            .eq("store_id", store.id).in("customer_code", codes)
        : { data: [] as any[] };
      const prof = new Map((profiles || []).map((p: any) => [String(p.customer_code).trim(), p]));

      // Televendas por nome (fallback quando o pedido não gravou o código)
      const { data: tvs } = await admin.from("store_users").select("name, erp_code")
        .eq("store_id", store.id).eq("role", "televendas");

      const out = orders.map((o: any) => {
        const c = o.customer || {};
        const cp = prof.get(String(c.customerCode || "").trim());
        const lines: any[] = [];
        for (const it of o.items || []) {
          const disc = Number(it.discountPercent) || 0;
          const unit = r2((Number(it.price) || 0) * (1 - disc / 100));
          const qty = Number(it.quantity) || 0;
          const comps = kitMap.get(it.productId) || [];
          if (comps.length) {
            const cs = comps.map((k: any) => ({ k, quantity: Number(k.quantity) || 1, fullPrice: Number(pmap.get(k.component_product_id)?.base_price) || 0 }));
            const prices = rate(unit, cs);
            cs.forEach((x, i) => {
              const p = pmap.get(x.k.component_product_id);
              lines.push({ product_id: x.k.component_product_id, code: p?.code, name: p?.name, quantity: x.quantity * qty,
                unit_price: prices[i], table_price: Number(p?.base_price) || prices[i], commission_percent: commission(x.k.component_product_id), kit_code: it.code });
            });
          } else {
            lines.push({ product_id: it.productId, code: it.code, name: it.name, color: it.color || null, size: it.size || null,
              quantity: qty, unit_price: unit, table_price: Number(it.price) || unit, commission_percent: commission(it.productId) });
          }
        }
        // Agrupa pelo código (mesma regra do XML)
        const merged = new Map<string, any>();
        for (const l of lines) {
          const key = `${l.code}|${l.color || ""}|${l.size || ""}`;
          const m = merged.get(key);
          const cents = Math.round(l.unit_price * l.quantity * 100);
          if (m) { m.quantity += l.quantity; m._cents += cents; }
          else merged.set(key, { ...l, _cents: cents });
        }
        const items = [...merged.values()].map(({ _cents, ...l }) => ({
          ...l, total: _cents / 100, unit_price: l.quantity ? r2(_cents / 100 / l.quantity) : 0,
          commission_value: r2((_cents / 100) * (l.commission_percent / 100)),
        }));
        const isTv = !!c.isTelevendas;
        const tvCode = c.televendasErpCode
          || (isTv ? (tvs || []).find((t: any) => t.name?.trim().toLowerCase() === String(c.televendasName || "").trim().toLowerCase())?.erp_code : null)
          || null;
        return {
          id: o.id, order_number: o.order_number, created_at: o.created_at,
          customer: {
            code: c.customerCode || cp?.customer_code || null, name: c.name,
            cpf_cnpj: (c.cpfCnpj || cp?.cpf_cnpj || "").replace(/\D/g, ""), ie: c.ie || cp?.ie || null,
            whatsapp: c.whatsapp, cep: c.cep, uf: c.uf, city: c.city, neighborhood: c.neighborhood,
            address: c.address, number: c.number, complement: c.complement,
          },
          seller_code: c.sellerCode || cp?.seller_code || null,
          price_table: c.priceTable ?? cp?.price_table ?? null,
          payment_forma_codigo: c.paymentFormaCodigo || null,
          payment_condicao_codigo: c.paymentCondicaoCodigo || null,
          payment_condicao_descricao: c.paymentCondicaoDescricao || null,
          transportadora: c.transportadora || cp?.transportadora || null,
          televendas: isTv, televendas_erp_code: tvCode,
          subtotal: Number(o.subtotal), discount: Number(o.discount), delivery_fee: Number(o.delivery_fee), total: Number(o.total),
          observations: o.observations || "", items,
        };
      });
      return json({ orders: out });
    }

    if (req.method === "POST") {
      const body = await req.json();
      const results = Array.isArray(body?.results) ? body.results : [body];
      const done: string[] = [];
      for (const r of results.slice(0, 200)) {
        if (!r?.order_id) continue;
        const { data: o } = await admin.from("orders").select("id, store_id, stores(slug)").eq("id", r.order_id).maybeSingle();
        if (!o || !ALLOWED_SLUGS.has((o as any).stores?.slug)) continue;
        const patch: Record<string, unknown> = r.ok === false
          ? { erp_error: String(r.error || "erro").slice(0, 1000) }
          : { erp_order_code: String(r.erp_order_code || ""), erp_sent_at: new Date().toISOString(), erp_error: null,
              xml_downloaded_at: new Date().toISOString(), status: "confirmado" };
        const { error } = await admin.from("orders").update(patch).eq("id", r.order_id).is("erp_sent_at", null);
        if (!error) done.push(r.order_id);
      }
      return json({ ok: true, updated: done });
    }
    return json({ error: "method not allowed" }, 405);
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
