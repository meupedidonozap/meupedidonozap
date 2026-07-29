import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/** Planilha oficial de produtos/preços (Google Sheets). */
const SPREADSHEET_ID = "1u6a579_NTt24Y93BrbkdRCPlP-JlFNJ0JcW00F2p3Zg";
/** Fallback: CSV publicado (usado se o conector Google Sheets falhar). */
const FALLBACK_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vTiEn32ibtrbsQQf4UAjNo3gJk13p7g4olYSWl2IRSNvkowpT1etqnS887s-mEAF2vrEAXnGMY96OKD/pub?output=csv";

/** RFC 4180 CSV parser – handles quoted fields with commas and escaped quotes */
function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ",") {
        fields.push(current.trim());
        current = "";
      } else current += ch;
    }
  }
  fields.push(current.trim());
  return fields;
}

const normalizeHeader = (h: string) =>
  String(h ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();

/** Lê a planilha pelo conector Google Sheets. Retorna matriz de linhas. */
async function readFromGoogleSheets(): Promise<string[][] | null> {
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

/** Fallback CSV publicado. */
async function readFromCSV(): Promise<string[][] | null> {
  const res = await fetch(FALLBACK_CSV_URL);
  if (!res.ok) return null;
  const text = await res.text();
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return null;
  return lines.map((l) => parseCSVLine(l));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { store_id } = await req.json();
    if (!store_id) {
      return new Response(JSON.stringify({ error: "store_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let rows = await readFromGoogleSheets();
    let source = "google_sheets";
    if (!rows) {
      rows = await readFromCSV();
      source = "csv_publicado";
    }
    if (!rows) {
      return new Response(
        JSON.stringify({ error: "Não foi possível ler a planilha (conector e CSV indisponíveis)." }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const header = rows[0].map(normalizeHeader);
    const codeIdx = header.findIndex((h) => ["procod", "codigo", "cod", "code"].includes(h));
    const price1Idx = header.findIndex((h) => ["preco 1", "preco1", "tabela 1", "tab 1"].includes(h));
    const price4Idx = header.findIndex((h) =>
      ["preco 4", "preco4", "tabela 4", "tab 4", "protabpre", "preco"].includes(h)
    );
    const price9Idx = header.findIndex((h) => ["preco 9", "preco9", "tabela 9", "tab 9"].includes(h));
    // Coluna reservada para a futura tabela de preço: detectada, porém IGNORADA.
    const priceResIdx = header.findIndex((h) =>
      ["preco reservado", "reservado", "preco futuro", "tabela reservada", "preco res"].includes(h)
    );

    const GRP_NAME_KEYS = [
      "des grp",
      "desgrp",
      "des_grp",
      "descricao grupo",
      "descricao do grupo",
      "nome grupo",
      "categoria",
    ];
    let grpIdx = header.findIndex((h) => GRP_NAME_KEYS.includes(h));
    if (grpIdx === -1) grpIdx = header.findIndex((h) => h === "grupo");

    const nameIdx = header.findIndex((h) =>
      ["descricao produto", "descricao", "pronom", "des pro", "des_pro", "despro", "produto", "nome"].includes(h)
    );
    const barIdx = header.findIndex((h) => ["procodbar", "codbar", "ean", "barras"].includes(h));

    if (codeIdx === -1 || (price1Idx === -1 && price4Idx === -1 && price9Idx === -1)) {
      return new Response(
        JSON.stringify({
          error:
            "Cabeçalho inválido: exige 'procod' e ao menos uma coluna de preço (Preço 1 / Preço 4 / Preço 9).",
          detected_headers: header,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const num = (raw: string | undefined): number => {
      if (raw == null || String(raw).trim() === "") return NaN;
      return parseFloat(String(raw).trim().replace(/\s/g, "").replace(",", "."));
    };

    const sheetData: Record<
      string,
      { price1: number; price4: number; price9: number; category?: string; name?: string; bar?: string }
    > = {};
    for (let i = 1; i < rows.length; i++) {
      const cols = rows[i] || [];
      const code = String(cols[codeIdx] ?? "").trim();
      if (!code) continue;
      const p1raw = price1Idx !== -1 ? num(cols[price1Idx]) : NaN;
      const p4raw = price4Idx !== -1 ? num(cols[price4Idx]) : NaN;
      const p9raw = price9Idx !== -1 ? num(cols[price9Idx]) : NaN;
      const candidates = [p4raw, p1raw, p9raw].filter((n) => Number.isFinite(n) && n > 0);
      if (candidates.length === 0) continue;
      const price4 = Number.isFinite(p4raw) && p4raw > 0 ? p4raw : candidates[0];
      const price1 = Number.isFinite(p1raw) && p1raw > 0 ? p1raw : 0;
      const price9 = Number.isFinite(p9raw) && p9raw > 0 ? p9raw : 0;
      const category = grpIdx !== -1 ? String(cols[grpIdx] ?? "").trim() || undefined : undefined;
      const name = nameIdx !== -1 ? String(cols[nameIdx] ?? "").trim() || undefined : undefined;
      const bar = barIdx !== -1 ? String(cols[barIdx] ?? "").trim() || undefined : undefined;
      sheetData[code] = { price1, price4, price9, category, name, bar };
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: products, error: pErr } = await supabase
      .from("products")
      .select("id, code, name, base_price, price_table_1, price_table_4, price_table_9, category_id, is_active")
      .eq("store_id", store_id);

    if (pErr) {
      return new Response(JSON.stringify({ error: pErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: existingCategories } = await supabase
      .from("categories")
      .select("id, name")
      .eq("store_id", store_id);

    const catMap = new Map<string, string>();
    const catNameById = new Map<string, string>();
    for (const cat of existingCategories || []) {
      catMap.set(cat.name.toLowerCase(), cat.id);
      catNameById.set(cat.id, cat.name);
    }

    const ensureCategory = async (name: string): Promise<string | null> => {
      const key = name.toLowerCase();
      const existing = catMap.get(key);
      if (existing) return existing;
      const { data: newCat, error: catErr } = await supabase
        .from("categories")
        .insert({ store_id, name, sort_order: 0, commission_percent: 1.0 })
        .select("id")
        .single();
      if (catErr || !newCat) return null;
      catMap.set(key, newCat.id);
      catNameById.set(newCat.id, name);
      categoriesCreated.push(name);
      return newCat.id;
    };

    const priceUpdates: {
      code: string;
      old_price: number;
      new_price: number;
      t1?: { old: number; new: number };
      t4?: { old: number; new: number };
      t9?: { old: number; new: number };
    }[] = [];
    const categoryUpdates: { code: string; old_cat: string | null; new_cat: string }[] = [];
    const nameUpdates: { code: string; old_name: string; new_name: string }[] = [];
    const categoriesCreated: string[] = [];
    const productsCreated: { code: string; name: string }[] = [];
    const productsDeactivated: string[] = [];
    const productsReactivated: string[] = [];

    const existingCodes = new Set((products || []).map((p) => p.code));

    for (const product of products || []) {
      const sheet = sheetData[product.code];

      // Produto que não está mais na planilha → inativar.
      if (!sheet) {
        if (product.is_active) {
          await supabase.from("products").update({ is_active: false }).eq("id", product.id);
          productsDeactivated.push(product.code);
        }
        continue;
      }

      const updates: Record<string, unknown> = {};

      const oldBase = Number(product.base_price) || 0;
      const oldT1 = Number(product.price_table_1) || 0;
      const oldT4 = Number(product.price_table_4) || 0;
      const oldT9 = Number(product.price_table_9) || 0;

      const diff1 = Math.abs(sheet.price1 - oldT1) > 0.001;
      const diff4 = Math.abs(sheet.price4 - oldT4) > 0.001;
      const diff9 = Math.abs(sheet.price9 - oldT9) > 0.001;
      const diffBase = Math.abs(sheet.price4 - oldBase) > 0.001;

      if (diff1) updates.price_table_1 = sheet.price1;
      if (diff4) updates.price_table_4 = sheet.price4;
      if (diff9) updates.price_table_9 = sheet.price9;
      if (diffBase) updates.base_price = sheet.price4;

      if (diff1 || diff4 || diff9 || diffBase) {
        priceUpdates.push({
          code: product.code,
          old_price: oldBase,
          new_price: sheet.price4,
          t1: diff1 ? { old: oldT1, new: sheet.price1 } : undefined,
          t4: diff4 ? { old: oldT4, new: sheet.price4 } : undefined,
          t9: diff9 ? { old: oldT9, new: sheet.price9 } : undefined,
        });
      }

      // Nome: planilha é a fonte da verdade.
      if (sheet.name && sheet.name !== product.name) {
        updates.name = sheet.name;
        nameUpdates.push({ code: product.code, old_name: product.name, new_name: sheet.name });
      }

      // Categoria pelo nome do grupo.
      if (sheet.category && grpIdx !== -1) {
        const catId = await ensureCategory(sheet.category);
        if (catId && catId !== product.category_id) {
          updates.category_id = catId;
          categoryUpdates.push({
            code: product.code,
            old_cat: product.category_id ? catNameById.get(product.category_id) || null : null,
            new_cat: sheet.category,
          });
        }
      }

      // Reativar produto que voltou para a planilha.
      if (!product.is_active) {
        updates.is_active = true;
        productsReactivated.push(product.code);
      }

      if (Object.keys(updates).length > 0) {
        await supabase.from("products").update(updates).eq("id", product.id);
      }
    }

    // Produtos novos
    const toInsert: Array<Record<string, unknown>> = [];
    for (const [code, sheet] of Object.entries(sheetData)) {
      if (existingCodes.has(code)) continue;
      const catId = sheet.category ? await ensureCategory(sheet.category) : null;
      const productName = sheet.name || `Produto ${code}`;
      toInsert.push({
        store_id,
        code,
        name: productName,
        description: sheet.bar ? `EAN: ${sheet.bar}` : "",
        base_price: sheet.price4,
        price_table_1: sheet.price1,
        price_table_4: sheet.price4,
        price_table_9: sheet.price9,
        category_id: catId,
        is_active: true,
        has_variants: false,
      });
      productsCreated.push({ code, name: productName });
    }

    if (toInsert.length > 0) {
      const BATCH = 200;
      for (let i = 0; i < toInsert.length; i += BATCH) {
        const batch = toInsert.slice(i, i + BATCH);
        const { error: insErr } = await supabase.from("products").insert(batch);
        if (insErr) {
          return new Response(
            JSON.stringify({ error: `Erro ao inserir produtos novos: ${insErr.message}` }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
    }

    // ============================================================
    // Consolidação de categorias duplicadas + remoção de vazias
    // ============================================================
    let categoriesMerged = 0;
    let categoriesDeleted = 0;

    const { data: allCats } = await supabase
      .from("categories")
      .select("id, name, created_at")
      .eq("store_id", store_id);

    const { data: allProducts } = await supabase
      .from("products")
      .select("id, category_id")
      .eq("store_id", store_id);

    const byName = new Map<string, Array<{ id: string; created_at: string }>>();
    for (const c of allCats || []) {
      const key = (c.name || "").trim().toLowerCase();
      if (!key) continue;
      const arr = byName.get(key) || [];
      arr.push({ id: c.id, created_at: c.created_at });
      byName.set(key, arr);
    }

    const productCountByCat = new Map<string, number>();
    for (const p of allProducts || []) {
      if (!p.category_id) continue;
      productCountByCat.set(p.category_id, (productCountByCat.get(p.category_id) || 0) + 1);
    }

    for (const [, group] of byName.entries()) {
      if (group.length < 2) continue;
      const sorted = [...group].sort((a, b) => {
        const ca = productCountByCat.get(a.id) || 0;
        const cb = productCountByCat.get(b.id) || 0;
        if (cb !== ca) return cb - ca;
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      });
      const canonical = sorted[0];
      const dupIds = sorted.slice(1).map((c) => c.id);
      const { error: mvErr } = await supabase
        .from("products")
        .update({ category_id: canonical.id })
        .in("category_id", dupIds);
      if (!mvErr) {
        for (const dId of dupIds) {
          const moved = productCountByCat.get(dId) || 0;
          productCountByCat.set(canonical.id, (productCountByCat.get(canonical.id) || 0) + moved);
          productCountByCat.set(dId, 0);
        }
        categoriesMerged += dupIds.length;
      }
    }

    const { data: prodCatsFresh } = await supabase
      .from("products")
      .select("category_id")
      .eq("store_id", store_id)
      .not("category_id", "is", null);
    const usedIds = new Set<string>((prodCatsFresh || []).map((r: any) => r.category_id));
    const { data: catsFresh } = await supabase
      .from("categories")
      .select("id")
      .eq("store_id", store_id);
    const stillEmpty = (catsFresh || [])
      .map((c: any) => c.id as string)
      .filter((id) => !usedIds.has(id));
    for (const cid of stillEmpty) {
      const { error: delErr } = await supabase
        .from("categories")
        .delete()
        .eq("id", cid)
        .eq("store_id", store_id);
      if (!delErr) categoriesDeleted += 1;
      else console.warn(`Falha ao excluir categoria ${cid}:`, delErr.message);
    }

    return new Response(
      JSON.stringify({
        success: true,
        source,
        updated_prices: priceUpdates.length,
        updated_names: nameUpdates.length,
        updated_categories: categoryUpdates.length,
        created_categories: categoriesCreated.length,
        created_products: productsCreated.length,
        deactivated_products: productsDeactivated.length,
        reactivated_products: productsReactivated.length,
        categories_merged: categoriesMerged,
        categories_deleted: categoriesDeleted,
        total_sheet_codes: Object.keys(sheetData).length,
        total_products: (products || []).length,
        has_category_column: grpIdx !== -1,
        has_name_column: nameIdx !== -1,
        has_reserved_price_column: priceResIdx !== -1,
        price_updates: priceUpdates,
        name_updates: nameUpdates,
        category_updates: categoryUpdates,
        categories_created: categoriesCreated,
        products_created: productsCreated,
        products_deactivated: productsDeactivated,
        products_reactivated: productsReactivated,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("sync-prices erro:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
