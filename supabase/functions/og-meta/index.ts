import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};


  // Bot detected — fetch store data and return static HTML with OG tags
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!
  );

  const { data: store, error } = await supabase
    .from("stores")
    .select("name, slug, logo, banner, address, type")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();

  if (error || !store) {
    return new Response(
      generateHTML(
        "MeuPedidoNoZap",
        "Faça seu pedido online via WhatsApp",
        "/placeholder.svg",
        `https://meupedidonozap.online/${slug}`
      ),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" },
      }
    );
  }

  const title = `${store.name} | MeuPedidoNoZap`;
  const description = `Faça seu pedido em ${store.name}. ${store.address || "Peça online via WhatsApp."}`;
  const image = store.logo || store.banner || "https://meupedidonozap.online/placeholder.svg";
  const pageUrl = `https://meupedidonozap.online/${store.slug}`;

  return new Response(generateHTML(title, description, image, pageUrl), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" },
  });
});

function generateHTML(
  title: string,
  description: string,
  image: string,
  url: string
): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <meta property="og:type" content="website">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:image" content="${escapeHtml(image)}">
  <meta property="og:url" content="${escapeHtml(url)}">
  <meta property="og:site_name" content="MeuPedidoNoZap">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <meta name="twitter:image" content="${escapeHtml(image)}">
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <p>${escapeHtml(description)}</p>
  <a href="${escapeHtml(url)}">Visitar loja</a>
</body>
</html>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
