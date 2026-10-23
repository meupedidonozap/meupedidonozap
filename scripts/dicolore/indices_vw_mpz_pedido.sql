-- Acelera a view vw_mpz_pedido (e o DW) criando índices nas tabelas que ela consulta por pedido.
-- NÃO altera nenhum dado nem a view. Rode no banco do ERP (PostgreSQL) com o usuário dono das tabelas.
-- IMPORTANTE: CREATE INDEX CONCURRENTLY não pode rodar dentro de transação.
-- No pgAdmin/DBeaver, execute UM comando por vez (selecione a linha e execute), com auto-commit ligado.

-- PASSO 1 (só leitura) - MEDIÇÃO: mostra onde o tempo é gasto em 1 pedido. Guarde o resultado.
EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM vw_mpz_pedido WHERE codigo_importacao = '722199';

-- PASSO 2 - ÍNDICES (cada um pode levar alguns minutos; o ERP continua funcionando normalmente).
CREATE INDEX CONCURRENTLY IF NOT EXISTS mpz_ve0091_emp_ped   ON ve0091 (ordempcod, ordped);
CREATE INDEX CONCURRENTLY IF NOT EXISTS mpz_ve009_emp_pedcod ON ve009  (ordempcod, ordpedcod);
CREATE INDEX CONCURRENTLY IF NOT EXISTS mpz_pe0011_emp_ped   ON pe0011 (pedempcod, pedcod);
CREATE INDEX CONCURRENTLY IF NOT EXISTS mpz_pe001_datemi     ON pe001  (peddatemi);

-- PASSO 3 - ESTATÍSTICAS (rápido; ajuda o banco a usar os índices novos).
ANALYZE ve0091;
ANALYZE ve009;
ANALYZE pe0011;
ANALYZE pe001;

-- PASSO 4 (só leitura) - CONFERÊNCIA: compare o "Execution Time" com o do PASSO 1.
EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM vw_mpz_pedido WHERE codigo_importacao = '722199';

-- Para desfazer (se um dia precisar), é só remover os índices; nada mais muda:
-- DROP INDEX CONCURRENTLY IF EXISTS mpz_ve0091_emp_ped;
-- DROP INDEX CONCURRENTLY IF EXISTS mpz_ve009_emp_pedcod;
-- DROP INDEX CONCURRENTLY IF EXISTS mpz_pe0011_emp_ped;
-- DROP INDEX CONCURRENTLY IF EXISTS mpz_pe001_datemi;
