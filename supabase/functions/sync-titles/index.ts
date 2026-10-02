import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { unzipSync } from "npm:fflate@0.8.2";
import { z } from "npm:zod@3.23.8";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const str = z.union([z.string(), z.number()]).nullish().transform((v) => (v == null ? "" : String(v).trim()));
const num = z.union([z.string(), z.number()]).nullish().transform((v) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
});
const date = z.string().nullish().transform((v) => {
  const d = (v || "").slice(0, 10);
  return !d || d.startsWith("0001") ? null : d;
});

const TitleSchema = z.object({
  filial_codigo: str, vendedor_codigo: str, cliente_codigo: str, codigo: str,
  nota_fiscal_numero: str, nota_fiscal_serie: str, parcela: str, pedido_codigo: str,
  valor_total: num, valor_pago: num, valor_saldo: num, valor_comissao: num,
  data_emissao: date, data_vencimento: date, data_quitacao: date, status: str,
});
const BoletoSchema = z.object({
  filial_codigo: str, nota: str, serie: str, parcela: str,
  arquivo_base64: z.string().min(10),
});
const InvoiceSchema = z.object({
  numero: str, serie: str, filial_codigo: str, valor_total_nota_fiscal: num,
  pedido_codigo: str, vendedor_codigo: str, mensagem_nota_fiscal: str,
  data_emissao: date, cliente_codigo: str, valor_total_ipi: num,
  valor_total_st: num, valor_total_icms: num, tipo_frete: str,
  chave_nfe: str, data_entrega: date, transportadora_codigo: str,
  peso_total_liquido: num, peso_total_bruto: num, base_icms: num,
  base_st: num, valor_total_frete: num, valor_total_seguro: num,
  valor_total_desconto: num, valor_total_produtos: num,
  valor_total_despesas: num, status: str, condicao_pagamento_codigo: str,
  total_quantidade_un_1_faturada: num,
});
const OrderSchema = z.object({
  codigo: str, codigo_importacao: str, filial_codigo: str, cliente_codigo: str, vendedor_codigo: str,
  tabela_preco_codigo: str, condicao_pagamento_codigo: str, operacao_codigo: str, observacao_comercial: str,
  data_emissao: date, data_entrega: date, data_faturamento: date,
  valor_total_com_impostos: num, valor_total_desconto: num, valor_total_faturado: num, total_quantidade_un_1: num,
  status: str, ordem_faturamento: str, nota_fiscal_numero: str, pedido_origem: str,
}).passthrough();
const OrderItemSchema = z.object({
  codigo: str, pedido_codigo_importacao: str, filial_codigo: str, cliente_codigo: str,
  produto_codigo: str, produto_descricao: str,
  quantidade_un_1: num, quantidade_un_1_faturada: num, valor_unitario_venda: num,
  valor_total_com_impostos: num, percentual_total_descontos: num, status: str,
}).passthrough();
const BodySchema = z.object({
  store_slug: z.string().min(1).max(100),
  titles: z.array(TitleSchema).max(5000).default([]),
  boletos: z.array(BoletoSchema).max(500).default([]),
  invoices: z.array(InvoiceSchema).max(5000).default([]),
  orders: z.array(OrderSchema).max(5000).default([]),
  order_items: z.array(OrderItemSchema).max(10000).default([]),
});

/** Chave única: filial|nota|serie+parcela (mesmo formato da coluna parcela da view). */
const keyOf = (filial: string, codigo: string, parcela: string) => `${filial || "1"}|${codigo}|${parcela}`;
const invoiceKeyOf = (filial: string, numero: string, serie: string) => `${filial || "1"}|${numero}|${serie}`;
/** Pedido ERP: filial|pedcod (codigo_importacao) — estável mesmo quando o número do Zap muda. */
const orderKeyOf = (filial: string, pedcod: string) => `${filial || "1"}|${pedcod}`;

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function bytesToB64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

/** O ERP guarda o PDF compactado em ZIP (assinatura PK). Extrai o primeiro .pdf. */
function extractPdf(raw: Uint8Array): { name: string; bytes: Uint8Array } {
  if (raw[0] === 0x50 && raw[1] === 0x4b) {
    const files = unzipSync(raw);
    const name = Object.keys(files).find((n) => n.toLowerCase().endsWith(".pdf")) || Object.keys(files)[0];
    if (!name) throw new Error("ZIP vazio");
    return { name, bytes: files[name] };
  }
  return { name: "boleto.pdf", bytes: raw };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);

  const token = Deno.env.get("TITLES_SYNC_TOKEN");
  if (!token || req.headers.get("x-sync-token") !== token) return json({ error: "Não autorizado" }, 401);

  let body;
  try {
    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) return json({ error: parsed.error.flatten() }, 400);
    body = parsed.data;
  } catch {
    return json({ error: "JSON inválido" }, 400);
  }

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: store } = await supabase.from("stores").select("id").eq("slug", body.store_slug).maybeSingle();
  if (!store) return json({ error: "Loja não encontrada" }, 404);

  // 1) Títulos
  let titlesUpserted = 0;
  const rows = body.titles.map((t) => ({
    store_id: store.id,
    external_key: keyOf(t.filial_codigo, t.codigo, t.parcela),
    filial_codigo: t.filial_codigo, vendedor_codigo: t.vendedor_codigo, cliente_codigo: t.cliente_codigo,
    codigo: t.codigo, nota_fiscal_numero: t.nota_fiscal_numero, nota_fiscal_serie: t.nota_fiscal_serie,
    parcela: t.parcela, pedido_codigo: t.pedido_codigo,
    valor_total: t.valor_total, valor_pago: t.valor_pago,
    valor_saldo: t.status.toUpperCase() === "PAGO" ? 0 : Math.max(t.valor_total - t.valor_pago, 0),
    valor_comissao: t.valor_comissao,
    data_emissao: t.data_emissao, data_vencimento: t.data_vencimento, data_quitacao: t.data_quitacao,
    status: (t.status || "ABERTO").toUpperCase(),
  }));
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);
    const { error } = await supabase.from("customer_titles").upsert(chunk, { onConflict: "store_id,external_key" });
    if (error) return json({ error: `Falha ao gravar títulos: ${error.message}`, titlesUpserted }, 500);
    titlesUpserted += chunk.length;
  }

  // 2) Notas fiscais
  let invoicesUpserted = 0;
  const invoiceRows = body.invoices.map((invoice) => ({
    store_id: store.id,
    external_key: invoiceKeyOf(invoice.filial_codigo, invoice.numero, invoice.serie),
    numero: invoice.numero,
    serie: invoice.serie,
    filial_codigo: invoice.filial_codigo,
    valor_total_nota_fiscal: invoice.valor_total_nota_fiscal,
    pedido_codigo: invoice.pedido_codigo,
    vendedor_codigo: invoice.vendedor_codigo,
    mensagem_nota_fiscal: invoice.mensagem_nota_fiscal || null,
    data_emissao: invoice.data_emissao,
    cliente_codigo: invoice.cliente_codigo,
    valor_total_ipi: invoice.valor_total_ipi,
    valor_total_st: invoice.valor_total_st,
    valor_total_icms: invoice.valor_total_icms,
    tipo_frete: invoice.tipo_frete || null,
    chave_nfe: invoice.chave_nfe || null,
    data_entrega: invoice.data_entrega,
    transportadora_codigo: invoice.transportadora_codigo || null,
    peso_total_liquido: invoice.peso_total_liquido,
    peso_total_bruto: invoice.peso_total_bruto,
    base_icms: invoice.base_icms,
    base_st: invoice.base_st,
    valor_total_frete: invoice.valor_total_frete,
    valor_total_seguro: invoice.valor_total_seguro,
    valor_total_desconto: invoice.valor_total_desconto,
    valor_total_produtos: invoice.valor_total_produtos,
    valor_total_despesas: invoice.valor_total_despesas,
    status: invoice.status,
    condicao_pagamento_codigo: invoice.condicao_pagamento_codigo || null,
    total_quantidade_un_1_faturada: invoice.total_quantidade_un_1_faturada,
  }));
  for (let i = 0; i < invoiceRows.length; i += 500) {
    const chunk = invoiceRows.slice(i, i + 500);
    const { error } = await supabase.from("customer_invoices").upsert(chunk, { onConflict: "store_id,external_key" });
    if (error) return json({ error: `Falha ao gravar notas fiscais: ${error.message}`, invoicesUpserted }, 500);
    invoicesUpserted += chunk.length;
  }

  // 3) Boletos
  let boletosSaved = 0;
  const boletoErrors: string[] = [];
  for (const b of body.boletos) {
    const key = keyOf(b.filial_codigo, b.nota, `${b.serie}${b.parcela}`);
    try {
      const { data: title } = await supabase.from("customer_titles").select("id")
        .eq("store_id", store.id).eq("external_key", key).maybeSingle();
      if (!title) { boletoErrors.push(`${key}: título não encontrado`); continue; }
      const pdf = extractPdf(b64ToBytes(b.arquivo_base64));
      const { error } = await supabase.from("customer_title_boletos").upsert({
        title_id: title.id, file_name: pdf.name, pdf_base64: bytesToB64(pdf.bytes),
      });
      if (error) throw error;
      await supabase.from("customer_titles").update({ has_boleto: true }).eq("id", title.id);
      boletosSaved++;
    } catch (e) {
      boletoErrors.push(`${key}: ${(e as Error).message}`);
    }
  }

  // 4) Pedidos do ERP (vw_mpz_pedido)
  let ordersUpserted = 0;
  const orderRows = body.orders.map((o) => ({
    store_id: store.id,
    external_key: orderKeyOf(o.filial_codigo, o.codigo_importacao || o.codigo),
    codigo: o.codigo, codigo_importacao: o.codigo_importacao || o.codigo,
    filial_codigo: o.filial_codigo, cliente_codigo: o.cliente_codigo, vendedor_codigo: o.vendedor_codigo,
    tabela_preco_codigo: o.tabela_preco_codigo || null,
    condicao_pagamento_codigo: o.condicao_pagamento_codigo || null,
    operacao_codigo: o.operacao_codigo || null,
    observacao: o.observacao_comercial || null,
    data_emissao: o.data_emissao, data_entrega: o.data_entrega, data_faturamento: o.data_faturamento,
    valor_total: o.valor_total_com_impostos, valor_desconto: o.valor_total_desconto,
    valor_faturado: o.valor_total_faturado, quantidade_total: o.total_quantidade_un_1,
    status: ["N", "S", "F"].includes(o.status.toUpperCase()) ? o.status.toUpperCase() : "N",
    ordem_faturamento: o.ordem_faturamento || null,
    nota_fiscal_numero: o.nota_fiscal_numero && o.nota_fiscal_numero !== "0" ? o.nota_fiscal_numero : null,
    pedido_origem: o.pedido_origem || null,
  }));
  for (let i = 0; i < orderRows.length; i += 500) {
    const chunk = orderRows.slice(i, i + 500);
    const { error } = await supabase.from("erp_orders").upsert(chunk, { onConflict: "store_id,external_key" });
    if (error) return json({ error: `Falha ao gravar pedidos: ${error.message}`, ordersUpserted }, 500);
    ordersUpserted += chunk.length;
  }

  // 5) Itens dos pedidos (vw_mpz_pedido_item) — substitui todos os itens de cada pedido recebido
  let orderItemsSaved = 0;
  if (body.order_items.length) {
    const itemRows = body.order_items.map((it) => ({
      store_id: store.id,
      order_key: orderKeyOf(it.filial_codigo, it.pedido_codigo_importacao || it.codigo),
      cliente_codigo: it.cliente_codigo,
      produto_codigo: it.produto_codigo, produto_descricao: it.produto_descricao || null,
      quantidade: it.quantidade_un_1, quantidade_faturada: it.quantidade_un_1_faturada,
      valor_unitario: it.valor_unitario_venda, valor_total: it.valor_total_com_impostos,
      percentual_desconto: it.percentual_total_descontos, status: it.status || null,
    }));
    const keys = [...new Set(itemRows.map((r) => r.order_key))];
    // Completa cliente_codigo a partir do cabeçalho quando não vier no item
    const missing = keys.filter((k) => itemRows.some((r) => r.order_key === k && !r.cliente_codigo));
    for (let i = 0; i < missing.length; i += 300) {
      const { data } = await supabase.from("erp_orders").select("external_key, cliente_codigo")
        .eq("store_id", store.id).in("external_key", missing.slice(i, i + 300));
      const map = new Map((data || []).map((d) => [d.external_key, d.cliente_codigo]));
      for (const r of itemRows) if (!r.cliente_codigo) r.cliente_codigo = map.get(r.order_key) || "";
    }
    for (let i = 0; i < keys.length; i += 300) {
      const { error } = await supabase.from("erp_order_items").delete()
        .eq("store_id", store.id).in("order_key", keys.slice(i, i + 300));
      if (error) return json({ error: `Falha ao limpar itens: ${error.message}` }, 500);
    }
    for (let i = 0; i < itemRows.length; i += 1000) {
      const chunk = itemRows.slice(i, i + 1000);
      const { error } = await supabase.from("erp_order_items").insert(chunk);
      if (error) return json({ error: `Falha ao gravar itens: ${error.message}`, orderItemsSaved }, 500);
      orderItemsSaved += chunk.length;
    }
  }

  return json({ ok: true, titlesUpserted, invoicesUpserted, boletosSaved, ordersUpserted, orderItemsSaved, boletoErrors: boletoErrors.slice(0, 50) });
});
