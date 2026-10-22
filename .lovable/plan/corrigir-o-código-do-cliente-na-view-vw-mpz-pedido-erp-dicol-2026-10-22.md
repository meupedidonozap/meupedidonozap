# Corrigir o código do cliente na view vw_mpz_pedido (ERP DiColore)

## Objetivo
Fazer a view do ERP devolver em `cliente_codigo` o valor de **ve001a.clicod** (ex.: 94967), em vez do código interno (ex.: `627cdd9bd10f6`). Assim os 650 pedidos restantes passam a aparecer para os vendedores certos.

## O que será entregue
1. Um script SQL pronto (`scripts/dicolore/corrigir_vw_mpz_pedido.sql`) que:
   - mostra a definição atual da view (para backup);
   - recria a view mantendo todas as colunas e a ordem atuais, trocando só a origem de `cliente_codigo` para `ve001a.clicod::text` (sem espaços).
2. Um passo no script Python para, depois da troca, reenviar o histórico (pedidos com código errado), sem alterar itens nem preços.
3. Instruções curtas no LEIA-ME: fazer backup, executar o SQL no banco do ERP, rodar a ressincronização.

## Ponto de atenção
Não tenho acesso ao banco do ERP, então não consigo ver o texto atual da view. O script vai começar exibindo a definição atual; se a troca automática não servir, você me cola esse texto e eu devolvo a view final exata.

## Validação
- Consulta no ERP: `SELECT codigo_importacao, cliente_codigo FROM vw_mpz_pedido WHERE codigo_importacao = '98855'` deve retornar 94967.
- Depois da ressincronização, conferir na nuvem que não restam pedidos com código de cliente não numérico.
