
# Correcao: Carrinho visivel em lojas SERVICOS (e todas)

## Problema Identificado

O carrinho existe e funciona, mas o icone fica **cortado/invisivel** no header em telas de celular. Isso acontece porque o nome da loja tem `flex-shrink-0` (nao encolhe), empurrando os icones da direita para fora da tela. Alem disso, nao ha nenhuma indicacao visual fixa de que existem itens no carrinho.

## Solucao

Duas mudancas no arquivo `src/pages/ProductStorePage.tsx`:

### 1. Corrigir o overflow do header

Remover `flex-shrink-0` do link do nome da loja e adicionar `truncate` no titulo para que nomes longos sejam cortados com "..." em vez de empurrar os icones para fora.

```text
Antes:
<Link ... className="flex-shrink-0 flex items-center gap-2">
  <h1 className="text-lg font-bold">{store.name}</h1>

Depois:
<Link ... className="min-w-0 flex items-center gap-2">
  <h1 className="text-lg font-bold truncate">{store.name}</h1>
```

Tambem garantir que o container dos icones da direita tenha `flex-shrink-0` para nunca ser escondido.

### 2. Adicionar barra flutuante do carrinho no rodape

Quando houver itens no carrinho, mostrar uma barra fixa no rodape da pagina com:
- Quantidade de itens e valor total
- Botao "Ver Carrinho" que abre o Sheet do carrinho

Isso garante que o cliente sempre veja que tem itens no carrinho, independente do tamanho da tela.

```text
{totalItems > 0 && !isCartOpen && (
  <div className="fixed bottom-0 left-0 right-0 z-50 border-t bg-card p-3 shadow-lg">
    <Button onClick={() => setIsCartOpen(true)} className="w-full gap-2 bg-accent ...">
      <ShoppingCart /> Ver Carrinho ({totalItems} itens) - {formatCurrency(cart.total)}
    </Button>
  </div>
)}
```

## Resumo

| Mudanca | Descricao |
|---|---|
| Header fix | Nome da loja com `truncate` + icones com `flex-shrink-0` |
| Barra flutuante | Barra fixa no rodape quando ha itens no carrinho |

## Arquivo modificado

- `src/pages/ProductStorePage.tsx`
