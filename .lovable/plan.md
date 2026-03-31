

# Corrigir leitura de variáveis de ambiente no prerender.cjs

## Problema

O script tenta ler `process.env.VITE_SUPABASE_URL` diretamente, mas no Netlify essas variáveis podem não estar definidas no ambiente Node.js. Se não encontrar, o script silenciosamente pula sem gerar as páginas.

## Correção

**Arquivo:** `scripts/prerender.cjs`

1. Adicionar `require('dotenv').config()` como fallback caso `process.env` não tenha as variáveis
2. Adicionar logs indicando a origem das variáveis (env ou .env file)
3. Manter o resto do script inalterado

```javascript
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
```

O `dotenv` já é dependência do Vite, portanto não precisa instalar nada extra.

## Nota sobre Netlify

O usuário também deve configurar `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` nas variáveis de ambiente do Netlify (Build & deploy → Environment) para que funcione em produção sem depender do `.env`.

