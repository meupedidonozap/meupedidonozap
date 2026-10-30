## Não é erro: a atualização de pedidos está funcionando, só que lenta

O log mostra que os pedidos estão sendo lidos e gravados (lotes 2 e 3 "gravados"). A mensagem "excederam 120s; dividindo em 2" é a proteção automática: quando um grupo de 50 pedidos demora demais no ERP, o script divide o grupo e continua.

O problema é o tempo: cada grupo de 50 perde 2 minutos antes de ser dividido. Com 1179 pedidos, isso leva cerca de 1h30.

### O que fazer agora (sem trocar arquivo)
Pode deixar o comando atual terminar. Ou feche a janela e rode com grupos menores, que não estouram o limite:

```text
cd /d "S:\denis\integration\mpz\automação dicolore"
python sync_dicolore_financeiro_v5.py --somente-pedidos --dias 31 --lote 20 --timeout-lote 180
```

Os pedidos já gravados não se perdem nem são duplicados.

### Atenção
O log mostra "v16", ou seja, o arquivo do computador do ERP ainda é a versão anterior. Para ter os monitores de Títulos e Boletos, troque pelo arquivo v17 enviado antes.

### Mudança opcional no código (se aprovar)
Mudar o tamanho padrão do grupo de 50 para 20 em `scripts/dicolore/sync_dicolore_financeiro_v5.py`, para o monitor diário não perder tempo dividindo grupos. Envio o arquivo completo depois.
