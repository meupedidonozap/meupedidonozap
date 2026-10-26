# Exigir código do cliente para baixar XML: opção por loja

## O que muda
- Hoje o painel bloqueia o download do XML (individual e em lote) quando o cliente não tem código do ERP — em **todas** as lojas.
- Nova opção em **Configurações** da loja: **"Usar código do cliente para baixar arquivo?" Sim / Não**.
  - **DiColore:** padrão **Sim** (mantém a regra atual).
  - **Senses e demais lojas:** padrão **Não** — o XML volta a ser baixado manualmente como antes, mesmo sem código.
- Quando estiver "Não", o arquivo sai normalmente com os dados do pedido/cadastro (campo de código fica vazio se não houver).

## Detalhes técnicos
- Nova chave `settings.requireCustomerCodeForDownload` (boolean). Leitura: valor salvo; se ausente, `true` só para slug `dicolore`, `false` para as demais.
- `src/pages/StoreAdminPage.tsx`: os dois bloqueios (`runBulkDownload` e diálogo de download) passam a checar essa opção antes de `orderErpCustomerCode`.
- Switch Sim/Não adicionado no cartão de configurações da loja, salvo em `settings`.
- Sem mudança no banco (settings já é JSON). Não altera a transmissão automática da DiColore.
