

# Pre-rendering de Páginas de Loja no Build

## O que sera feito

Criar um script Node.js que roda apos o build do Vite, busca todas as lojas ativas no banco de dados, e gera arquivos HTML estaticos com meta tags OG corretas para cada loja.

## Mudancas

### 1. Criar `scripts/prerender.js`

Script Node.js que:
- Usa `fetch` para chamar a API do banco (via REST API do backend) buscando lojas ativas (`slug`, `name`, `logo`, `banner`, `address`)
- Le o `dist/index.html` gerado pelo Vite
- Para cada loja, substitui as meta tags genericas no `<head>` por meta tags OG dinamicas:
  - `og:title` → `{nome da loja} | MeuPedidoNoZap`
  - `og:description` → `Faca seu pedido em {nome}. {endereco}`
  - `og:image` → logo ou banner da loja
  - `og:url` → `https://meupedidonozap.online/{slug}`
  - `<title>` → `{nome da loja} | MeuPedidoNoZap`
- Cria pasta `dist/{slug}/` e salva `index.html` dentro
- Usa as env vars `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` (disponiveis no build) para autenticar a chamada REST

### 2. Atualizar `package.json`

Alterar o script `build`:
```json
"build": "vite build && node scripts/prerender.js"
```

### 3. Atualizar `netlify.toml`

Remover o bloco `[[edge-functions]]` e o `functions` directory. Deixar apenas:
```toml
[build]
  publish = "dist"
  command = "bun run build && node scripts/prerender.js"
```

O Netlify servira automaticamente `dist/{slug}/index.html` quando acessar `/{slug}`, com as meta tags corretas para crawlers e bots do WhatsApp/Facebook.

### 4. Manter `netlify/edge-functions/og-redirect.ts` e `supabase/functions/og-meta/index.ts`

Esses arquivos podem ser mantidos como fallback, mas nao serao mais usados pelo Netlify apos remover o `[[edge-functions]]`.

## Resultado

- Cada loja tera um HTML estatico em `dist/{slug}/index.html` com meta tags OG corretas
- Bots e crawlers verao titulo, descricao e imagem da loja sem precisar executar JS
- Usuarios normais continuam usando a SPA normalmente (o HTML carrega o React app)

