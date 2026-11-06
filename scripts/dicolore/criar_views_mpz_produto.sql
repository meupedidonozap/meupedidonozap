-- Views do MPZ no banco do ERP (mesmo conceito do DW, sem alterar dw_produto / dw_produto_estoque).
-- Rode no pgAdmin conectado ao banco do ERP.

CREATE OR REPLACE VIEW public.mpz_produto AS
 SELECT es001.procod::character varying(60) AS codigo,
    es001.pronom::character varying(100) AS descricao,
    es001.prouniven::character varying(10) AS unidade,
    COALESCE(es001.procvsven, 1::numeric)::double precision AS fator_conversor,
    es001.proncm::character varying(15) AS ncm,
    es001.propesbru::double precision AS peso,
    COALESCE(es001.proipi::real, 0::real) AS percentual_ipi,
    es001.proprecus::double precision AS preco_base,
    es001.grpcod::character varying(60) AS grupo_codigo,
    es001.procatcod::character varying(120) AS categoria,
    es001.procest::character varying(9) AS cest,
    es001.proati AS ativo
   FROM es001
  WHERE es001.proclassi = ANY (ARRAY['P'::bpchar, 'C'::bpchar])
    AND es001.proenvpalm = 1;

CREATE OR REPLACE VIEW public.mpz_produto_estoque AS
 SELECT es006.posempcod::character varying(60) AS filial_codigo,
    es006.pospro::character varying(60) AS produto_codigo,
    es006.possal::double precision AS saldo,
    (es006.possal - (( SELECT COALESCE(sum(pe0011.pedqtdsal), 0::numeric)
           FROM pe001
             JOIN pe0011 USING (pedempcod, pedcod)
          WHERE pe001.pedempcod = 1 AND pe0011.procod = es006.pospro
            AND pe001.pedfat <> 'S'::bpchar AND pe001.pedmcpcod <= 0
            AND pe0011.pedqtdsal > 0::numeric AND pe001.pedclasse = 'P'::bpchar
            AND pe001.pedlib <> 'N'::bpchar AND pe0011.peddepcod = 1)))::double precision AS quantidade_disponivel
   FROM es006
     JOIN es001 ON es006.pospro = es001.procod
  WHERE (es001.proclassi = ANY (ARRAY['P'::bpchar, 'C'::bpchar]))
    AND es001.proati = 'A'::bpchar AND es001.proenvpalm = 1
    AND es006.posdepcod = 1 AND es006.posempcod = 1;

GRANT SELECT ON public.mpz_produto TO automacao_dicolore;
GRANT SELECT ON public.mpz_produto_estoque TO automacao_dicolore;

-- Conferência (deve dar 5637 para o PRETO COLOR CREME 60G):
SELECT * FROM public.mpz_produto_estoque WHERE produto_codigo = '7898418090019';
