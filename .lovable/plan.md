## Contexto

- Usuário `dicolore2026@gmail.com` é `store_admin` da loja DICOLORE (`store_id 3b77c581...`).
- Produtos `7898418093867` e `7898418093997` existem na loja, sem `image_url`.
- Bucket `product-images` está público e sem limite de tamanho/MIME.
- Políticas RLS de `storage.objects` (INSERT/UPDATE/DELETE) permitem quem estiver em `store_admins`, ou em `store_users` com `can_manage_products`, ou platform admin. Deveriam passar.
- Políticas de `products` / `product_images` também permitem para `store_admin`.
- Logs adicionados nas últimas iterações (`[uploadProductImage] start/compressed/uploaded`, `[ProductForm] handleImageSelect`, `[ProductForm] save error`) mas os console logs recebidos estão vazios — provavelmente não capturei uma tentativa recente.

Ou seja, do lado do banco tudo aparenta estar correto. O problema está no cliente (compressão, seleção do arquivo, chamada de upload, ou update do produto).

## Plano de investigação

1. **Reproduzir com Playwright autenticado como o admin da DICOLORE** (via `LOVABLE_BROWSER_SUPABASE_*`, restaurando localStorage/cookies e navegando para `/dicolore/admin`).
2. Localizar o produto `7898418093867` na lista, abrir o `ProductFormDialog`, clicar em "Upload", anexar um arquivo pequeno de teste (PNG gerado em `/tmp/browser/`), aguardar preview e clicar em "Salvar".
3. Capturar tudo:
   - `page.on("console", ...)` para pegar `[ProductForm] handleImageSelect`, `[uploadProductImage] start/compressed/uploaded`, `[ProductForm] save error`.
   - `page.on("requestfailed", ...)` e `page.on("response", ...)` filtrados por `product-images`, `products`, `product_images` — capturar status, corpo do erro e header `x-upstream-*`.
   - Screenshots em cada etapa (antes/depois de anexar, após salvar) para confirmar visualmente se o toast de erro aparece ou se simplesmente “não faz nada”.
4. Comparar o comportamento observado com os três pontos de falha prováveis:
   - **A. `compressImage` trava** (ex.: `img.onload` nunca dispara em algum tipo/tamanho): o log `[uploadProductImage] compressed` não aparece.
   - **B. Upload falha no Storage** (RLS/403, MIME, tamanho): aparece `[uploadProductImage] start` mas não `uploaded`; response 4xx no PUT do bucket.
   - **C. Upload OK mas `updateProduct` falha** (RLS ou payload): aparece `[uploadProductImage] uploaded` mas depois erro no PATCH em `products` (ou toast "Erro ao salvar produto").
5. Com o ponto de falha identificado, aplicar correção mínima:
   - Se **A**: tornar `compressImage` resiliente (timeout + fallback ao arquivo original quando `onload` demorar) e cortar early quando o arquivo já for pequeno.
   - Se **B**: corrigir a política/definição do bucket (ex.: falta de `owner` no upsert, política errada em algum caminho específico) — analisar a mensagem exata do PostgREST/Storage antes de mexer no SQL.
   - Se **C**: ajustar o payload ou a política de `products`/`product_images` conforme a mensagem de erro.
6. Rodar o mesmo cenário com Playwright novamente para confirmar que a imagem persiste no produto (checar `image_url` via `supabase--read_query` após salvar).

## Observações

- Não vou alterar RLS “no escuro”: só após ver a mensagem exata do erro no console/response.
- Sem mudanças de código nesta rodada — apenas diagnóstico. As correções virão numa próxima iteração baseadas no que o Playwright capturar.
