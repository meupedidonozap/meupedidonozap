import type { Context } from "https://edge.netlify.com";

const BOT_USER_AGENTS = [
  "whatsapp",
  "telegrambot",
  "facebookexternalhit",
  "facebookcatalog",
  "twitterbot",
  "linkedinbot",
  "slackbot",
  "discordbot",
  "googlebot",
  "bingbot",
  "yandexbot",
  "baiduspider",
  "duckduckbot",
  "applebot",
  "pinterestbot",
  "redditbot",
  "embedly",
  "showyoubot",
  "outbrain",
  "quora link preview",
  "rogerbot",
  "vkshare",
  "w3c_validator",
  "semrushbot",
  "ahrefsbot",
  "mj12bot",
  "ia_archiver",
  "sogou",
  "petalbot",
];

export default async (request: Request, context: Context) => {
  const url = new URL(request.url);
  const pathname = url.pathname;

  // Skip static assets and known non-store paths
  if (
    pathname.includes(".") ||
    pathname === "/" ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/checkout") ||
    pathname.startsWith("/order-history")
  ) {
    return context.next();
  }

  const slug = pathname.replace(/^\//, "").split("/")[0];
  if (!slug) return context.next();

  // Check if request is from a bot
  const ua = (request.headers.get("user-agent") || "").toLowerCase();
  const isBot = BOT_USER_AGENTS.some((bot) => ua.includes(bot));

  if (!isBot) {
    return context.next();
  }

  // Bot detected — fetch OG meta from Supabase edge function
  const metaUrl = `https://buvhdqpbpbwpzidzmdqh.supabase.co/functions/v1/og-meta?slug=${encodeURIComponent(slug)}`;

  try {
    const metaResponse = await fetch(metaUrl);
    if (!metaResponse.ok) return context.next();
    const html = await metaResponse.text();

    return new Response(html, {
      status: 200,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  } catch {
    return context.next();
  }
};
