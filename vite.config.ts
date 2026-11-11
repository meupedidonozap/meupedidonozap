import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";

// The running bundle and the network manifest share an automatic source fingerprint.
// A source change is a new release even if the target-store list stays the same.
const fingerprint = createHash('sha256');
function fingerprintDirectory(directory: string) {
  for (const entry of readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) fingerprintDirectory(file);
    else fingerprint.update(file).update(readFileSync(file));
  }
}
fingerprintDirectory('src');
fingerprintDirectory('public');
const appVersion = fingerprint.digest('hex').slice(0, 20);
const release = JSON.parse(readFileSync('public/release.json', 'utf8'));
const appManifest = JSON.stringify({ version: appVersion, stores: release.stores });
const appVersionPlugin: Plugin = {
  name: 'mpz-app-version',
  generateBundle() {
    this.emitFile({ type: 'asset', fileName: 'app-version.json', source: appManifest });
  },
  configureServer(server) {
    server.middlewares.use('/app-version.json', (_req, res) => {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Cache-Control', 'no-store');
      res.end(appManifest);
    });
  },
};

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  define: { 'import.meta.env.VITE_APP_BUILD_ID': JSON.stringify(appVersion) },
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    appVersionPlugin,
    react(),
    mode === "development" && componentTagger(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: null,
      filename: "sw.js",
      devOptions: { enabled: false },
      includeAssets: ["placeholder.svg", "robots.txt"],
      manifest: {
        name: "Meu Pedido no Zap",
        short_name: "MeuPedido",
        description: "Catálogo e pedidos online, com modo offline.",
        theme_color: "#0f172a",
        background_color: "#ffffff",
        display: "standalone",
        start_url: "/",
        icons: [
          { src: "/placeholder.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
        ],
      },
      workbox: {
        // Mantém as notificações push (handlers movidos para /push-sw.js)
        importScripts: ["/push-sw.js"],
        globPatterns: ["**/*.{js,css,ico,png,svg,woff2}", "index.html"],
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/~oauth/],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.mode === "navigate",
            handler: "NetworkFirst",
            options: { cacheName: "html-nav", networkTimeoutSeconds: 5 },
          },
          {
            urlPattern: ({ request, sameOrigin }) =>
              sameOrigin && ["style", "script", "worker", "font"].includes(request.destination),
            handler: "CacheFirst",
            options: { cacheName: "static-assets", expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 } },
          },
          {
            urlPattern: ({ request }) => request.destination === "image",
            handler: "StaleWhileRevalidate",
            options: { cacheName: "images", expiration: { maxEntries: 500, maxAgeSeconds: 60 * 60 * 24 * 30 } },
          },
          {
            // Catálogo (leituras do backend) — permite abrir a loja offline
            urlPattern: ({ url, request }) => url.pathname.startsWith("/rest/v1/") && request.method === "GET",
            handler: "NetworkFirst",
            options: { cacheName: "api-reads", networkTimeoutSeconds: 6, expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 7 } },
          },
        ],
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
