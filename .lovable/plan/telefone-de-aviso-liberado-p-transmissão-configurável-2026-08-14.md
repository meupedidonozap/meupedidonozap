# Telefone de aviso "Liberado p/ Transmissão" configurável

## O problema

O número de WhatsApp usado quando um pedido vai para o status "Liberado p/ Transmissão" **não vem da configuração da loja**. Ele está fixo no código (`5547992491139`), no diálogo "Liberar pedido para o ERP" do painel administrativo. Por isso, alterar o WhatsApp da loja DiColore em Configurações não muda nada nesse aviso.

## O que será feito

1. Novo campo em **Configurações** da loja: "WhatsApp para aviso de transmissão (ERP)", com dica de formato (DDI+DDD+número, ex.: 5547992491139) e texto explicando que é para onde vai a mensagem quando o pedido é liberado.
2. O diálogo de liberação passa a usar esse número. Se o campo estiver vazio, usa o número atual como padrão, para não quebrar o funcionamento existente.
3. O campo é salvo junto com as demais configurações da loja, valendo por loja (DiColore pode ter um número diferente das outras).

## Detalhes técnicos

- `src/types/index.ts`: adicionar `erpReleaseWhatsapp?: string` em `StoreSettings`.
- `src/pages/StoreAdminPage.tsx`:
  - novo estado `erpWhatsapp`, inicializado de `store.settings.erpReleaseWhatsapp`, incluído em `handleSaveSettings`;
  - input na aba Configurações (exibido para a loja com fluxo ERP, mesma regra do gatilho atual `slug === 'dicolore'`, mais `dicoloresenses` se aplicável);
  - no `AlertDialogAction` de "Liberar pedido para o ERP", trocar o número fixo por `(store.settings.erpReleaseWhatsapp || '5547992491139').replace(/\D/g,'')`, mantendo a abertura síncrona do `window.open` (necessária no iOS).
