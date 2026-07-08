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

    // Parse header using RFC parser
    const header = parseCSVLine(lines[0]).map((h) => h.toLowerCase());
    const codeIdx = header.indexOf("procod");
    const priceIdx = header.indexOf("protabpre");
    const grpIdx = header.findIndex((h) => h === "des grp" || h === "desgrp" || h === "des_grp");
    const nameIdx = header.findIndex((h) =>
      ["pronom", "descricao", "descrição", "des_pro", "despro", "des pro", "produto", "nome"].includes(h)
    );
    const barIdx = header.findIndex((h) => ["procodbar", "codbar", "ean", "barras"].includes(h));

    if (codeIdx === -1 || priceIdx === -1) {
      return new Response(
        JSON.stringify({ error: "Columns procod/protabpre not found in spreadsheet" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build price + category map from spreadsheet
    const sheetData: Record<string, { price: number; category?: string; name?: string; bar?: string }> = {};
    for (let i = 1; i < lines.length; i++) {
      const cols = parseCSVLine(lines[i]);
      const code = cols[codeIdx];
      const rawPrice = cols[priceIdx]?.replace(",", ".");
      const price = parseFloat(rawPrice);
      if (!code || isNaN(price) || price <= 0) continue;
      const category = grpIdx !== -1 ? cols[grpIdx]?.trim() || undefined : undefined;
      const name = nameIdx !== -1 ? cols[nameIdx]?.trim() || undefined : undefined;
      const bar = barIdx !== -1 ? cols[barIdx]?.trim() || undefined : undefined;
      sheetData[code] = { price, category, name, bar };
    }

    // Supabase client with service role
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch products from DB
    const { data: products, error: pErr } = await supabase
      .from("products")
      .select("id, code, base_price, category_id")
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
    const priceUpdates: { code: string; old_price: number; new_price: number }[] = [];
    const categoryUpdates: { code: string; old_cat: string | null; new_cat: string }[] = [];
    const categoriesCreated: string[] = [];
    const productsCreated: { code: string; name: string }[] = [];

    const existingCodes = new Set((products || []).map((p) => p.code));

    for (const product of products || []) {
      const sheet = sheetData[product.code];
      if (!sheet) continue;

      const updates: Record<string, unknown> = {};

      // Price check
      if (Math.abs(sheet.price - Number(product.base_price)) > 0.001) {
        updates.base_price = sheet.price;
        priceUpdates.push({
          code: product.code,
          old_price: Number(product.base_price),
          new_price: sheet.price,
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
        base_price: sheet.price,
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
