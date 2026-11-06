import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3.23.8";

// Estoque DISPONÍVEL vindo da view mpz_produto_estoque do ERP (já desconta pedidos confirmados no ERP).
// Desconta ainda os pedidos do MPZ que reservam estoque e ainda NÃO foram transmitidos ao ERP.
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const Body = z.object({
  store_slug: z.string().min(1).max(60),
  full: z.boolean().default(true), // true = produtos fora da view ficam com estoque 0
  stock: z.array(z.object({
    codigo: z.union([z.string(), z.number()]).transform((v) => String(v).trim()),
    quantidade: z.union([z.string(), z.number()]).transform((v) => Math.max(0, Math.trunc(Number(v) || 0))),
  })).max(20000),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);
  const token = Deno.env.get("TITLES_SYNC_TOKEN");
  if (!token || req.headers.get("x-sync-token") !== token) return json({ error: "Não autorizado" }, 401);

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: parsed.error.flatten() }, 400);
  const { store_slug, full, stock } = parsed.data;
  if (full && stock.length === 0) return json({ error: "Lista vazia com full=true; nada alterado." }, 400);

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: store } = await sb.from("stores").select("id").eq("slug", store_slug).maybeSingle();
  if (!store) return json({ error: "Loja não encontrada" }, 404);

  const erp = new Map<string, number>();
  for (const s of stock) if (s.codigo) erp.set(s.codigo, s.quantidade);

  // Reservas MPZ ainda não transmitidas ao ERP
  const reserved = new Map<string, number>();
  const { data: open } = await sb.from("orders").select("items")
    .eq("store_id", store.id).is("erp_order_code", null)
    .in("status", ["pendente", "pending", "confirmado", "preparando", "liberado_transmissao"]);
  for (const o of open || []) {
    for (const it of Array.isArray(o.items) ? o.items : []) {
      const key = String(it?.variantId || it?.productId || "");
      const q = Math.trunc(Number(it?.quantity) || 0);
      if (key && q > 0) reserved.set(key, (reserved.get(key) || 0) + q);
    }
  }

  const products: { id: string; code: string; stock: number }[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb.from("products").select("id, code, stock").eq("store_id", store.id).range(from, from + 999);
    if (error) return json({ error: error.message }, 500);
    products.push(...(data || []));
    if (!data || data.length < 1000) break;
  }

  const updates: { code: string; old: number; new: number }[] = [];
  const seen = new Set<string>();
  for (const p of products) {
    const code = String(p.code || "").trim();
    const has = erp.has(code);
    if (has) seen.add(code);
    if (!has && !full) continue;
    const next = Math.max(0, (has ? erp.get(code)! : 0) - (reserved.get(p.id) || 0));
    if (next === (Number(p.stock) || 0)) continue;
    const { error } = await sb.from("products").update({ stock: next }).eq("id", p.id);
    if (error) { console.error("estoque", code, error.message); continue; }
    updates.push({ code, old: Number(p.stock) || 0, new: next });
  }

  // Variações (sku = código ERP)
  const ids = products.map((p) => p.id);
  let variantsUpdated = 0;
  for (let i = 0; i < ids.length; i += 200) {
    const { data: vs } = await sb.from("product_variants").select("id, sku, stock").in("product_id", ids.slice(i, i + 200));
    for (const v of vs || []) {
      const sku = String(v.sku || "").trim();
      if (!sku || !erp.has(sku)) continue;
      seen.add(sku);
      const next = Math.max(0, erp.get(sku)! - (reserved.get(v.id) || 0));
      if (next === (Number(v.stock) || 0)) continue;
      const { error } = await sb.from("product_variants").update({ stock: next }).eq("id", v.id);
      if (!error) variantsUpdated++;
    }
  }

  const notFound = [...erp.keys()].filter((c) => !seen.has(c));
  return json({
    ok: true, erp_codes: erp.size, total_products: products.length,
    updated_stock: updates.length, variants_updated: variantsUpdated,
    zeroed_products: updates.filter((u) => u.new === 0).length,
    not_found: notFound.length, not_found_codes: notFound.slice(0, 100), stock_updates: updates.slice(0, 200),
  });
});
