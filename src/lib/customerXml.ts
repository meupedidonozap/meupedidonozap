// Gera XML do cadastro de cliente no layout da view dw_cliente do ERP.
// Campos conhecidos no MPZ são preenchidos; os demais seguem vazios.
const FIELDS = [
  'codigo','vendedor_codigo','razao_social','nome_fantasia','cnpj','rg','fisica_juridica','inscricao_estadual',
  'inscricao_municipal','inscricao_rural','suframa','data_fundacao','tipo','telefone_geral_1','telefone_geral_2',
  'email_nfe','endereco_rua','endereco_numero','endereco_bairro','endereco_cep','endereco_complemento','situacao',
  'municipio_codigo_ibge','estado_codigo_ibge','endereco_entrega_rua','endereco_entrega_numero','endereco_entrega_bairro',
  'endereco_entrega_cep','endereco_entrega_complemento','municipio_entrega__codigo_ibge','estado_entrega__codigo_ibge',
  'data_cadastro','hora_cadastro','observacao','status','codigo_importacao','cliente_grupo_codigo',
  'cliente_classificacao_codigo','validade_classificacao','regiao_venda_codigo','tabela_preco_codigo',
  'condicao_pagamento_codigo','transportadora_codigo','frete_codigo','vencimento_credito','total_limite_credito',
  'total_credito_disponivel','total_titulos_aberto','total_titulos_vencidos','vencimento_titulo','data_ultimo_contato',
  'data_ultima_compra','isento_ipi','isento_st','isento_icms','percentual_carga_media','grupo_tributario_codigo',
  'evento_codigo','data_importacao','hora_importacao','regime_tributario','aceita_pendencia','data_ultima_nao_venda',
  'forma_pagamento_codigo','erro_integracao','cnae','sexo','latitude','longitude','nicho_mercado_codigo',
  'segmento_1_codigo','segmento_2_codigo','maior_atraso_titulos','media_atraso_titulos','valor_atraso_titulos',
  'raio_checkin','dia_atendimento','hora_atendimento','ciclo_compra','data_ultimo_orcamento',
];

const esc = (v: unknown) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const digits = (v: unknown) => String(v ?? '').replace(/\D/g, '');

export function buildCustomerXml(c: any): string {
  const doc = digits(c?.cpfCnpj);
  const pj = doc.length === 14;
  const today = new Date().toISOString().slice(0, 10);
  const v: Record<string, unknown> = {
    codigo: c?.customerCode || '',
    vendedor_codigo: c?.sellerCode || '',
    razao_social: c?.name || '',
    nome_fantasia: c?.name || '',
    cnpj: doc,
    fisica_juridica: doc ? (pj ? '1' : '0') : '',
    inscricao_estadual: pj ? (c?.ie || 'ISENTO') : 'ISENTO',
    tipo: 'CL',
    telefone_geral_1: digits(c?.whatsapp),
    telefone_geral_2: digits(c?.whatsapp),
    endereco_rua: c?.address || '',
    endereco_numero: c?.number || '',
    endereco_bairro: c?.neighborhood || '',
    endereco_cep: digits(c?.cep),
    endereco_complemento: c?.complement || '',
    situacao: 'A',
    endereco_entrega_rua: c?.address || '',
    endereco_entrega_numero: c?.number || '',
    endereco_entrega_bairro: c?.neighborhood || '',
    endereco_entrega_cep: digits(c?.cep),
    endereco_entrega_complemento: c?.complement || '',
    data_cadastro: today,
    hora_cadastro: '00:00:00',
    observacao: [c?.city, c?.uf].filter(Boolean).join('/') ? `Cidade: ${[c?.city, c?.uf].filter(Boolean).join('/')}` : '',
    status: '4',
    tabela_preco_codigo: c?.priceTable ?? '',
    transportadora_codigo: c?.transportadora || '',
    isento_ipi: '0', isento_st: '0', isento_icms: '0',
    sexo: ' ',
    latitude: c?.geoLat ?? '', longitude: c?.geoLng ?? '',
    raio_checkin: '300',
  };
  const body = FIELDS.map(f => `    <${f}>${esc(v[f])}</${f}>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<clientes>\n  <cliente>\n${body}\n  </cliente>\n</clientes>\n`;
}

export function downloadCustomerXml(c: any) {
  const blob = new Blob([buildCustomerXml(c)], { type: 'application/xml' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `cliente_${digits(c?.cpfCnpj) || 'sem_documento'}.xml`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
