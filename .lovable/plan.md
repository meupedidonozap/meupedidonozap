## Contexto

Sobre o botão Editar: confirmado — a regra "apenas Pendente pode editar" continua. O pedido #104 do Ronaldo aparece como **Entregue**, então é o comportamento correto não mostrar o botão. Nenhuma mudança nesse ponto.

Resta corrigir a faixa branca vertical na lateral direita do painel quando aberto pelo celular (segunda imagem). Isso é um overflow horizontal causado pelo header.

## Causa raiz

No `src/pages/StoreAdminPage.tsx` (linhas ~641-666) o cabeçalho usa:

```
<div className="flex items-center justify-between">
  <div className="flex items-center gap-4"> ... título longo "DiColore Profissional | ACESSO EXCLUSIVO..." ... </div>
  <div className="flex items-center gap-2"> Atualizar · Ver Loja · Sair </div>
</div>
```

No celular o título + os 3 botões não cabem na mesma linha e nada quebra (`flex` sem `flex-wrap`, título sem `min-w-0`/`break-words`), empurrando a largura da página. Como o `<main>` e o `<header>` ficam mais largos que a viewport, o body ganha scroll horizontal — visível como a faixa branca à direita.

## Mudanças

### `src/pages/StoreAdminPage.tsx` — bloco do header (linhas ~641-666)

1. Permitir wrap da linha do header e empilhar no mobile:
   - Trocar `flex items-center justify-between` por `flex flex-wrap items-center justify-between gap-3`.
2. Garantir que o título quebre em vez de empurrar a largura:
   - Bloco do título: adicionar `min-w-0 flex-1` no wrapper interno e `break-words` (ou `line-clamp-2`) no `<h1>`.
3. Permitir que os botões quebrem para a linha de baixo no mobile:
   - Bloco dos botões: `flex flex-wrap items-center gap-2 justify-end`.
4. Encolher os botões no mobile mantendo o visual no desktop:
   - "Ver Loja" / Atualizar: usar `size="sm"` no breakpoint mobile (classes `h-9 px-3`) e manter ícones; em telas `sm:` voltar ao tamanho atual.
   - Em telas muito estreitas, esconder os rótulos de texto e deixar só o ícone (ex.: span do label com `hidden sm:inline`) para "Ver Loja" e "Sair".

### Cinto e suspensório (defensivo)

5. No wrapper raiz da página adicionar `overflow-x-hidden` (`<div className="min-h-screen bg-background overflow-x-hidden">`) para impedir que qualquer outro filho que vaze cause de novo a faixa branca.

Nenhuma mudança em lógica de permissão, em `EditOrderDialog` ou no restante do painel — só layout do header e proteção contra overflow horizontal.

## Validação

- Abrir `/dicolore/admin` no preview em viewport mobile (375px): confirmar que não há mais scroll horizontal e que título + botões empilham corretamente.
- Conferir no desktop (1280px+) que header continua com título à esquerda e botões à direita, sem mudança visual.
