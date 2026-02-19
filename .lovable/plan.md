
# Corrigir Visibilidade do Botão "Baixar Modelo"

## Problema identificado

O botão "Baixar Modelo" está dentro do bloco `{!hasData && ...}`, o que significa que ele desaparece assim que o usuário seleciona um arquivo. Além disso, se o dialog for reaberto depois de uma importação bem-sucedida sem o estado ser limpo corretamente, o bloco `{result ? ...}` é exibido em vez da área de upload, ocultando o botão completamente.

## Solução

Mover o botão "Baixar Modelo" para um local fixo e sempre visível: o **`DialogFooter`** (rodapé do dialog), ao lado esquerdo dos botões de ação. Assim ele estará acessível independentemente do estado atual (sem arquivo, com arquivo carregado, ou na tela de resultado).

## O que vai mudar

### `src/components/ImportProductsDialog.tsx`

1. **Remover** o botão "Baixar Modelo" de dentro da área de upload (`{!hasData && ...}`)

2. **Adicionar** o botão no `DialogFooter`, no canto esquerdo, separado dos botões de ação principais usando `justify-between`:

```text
[Baixar Modelo]                    [Cancelar] [Importar]
```

3. O botão será sempre visível, em todas as etapas do fluxo (antes de carregar arquivo, após carregar, e na tela de conclusão)

4. O `DialogFooter` será reorganizado com `flex justify-between items-center` para separar o botão de download (esquerda) dos botões de ação (direita)

## Estrutura do footer após a mudança

```text
DialogFooter (flex justify-between)
├── Button "Baixar Modelo" (ghost, com ícone Download) — sempre visível
└── div (flex gap-2)
    ├── Button "Cancelar" — aparece quando não está importando
    └── Button "Importar" — aparece quando há dados válidos
```

## Benefícios

- O usuário pode baixar o modelo a qualquer momento, mesmo após já ter carregado um arquivo
- Não há dependência de estado para exibir o botão
- Layout mais limpo na área de upload (sem dois botões lado a lado)
- Resolve definitivamente o problema de o botão sumir
