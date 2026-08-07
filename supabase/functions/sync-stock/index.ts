import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/** Planilha oficial de ESTOQUE (Google Sheets) — colunas CODIGO / PRODUTO / ESTOQUE. */
const SPREADSHEET_ID = "1iYMv2HWlSE4tNHXswnijRm1AZX6sd2wEf3lfEM4lWoU";

const normalizeHeader = (h: string) =>
  String(h ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();

async function readSheet(): Promise<string[][] | null> {
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  const sheetsKey = Deno.env.get("GOOGLE_SHEETS_API_KEY");
  if (!lovableKey || !sheetsKey) return null;
  const url = `https://connector-gateway.lovable.dev/google_sheets/v4/spreadsheets/${SPREADSHEET_ID}/values/A:Z`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": sheetsKey,
    },
  });
  if (!res.ok) {
    const body = await res.text();
    console.error(`Google Sheets gateway falhou [${res.status}]: ${body}`);
    return null;
  }
  const json = await res.json();
  const values = json?.values;
  return Array.isArray(values) && values.length > 1 ? (values as string[][]) : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { store_id } = await req.json();
    if (!store_id) {
      return new Response(JSON.stringify({ error: "store_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rows = await readSheet();
    if (!rows) {
      return new Response(
        JSON.stringify({ error: "Não foi possível ler a planilha de estoque." }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const header = rows[0].map(normalizeHeader);
    const codeIdx = header.findIndex((h) =>
      ["codigo", "procod", "cod", "code", "codigo produto"].includes(h)
    );
    const stockIdx = header.findIndex((h) =>
      ["estoque", "saldo", "qtd", "quantidade", "estoque atual", "saldo estoque"].includes(h)
    );

    if (codeIdx === -1 || stockIdx === -1) {
      return new Response(
        JSON.stringify({
          error: "Cabeçalho inválido: exige colunas CODIGO e ESTOQUE.",
          detected_headers: header,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const toInt = (raw: string | undefined): number => {
      if (raw == null) return 0;
      const cleaned = String(raw).trim().replace(/\s/g, "").replace(/\.(?=\d{3}\b)/g, "").replace(",", ".");
      const n = Math.trunc(Number(cleaned));
      return Number.isFinite(n) ? n : 0;
    };

    const sheetStock: Record<string, number> = {};
    for (let i = 1; i < rows.length; i++) {
      const cols = rows[i] || [];
      const code = String(cols[codeIdx] ?? "").trim();
      if (!code) continue;
      sheetStock[code] = toInt(cols[stockIdx]);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: products, error: pErr } = await supabase
      .from("products")
      .select("id, code, stock")
      .eq("store_id", store_id);

    if (pErr) {
      return new Response(JSON.stringify({ error: pErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const dbCodes = new Set((products || []).map((p) => p.code));
    const stockUpdates: { code: string; old: number; new: number }[] = [];
    const zeroed: string[] = [];

    for (const product of products || []) {
      const current = Number(product.stock) || 0;
      const next = Object.prototype.hasOwnProperty.call(sheetStock, product.code)
        ? sheetStock[product.code]
        : 0;
      if (next === current) continue;
      const { error: upErr } = await supabase
        .from("products")
        .update({ stock: next })
        .eq("id", product.id);
      if (upErr) {
        console.error(`Falha ao atualizar estoque de ${product.code}:`, upErr.message);
        continue;
      }
      stockUpdates.push({ code: product.code, old: current, new: next });
      if (next === 0) zeroed.push(product.code);
    }

    const notFound = Object.keys(sheetStock).filter((c) => !dbCodes.has(c));

    return new Response(
      JSON.stringify({
        success: true,
        updated_stock: stockUpdates.length,
        zeroed_products: zeroed.length,
        not_found: notFound.length,
        total_sheet_codes: Object.keys(sheetStock).length,
        total_products: (products || []).length,
        stock_updates: stockUpdates,
        not_found_codes: notFound.slice(0, 100),
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("sync-stock erro:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});