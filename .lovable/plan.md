# Aviso de transmissão (WhatsApp) na DiColore SENSES

## Causa

O gatilho que abre a janela de confirmação "Liberar pedido para o ERP" está restrito a uma única loja. No painel, ao mudar o status para "Liberado p/ Transmissão", o diálogo (e o envio ao WhatsApp) só dispara quando o slug da loja é `dicolore`. Na SENSES o status é alterado direto, sem diálogo e sem mensagem.

O card de Configurações "Aviso de Transmissão (ERP)" já aparece nas duas lojas, e o diálogo já usa o número configurado da loja — só falta ativar o gatilho na SENSES.

## O que muda

- Na DiColore SENSES, ao mudar o status de um pedido para "Liberado p/ Transmissão", passa a abrir a mesma janela de confirmação da DiColore, com as opções Cancelar / Não / Sim.
- Ao clicar em "Sim", abre o WhatsApp com a mensagem do pedido, usando o número configurado em Configurações → Aviso de Transmissão (ERP) da própria SENSES.
- Nada muda nas demais lojas nem no comportamento atual da DiColore.

## Detalhes técnicos

Arquivo: `src/pages/StoreAdminPage.tsx`, linha ~1480.

Trocar `store.slug === 'dicolore' && value === 'liberado_transmissao'` por uma checagem com a lista `['dicolore','dicoloresenses']` (reaproveitando o padrão já usado em `usesSellerRule`). O `AlertDialog` (linhas ~3067-3128) e o fallback de número permanecem inalterados.
