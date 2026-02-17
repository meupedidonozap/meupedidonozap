
# Bloquear Geracao de OS Duplicada

## Problema

Atualmente, o botao "Gerar OS" aparece para todos os pedidos de lojas do tipo SERVICOS, mesmo que o pedido ja tenha uma OS criada. Isso permite criar multiplas OS para o mesmo pedido.

## Solucao

Usar a lista de `serviceOrders` que ja esta carregada (linha 92) para verificar se o pedido ja possui uma OS antes de permitir a criacao.

### Mudancas no arquivo `src/pages/StoreAdminPage.tsx`

No trecho do botao "Gerar OS" (linha 502-522):

1. Antes de renderizar o botao, verificar se ja existe uma OS com `orderId` igual ao `order.id` na lista `serviceOrders`
2. Se ja existir: mostrar um botao diferente ("Abrir OS") que abre a OS existente em vez de criar uma nova
3. Se nao existir: manter o botao "Gerar OS" atual

A logica sera:

```
const existingSO = serviceOrders.find(so => so.orderId === order.id);

if (existingSO) {
  // Botao "Abrir OS" -> abre o dialog com a OS existente
} else {
  // Botao "Gerar OS" -> cria nova OS (codigo atual)
}
```

Isso resolve o problema sem precisar de consultas extras ao banco, pois os dados ja estao disponíveis no estado do componente.
