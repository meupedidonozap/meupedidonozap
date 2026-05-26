## Objetivo

Trocar o domínio canônico do projeto de `meupedidonozap.lovable.app` para **`https://meupedidonozap.online`** (Netlify) e executar a verificação + indexação no Google Search Console de forma programática via conector.

A recomendação é **NÃO registrar o domínio Lovable** no Search Console — concorda com sua escolha. Dois domínios indexados com o mesmo conteúdo geram conteúdo duplicado, prejudicam ranqueamento e diluem autoridade. O canônico fica só no `.online`. O Lovable continua acessível pra preview interno mas com `noindex` implícito por não estar no sitemap nem ter backlinks.

---

## Parte 1 — Corrigir domínio no código

Trocar todas as referências de `meupedidonozap.lovable.app` por `meupedidonozap.online`:

1. **`index.html`** — atualizar JSON-LD Organization/WebSite com novo `url`. Adicionar `<link rel="canonical" href="https://meupedidonozap.online/" />` e `og:url`.
2. **`public/robots.txt`** — atualizar linha `Sitemap:` para `https://meupedidonozap.online/sitemap.xml`.
3. **`scripts/generate-sitemap.cjs`** — alterar constante `BASE_URL`.
4. **`src/lib/seoSchemas.ts`** — alterar constante `BASE_URL`.
5. **`netlify/edge-functions/og-redirect.ts`** — verificar se há URL hardcoded (não há, é dinâmico via slug — ok).
6. **`supabase/functions/og-meta/index.ts`** — verificar URLs absolutas geradas no HTML retornado e ajustar se necessário.

## Parte 2 — Verificação no Google Search Console (programática)

Usando o conector Google Search Console já disponível, executar via `code--exec` + `curl`:

1. **Solicitar token META** para `https://meupedidonozap.online/`
2. **Inserir meta tag de verificação no `index.html`** (substituir as 2 existentes do Lovable por uma nova específica do `.online`)
3. **Você publica/sobe no Netlify** (precisa ser ação sua porque Netlify build é fora do Lovable). Confirmo quando estiver no ar.
4. **Chamar endpoint verify** para o Google confirmar
5. **Adicionar site como propriedade** no Search Console (PUT em `/sites/{url-encoded}`)
6. **Submeter sitemap** `https://meupedidonozap.online/sitemap.xml` via API (PUT em `/sites/.../sitemaps/{sitemap-url-encoded}`)
7. **(opcional)** Listar lojas ativas e solicitar inspeção/indexação das principais via URL Inspection API

## Parte 3 — Orientação operacional pós-execução

Depois da execução automática vou te entregar:
- Status de cada step (verificado / sitemap aceito / quantas URLs enviadas)
- Como acompanhar cobertura no painel do Search Console (link direto)
- Como conectar Search Console ao Google Ads pra campanhas
- Bing Webmaster Tools (importar da GSC em 1 clique — opcional)

---

## Fluxo de execução

```text
1. Edit code (BASE_URL → .online)  ──┐
2. Request META token                 │  programático
3. Inject token meta into index.html  ┘
   ↓
4. VOCÊ: publica no Netlify
   ↓
5. POST verify                        ──┐
6. PUT site                            │  programático
7. PUT sitemap                          ┘
   ↓
8. Resumo de status + próximos passos
```

## Sobre o "página não encontrada" ao compartilhar

Você confirmou que é em outro projeto — ignorando.

---

**Arquivos alterados:** `index.html`, `public/robots.txt`, `scripts/generate-sitemap.cjs`, `src/lib/seoSchemas.ts`, possivelmente `supabase/functions/og-meta/index.ts`.
**DB:** nenhuma alteração.
**Pré-requisito:** conector Google Search Console autorizado (vou checar com `standard_connectors--list_connections`; se não estiver, vou pedir pra você conectar antes do step 5).
