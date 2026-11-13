# Mostrar o nome do usuário no botão do topo

## Problema
Para funcionários (Gerente, Administrador, Vendedor) que não têm cadastro de cliente, o botão no topo da loja mostra "Perfil". Só os clientes veem o próprio nome.

## O que vou fazer
O botão vai mostrar, nesta ordem:
1. O primeiro nome do cliente, se a pessoa for cliente (fica como já é hoje, ex.: "ARIANA").
2. Se não for, o nome cadastrado na tela de usuários da loja.
3. Se não houver nome, a parte do e-mail antes do "@" (ex.: "ornellas").

"Perfil" só aparece se nada disso existir.

## Técnico
- `ProductStorePage.tsx` linha ~439: fallback `seller.sellerName` → `user.email.split('@')[0]` → 'Perfil'.
- `useSellerMode`: `sellerName` não força mais "Gerente" quando o nome está vazio, para o e-mail ser usado.
