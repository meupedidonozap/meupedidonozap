# KITS não aparecem na vitrine da Senses

## Causa confirmada

Na Senses a tabela de preço padrão é a **11**. Consultei o banco: os kits ativos (KITS001, KITS002, KITS003, KITS004, KITS005, KITS006) estão com **Tabela 11 = 0**, embora tenham Tabela 4 preenchida (R$ 40 a R$ 63). Como a vitrine esconde qualquer produto sem preço na tabela ativa do cliente, os kits somem.

O campo "Tabela 11" no modal do produto aparece preenchido com 63 porque o formulário **exibe o preço base quando a Tabela 11 está zerada** — ou seja, a tela engana: o valor mostrado não é o que está gravado. Ao todo são 7 produtos ativos da Senses nessa situação (os 6 kits + 1 item).

## O que fazer

1. **Corrigir os dados**: preencher a Tabela 11 com o valor da Tabela 4 para os produtos ativos da Senses que estão com Tabela 11 zerada. Isso já faz os kits voltarem à vitrine.
2. **Rede de segurança no preço**: na loja Senses, quando a Tabela 11 não estiver preenchida, usar o preço da Tabela 4 / preço base em vez de ocultar o produto (mesmo comportamento que a Tabela 4 já tem hoje). Assim um cadastro novo sem Tabela 11 não desaparece silenciosamente.
3. **Deixar o formulário honesto**: o campo Tabela 11 (e Tabela 1 / Tabela 9) passa a mostrar vazio quando não há valor gravado, com texto de apoio indicando que ficará igual ao preço padrão. Sem valor fantasma na tela.

## Observação (fora do escopo, confirmar depois)

Existem 6 kits duplicados inativos com códigos antigos (KIT-SENSES-CURLS, KIT-SENSES-GLOW, KIT-SENSES-KERATIN, KIT-SENSES-NOMOREOIL, KIT-SENSES-NUTRI, KIT-SENSES-NUTRI-TRAVEL). Posso excluí-los depois, se quiser.
Também: KITS004 (Kit Nutri Intuition) está sem componentes cadastrados — a composição precisa ser preenchida para o pedido sair explodido.

## Detalhes técnicos

- Migração de dados: `UPDATE products SET price_table_11 = price_table_4` para produtos ativos da loja `dicoloresenses` com `coalesce(price_table_11,0)=0`.
- `src/lib/pricing.ts`: em `getProductPriceOrNull` / `getVariantPriceOrNull`, tratar a tabela 11 com fallback para tabela 4 / base price quando o valor for nulo (mantendo 0 explícito como indisponível apenas onde há valor gravado).
- `src/components/ProductFormDialog.tsx`: remover o fallback visual `String(product.basePrice)` nos campos Tabela 1 / 9 / 11.
