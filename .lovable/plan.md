# Códigos do KIT e dos itens na impressão do pedido

## Problema

Na impressão (térmica e A4), os itens explodidos de um KIT aparecem só com a descrição do KIT ao qual pertencem ("KIT: Kit Senses Nutri Travel + Necessaire"). Sem o código do KIT, a conferência contra a planilha/ERP fica difícil.

## O que muda

Na impressão do pedido, cada linha de item que veio de um KIT passa a mostrar:

- O código do próprio produto componente (já existe hoje).
- O código do KIT junto do nome do KIT, no formato `KIT KITS006 - Kit Senses Nutri Travel + Necessaire`.

Layout A4: a coluna "Código" continua com o código do componente, e abaixo do nome do produto entra a linha com código + nome do KIT.

Layout térmico (80mm): abaixo da linha `Cod: ...` entra a linha `KIT KITS006 - Kit Senses Nutri Travel + Necessaire`.

Itens que não pertencem a nenhum KIT continuam exatamente como hoje.

## Não muda

- Arquivos de transmissão (XML, TXT, Bling) — seguem agrupando por código.
- WhatsApp e telas do painel.
- Valores, quantidades e totais.

## Detalhes técnicos

- `src/lib/printOrder.ts`: em `buildThermalHTML` e `buildA4HTML`, usar os campos `kitParentCode` e `kitParentName` (já preenchidos por `expandKitItems` em `src/lib/kitExpansion.ts`) para renderizar a linha do KIT.
- Nenhuma mudança de dados ou de backend.
