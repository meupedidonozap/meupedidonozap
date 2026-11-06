# Estoque ERP: ler a chave dos mesmos arquivos dos outros monitores

## Situação
O monitor de títulos já funciona e procura a chave em 4 arquivos: `dicolore.env`, `.env`, `importacao\importacao.env` e `importacao.env`. A chave provavelmente está no `importacao.env`. O novo monitor de estoque procura só no `.env`, por isso não a encontra.

## Mudança
- `scripts/dicolore/sync_estoque_erp.py`: ler os mesmos 4 arquivos, na mesma ordem do monitor de títulos (inclusive os dados de acesso ao ERP).
- A mensagem de erro passa a listar os arquivos onde a chave foi procurada.
- Enviar o arquivo completo para substituir `S:\denis\integration\mpz\automação dicolore\sync_estoque_erp.py`.

## Depois
Executar `python sync_estoque_erp.py --dry-run` (sem criar nem alterar nenhum arquivo .env).
