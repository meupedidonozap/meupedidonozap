-- Corrige vw_mpz_pedido: cliente_codigo passa a vir de ve001a.clicod
-- Rode no banco do ERP (PostgreSQL) com usuário dono da view.

-- PASSO 1 - BACKUP: copie e guarde o resultado desta consulta.
SELECT pg_get_viewdef('vw_mpz_pedido'::regclass, true) AS definicao_atual;

-- PASSO 2 - TROCA AUTOMÁTICA: substitui apenas a expressão "... AS cliente_codigo".
-- Se aparecer erro, NADA é alterado: mande o resultado do PASSO 1 para ajuste manual.
DO $$
DECLARE
  v_def text := pg_get_viewdef('vw_mpz_pedido'::regclass, true);
  v_new text;
BEGIN
  IF v_def !~* '\mve001a\M' THEN
    RAISE EXCEPTION 'A view não usa a tabela ve001a com esse nome/alias. Envie a definição do PASSO 1.';
  END IF;
  v_new := regexp_replace(v_def,
    '([,(\s])[^,]*?\s+AS\s+cliente_codigo\M',
    '\1 btrim(ve001a.clicod::text) AS cliente_codigo', 'i');
  IF v_new = v_def THEN
    RAISE EXCEPTION 'Coluna cliente_codigo não encontrada. Envie a definição do PASSO 1.';
  END IF;
  EXECUTE 'CREATE OR REPLACE VIEW vw_mpz_pedido AS ' || v_new;
  RAISE NOTICE 'View atualizada.';
END $$;

-- PASSO 3 - CONFERÊNCIA: deve retornar 94967.
SELECT codigo_importacao, cliente_codigo FROM vw_mpz_pedido WHERE codigo_importacao::text = '98855';
