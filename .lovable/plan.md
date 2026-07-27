## Objetivo
Deixar claro na vitrine da loja o que cada botão de visualização faz, mostrando os rótulos **LISTA** e **QUADRO**.

## Alteração
Arquivo: `src/pages/ProductStorePage.tsx` (barra de busca, linhas ~454-459)

- Trocar os dois botões `size="icon"` por botões com ícone + texto:
  - Ícone `List` + rótulo `LISTA`
  - Ícone `Grid` + rótulo `QUADRO`
- Manter o mesmo comportamento de seleção (botão ativo continua destacado com o token `bg-primary text-primary-foreground`).
- Rótulos em texto pequeno (`text-xs font-semibold`), e em telas muito estreitas o texto permanece visível (os botões ficam compactos e a busca reduz), preservando o layout em uma única linha.
- Adicionar `aria-label` em cada botão para acessibilidade.

## Escopo
Somente apresentação; nenhuma mudança em lógica de catálogo, filtros ou dados.