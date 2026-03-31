const fs = require('fs');
const path = require('path');

// Tenta process.env primeiro, se não encontrar carrega do .env
let SUPABASE_URL = process.env.VITE_SUPABASE_URL;
let SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.log('[prerender] Vars not in process.env, trying .env file...');
  require('dotenv').config();
  SUPABASE_URL = process.env.VITE_SUPABASE_URL;
  SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
}

console.log('[prerender] VITE_SUPABASE_URL found:', !!SUPABASE_URL);
console.log('[prerender] VITE_SUPABASE_PUBLISHABLE_KEY found:', !!SUPABASE_KEY);

async function main() {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.warn('[prerender] Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY, skipping.');
    return;
  }

  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/stores?is_active=eq.true&select=slug,name,logo,banner,address`,
    { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
  );

  if (!res.ok) {
    console.error('[prerender] Failed to fetch stores:', res.status, await res.text());
    return;
  }

  const stores = await res.json();
  const distIndex = path.join(__dirname, '..', 'dist', 'index.html');

  if (!fs.existsSync(distIndex)) {
    console.error('[prerender] dist/index.html not found');
    return;
  }

  const baseHtml = fs.readFileSync(distIndex, 'utf-8');

  for (const store of stores) {
    const title = `${store.name} | MeuPedidoNoZap`;
    const description = `Faça seu pedido em ${store.name}.${store.address ? ' ' + store.address : ''}`;
    const image = store.logo || store.banner || 'https://lovable.dev/opengraph-image-p98pqg.png';
    const url = `https://meupedidonozap.online/${store.slug}`;

    const html = baseHtml
      .replace(/<title>.*?<\/title>/, `<title>${title}</title>`)
      .replace(/<meta name="description" content=".*?"/, `<meta name="description" content="${description}"`)
      .replace(/<meta property="og:title" content=".*?"/, `<meta property="og:title" content="${title}"`)
      .replace(/<meta property="og:description" content=".*?"/, `<meta property="og:description" content="${description}"`)
      .replace(/<meta property="og:image" content=".*?"/, `<meta property="og:image" content="${image}"`)
      .replace(/<meta property="og:type" content=".*?"/, `<meta property="og:type" content="website"`)
      .replace(/<meta name="twitter:image" content=".*?"/, `<meta name="twitter:image" content="${image}"`)
      .replace('</head>', `<meta property="og:url" content="${url}" />\n  <link rel="canonical" href="${url}" />\n  </head>`);

    const dir = path.join(__dirname, '..', 'dist', store.slug);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'index.html'), html, 'utf-8');
    console.log(`[prerender] Generated: dist/${store.slug}/index.html`);
  }

  console.log(`[prerender] Done. ${stores.length} store pages generated.`);
}

main().catch(console.error);
