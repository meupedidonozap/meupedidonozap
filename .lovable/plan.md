

# Corrigir SEO e Preview de Links (WhatsApp/Google) de Vez

## Diagnóstico

Existem **dois problemas** que impedem o funcionamento:

1. **Edge function não está ativada** — o arquivo `netlify/edge-functions/og-redirect.ts` existe mas NÃO está configurado no `netlify.toml`. Logo, nunca executa.

2. **Edge function serve HTML errado para humanos** — atualmente retorna uma página HTML simples do Supabase com um `window.location.href` redirect, causando flash e problemas. Precisa servir OG tags apenas para bots.

## Solução: Edge Function com Detecção de Bots

A estratégia correta é: bots recebem HTML com meta tags OG, humanos recebem a SPA normalmente.

### Arquivo 1: `netlify.toml`

Adicionar configuração da edge function:

```toml
[build]
  publish = "dist"
  command = "bun run build && node scripts/prerender.cjs"

[[edge_functions]]
  function = "og-redirect"
  path = "/*"
```

### Arquivo 2: `netlify/edge-functions/og-redirect.ts`

Reescrever com detecção de User-Agent de bots:

- Lista de bots: WhatsApp, Telegram, Facebook, Twitter, Google, LinkedIn, Discord, Slack, etc.
- Se User-Agent é bot → buscar OG meta do Supabase edge function → retornar HTML com meta tags
- Se User-Agent é humano → `context.next()` (serve a SPA normalmente)
- Remover o hack do `window.location.href` redirect

```text
Request chega
  ├─ É bot? (User-Agent check)
  │   ├─ SIM → busca OG meta do Supabase → retorna HTML com meta tags
  │   └─ NÃO → context.next() → SPA normal
  └─ Não tem slug? → context.next()
```

### Arquivo 3: `public/_redirects`

Manter como está — `/* /index.html 200` serve como fallback para o React Router.

### Prerender continua

O `prerender.cjs` continua funcionando como cache estático para SEO. A edge function atua como camada dinâmica que cobre lojas novas (adicionadas após o último deploy).

## O que o usuário precisa fazer

1. No painel do **Netlify** → Build & deploy → Environment, confirmar que estas variáveis existem:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
2. Após o deploy, testar compartilhando um link de loja no WhatsApp

## Resultado

- Google/bots recebem HTML completo com título, descrição e imagem da loja
- WhatsApp mostra preview com nome da loja, descrição e logo
- Usuários humanos continuam usando a SPA normalmente sem flash/redirect
- Funciona para lojas novas sem precisar rebuildar

