# Exportar pedido no "Formato Bling" (DiColore Senses)

## O que muda

No painel administrativo da loja `dicoloresenses`, ao baixar um pedido, passa a existir a opção de formato **XML (Bling)**, além dos formatos atuais (XML Tinturaria e TXT). O arquivo gerado segue a estrutura do modelo enviado.

## Como os dados do pedido são preenchidos

- **Cliente:** nome, CPF/CNPJ (do cadastro do cliente), endereço, número, complemento, bairro, CEP, cidade, UF, telefone (WhatsApp) e e-mail. `tipoPessoa` = `J` quando CNPJ (14 dígitos) e `F` quando CPF.
- **Transporte:** transportadora do cadastro do cliente quando existir; tipo de frete `R`. Bloco de etiqueta com o mesmo endereço de entrega. Sem volumes/códigos de rastreio.
- **Itens:** itens do pedido com KITs explodidos nos componentes e valor rateado (mesma regra já usada no XML/TXT/WhatsApp). Cada item leva código, descrição, unidade `Un`, quantidade e valor unitário já com desconto aplicado.
- **Parcelas:** não enviadas; a condição de pagamento vai nas observações internas.
- **Frete / Desconto:** `vlr_frete` = taxa de entrega do pedido, `vlr_desconto` = desconto do pedido.
- **Observações:** observações do pedido em `obs`; em `obs_internas` vão número do pedido, forma/condição de pagamento e o vendedor (representante), quando houver.

Nome do arquivo: `pedido_bling_<numero>_<data>_<hora>.xml`.

## Detalhes técnicos

- `src/lib/exportOrder.ts`: nova função `exportOrderBlingXml(order, store, extra)` reutilizando `escapeXml`, `formatCgc`, `ensureItemDiscountPercents` e `expandKitItems`; `downloadOrderFile` passa a aceitar o formato `'bling'`.
- `src/pages/StoreAdminPage.tsx`: o estado `downloadFormat` aceita `'bling'` e o `Select` do diálogo de download exibe **XML (Bling)** apenas quando `store.slug === 'dicoloresenses'`. A chamada de `downloadOrderFile` segue passando `kitMap`, `cpfCnpj`, `sellerCode` e `transportadora`.
- Sem alterações de banco de dados e sem impacto nas demais lojas.