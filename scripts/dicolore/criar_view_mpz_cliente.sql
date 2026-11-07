-- View do MPZ no banco do ERP: clientes no mesmo layout da dw_cliente (sem alterar a dw_cliente).
-- Rode no pgAdmin conectado ao banco do ERP, com o usuário postgres.

CREATE OR REPLACE VIEW public.mpz_cliente AS
 SELECT
    CASE WHEN NULLIF(btrim(c.clicodext::text), '') IS NOT NULL
         THEN btrim(c.clicodext::text) ELSE c.clicod::text END::character varying(60) AS codigo,
    c.clirepcod::character varying(60)                                   AS vendedor_codigo,
    c.clirazsoc::character varying(160)                                  AS razao_social,
    COALESCE(NULLIF(btrim(c.clinomfan::text), ''), c.clirazsoc::text)::character varying(160) AS nome_fantasia,
    regexp_replace(COALESCE(c.clicgccpf::text, ''), '[^0-9]', '', 'g')::character varying(14) AS cnpj,
    c.clipes::character varying(1)                                       AS fisica_juridica,
    COALESCE(NULLIF(btrim(c.cliinsest::text), ''), 'ISENTO')::character varying(30) AS inscricao_estadual,
    c.clisuf::character varying(30)                                      AS suframa,
    c.clicla::character varying(10)                                      AS tipo,
    regexp_replace(COALESCE(c.clicel::text, ''), '[^0-9]', '', 'g')::character varying(35) AS telefone_geral_1,
    regexp_replace(COALESCE(c.clifon::text, ''), '[^0-9]', '', 'g')::character varying(35) AS telefone_geral_2,
    c.cliemanfe::character varying(120)                                  AS email_nfe,
    c.cliend::character varying(90)                                      AS endereco_rua,
    c.cliendnum::character varying(60)                                   AS endereco_numero,
    c.clibai::character varying(100)                                     AS endereco_bairro,
    regexp_replace(COALESCE(c.clicep::text, ''), '[^0-9]', '', 'g')::character varying(9) AS endereco_cep,
    c.cliendcom::character varying(80)                                   AS endereco_complemento,
    (SELECT ci.cidnom FROM ve026 ci WHERE ci.cidcod = c.cidcod LIMIT 1)::character varying(80) AS endereco_cidade,
    c.cliest::character varying(2)                                       AS endereco_uf,
    c.clisit::character varying(1)                                       AS situacao,
    e.cliendent::character varying(90)                                   AS endereco_entrega_rua,
    e.cliendentn::character varying(60)                                  AS endereco_entrega_numero,
    e.clibaient::character varying(100)                                  AS endereco_entrega_bairro,
    regexp_replace(COALESCE(e.clicepent::text, ''), '[^0-9]', '', 'g')::character varying(9) AS endereco_entrega_cep,
    e.clicoment::character varying(80)                                   AS endereco_entrega_complemento,
    e.clicidentc::character varying(80)                                  AS endereco_entrega_cidade,
    e.cliestent::character varying(2)                                    AS endereco_entrega_uf,
    c.grempcod::character varying(60)                                    AS cliente_grupo_codigo,
    c.cliclassi::character varying(60)                                   AS cliente_classificacao_codigo,
    c.cliregcod::character varying(60)                                   AS regiao_venda_codigo,
    c.clitabpre::character varying(60)                                   AS tabela_preco_codigo,
    c.clitvecod::character varying(60)                                   AS condicao_pagamento_codigo,
    c.clicobcod::character varying(60)                                   AS forma_pagamento_codigo,
    c.clitracod::character varying(60)                                   AS transportadora_codigo,
    c.clifrepag::character varying(60)                                   AS frete_codigo,  -- exato do ERP: 0 = CIF, 1 = FOB
    c.clilimcre::double precision                                        AS total_limite_credito,
    c.clinatcod::character varying(60)                                   AS grupo_tributario_codigo,
    c.cliregtri::character varying(10)                                   AS regime_tributario,
    c.clicnae::character varying(20)                                     AS cnae
   FROM ve001a c
   LEFT JOIN ve001d e ON e.clicod = c.clicod
  WHERE c.clicla = ANY (ARRAY['CL'::bpchar, 'AM'::bpchar]);

GRANT SELECT ON public.mpz_cliente TO automacao_dicolore;

-- Conferência:
SELECT codigo, razao_social, vendedor_codigo, tabela_preco_codigo, frete_codigo, endereco_cidade
  FROM public.mpz_cliente WHERE codigo = '92751';
SELECT frete_codigo, count(*) FROM public.mpz_cliente GROUP BY 1;
