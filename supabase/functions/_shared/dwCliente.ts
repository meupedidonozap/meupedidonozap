// Monta o cliente no layout da view dw_cliente do ERP (mesmos nomes de atributos).
const d = (v: unknown) => String(v ?? "").replace(/\D/g, "");
const s = (v: unknown) => (v == null ? "" : String(v));

// Código exato do ERP (ve001a.clifrepag / pe001.pedfrepag): "0" = CIF, "1" = FOB.
export function normalizeFrete(v: unknown): "0" | "1" | "" {
  const x = String(v ?? "").trim().toUpperCase();
  if (x === "0" || x === "CIF" || x === "C") return "0";
  if (x === "1" || x === "FOB" || x === "F") return "1";
  return "";
}

export function toDwCliente(c: any) {
  const doc = d(c.cpf_cnpj);
  const pj = c.fisica_juridica ? c.fisica_juridica === "1" : doc.length === 14;
  const ie = s(c.ie).trim();
  return {
    id_mpz: c.id,
    codigo: s(c.customer_code),
    vendedor_codigo: s(c.seller_code),
    razao_social: s(c.name),
    nome_fantasia: s(c.nome_fantasia) || s(c.name),
    cnpj: doc,
    rg: pj ? "" : d(c.rg),
    fisica_juridica: pj ? "1" : "0",
    inscricao_estadual: pj && ie && ie.toUpperCase() !== "ISENTO" ? d(ie) : "ISENTO",
    inscricao_municipal: s(c.inscricao_municipal),
    inscricao_rural: s(c.inscricao_rural),
    suframa: s(c.suframa),
    data_fundacao: c.data_fundacao ?? null,
    site: s(c.site),
    tipo: s(c.tipo) || "CL",
    telefone_geral_1: d(c.whatsapp),
    telefone_geral_2: d(c.telefone_geral_2),
    email_nfe: s(c.email_nfe),
    endereco_rua: s(c.address),
    endereco_numero: s(c.number),
    endereco_bairro: s(c.neighborhood),
    endereco_cep: d(c.cep),
    endereco_complemento: s(c.complement),
    endereco_cidade: s(c.city),
    endereco_uf: s(c.uf),
    situacao: s(c.situacao) || "A",
    municipio_codigo_ibge: s(c.municipio_codigo_ibge),
    estado_codigo_ibge: s(c.estado_codigo_ibge),
    endereco_entrega_rua: s(c.endereco_entrega_rua) || s(c.address),
    endereco_entrega_numero: s(c.endereco_entrega_numero) || s(c.number),
    endereco_entrega_bairro: s(c.endereco_entrega_bairro) || s(c.neighborhood),
    endereco_entrega_cep: d(c.endereco_entrega_cep) || d(c.cep),
    endereco_entrega_complemento: s(c.endereco_entrega_complemento) || s(c.complement),
    endereco_entrega_cidade: s(c.endereco_entrega_cidade) || s(c.city),
    endereco_entrega_uf: s(c.endereco_entrega_uf) || s(c.uf),
    municipio_entrega__codigo_ibge: s(c.municipio_entrega_codigo_ibge) || s(c.municipio_codigo_ibge),
    estado_entrega__codigo_ibge: s(c.estado_entrega_codigo_ibge) || s(c.estado_codigo_ibge),
    data_cadastro: s(c.created_at).slice(0, 10),
    observacao: s(c.observacao),
    status: "4",
    cliente_grupo_codigo: s(c.cliente_grupo_codigo),
    cliente_classificacao_codigo: s(c.cliente_classificacao_codigo),
    regiao_venda_codigo: s(c.regiao_venda_codigo),
    tabela_preco_codigo: c.price_table == null ? "" : String(c.price_table),
    condicao_pagamento_codigo: s(c.condicao_pagamento_codigo),
    transportadora_codigo: s(c.transportadora),
    frete_codigo: normalizeFrete(c.frete_codigo),
    total_limite_credito: c.total_limite_credito == null ? null : Number(c.total_limite_credito),
    grupo_tributario_codigo: s(c.grupo_tributario_codigo),
    regime_tributario: s(c.regime_tributario),
    forma_pagamento_codigo: s(c.forma_pagamento_codigo),
    cnae: s(c.cnae),
    latitude: c.geo_lat ?? 0,
    longitude: c.geo_lng ?? 0,
    isento_ipi: "0", isento_st: "0", isento_icms: "0",
    situacao_mpz: s(c.approval_status),
    ultimo_erro: c.erp_error ?? null,
    criado_em: c.created_at,
  };
}
