import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const storeSlug = url.searchParams.get("store");

    if (!storeSlug) {
      return new Response("Missing 'store' query parameter", { status: 400 });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get store
    const { data: store, error: storeError } = await supabase
      .from("stores")
      .select("*")
      .eq("slug", storeSlug)
      .single();

    if (storeError || !store) {
      return new Response("Store not found", { status: 404 });
    }

    // Get active products with variants
    const { data: products, error: productsError } = await supabase
      .from("products")
      .select("*, product_variants(*), product_images(*)")
      .eq("store_id", store.id)
      .eq("is_active", true);

    if (productsError) {
      return new Response("Error fetching products", { status: 500 });
    }

    const siteUrl = `https://meupedidonozap.online/${store.slug}`;

    const items = (products || [])
      .map((product: any) => {
        const imageUrl =
          product.image_url ||
          (product.product_images?.length > 0
            ? product.product_images.sort(
                (a: any, b: any) => a.sort_order - b.sort_order
              )[0].image_url
            : null);

        const price = product.base_price;
        if (!price || price <= 0) return "";

        const availability =
          product.has_variants &&
          product.product_variants?.length > 0
            ? product.product_variants.some((v: any) => v.stock > 0)
              ? "in_stock"
              : "out_of_stock"
            : "in_stock";

        const description = (product.description || product.name)
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;");

        const title = product.name
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;");

        return `    <item>
      <g:id>${product.id}</g:id>
      <g:title><![CDATA[${product.name}]]></g:title>
      <g:description><![CDATA[${product.description || product.name}]]></g:description>
      <g:link>${siteUrl}</g:link>
      <g:price>${price.toFixed(2)} BRL</g:price>
      <g:availability>${availability}</g:availability>
      <g:condition>new</g:condition>
      <g:brand><![CDATA[${store.name}]]></g:brand>${
          imageUrl
            ? `
      <g:image_link>${imageUrl}</g:image_link>`
            : ""
        }${
          product.code
            ? `
      <g:mpn><![CDATA[${product.code}]]></g:mpn>`
            : ""
        }
    </item>`;
      })
      .filter(Boolean)
      .join("\n");

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>${store.name}</title>
    <link>${siteUrl}</link>
    <description>Produtos de ${store.name}</description>
${items}
  </channel>
</rss>`;

    return new Response(xml, {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/xml; charset=utf-8",
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(`Error: ${message}`, { status: 500 });
  }
});
