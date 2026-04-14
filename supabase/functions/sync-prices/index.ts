import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    // Parse header to find column indices
    const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
    const codeIdx = header.indexOf("procod");
    const priceIdx = header.indexOf("protabpre");
    if (codeIdx === -1 || priceIdx === -1) {
      return new Response(
        JSON.stringify({ error: "Columns procod/protabpre not found in spreadsheet" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build price map from spreadsheet
    const sheetPrices: Record<string, number> = {};
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(",").map((c) => c.trim());
      const code = cols[codeIdx];
      const rawPrice = cols[priceIdx]?.replace(",", ".");
      const price = parseFloat(rawPrice);
      if (!code || isNaN(price) || price <= 0) continue;
      sheetPrices[code] = price;
    }

    // Fetch products from DB
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: products, error: pErr } = await supabase
      .from("products")
      .select("id, code, base_price")
      .eq("store_id", store_id);

    if (pErr) {
      return new Response(JSON.stringify({ error: pErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Compare and update
    const updates: { code: string; old_price: number; new_price: number }[] = [];
    for (const product of products || []) {
      const newPrice = sheetPrices[product.code];
      if (newPrice !== undefined && Math.abs(newPrice - Number(product.base_price)) > 0.001) {
        const { error: uErr } = await supabase
          .from("products")
          .update({ base_price: newPrice })
          .eq("id", product.id);
        if (!uErr) {
          updates.push({
            code: product.code,
            old_price: Number(product.base_price),
            new_price: newPrice,
          });
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        updated_count: updates.length,
        total_sheet_codes: Object.keys(sheetPrices).length,
        total_products: (products || []).length,
        updates,
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
