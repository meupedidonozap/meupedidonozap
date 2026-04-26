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

    if (codeIdx === -1 || priceIdx === -1) {
      return new Response(
        JSON.stringify({ error: "Columns procod/protabpre not found in spreadsheet" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build price + category map from spreadsheet
    const sheetData: Record<string, { price: number; category?: string }> = {};
    for (let i = 1; i < lines.length; i++) {
      const cols = parseCSVLine(lines[i]);
      const code = cols[codeIdx];
      const rawPrice = cols[priceIdx]?.replace(",", ".");
      const price = parseFloat(rawPrice);
      if (!code || isNaN(price) || price <= 0) continue;
      const category = grpIdx !== -1 ? cols[grpIdx]?.trim() || undefined : undefined;
      sheetData[code] = { price, category };
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
            .insert({ store_id, name: sheet.category, sort_order: 0 })
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

    return new Response(
      JSON.stringify({
        success: true,
        updated_prices: priceUpdates.length,
        updated_categories: categoryUpdates.length,
        created_categories: categoriesCreated.length,
        total_sheet_codes: Object.keys(sheetData).length,
        total_products: (products || []).length,
        has_category_column: grpIdx !== -1,
        price_updates: priceUpdates,
        category_updates: categoryUpdates,
        categories_created: categoriesCreated,
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
