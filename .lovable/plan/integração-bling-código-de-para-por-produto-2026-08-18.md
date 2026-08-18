# Integração Bling: código "de-para" por produto

## O que será feito

1. **Novo parâmetro da loja: "Trabalha com integração BLING? SIM / NÃO"**
   - Fica na aba de Configurações, junto do parâmetro de integração de estoque.
   - Quando NÃO, nada muda no sistema.

2. **Novo campo no cadastro de produto: "Código BLING"**
   - Aparece no formulário de produto apenas quando a loja trabalha com integração Bling.
   - Opcional; é a referência usada pelo Bling (hoje o EAN).
   - Também passa a ser aceito na planilha de importação/atualização de produtos, na coluna "Codigo BLING" (variações aceitas: "Cod Bling", "Codigo Bling", "bling_code"), e é exportado na planilha de produtos salvos.

3. **Download do pedido**
   - **XML Tinturaria e TXT:** continuam exatamente como estão hoje (código do sistema).
   - **XML BLING:** cada item passa a sair com o Código BLING do produto. Se o produto não tiver Código BLING cadastrado, sai o código atual do sistema (evita item sem referência).
   - Vale também para itens vindos da explosão de KIT: o de-para é feito pelo produto componente.

## Detalhes técnicos

- Migração: `products.bling_code text` (coluna nova, sem impacto nas demais lojas).
- `StoreSettings` ganha `useBlingIntegration?: boolean`; toggle em `src/pages/StoreAdminPage.tsx` (mesmo padrão de `useStockIntegration`) e salvo no `settings` JSONB.
- `Product` ganha `blingCode?: string`; mapeado em `src/hooks/useProducts.ts` (leitura + insert/update) e no `src/components/ProductFormDialog.tsx`.
- `src/lib/exportOrder.ts`: `CustomerExtra` ganha `productBlingCode` (por productId) e `productBlingCodeByCode` (por código, para componentes de KIT). Em `exportOrderBlingXml`, `<codigo>` usa `blingCode ?? item.code`. `mergeItemsByCode` continua agrupando pelo código do sistema antes da troca, então nenhuma linha duplica.
- `StoreAdminPage.tsx` monta esses mapas ao chamar `downloadOrderFile` (mesmo local onde hoje monta `productUnit`/`productUnitByCode`).
- `src/components/ImportProductsDialog.tsx`: `COLUMN_MAP` ganha as chaves de "codigo bling"; grava/exporta `bling_code`.
