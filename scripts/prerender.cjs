/**
 * prerender.cjs
 * 
 * Executado após `vite build`. Para cada loja ativa no Supabase:
 *  1. Cria dist/{slug}/index.html com meta tags personalizadas
 *  2. Injeta Schema.org JSON-LD (LocalBusiness/Restaurant/etc)
 *  3. Gera dist/sitemap.xml com todas as URLs
 * 
 * Assim o Googlebot recebe HTML real (não SPA vazia) para cada loja.
 */

const fs = require('fs');
const path = require('path');

const BASE_URL = 'https://meupedidonozap.online';

// ─── Carregar variáveis de ambiente ──────────────────────────────────────────
let SUPABASE_URL = process.env.VITE_SUPABASE_URL;
let SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.log('[prerender] Vars not in process.env, trying .env file...');
  try {
    const envPath = path.join(__dirname, '..', '.env');
    const envContent = fs.readFileSync(envPath, 'utf-8');
    for (const line of envContent.split('\n')) {
      const match = line.match(/^(\w+)\s*=\s*"?([^"]*)"?$/);
      if (match) process.env[match[1]] = match[2];
    }
  } catch (e) {
    console.warn('[prerender] Could not read .env file:', e.message);
  }
  SUPABASE_URL = process.env.VITE_SUPABASE_URL;
  SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
}

console.log('[prerender] SUPABASE_URL found:', !!SUPABASE_URL);
console.log('[prerender] SUPABASE_KEY found:', !!SUPABASE_KEY);

// ─── Helpers de Schema.org ────────────────────────────────────────────────────
function schemaTypeForStore(type) {
  switch (type) {
    case 'COMIDA':     return 'Restaurant';
    case 'PIZZARIA':   return 'Restaurant';
    case 'SALAO':      return 'HairSalon';
    case 'SERVICOS':   return 'LocalBusiness';
    case 'LOJA':       return 'Store';
    case 'ACESSORIOS': return 'ClothingStore';
    default:           return 'Store';
  }
}

function defaultDescription(store) {
  switch (store.type) {
    case 'COMIDA':    return `Faça seu pedido de delivery em ${store.name}. Peça online e receba via WhatsApp.`;
    case 'PIZZARIA':  return `Peça sua pizza em ${store.name}. Delivery rápido com pedido via WhatsApp.`;
    case 'SALAO':     return `Agende seu horário em ${store.name}. Serviços de beleza com agendamento online.`;
    case 'SERVICOS':  return `Solicite serviços em ${store.name} pelo WhatsApp.`;
    default:          return `Compre em ${store.name} pelo WhatsApp. Catálogo digital com pedido online.`;
  }
}

function buildLocalBusinessSchema(store) {
  const url = `${BASE_URL}/${store.slug}`;
  const image = store.logo || store.banner || undefined;

  const schema = {
    '@context': 'https://schema.org',
    '@type': schemaTypeForStore(store.type),
    name: store.name,
    url,
    description: defaultDescription(store),
    ...(image && { image }),
    ...(store.whatsapp && { telephone: store.whatsapp }),
    ...(store.address && {
      address: {
        '@type': 'PostalAddress',
        streetAddress: store.address,
        addressCountry: 'BR',
      },
    }),
    priceRange: '$$',
    ...(store.type === 'COMIDA' || store.type === 'PIZZARIA'
      ? {
          hasMenu: url,
          servesCuisine: store.type === 'PIZZARIA' ? 'Pizza' : 'Brasileira',
          acceptsReservations: false,
        }
      : {}),
    potentialAction: { '@type': 'OrderAction', target: url },
  };

  return JSON.stringify(schema);
}

function buildBreadcrumbSchema(store) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'MeuPedidoNoZap', item: BASE_URL },
      { '@type': 'ListItem', position: 2, name: store.name, item: `${BASE_URL}/${store.slug}` },
    ],
  };
  return JSON.stringify(schema);
}

// ─── Gerador de sitemap.xml ───────────────────────────────────────────────────
function buildSitemap(stores) {
  const entries = [
    { loc: `${BASE_URL}/`, changefreq: 'weekly', priority: '1.0' },
    ...stores.map(s => ({
      loc: `${BASE_URL}/${s.slug}`,
      lastmod: (s.created_at || '').split('T')[0],
      changefreq: 'daily',
      priority: '0.9',
    })),
  ];

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
    ...entries.map(e => [
      '  <url>',
      `    <loc>${e.loc}</loc>`,
      e.lastmod ? `    <lastmod>${e.lastmod}</lastmod>` : null,
      `    <changefreq>${e.changefreq}</changefreq>`,
      `    <priority>${e.priority}</priority>`,
      '  </url>',
    ].filter(Boolean).join('\n')),
    `</urlset>`,
  ].join('\n');
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.warn('[prerender] Missing env vars — skipping store pages and sitemap.');
    return;
  }

  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/stores?is_active=eq.true&select=slug,name,type,logo,banner,address,whatsapp,created_at`,
    { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
  );

  if (!res.ok) {
    console.error('[prerender] Failed to fetch stores:', res.status, await res.text());
    return;
  }

  const stores = await res.json();
  const distDir = path.join(__dirname, '..', 'dist');
  const distIndex = path.join(distDir, 'index.html');

  if (!fs.existsSync(distIndex)) {
    console.error('[prerender] dist/index.html not found. Run vite build first.');
    return;
  }

  const baseHtml = fs.readFileSync(distIndex, 'utf-8');

  // ── Gerar uma pasta por loja ────────────────────────────────────────────────
  for (const store of stores) {
    const title = `${store.name} | MeuPedidoNoZap`;
    const description = defaultDescription(store);
    const image = store.logo || store.banner || `${BASE_URL}/meupedidonozap.png`;
    const url = `${BASE_URL}/${store.slug}`;

    // Schema.org JSON-LD injetado no <head>
    const schemaScripts = `
  <script type="application/ld+json">${buildLocalBusinessSchema(store)}</script>
  <script type="application/ld+json">${buildBreadcrumbSchema(store)}</script>`;

    let html = baseHtml
      // Title
      .replace(/<title>.*?<\/title>/, `<title>${title}</title>`)
      // Meta description
      .replace(/<meta name="description" content=".*?"/, `<meta name="description" content="${description}"`)
      // Canonical
      .replace(/<link rel="canonical" href=".*?"/, `<link rel="canonical" href="${url}"`)
      // OG tags
      .replace(/<meta property="og:title" content=".*?"/, `<meta property="og:title" content="${title}"`)
      .replace(/<meta property="og:description" content=".*?"/, `<meta property="og:description" content="${description}"`)
      .replace(/<meta property="og:image" content=".*?"/, `<meta property="og:image" content="${image}"`)
      .replace(/<meta property="og:url" content=".*?"/, `<meta property="og:url" content="${url}"`)
      // Twitter
      .replace(/<meta name="twitter:image" content=".*?"/, `<meta name="twitter:image" content="${image}"`)
      // Injeta Schema.org antes de </head>
      .replace('</head>', `${schemaScripts}\n</head>`);

    const dir = path.join(distDir, store.slug);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'index.html'), html, 'utf-8');
    console.log(`[prerender] ✅ dist/${store.slug}/index.html`);
  }

  // ── Gerar sitemap.xml ───────────────────────────────────────────────────────
  const sitemapXml = buildSitemap(stores);
  fs.writeFileSync(path.join(distDir, 'sitemap.xml'), sitemapXml, 'utf-8');
  console.log(`[prerender] ✅ sitemap.xml com ${stores.length + 1} URLs`);

  console.log(`\n[prerender] Concluído: ${stores.length} lojas pré-renderizadas.`);
}

main().catch(console.error);
