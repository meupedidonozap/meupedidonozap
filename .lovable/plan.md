

# Corrigir Erro de Build: require não definido em ES module

## Problema

O `package.json` tem `"type": "module"`, então arquivos `.js` são tratados como ESM. O `require()` não funciona em ESM.

## Correção

Renomear `scripts/prerender.js` para `scripts/prerender.cjs` e atualizar as referências:

1. **Renomear** `scripts/prerender.js` → `scripts/prerender.cjs`
2. **`netlify.toml`**: trocar `node scripts/prerender.js` por `node scripts/prerender.cjs`
3. **`package.json`**: atualizar o script build para `node scripts/prerender.cjs`

