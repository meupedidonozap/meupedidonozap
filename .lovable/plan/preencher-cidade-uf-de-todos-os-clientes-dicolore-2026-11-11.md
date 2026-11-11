# Preencher Cidade/UF de todos os clientes DiColore

## Situação confirmada
- 15.722 de 15.779 clientes DiColore estão sem cidade e 15.720 sem UF no MPZ.
- Só quem já passou pelo checkout (ex.: 86553 JOICELI, pedido #744) ganhou cidade/UF — a correção anterior preenche na hora do pedido, por isso apareceu a escolha de Estado/Cidade.
- A view enviada `vw_mpz_clientes` já traz `uf` (a.cliest) e `cidade` (c.cidnom) em texto.

## O que será feito
1. **Integrador de clientes** (`scripts/dicolore/sync_clientes_erp.py`): ler `cidade` e `uf` da `vw_mpz_clientes` (junto com a `dw_cliente`) e enviá-los ao MPZ; um cliente sem cidade/UF no MPZ passa a ser considerado "alterado" e é reenviado.
2. **Recebimento** (`sync-customers`): gravar cidade/UF recebidos do ERP em clientes já cadastrados, sem mexer em tabela de preço/vendedor ajustados no MPZ.
3. **Carga imediata da base**: preencher agora, no banco, cidade/UF pelo CEP para os ~15.000 clientes com CEP válido (lote único), para não depender da próxima rodada do monitor.
4. **Checkout**: não pedir Estado/Cidade quando o cadastro já tiver os dados; o seletor só aparece se nem cadastro nem CEP resolverem.
5. Testes do integrador atualizados (cidade/UF enviados e reenvio de cadastros incompletos); entrego o caminho e o código completo do script para copiar e colar.

## Escopo
Somente DiColore; JEWOS, SENSES e demais lojas não mudam.
