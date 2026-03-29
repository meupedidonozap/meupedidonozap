import type { Context } from "https://edge.netlify.com";

export default async (request: Request, context: Context) => {
  const slug = new URL(request.url).pathname.replace("/", "").split("/")[0];

  if (!slug || slug.includes(".") || slug === "") {
    return context.next();
  }

  const metaUrl = `https://buvhdqpbpbwpzidzmdqh.supabase.co/functions/v1/og-meta?slug=${slug}`;

  try {
    const metaResponse = await fetch(metaUrl);
    if (!metaResponse.ok) return context.next();
    const html = await metaResponse.text();

    // Injeta redirect para o React carregar depois das meta tags
    const htmlWithRedirect = html.replace(
      "</head>",
      `<script>window.location.href = window.location.href;</script></head>`
    );

    return new Response(htmlWithRedirect, {
      headers: { "content-type": "text/html" },
    });
  } catch {
    return context.next();
  }
};
