# Modo Vendedor na vitrine (pedido em nome do cliente)

O vendedor entra na loja pelo link normal (`/dicoloresenses`), com o login dele. O sistema reconhece que é vendedor e ativa o **Modo Vendedor**.

## Fluxo

1. Ao entrar na loja logado como vendedor, aparece uma barra fixa **"Modo Vendedor — selecione o cliente"**.
2. O vendedor escolhe o cliente **antes de montar o carrinho** (assim a vitrine já mostra a tabela de preço correta do cliente). Na mesma janela ele pode **criar um novo cliente** (nome, WhatsApp, CPF/CNPJ, endereço, tabela de preço), que já nasce vinculado à carteira dele.
3. A lista mostra **somente os clientes da carteira do vendedor** (códigos de representante vinculados ao usuário), com busca por nome, código, WhatsApp e CNPJ/CPF.
4. Monta o carrinho normalmente, com preços, descontos e regra de estoque do cliente selecionado.
5. Em **FINALIZAR PEDIDO**, o checkout já vem preenchido com os dados do cliente (endereço, condição/prazo de pagamento). O vendedor pode ajustar antes de confirmar.
6. Ao confirmar: o pedido é gravado e aparece no painel do admin como pedido do **cliente escolhido**, com o **representante do vendedor logado** registrado. **Não abre WhatsApp** — apenas confirmação na tela e opção de imprimir/voltar à loja.
7. A barra permite **trocar de cliente** (limpa o carrinho, para não misturar tabelas de preço) e **sair do Modo Vendedor**.

## Também nesta entrega

No **Novo Pedido** do painel admin, a lista de clientes passa a mostrar somente os clientes da carteira do vendedor logado. Administradores continuam vendo todos.

## Detalhes técnicos

- **Detecção**: novo hook `useSellerMode(storeId)` reaproveitando `useStoreAdmin` — ativo quando o usuário é `store_users` ativo com `role` `vendedor`/`televendas` e `seller_codes` preenchido. Admin/platform admin também pode ativar (vê todos os clientes).
- **Cliente ativo**: novo contexto `SellerContext` (provider dentro de `CartProvider`) guardando o `customer_profiles` selecionado em `sessionStorage` por loja. `ProductStorePage`, `CartContext` e `CheckoutPage` passam a ler o perfil ativo por um hook único `useActiveCustomerProfile()` — retorna o cliente selecionado no Modo Vendedor, ou o próprio perfil do usuário no fluxo normal. Isso já resolve tabela de preço (1/4/9), descontos por grupo e filtro de preço zerado sem duplicar lógica.
- **Seleção de cliente**: novo componente `SellerCustomerDialog` usando `useStoreCustomerProfiles(storeId)` filtrado por `sellerCode ∈ sellerCodes`, mais criação via o hook de criação de cliente já usado no admin (`useCustomerProfiles`), gravando `seller_code` do vendedor.
- **Checkout**: quando em Modo Vendedor — pula a exigência de perfil próprio, preenche o form do cliente selecionado, esconde o seletor de destinatário WhatsApp, não chama `useUpsertCustomerProfile` (não sobrescreve o cadastro do cliente), e após `createOrder` mostra confirmação em vez de `openWhatsApp`.
- **Gravação do pedido**: `orders.customer` recebe nome/CNPJ/endereço/IE/transportadora e `customerCode` do cliente escolhido mais `sellerCode` do vendedor; `origem` = `vendedor`. O `user_id` continua sendo o do usuário autenticado (o vendedor), para não conflitar com as políticas de acesso de `orders` — o vínculo ao cliente é feito pelo código do cliente, que é o que os relatórios, impressão e XML Bling já usam.
- **Admin**: `resolveOrderSellerName` já exibe o representante a partir do pedido; será validado com um pedido criado por este fluxo.
- **NewOrderDialog**: lista de clientes filtrada por `sellerCodes` de `useStoreAdmin` quando o usuário não é admin.
- **Verificação**: confirmar em execução que um `store_user` vendedor consegue ler `customer_profiles` da loja e inserir em `orders`; se alguma política bloquear, ajusto as regras de acesso na mesma entrega.
