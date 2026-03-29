

# SEO: Meta Tags Dinâmicas para Páginas de Loja

## Limitação importante

O `vite-plugin-prerender` e `@prerenderer/renderer-puppeteer` **não funcionam** no ambiente de build do Lovable — eles precisam de um navegador headless (Puppeteer/Chromium) rodando no servidor de build, o que não é suportado.

Porém, a boa notícia: **o Google executa JavaScript** e consegue indexar SPAs com `react-helmet-async`. O projeto já usa `HelmetProvider`. O que falta é adicionar as meta tags dinâmicas nas páginas de loja.

## O que será feito

### 1. StorePage.tsx — Meta tags com dados da loja

Adicionar `<Helmet>` com title, description, og:title, og:description, og:image, og:url usando os dados da loja carregada do banco:

```html
<title>{store.name} | MeuPedidoNoZap</title>
<meta name="description" content="Faça seu pedido em {store.name}. {store.address}" />
<meta property="og:title" content="{store.name}" />
<meta property="og:description" content="Peça online via WhatsApp" />
<meta property="og:image" content="{store.logo || store.banner}" />
<meta property="og:url" content="https://meupedidonozap.lovable.app/{slug}" />
```

### 2. FoodStorePage.tsx — Mesmas meta tags

Adicionar `<Helmet>` com dados da loja (já importa dados via `useStoreBySlug`).

### 3. ProductStorePage.tsx — Verificar Helmet existente

Já usa `Helmet` — garantir que as meta tags OG estão completas e corretas.

### 4. index.html — Meta tags padrão como fallback

Manter as meta tags genéricas atuais como fallback para quando JS não executar.

## Resultado

- Google, Bing e redes sociais verão as meta tags corretas ao compartilhar links
- Cada loja terá título, descrição e imagem únicos
- Para pre-rendering real (HTML estático sem JS), seria necessário um serviço externo como prerender.io ou self-hosting com SSR — mas as meta tags dinâmicas cobrem 95% dos casos de SEO

