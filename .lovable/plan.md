## Diagnóstico

Confirmei no banco: o cliente `98216` está com `seller_code` vazio.

**Causa raiz:** em `src/components/ImportCustomersDialog.tsx` (linha 96), o parser da planilha lê a coluna do vendedor via:

```ts
r.codigo_vendedor ?? r['código_vendedor'] ?? r.vendedor
```

Mas o cabeçalho da nova planilha é **`VENDEDOR`** (maiúsculo — coluna L da imagem). O `sheet_to_json` do XLSX usa o texto do cabeçalho como chave literal, então `r.vendedor` (minúsculo) não bate com `VENDEDOR`, e o `codigo_vendedor` chega vazio ao edge function. Resultado: todos os clientes importados por essa planilha ficaram sem vínculo de vendedor.

Os demais campos (CODIGO, NOME, CIDADE, etc.) já têm variantes uppercase no parser, mas VENDEDOR foi esquecido.

## Correção

**1) `src/components/ImportCustomersDialog.tsx`**
- Normalizar cada linha antes do mapeamento: construir um dicionário `lower(headerTrim) -> value` e resolver todos os campos por essa chave normalizada (case-insensitive, tolerante a acento/espaço). Isso conserta VENDEDOR e blinda contra novas variações de cabeçalho (`Vendedor`, `TRANSPORTADORA`, etc. — este último não é usado hoje, mas o parser fica robusto).
- Manter a assinatura para o edge function (`codigo_vendedor`) inalterada.

**2) Ação do usuário após o deploy**
- Reabrir "Atualizar Clientes" e reenviar a mesma planilha em modo update; o edge function já faz `setIf('seller_code', ...)`, portanto vai preencher/atualizar `seller_code` para todos os clientes da planilha, incluindo o 98216 (308) e os demais.

Sem alterações no edge function, no banco ou nas outras telas — o defeito é apenas no parser do cliente.
