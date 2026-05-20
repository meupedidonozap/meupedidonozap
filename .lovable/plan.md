## Objetivo

Exibir o **Código do Cliente** na aba **Pedidos** (painel admin da Dicolore) para facilitar a localização do cliente.

## Onde aparecerá

Na coluna **Cliente** da tabela de Pedidos (`src/pages/StoreAdminPage.tsx`, aba `orders`), abaixo do nome/WhatsApp:

```text
EDUARDO MARCELO QUINTINO OLIANI
(47)99211-0929
Código: 12345 · Rep.: Ronaldo
```

- **Código** = `customer_profiles.customer_code` (mesma coluna mostrada na aba Clientes).
- **Representante** (já existe em outros lugares, mantemos só se já estiver disponível pelo mesmo lookup).

## Como vou ligar pedido → cliente

O pedido armazena `customer.cpfCnpj` e `customer.whatsapp`, mas não o `customer_code`. Vou:

1. Carregar `customer_profiles` da loja (já existe `useCustomerProfiles(storeId)`).
2. Montar um `Map` em memória indexado por:
   - dígitos do `cpf_cnpj`, e
   - últimos 8 dígitos do WhatsApp (fallback).
3. Para cada pedido, resolver o `customer_code` por esse mapa e renderizar no card do cliente.

Se não houver match (pedido antigo sem cadastro), simplesmente não mostra o código — sem quebrar nada.

## Arquivos afetados

- `src/pages/StoreAdminPage.tsx` — aba "Pedidos": adicionar lookup e a linha "Código: …" na célula Cliente.

## Fora do escopo

- Não vou alterar a estrutura de `orders` nem gravar `customer_code` no JSON do pedido (mantém retroatividade).
- Não vou mexer em impressão/exportação/WhatsApp — só a tela de Pedidos do admin.
- Sem mudanças em RLS, hooks de mutação ou tipos do pedido.
