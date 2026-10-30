# Painel do Televendas sem dados — correção

## O que encontrei
- O cadastro está certo: Denise tem código ERP **9** e atende os vendedores 293, 32, 4, 128, 68, 179, 306, 127. Grazi tem código 5.
- O painel está programado certo, mas o banco só tem **7 pedidos** marcados como televendas (todos de 29 e 30/10). Os outros ~940 pedidos de outubro foram gravados antes da mudança e não têm a marca "pedido do televendas" nem o código da operadora.
- O relatório do ERP que você enviou (RTV307A) conta por **Nota Fiscal faturada**: Denise = R$ 78.299,86 em outubro. O painel hoje conta por pedido emitido, então mesmo com os dados completos os números não bateriam com esse relatório.

## O que vou fazer
1. **Recarregar outubro inteiro com a marca de televendas**: ajustar o script do ERP para aceitar `--somente-pedidos --desde 2026-10-01`, regravando todos os pedidos do período com `pedtelven` e `pedotvcod`. Envio o arquivo completo para copiar no computador do ERP e o comando exato.
2. **Monitor diário**: garantir que o monitor de pedidos sempre grave a marca de televendas (já grava nos novos; confirmo que a atualização de pedidos antigos também passa por isso).
3. **Painel do Televendas baseado em Notas Fiscais** (igual ao relatório RTV307A):
   - "Faturado pelo televendas": notas cujo pedido foi emitido pela operadora (liga NF → pedido → `pedotvcod`).
   - "Total da carteira": todas as notas dos vendedores que ela atende.
   - Barras mostrando a parte dela dentro de cada vendedor, Top 10 clientes e Top 20 produtos.
   - Mantém também o quadro de "Pedidos emitidos" (o que ela digitou, faturado ou não).
4. **Aviso na tela**: quando não houver pedidos marcados no período, mostrar "Pedidos do televendas ainda não sincronizados — rode a atualização de pedidos" em vez de zeros.
5. Conferir no banco que Denise em outubro fica em R$ 78.299,86.

## Detalhes técnicos
- Script `scripts/dicolore/sync_dicolore_financeiro_v5.py`: novo parâmetro `--desde`, reaproveitando `enrich_televendas` em lotes; teste novo em `test_sync_pedidos.py`.
- `ResultsDrilldown.tsx` (modo tv): buscar `customer_invoices` dos `sellerCodes`, juntar com `erp_orders` por `filial|pedido_codigo` para saber `televendas_codigo`; teste para a regra de separação operadora × carteira.
- Sem mudanças de banco.
