# Modo Offline: catálogo em cache e fila de pedidos

Sim, dá para fazer. A loja passa a abrir mesmo sem internet (catálogo salvo no aparelho), o pedido é montado normalmente e, ao finalizar sem conexão, aparece o aviso "Você está OFFLINE — pedido salvo na fila"; a transmissão acontece sozinha quando a internet voltar.

## Como vai funcionar

1. **Indicador de conexão**: faixa fixa avisando "Sem conexão — modo offline" quando o aparelho perde a rede, e some quando volta.
2. **Catálogo em cache**: produtos, categorias, variações, dados da loja e a carteira de clientes do vendedor ficam salvos no aparelho na última vez em que houve internet. Offline, a vitrine abre com esses dados, indicando a data/hora da última atualização.
3. **Carrinho**: já é salvo no aparelho hoje; continua funcionando offline.
4. **Finalizar offline**: ao clicar em FINALIZAR PEDIDO sem conexão, o pedido inteiro (cliente, itens, pagamento, frete, observações) é gravado numa **fila local** e o usuário vê: "Você está offline. Pedido salvo e será enviado automaticamente quando a conexão voltar."
5. **Fila de envio**: painel "Pedidos pendentes de envio" com status (Na fila / Enviando / Enviado / Erro), botão **Tentar enviar agora** e opção de excluir. O envio dispara automaticamente ao voltar a conexão e ao abrir o app.
6. **Sem duplicidade**: cada pedido da fila recebe um identificador único; reenvios não geram pedido repetido.
7. **WhatsApp**: no fluxo de cliente, o WhatsApp só abre quando o pedido é realmente transmitido (não é possível abrir a conversa offline). No Modo Vendedor não há WhatsApp, então o fluxo fica 100% offline.

## Limitações honestas

- Só funciona se a loja já tiver sido aberta **pelo menos uma vez com internet** naquele aparelho/navegador.
- Preços, estoque e clientes ficam congelados na última sincronização; o pedido é enviado com os valores que estavam no aparelho.
- Estoque não é reservado offline; a checagem de "esgotado" usa o dado em cache.
- O número definitivo do pedido só é gerado na transmissão (offline mostra um número provisório).
- iPhone/Safari pode limpar dados de sites pouco usados após semanas; nesse caso é preciso abrir a loja online novamente.

## Detalhes técnicos

- **Service Worker** (`public/sw.js`): hoje apaga todos os caches no `activate` e só trata push. Passa a fazer precache do app shell (HTML/JS/CSS) com versionamento, `stale-while-revalidate` para imagens de produto e `network-first` com fallback de cache na navegação. O mecanismo `?limpar` em `src/main.tsx` e a auto-atualização de versão continuam funcionando.
- **Cache de dados**: persistência do React Query (`@tanstack/react-query-persist-client`) no `QueryClient` de `src/App.tsx`, com `gcTime` longo e `buster` por versão; cobre `useProducts`, `useCategories`, `useStores`, `useCustomerProfiles`.
- **Fila de pedidos**: novo `src/lib/offlineQueue.ts` (IndexedDB via `idb-keyval`, fallback em `localStorage`) guardando o mesmo payload usado hoje em `useCreateOrder`, mais `client_order_id` (UUID), `status`, `attempts`, `lastError`.
- **Idempotência**: nova coluna `client_order_id` em `orders` com índice único parcial por loja; o insert envia esse valor e trata conflito como "já enviado".
- **Sincronizador**: hook `useOfflineSync` disparado no evento `online`, no mount e periodicamente, processando a fila em série com backoff e invalidando `['orders']` ao concluir.
- **UI**: componente `OfflineBanner` (via `navigator.onLine` + eventos) na loja e no checkout; painel `PendingOrdersCard` acessível no checkout, no `SellerModeBar` e na aba Pedidos do admin.
- **Checkout** (`src/pages/CheckoutPage.tsx`): offline, `handleSendWhatsApp` grava na fila em vez de chamar `createOrder`, mostra o toast, limpa o carrinho e navega; online, comportamento atual inalterado.
- Escopo inicial: lojas de produtos (LOJA/ACESSORIOS). Mesa, cozinha e salão ficam fora por dependerem de tempo real.