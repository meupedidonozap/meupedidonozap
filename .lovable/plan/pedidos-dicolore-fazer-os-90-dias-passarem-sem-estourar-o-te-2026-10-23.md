# Pedidos DiColore: fazer os 90 dias passarem (sem estourar o tempo)

## Por que demorou mais de 5 minutos

A consulta em si é simples, mas a view `vw_mpz_pedido` calcula, **para cada pedido**, de 5 a 6 subconsultas nas tabelas de faturamento (`ve0091`/`ve009`) e de itens (`pe0011`): status, OF, NF, data de faturamento, valor faturado, saldo. Quando a busca é por **um pedido**, isso roda uma vez só e é rápido. Em 90 dias (cerca de 1.700 pedidos), roda milhares de vezes. Se essas tabelas não têm índice pelo número do pedido, cada subconsulta lê a tabela inteira. Com isso a consulta única passa de 300 s e **nada é gravado**, porque o envio só começa depois que a leitura termina.

Ainda não temos a medição do servidor do ERP, então essa causa não está confirmada. O passo 3 confirma.

## O que vai mudar

### 1. Script: ler em lotes pequenos e gravar cada lote na hora (sem mexer no ERP)
Arquivo: `scripts/dicolore/sync_dicolore_financeiro_v5.py` (v14)

- **Etapa A (leve):** busca só a lista de códigos dos pedidos do período direto na tabela de pedidos, com os mesmos filtros da view (filial 1, sem pedidos de mostruário). Leva poucos segundos.
- **Etapa B:** consulta a view em lotes de **50 códigos** (`codigo_importacao = ANY(...)`). Cada lote é enviado e confirmado pela nuvem antes de ir para o próximo.
- Cada lote tem um tempo limite próprio (padrão 120 s). Se um lote estourar, ele é dividido em lotes menores; se ainda assim falhar, é pulado e anotado, e a leitura continua.
- O log mostra o progresso: `Lote 7/34: 50 pedidos em 6,2s, gravados`. Se cair no meio, o que já foi enviado fica gravado.
- Esse passa a ser o padrão de `--dias`. A consulta única antiga continua disponível com `--consulta-unica`, e o modo dia a dia com `--por-dia`.
- `--pedido` e `--pendentes` continuam como estão.
- Novas opções: `--lote N` (padrão 50) e `--timeout-lote S` (padrão 120).

### 2. Testes
Em `scripts/dicolore/test_sync_pedidos.py`:
- 120 códigos com lote de 50 geram 3 consultas (50, 50 e 20).
- Um lote que estoura o tempo é dividido e os demais lotes continuam.
- `--consulta-unica` mantém uma única consulta.

### 3. Opcional e recomendado: índices no banco do ERP (ajuste definitivo)
Novo arquivo: `scripts/dicolore/indices_vw_mpz_pedido.sql`. Você mesmo roda, quando quiser.

- **Passo 1 (só leitura):** `EXPLAIN ANALYZE` de um pedido, para medir onde o tempo é gasto.
- **Passo 2:** `CREATE INDEX CONCURRENTLY IF NOT EXISTS` em:
  - `ve0091 (ordempcod, ordped)`
  - `ve009 (ordempcod, ordpedcod)`
  - `pe0011 (pedempcod, pedcod)`
  - `pe001 (peddatemi)`
- Índice não altera nenhum dado nem a view. `CONCURRENTLY` não trava o ERP enquanto o índice é criado. Também acelera o DW e o monitor.

## Como rodar depois

```text
cd /d "S:\denis\integration\mpz\automação dicolore"
python sync_dicolore_financeiro_v5.py --somente-pedidos --dias 90
```

Você vai ver a lista de códigos, depois os lotes sendo gravados um a um. A Adriana (293) deve passar a mostrar os 46 pedidos do DW.

## Entrega
Como você pediu, vou enviar no chat o caminho exato e o código completo de `sync_dicolore_financeiro_v5.py` e de `indices_vw_mpz_pedido.sql`, prontos para copiar e colar.

## Detalhes técnicos
- Etapa A: `SELECT pedcod::text FROM pe001 WHERE peddatemi >= %s AND peddatemi < %s AND pedmcpcod <= 0 AND pedempcod::text = '1' ORDER BY peddatemi DESC`, só leitura e com o mesmo `statement_timeout` da sessão.
- O `statement_timeout` de cada lote é aplicado com `SET LOCAL` dentro de uma transação só de leitura. A conexão continua em modo somente leitura.
- `normalize_order` e o `post()` com confirmação de `ordersUpserted` continuam iguais. A gravação é idempotente (chave `filial|pedcod`), então rodar de novo é seguro.
- `mark_missing` continua sendo usado só nos modos `--pedido` e `--pendentes`. A busca por período nunca exclui nada.
