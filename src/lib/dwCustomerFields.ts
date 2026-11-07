// Campos extras do cadastro do cliente no layout da view dw_cliente do ERP.
// Só aparecem no formulário de edição (lápis); a lista de clientes não muda.
export type DwField = { key: string; label: string; type?: 'text' | 'date' | 'number' | 'frete' | 'pfpj' };

export const DW_FIELD_GROUPS: { title: string; fields: DwField[] }[] = [
  { title: 'Identificação', fields: [
    { key: 'nome_fantasia', label: 'Nome fantasia' },
    { key: 'fisica_juridica', label: 'Pessoa', type: 'pfpj' },
    { key: 'rg', label: 'RG (pessoa física)' },
    { key: 'inscricao_municipal', label: 'Inscrição municipal' },
    { key: 'inscricao_rural', label: 'Inscrição rural' },
    { key: 'suframa', label: 'Suframa' },
    { key: 'cnae', label: 'CNAE' },
    { key: 'data_fundacao', label: 'Data de fundação', type: 'date' },
    { key: 'site', label: 'Site' },
    { key: 'tipo', label: 'Tipo (CL/AM)' },
    { key: 'situacao', label: 'Situação no ERP' },
  ]},
  { title: 'Contato', fields: [
    { key: 'telefone_geral_2', label: 'Telefone 2' },
    { key: 'email_nfe', label: 'E-mail para NF-e' },
  ]},
  { title: 'Comercial e frete', fields: [
    { key: 'frete_codigo', label: 'Tipo de frete', type: 'frete' },
    { key: 'condicao_pagamento_codigo', label: 'Condição de pagamento (código)' },
    { key: 'forma_pagamento_codigo', label: 'Forma de pagamento (código)' },
    { key: 'regiao_venda_codigo', label: 'Região de venda (código)' },
    { key: 'cliente_grupo_codigo', label: 'Grupo do cliente (código)' },
    { key: 'cliente_classificacao_codigo', label: 'Classificação (código)' },
    { key: 'total_limite_credito', label: 'Limite de crédito', type: 'number' },
  ]},
  { title: 'Fiscal', fields: [
    { key: 'grupo_tributario_codigo', label: 'Grupo tributário (código)' },
    { key: 'regime_tributario', label: 'Regime tributário' },
    { key: 'municipio_codigo_ibge', label: 'IBGE município' },
    { key: 'estado_codigo_ibge', label: 'IBGE estado' },
  ]},
  { title: 'Endereço de entrega (se diferente)', fields: [
    { key: 'endereco_entrega_rua', label: 'Rua' },
    { key: 'endereco_entrega_numero', label: 'Número' },
    { key: 'endereco_entrega_bairro', label: 'Bairro' },
    { key: 'endereco_entrega_complemento', label: 'Complemento' },
    { key: 'endereco_entrega_cep', label: 'CEP' },
    { key: 'endereco_entrega_cidade', label: 'Cidade' },
    { key: 'endereco_entrega_uf', label: 'UF' },
    { key: 'municipio_entrega_codigo_ibge', label: 'IBGE município entrega' },
    { key: 'estado_entrega_codigo_ibge', label: 'IBGE estado entrega' },
  ]},
  { title: 'Observação', fields: [{ key: 'observacao', label: 'Observação' }] },
];

export const DW_FIELD_KEYS = DW_FIELD_GROUPS.flatMap((g) => g.fields);

/** Normaliza o tipo de frete para CIF/FOB (aceita C/F, 1/2, CIF/FOB). */
export function normalizeFrete(v: unknown): 'CIF' | 'FOB' | '' {
  const s = String(v ?? '').trim().toUpperCase();
  if (!s) return '';
  if (s === 'CIF' || s === 'C' || s === '0' || s === '1') return 'CIF';
  if (s === 'FOB' || s === 'F' || s === '2') return 'FOB';
  return '';
}

export function dwFormFromRow(row: any): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of DW_FIELD_KEYS) out[f.key] = row?.[f.key] == null ? '' : String(row[f.key]);
  return out;
}

export function dwUpdateFromForm(form: Record<string, string>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of DW_FIELD_KEYS) {
    const v = (form[f.key] ?? '').trim();
    if (f.type === 'number') out[f.key] = v === '' ? null : Number(v.replace(',', '.')) || 0;
    else if (f.type === 'frete') out[f.key] = normalizeFrete(v) || null;
    else out[f.key] = v === '' ? null : v;
  }
  return out;
}
