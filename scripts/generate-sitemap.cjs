const fs = require('fs');
const path = require('path');

const BASE_URL = 'https://meupedidonozap.online';

let SUPABASE_URL = process.env.VITE_SUPABASE_URL;
let SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  try {
    const envPath = path.join(__dirname, '..', '.env');
    const envContent = fs.readFileSync(envPath, 'utf-8');
    for (const line of envContent.split('\n')) {
      const match = line.match(/^(\w+)\s*=\s*"?([^"]*)"?$/);
      if (match) process.env[match[1]] = match[2];
    }
  } catch (e) {
    console.warn('[sitemap] Could not read .env file:', e.message);
  }
  SUPABASE_URL = process.env.VITE_SUPABASE_URL;
  SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
}

async function main() {
  const entries = [
    { loc: `${BASE_URL}/`, changefreq: 'weekly', priority: '1.0' },
  ];

  if (SUPABASE_URL && SUPABASE_KEY) {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/stores?is_active=eq.true&select=slug,created_at`,
      { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
    );
    if (res.ok) {
      const stores = await res.json();
      for (const s of stores) {
        entries.push({
          loc: `${BASE_URL}/${s.slug}`,
          lastmod: (s.created_at || '').split('T')[0],
          changefreq: 'daily',
          priority: '0.9',
        });
      }
      console.log(`[sitemap] Added ${stores.length} store entries`);
    } else {
      console.warn('[sitemap] Failed to fetch stores:', res.status);
    }
  } else {
    console.warn('[sitemap] Missing env vars, generating homepage-only sitemap');
  }

  const xml = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
    ...entries.map(e => [
      '  <url>',
      `    <loc>${e.loc}</loc>`,
      e.lastmod ? `    <lastmod>${e.lastmod}</lastmod>` : null,
      e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
      e.priority ? `    <priority>${e.priority}</priority>` : null,
      '  </url>',
    ].filter(Boolean).join('\n')),
    `</urlset>`,
  ].join('\n');

  const distDir = path.join(__dirname, '..', 'dist');
  if (!fs.existsSync(distDir)) fs.mkdirSync(distDir, { recursive: true });
  fs.writeFileSync(path.join(distDir, 'sitemap.xml'), xml, 'utf-8');
  console.log(`[sitemap] dist/sitemap.xml written (${entries.length} entries)`);
}

main().catch(console.error);