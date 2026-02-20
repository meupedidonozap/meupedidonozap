
# Persistência do Carrinho — Carrinho Salvo ao Fechar e Reabrir o App

## Situação Atual

O `CartContext` usa apenas `useState`, que é **memória volátil**: ao fechar a aba, recarregar a página ou navegar para fora, tudo é perdido. O estado existe somente enquanto o JavaScript da página está ativo.

## Solução: localStorage por Loja

A forma mais simples, rápida e que não exige nenhuma mudança no banco de dados é salvar o carrinho no `localStorage` do navegador — exatamente como fazem iFood, Shopee, Amazon e outros apps. O dado fica gravado no dispositivo do usuário.

### Comportamento após a mudança

| Situação | Antes | Depois |
|---|---|---|
| Fechar a aba e reabrir | Carrinho vazio | Carrinho restaurado |
| Recarregar a página (F5) | Carrinho vazio | Carrinho restaurado |
| Navegar para outra página e voltar | Carrinho vazio | Carrinho restaurado |
| Fechar o navegador e reabrir | Carrinho vazio | Carrinho restaurado |
| Trocar de loja | Limpa o carrinho | Limpa o carrinho (correto) |
| Finalizar pedido (clearCart) | Limpa o carrinho | Limpa o carrinho e o localStorage |

### Chave de armazenamento

O carrinho será salvo com a chave `cart_[storeId]`, ex:  
`cart_3b77c581-4c30-4c43-a3d5-944eb9f3032a`

Isso garante que cada loja tenha seu próprio carrinho independente no dispositivo.

## Arquivo a Modificar

### `src/contexts/CartContext.tsx`

Apenas **3 mudanças** neste único arquivo:

**1. Carregar o carrinho salvo ao iniciar** (substitui o `useState(initialCart)`):

```typescript
const [cart, setCart] = useState<Cart>(() => {
  // Ao criar o estado, tenta recuperar do localStorage
  // (ainda sem storeId — será restaurado quando a loja carregar)
  return initialCart;
});
```

**2. Ao definir a loja (`setStoreId`)**, tentar recuperar o carrinho salvo para aquela loja:

```typescript
const setStoreId = useCallback((storeId: string) => {
  setCart(prev => {
    if (prev.storeId !== storeId) {
      // Tenta restaurar carrinho salvo para esta loja
      try {
        const saved = localStorage.getItem(`cart_${storeId}`);
        if (saved) {
          const parsed = JSON.parse(saved) as Cart;
          return parsed; // restaura com itens, cupom, etc.
        }
      } catch {}
      return { ...initialCart, storeId };
    }
    return prev;
  });
}, []);
```

**3. Salvar no localStorage a cada mudança no carrinho** (usando `useEffect`):

```typescript
useEffect(() => {
  if (cart.storeId) {
    localStorage.setItem(`cart_${cart.storeId}`, JSON.stringify(cart));
  }
}, [cart]);
```

**4. `clearCart` também limpa o localStorage:**

```typescript
const clearCart = useCallback(() => {
  setCart(prev => {
    localStorage.removeItem(`cart_${prev.storeId}`);
    return { ...initialCart, storeId: prev.storeId };
  });
}, []);
```

## O que NÃO muda

- Nenhuma mudança no banco de dados
- Nenhuma nova dependência ou biblioteca
- Toda a lógica de carrinho existente permanece igual
- O comportamento de trocar de loja (limpar carrinho) continua funcionando

## Resumo Técnico

| Item | Detalhe |
|---|---|
| Arquivo modificado | `src/contexts/CartContext.tsx` apenas |
| Tecnologia | `localStorage` nativo do navegador |
| Chave de armazenamento | `cart_[storeId]` |
| Dados persistidos | Itens, quantidades, cupom, desconto, subtotal, total |
| Tamanho estimado no storage | < 5KB por loja |
| Compatibilidade | Todos os navegadores modernos (mobile e desktop) |
