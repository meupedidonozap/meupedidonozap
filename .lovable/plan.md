
# Corrigir Scroll no VariantDialog (Loja ACESSORIOS)

## Problema

O `DialogContent` no `VariantDialog` não tem altura máxima (`max-h`) nem overflow scroll configurado. Quando o produto tem muitas variantes de cor e tamanho (como visto na imagem: 7 cores + tamanhos), o conteúdo ultrapassa a altura da tela do dispositivo. O resultado é que o usuario nao consegue ver as opcoes de tamanho nem o botao "Adicionar ao Carrinho".

## Solução

Aplicar altura máxima ao `DialogContent` e tornar o conteúdo interno rolável, mantendo o cabeçalho fixo no topo.

## Mudanças no `src/components/VariantDialog.tsx`

### 1. Limitar a altura do `DialogContent`

Adicionar `max-h-[90vh]` ao `DialogContent` para garantir que o modal nunca ultrapasse 90% da altura da viewport:

```
<DialogContent className="sm:max-w-md max-h-[90vh] flex flex-col">
```

O `flex flex-col` é necessário para que o conteúdo interno possa crescer e o scroll funcione corretamente.

### 2. Tornar o corpo do dialog rolável

Substituir a `<div className="space-y-4">` por uma div com overflow-y scroll:

```
<div className="overflow-y-auto flex-1 space-y-4 pr-1">
  {/* carousel, nome, cores, tamanhos */}
</div>
```

O `pr-1` evita que a barra de scroll sobreponha o conteúdo.

### 3. Fixar o botão "Adicionar ao Carrinho" fora do scroll

Mover o botão para fora da div scrollável, para que ele fique sempre visível na parte inferior do dialog, independentemente da quantidade de opções:

```text
DialogContent (flex flex-col, max-h-[90vh])
├── DialogHeader (fixo no topo)
├── div.overflow-y-auto (área rolável)
│   ├── Carrossel de imagens
│   ├── Nome + Descrição + Preço
│   ├── Seleção de Cor
│   └── Seleção de Tamanho
└── Button "Adicionar ao Carrinho" (fixo na base, sempre visível)
```

## Arquivo modificado

- `src/components/VariantDialog.tsx` — único arquivo a ser alterado

## Benefícios

- O usuario consegue rolar para ver todas as opcoes de cor e tamanho
- O botao "Adicionar ao Carrinho" fica sempre visivel na parte inferior
- Funciona tanto em mobile quanto em desktop
- Nenhuma logica de negocio e alterada, apenas o layout
