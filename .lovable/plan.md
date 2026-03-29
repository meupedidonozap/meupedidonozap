

# Edge Function para OG Meta Tags (Preview de Links no WhatsApp)

## Problema

WhatsApp, Facebook e Twitter não executam JavaScript ao gerar preview de links. Como o app é uma SPA, eles veem apenas as meta tags genéricas do `index.html`.

## Solução

Criar uma Edge Function `og-meta` que detecta bots pelo User-Agent e retorna HTML minimalista com as meta tags OG corretas (nome da loja, descrição, logo). Para usuários normais, redireciona para a SPA.

O fluxo funciona via Netlify `_redirects`: requisições para `/:slug` passam pela Edge Function primeiro. Se for bot, retorna HTML com OG tags. Se for humano, serve o `index.html` normal.

## Implementacao

### 1. Criar Edge Function `supabase/functions/og-meta/index.ts`

- Recebe `?slug=rafasmanutencaoresidencial`
- Detecta User-Agent de bots (WhatsApp, facebookexternalhit, Twitterbot, LinkedInBot, Googlebot)
- Se for bot: busca loja no banco, retorna HTML com `og:title`, `og:description`, `og:image`, `og:url`
- Se nao for bot: retorna redirect 302 para a SPA

### 2. Atualizar `supabase/config.toml`

- Adicionar bloco `[functions.og-meta]` com `verify_jwt = false`

### 3. Opcao de uso

A URL da Edge Function seria:
`https://buvhdqpbpbwpzidzmdqh.supabase.co/functions/v1/og-meta?slug=rafasmanutencaoresidencial`

Para funcionar automaticamente no dominio `meupedidonozap.online`, seria necessario configurar um redirect no Netlify apontando bots para a Edge Function. Isso requer configuracao manual no Netlify (nao pode ser feito pelo Lovable).

**Alternativa mais simples**: usar o servico gratuito do `https://prerender.io` ou configurar um Netlify Edge Function (diferente de Supabase Edge Function) que faz o proxy de bots.

### Resultado

- Bots recebem HTML estatico com meta tags corretas da loja
- Usuarios normais continuam usando a SPA normalmente
- Preview de links no WhatsApp mostra nome, descricao e logo da loja

