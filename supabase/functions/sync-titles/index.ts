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
const BodySchema = z.object({
  store_slug: z.string().min(1).max(100),
  titles: z.array(TitleSchema).max(5000).default([]),
  boletos: z.array(BoletoSchema).max(500).default([]),
});

/** Chave única: filial|nota|serie+parcela (mesmo formato da coluna parcela da view). */
const keyOf = (filial: string, codigo: string, parcela: string) => `${filial || "1"}|${codigo}|${parcela}`;

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

  // 2) Boletos
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

  return json({ ok: true, titlesUpserted, boletosSaved, boletoErrors: boletoErrors.slice(0, 50) });
});
