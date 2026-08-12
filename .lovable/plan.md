# Revisão do XML Bling: o que já vai e o que falta

## Situação atual (verificada no código e no banco)

O XML gerado hoje já contém: dados do cliente (nome, tipoPessoa J/F pelo CPF/CNPJ, endereço, número, complemento, bairro, CEP, cidade, UF, fone, e-mail), bloco de transporte com transportadora e etiqueta de entrega, itens (código, descrição, unidade, quantidade, valor unitário já com o desconto rateado e kits explodidos), valor do frete, valor do desconto, observações e observações internas (número do pedido, forma/condição de pagamento e vendedor).

Faltam, em relação ao modelo do Bling:

1. **`<ie>` (inscrição estadual)** — sai sempre vazio. O cadastro de cliente não tem esse campo no banco.
2. **`<parcelas>`** — não é gerado. Hoje a condição/prazo de pagamento só vai como texto nas observações internas, então o Bling não cria as parcelas do financeiro.
3. **`<servico_correios>` e `<volumes>`** — não são gerados (só fazem sentido se houver envio por Correios).
4. **`<un>` do item** — fixo em "Un"; o cadastro de produto não guarda unidade de medida.

## O que proponho implementar

1. **Inscrição Estadual no cliente**: novo campo no cadastro de cliente (admin e importação), preenchendo `<ie>` no XML. Quando vazio, sai vazio (aceito pelo Bling).
2. **Parcelas a partir do prazo de pagamento**: interpretar a descrição do prazo escolhido (ex.: "30/60/90 S/J", "1/30 S/J", "7 DIAS S/J", "A VISTA") e gerar um `<parcela>` por vencimento, com data = data do pedido + dias e valor = total dividido igualmente (último ajusta os centavos). Quando o prazo não for interpretável, o bloco `<parcelas>` é omitido, como hoje.
3. **Unidade de medida do produto**: novo campo opcional "Unidade" no cadastro de produto (padrão "Un"), usado em `<un>`; também lido da planilha de atualização quando a coluna existir.
4. **Correios**: manter fora por enquanto — o fluxo atual entrega por transportadora/representante. Se quiser, incluo `servico_correios`/`volumes` depois.

## Detalhes técnicos

- Migração: `customer_profiles.ie text`, `products.unit text default 'Un'` (com GRANTs já existentes nas tabelas).
- `src/lib/exportOrder.ts`: preencher `<ie>`, usar `item.unit ?? 'Un'`, e novo helper `buildBlingParcelas(order, condicaoDescricao)` que parseia padrões `n/n/n`, `N DIAS`, `A VISTA`/`VENDA A VISTA` e formata datas em `dd/mm/aaaa`.
- `src/hooks/useCustomerProfiles.ts`, cadastro de cliente e `ImportCustomersDialog`/`sync-customers`: mapear a nova coluna IE.
- `src/components/ProductFormDialog.tsx` e `sync-prices`: mapear a unidade.
- Sem mudança nos formatos XML/TXT antigos nem em outras lojas.
