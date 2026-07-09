## Objetivo

Reproduzir o upload de foto no admin da DICOLORE via Playwright autenticado, capturar console + network e identificar exatamente onde falha (compressão, upload no Storage, ou update do produto).

## Passos

1. Restaurar a sessão Supabase do admin (`LOVABLE_BROWSER_SUPABASE_*`) no localhost e navegar para `/dicolore/admin`.
2. Abrir o produto `7898418093867`, clicar em "Upload", anexar um PNG gerado em `/tmp/browser/test.png`.
3. Instrumentar:
   - `page.on("console")` — capturar `[uploadProductImage] start/compressed/uploaded`, `[ProductForm] handleImageSelect`, `[ProductForm] save error`, `[compressImage] timeout`.
   - `page.on("response")` filtrado por `product-images`, `products`, `product_images` — status + corpo.
   - Screenshots antes de anexar, com preview, após salvar.
4. Clicar em "Salvar" e aguardar toast/rede.
5. Consultar via `supabase--read_query` se `products.image_url` e `product_images` foram gravados.
6. Classificar a falha:
   - **A.** `compressed` não aparece → travar em `compressImage`.
   - **B.** `uploaded` não aparece → RLS/Storage.
   - **C.** update falha → RLS em `products` ou payload.
   - **D.** tudo OK no cliente mas banco continua NULL → mismatch de sessão/RLS silencioso.
7. Reportar diagnóstico com evidência (screenshots + logs) antes de aplicar qualquer correção.

## Observação

Nenhuma alteração de código nesta rodada — só diagnóstico. Correções virão na próxima iteração com base no ponto de falha identificado.