import type { Context } from "https://edge.netlify.com";

export default async (request: Request, context: Context) => {
  const userAgent = request.headers.get("user-agent") || "";
  const isBotOrCrawler = /bot|crawler|spider|facebookexternalhit|whatsapp|telegram|twitter|linkedin|slack|discord|googlebot|bingbot|curl|wget/i.test(userAgent);
  if (!isBotOrCrawler) return context.next();
  const slug = new URL(request.url).pathname.replace("/", "");
  if (!slug || slug.includes(".")) return context.next();
  const metaUrl = `https://buvhdqpbpbwpzidzmdqh.supabase.co/functions/v1/og-meta?slug=${slug}`;
  try {
    const metaResponse = await fetch(metaUrl);
    if (!metaResponse.ok) return context.next();
    const html = await metaResponse.text();
    return new Response(html, { headers: { "content-type": "text/html" } });
  } catch {
    return context.next();
  }
};
