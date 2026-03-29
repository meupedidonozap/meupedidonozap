

# Corrigir Edge Function og-meta: Sempre retornar HTML estático

## Problema

A função atual faz redirect 302 quando o User-Agent não é bot (linhas 54-62). O pedido é que **sempre** retorne HTML com meta tags, independente de ser bot ou não.

## Correção

### Arquivo: `supabase/functions/og-meta/index.ts`

Remover a lógica de detecção de bot e o redirect. A função deve:

1. Receber `?slug=xxx`
2. Buscar dados da loja no banco (nome, logo, banner, address, whatsapp)
3. Retornar HTML estático com status 200 **sempre**, com as meta tags OG preenchidas
4. Manter o fallback genérico caso a loja não seja encontrada

Basicamente: remover o bloco `isBot()` / redirect (linhas 9-62) e ir direto para a busca no banco e geração de HTML para qualquer requisição.

