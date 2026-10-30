## O arquivo novo está certo: o "v16" é só um texto que esqueci de atualizar

A mensagem "v16: conectando ao ERP..." está escrita fixa no script e não mudou quando a versão passou a ser v17. O arquivo que você colocou na pasta já é o novo, com grupos de 20 pedidos e os monitores de Títulos e Boletos.

### Como confirmar agora
Deixe rodando. As próximas linhas devem mostrar grupos de **20** pedidos, por exemplo "Lote 1 (20/1179 códigos ...)", e quase nenhum "excederam ... dividindo em 2".

### Correção
- Trocar o texto da mensagem inicial para "v17" em `scripts/dicolore/sync_dicolore_financeiro_v5.py`.
- Enviar o arquivo completo de novo. Trocar é opcional, porque só muda o texto mostrado na tela.
