import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        fields.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
  }
  fields.push(current.trim());
  return fields;
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

    // Fetch CSV from Google Sheets
    const csvUrl =
      "https://docs.google.com/spreadsheets/d/e/2PACX-1vTiEn32ibtrbsQQf4UAjNo3gJk13p7g4olYSWl2IRSNvkowpT1etqnS887s-mEAF2vrEAXnGMY96OKD/pub?output=csv";
    const csvRes = await fetch(csvUrl);
    if (!csvRes.ok) {
      return new Response(JSON.stringify({ error: "Failed to fetch spreadsheet" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const csvText = await csvRes.text();
    const lines = csvText.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length < 2) {
      return new Response(JSON.stringify({ error: "Empty spreadsheet" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse header using RFC parser. Normalize: lowercase + strip accents + collapse spaces.
    const normalizeHeader = (h: string) =>
      h
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, " ")
        .trim();
    const header = parseCSVLine(lines[0]).map(normalizeHeader);
    const codeIdx = header.indexOf("procod");
    const price1Idx = header.findIndex((h) => ["preco 1", "preco1", "tabela 1", "tab 1"].includes(h));
    const price4Idx = header.findIndex((h) =>
      ["preco 4", "preco4", "tabela 4", "tab 4", "protabpre", "preco"].includes(h)
    );
    const price9Idx = header.findIndex((h) => ["preco 9", "preco9", "tabela 9", "tab 9"].includes(h));
    const grpIdx = header.findIndex((h) =>
      ["grupo", "des grp", "desgrp", "des_grp", "categoria"].includes(h)
    );
    const nameIdx = header.findIndex((h) =>
      [
        "pronom",
        "descricao",
        "descricao produto",
        "descricao pRoduto".toLowerCase(),
        "des pro",
        "des_pro",
        "despro",
        "produto",
        "nome",
      ].includes(h)
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

    const parseNum = (raw: string | undefined): number => {
      if (!raw) return NaN;
      const n = parseFloat(String(raw).replace(/\./g, "").replace(",", "."));
      // If value contains no comma and no dot-decimal, fallback:
      if (isNaN(n)) return parseFloat(String(raw).replace(",", "."));
      return n;
    };

    // Build price + category map from spreadsheet
    const sheetData: Record<
      string,
      { price1: number; price4: number; price9: number; category?: string; name?: string; bar?: string }
    > = {};
    for (let i = 1; i < lines.length; i++) {
      const cols = parseCSVLine(lines[i]);
      const code = cols[codeIdx];
      if (!code) continue;
      const p1raw = price1Idx !== -1 ? parseFloat(cols[price1Idx]?.replace(",", ".")) : NaN;
      const p4raw = price4Idx !== -1 ? parseFloat(cols[price4Idx]?.replace(",", ".")) : NaN;
      const p9raw = price9Idx !== -1 ? parseFloat(cols[price9Idx]?.replace(",", ".")) : NaN;
      const candidates = [p4raw, p1raw, p9raw].filter((n) => Number.isFinite(n) && n > 0);
      if (candidates.length === 0) continue;
      const fallback = candidates[0];
      const price1 = Number.isFinite(p1raw) && p1raw > 0 ? p1raw : fallback;
      const price4 = Number.isFinite(p4raw) && p4raw > 0 ? p4raw : fallback;
      const price9 = Number.isFinite(p9raw) && p9raw > 0 ? p9raw : fallback;
      const category = grpIdx !== -1 ? cols[grpIdx]?.trim() || undefined : undefined;
      const name = nameIdx !== -1 ? cols[nameIdx]?.trim() || undefined : undefined;
      const bar = barIdx !== -1 ? cols[barIdx]?.trim() || undefined : undefined;
      sheetData[code] = { price1, price4, price9, category, name, bar };
    }

    // Supabase client with service role
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch products from DB
    const { data: products, error: pErr } = await supabase
      .from("products")
      .select("id, code, base_price, price_table_1, price_table_4, price_table_9, category_id")
      .eq("store_id", store_id);

    if (pErr) {
      return new Response(JSON.stringify({ error: pErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch existing categories for this store
    const { data: existingCategories } = await supabase
      .from("categories")
      .select("id, name")
      .eq("store_id", store_id);

    // Build a name→id map (case-insensitive)
    const catMap = new Map<string, string>();
    for (const cat of existingCategories || []) {
      catMap.set(cat.name.toLowerCase(), cat.id);
    }

    // Track results
    const priceUpdates: {
      code: string;
      old_price: number;
      new_price: number;
      t1?: { old: number; new: number };
      t4?: { old: number; new: number };
      t9?: { old: number; new: number };
    }[] = [];
    const categoryUpdates: { code: string; old_cat: string | null; new_cat: string }[] = [];
    const categoriesCreated: string[] = [];
    const productsCreated: { code: string; name: string }[] = [];

    const existingCodes = new Set((products || []).map((p) => p.code));

    for (const product of products || []) {
      const sheet = sheetData[product.code];
      if (!sheet) continue;

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

      // Category check (only if sheet has Des GRP column)
      if (sheet.category && grpIdx !== -1) {
        const catKey = sheet.category.toLowerCase();
        let catId = catMap.get(catKey);

        // Create category if it doesn't exist
        if (!catId) {
          const { data: newCat, error: catErr } = await supabase
            .from("categories")
            .insert({ store_id, name: sheet.category, sort_order: 0, commission_percent: 1.00 })
            .select("id")
            .single();
          if (!catErr && newCat) {
            catId = newCat.id;
            catMap.set(catKey, catId as string);
            categoriesCreated.push(sheet.category);
          }
        }

        if (catId && catId !== product.category_id) {
          updates.category_id = catId;
          // Find old category name
          const oldCatName = product.category_id
            ? [...catMap.entries()].find(([, v]) => v === product.category_id)?.[0] || null
            : null;
          categoryUpdates.push({
            code: product.code,
            old_cat: oldCatName,
            new_cat: sheet.category,
          });
        }
      }

      // Apply updates if any
      if (Object.keys(updates).length > 0) {
        await supabase.from("products").update(updates).eq("id", product.id);
      }
    }

    // Insert products that exist in the sheet but not in the DB
    const toInsert: Array<Record<string, unknown>> = [];
    for (const [code, sheet] of Object.entries(sheetData)) {
      if (existingCodes.has(code)) continue;

      let catId: string | null = null;
      if (sheet.category) {
        const catKey = sheet.category.toLowerCase();
        catId = catMap.get(catKey) || null;
        if (!catId) {
          const { data: newCat, error: catErr } = await supabase
            .from("categories")
            .insert({ store_id, name: sheet.category, sort_order: 0, commission_percent: 1.00 })
            .select("id")
            .single();
          if (!catErr && newCat) {
            catId = newCat.id;
            catMap.set(catKey, catId as string);
            categoriesCreated.push(sheet.category);
          }
        }
      }

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
      // Batch insert to avoid payload limits
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

    // Recarrega categorias (com created_at para escolher canônica)
    const { data: allCats } = await supabase
      .from("categories")
      .select("id, name, created_at")
      .eq("store_id", store_id);

    // Recarrega produtos para saber quais categorias têm uso
    const { data: allProducts } = await supabase
      .from("products")
      .select("id, category_id")
      .eq("store_id", store_id);

    // Agrupa categorias por nome normalizado
    const byName = new Map<string, Array<{ id: string; created_at: string }>>();
    for (const c of allCats || []) {
      const key = (c.name || "").trim().toLowerCase();
      if (!key) continue;
      const arr = byName.get(key) || [];
      arr.push({ id: c.id, created_at: c.created_at });
      byName.set(key, arr);
    }

    // Contagem de produtos por category_id
    const productCountByCat = new Map<string, number>();
    for (const p of allProducts || []) {
      if (!p.category_id) continue;
      productCountByCat.set(p.category_id, (productCountByCat.get(p.category_id) || 0) + 1);
    }

    // Consolidar duplicadas: escolhe a com mais produtos; empate → mais antiga
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
      // Move produtos das duplicadas para a canônica
      const { error: mvErr } = await supabase
        .from("products")
        .update({ category_id: canonical.id })
        .in("category_id", dupIds);
      if (!mvErr) {
        // Atualiza contagem local para etapa de exclusão
        for (const dId of dupIds) {
          const moved = productCountByCat.get(dId) || 0;
          productCountByCat.set(canonical.id, (productCountByCat.get(canonical.id) || 0) + moved);
          productCountByCat.set(dId, 0);
        }
        categoriesMerged += dupIds.length;
      }
    }

    // Elimina categorias sem produtos
    const emptyIds: string[] = (allCats || [])
      .filter((c) => (productCountByCat.get(c.id) || 0) === 0)
      .map((c) => c.id);

    if (emptyIds.length > 0) {
      const { error: delErr, count } = await supabase
        .from("categories")
        .delete({ count: "exact" })
        .in("id", emptyIds)
        .eq("store_id", store_id);
      if (!delErr) {
        categoriesDeleted = count ?? emptyIds.length;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        updated_prices: priceUpdates.length,
        updated_categories: categoryUpdates.length,
        created_categories: categoriesCreated.length,
        created_products: productsCreated.length,
        categories_merged: categoriesMerged,
        categories_deleted: categoriesDeleted,
        total_sheet_codes: Object.keys(sheetData).length,
        total_products: (products || []).length,
        has_category_column: grpIdx !== -1,
        has_name_column: nameIdx !== -1,
        price_updates: priceUpdates,
        category_updates: categoryUpdates,
        categories_created: categoriesCreated,
        products_created: productsCreated,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
