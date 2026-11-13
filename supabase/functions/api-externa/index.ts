// API externa DiColore para ferramentas de terceiros.
// Autenticação: header x-api-key = EXTERNAL_API_TOKEN.
// Rotas: GET /pedidos, POST /pedidos/confirmar, GET /clientes, POST /clientes/confirmar
// Pedidos reaproveitam orders-export (mesmo conteúdo do integrador atual).
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3";
import { toDwCliente } from "../_shared/dwCliente.ts";
import { resolveExternalExportProfile } from "../_shared/customerExportProfile.ts";

const SLUG = "dicolore";
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const PedidoConf = z.object({
  pedido_id: z.string().uuid(),
  codigo_erp: z.string().trim().min(1).max(50).optional(),
  cliente_codigo_erp: z.string().trim().regex(/^\d{1,30}$/).optional(),
  erro: z.string().max(1000).optional(),
}).refine((v) => v.codigo_erp || v.erro, { message: "informe codigo_erp ou erro" });

const opt = (n: number) => z.string().trim().max(n).optional().nullable();
const ClienteConf = z.object({
  id_mpz: z.string().uuid(),
  codigo_erp: z.string().trim().min(1).max(30).optional(),
  erro: z.string().max(1000).optional(),
  nome: opt(200), ie: opt(30), cep: opt(10), uf: opt(2), cidade: opt(100), bairro: opt(100),
  endereco: opt(200), numero: opt(20), complemento: opt(100), whatsapp: opt(20),
  vendedor_codigo: opt(20), transportadora: opt(100),
  tabela_preco: z.number().int().min(0).max(99).optional().nullable(),
}).refine((v) => v.codigo_erp || v.erro, { message: "informe codigo_erp ou erro" });

const listOf = <T extends z.ZodTypeAny>(s: T) =>
  z.union([z.object({ resultados: z.array(s).min(1).max(200) }), s.transform((x) => ({ resultados: [x] }))]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const key = Deno.env.get("EXTERNAL_API_TOKEN");
  if (!key || req.headers.get("x-api-key") !== key) return json({ erro: "nao autorizado" }, 401);

  const SB_URL = Deno.env.get("SUPABASE_URL")!;
  const admin = createClient(SB_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const url = new URL(req.url);
  const route = url.pathname.replace(/^.*\/api-externa/, "").replace(/\/+$/, "") || "/";
  const limit = Math.min(Math.max(Number(url.searchParams.get("limite") || 50) || 50, 1), 50);

  try {
    const { data: store } = await admin.from("stores").select("id, settings").eq("slug", SLUG).single();
    if (!store) return json({ erro: "loja nao encontrada" }, 404);

    // ---------- PEDIDOS ----------
    if (route === "/pedidos" || route === "/pedidos/confirmar") {
      const exportUrl = `${SB_URL}/functions/v1/orders-export`;
      const hdr = { "x-sync-token": Deno.env.get("TITLES_SYNC_TOKEN") || "", "Content-Type": "application/json" };
      if (route === "/pedidos" && req.method === "GET") {
        const r = await fetch(`${exportUrl}?store_slug=${SLUG}&limit=${limit}&source=externa`, { headers: hdr });
        const body = await r.json();
        if (!r.ok) return json({ erro: body?.error || "falha" }, r.status);
        return json({ pedidos: body.orders ?? [], ...(body.integrador_ativo === "bat" ? { aviso: "integrador externo desativado na loja" } : {}) });
      }
      if (route === "/pedidos/confirmar" && req.method === "POST") {
        if ((store.settings as any)?.useExternalIntegrator !== true) return json({ erro: "integrador externo desativado na loja" }, 409);
        const p = listOf(PedidoConf).safeParse(await req.json().catch(() => null));
        if (!p.success) return json({ erro: p.error.flatten() }, 400);
        const atualizados: string[] = [];
        const falhas: { pedido_id: string; erro: string }[] = [];
        const clientes: { pedido_id: string; cliente_codigo_erp: string }[] = [];
        for (const x of p.data.resultados) {
          const { data: order, error: orderError } = await admin.from("orders").select("id, customer")
            .eq("id", x.pedido_id).eq("store_id", store.id).maybeSingle();
          if (orderError || !order) { falhas.push({ pedido_id: x.pedido_id, erro: "pedido nao encontrado" }); continue; }
          const c = (order.customer || {}) as any;
          const code = String(c.customerCode || "").trim();
          const doc = String(c.cpfCnpj || "").replace(/\D/g, "");
          const docs = [doc, String(c.cpfCnpj || "").trim()];
          if (doc.length === 11) docs.push(`${doc.slice(0,3)}.${doc.slice(3,6)}.${doc.slice(6,9)}-${doc.slice(9)}`);
          if (doc.length === 14) docs.push(`${doc.slice(0,2)}.${doc.slice(2,5)}.${doc.slice(5,8)}/${doc.slice(8,12)}-${doc.slice(12)}`);
          const query = admin.from("customer_profiles").select("*").eq("store_id", store.id);
          const { data: profiles, error: profileError } = code ? await query.eq("customer_code", code) : await query.in("cpf_cnpj", docs);
          if (profileError) { falhas.push({ pedido_id: x.pedido_id, erro: profileError.message }); continue; }
          const cp = resolveExternalExportProfile(profiles || [], c);
          const { data, error } = await admin.rpc("confirm_external_order_customer", {
            p_order_id: x.pedido_id, p_profile_id: cp?.id ?? null, p_order_code: x.codigo_erp ?? null,
            p_customer_code: x.cliente_codigo_erp ?? null, p_error: x.codigo_erp ? null : x.erro ?? null,
          });
          if (error) falhas.push({ pedido_id: x.pedido_id, erro: error.message });
          else {
            atualizados.push(x.pedido_id);
            if (data?.cliente_codigo_erp) clientes.push({ pedido_id: x.pedido_id, cliente_codigo_erp: data.cliente_codigo_erp });
          }
        }
        return json({ ok: falhas.length === 0, atualizados, clientes, falhas });
      }
    }

    // ---------- CLIENTES ----------
    if (route === "/clientes" && req.method === "GET") {
      const { data, error } = await admin.from("customer_profiles").select("*")
        .eq("store_id", store.id).or("customer_code.is.null,customer_code.eq.").is("erp_sent_at", null)
        .order("created_at", { ascending: true }).limit(limit);
      if (error) throw error;
      return json({ clientes: (data ?? []).map(toDwCliente) });
    }

    if (route.startsWith("/clientes/codigo/") && req.method === "GET") {
      const code = decodeURIComponent(route.slice("/clientes/codigo/".length)).trim();
      const { data, error } = await admin.from("customer_profiles").select("*")
        .eq("store_id", store.id).eq("customer_code", code).limit(1);
      if (error) throw error;
      if (!data?.length) return json({ erro: "cliente nao encontrado" }, 404);
      return json({ cliente: toDwCliente(data[0]) });
    }

    if (route === "/clientes/confirmar" && req.method === "POST") {
      const p = listOf(ClienteConf).safeParse(await req.json().catch(() => null));
      if (!p.success) return json({ erro: p.error.flatten() }, 400);
      const atualizados: string[] = [];
      const falhas: { id_mpz: string; erro: string }[] = [];
      for (const c of p.data.resultados) {
        const { data: cur } = await admin.from("customer_profiles").select("id")
          .eq("id", c.id_mpz).eq("store_id", store.id).maybeSingle();
        if (!cur) { falhas.push({ id_mpz: c.id_mpz, erro: "cliente nao encontrado" }); continue; }
        if (!c.codigo_erp) {
          await admin.from("customer_profiles").update({ erp_error: String(c.erro).slice(0, 1000) }).eq("id", c.id_mpz);
          atualizados.push(c.id_mpz); continue;
        }
        const { data: dup } = await admin.from("customer_profiles").select("id")
          .eq("store_id", store.id).eq("customer_code", c.codigo_erp).neq("id", c.id_mpz).limit(1);
        if (dup?.length) { falhas.push({ id_mpz: c.id_mpz, erro: `codigo ${c.codigo_erp} ja usado por outro cliente` }); continue; }
        const patch: Record<string, unknown> = {
          customer_code: c.codigo_erp, erp_sent_at: new Date().toISOString(), erp_error: null,
          approval_status: "approved", is_active: true,
        };
        const map: [keyof typeof c, string][] = [["nome", "name"], ["ie", "ie"], ["cep", "cep"], ["uf", "uf"],
          ["cidade", "city"], ["bairro", "neighborhood"], ["endereco", "address"], ["numero", "number"],
          ["complemento", "complement"], ["whatsapp", "whatsapp"], ["vendedor_codigo", "seller_code"],
          ["transportadora", "transportadora"], ["tabela_preco", "price_table"]];
        for (const [from, to] of map) if (c[from] != null && c[from] !== "") patch[to] = c[from];
        const { error } = await admin.from("customer_profiles").update(patch).eq("id", c.id_mpz);
        if (error) falhas.push({ id_mpz: c.id_mpz, erro: error.message }); else atualizados.push(c.id_mpz);
      }
      return json({ ok: falhas.length === 0, atualizados, falhas });
    }

    return json({ erro: "rota nao encontrada", rotas: ["GET /pedidos", "POST /pedidos/confirmar", "GET /clientes", "GET /clientes/codigo/:codigo", "POST /clientes/confirmar"] }, 404);
  } catch (e) {
    return json({ erro: (e as Error).message }, 500);
  }
});
