// Consulta CNPJ (Receita Federal) + Inscrição Estadual ativa. Fonte principal publica.cnpj.ws
// (traz IE por UF); contingência BrasilAPI (sem IE).
export interface CnpjData {
  name: string; ie: string; cep: string; uf: string; city: string;
  neighborhood: string; address: string; number: string; complement: string; phone: string;
}

const s = (v: unknown) => String(v ?? '').trim();

export function parseCnpjWs(d: any): CnpjData {
  const e = d?.estabelecimento || {};
  const uf = s(e.estado?.sigla).toUpperCase();
  const ies: any[] = Array.isArray(e.inscricoes_estaduais) ? e.inscricoes_estaduais : [];
  const ie = ies.find(i => i?.ativo && s(i?.estado?.sigla).toUpperCase() === uf) || ies.find(i => i?.ativo);
  return {
    name: s(d?.razao_social).toUpperCase(),
    ie: s(ie?.inscricao_estadual),
    cep: s(e.cep).replace(/\D/g, ''),
    uf, city: s(e.cidade?.nome),
    neighborhood: s(e.bairro),
    address: [s(e.tipo_logradouro), s(e.logradouro)].filter(Boolean).join(' '),
    number: s(e.numero), complement: s(e.complemento),
    phone: (s(e.ddd1) + s(e.telefone1)).replace(/\D/g, ''),
  };
}

export function parseBrasilApi(d: any): CnpjData {
  return {
    name: s(d?.razao_social).toUpperCase(), ie: '',
    cep: s(d?.cep).replace(/\D/g, ''), uf: s(d?.uf).toUpperCase(), city: s(d?.municipio),
    neighborhood: s(d?.bairro),
    address: [s(d?.descricao_tipo_de_logradouro), s(d?.logradouro)].filter(Boolean).join(' '),
    number: s(d?.numero), complement: s(d?.complemento),
    phone: s(d?.ddd_telefone_1).replace(/\D/g, ''),
  };
}

export async function lookupCnpj(doc: string): Promise<CnpjData | null> {
  const digits = doc.replace(/\D/g, '');
  if (digits.length !== 14) return null;
  try {
    const r = await fetch(`https://publica.cnpj.ws/cnpj/${digits}`);
    if (r.ok) return parseCnpjWs(await r.json());
  } catch { /* contingência */ }
  try {
    const r = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${digits}`);
    if (r.ok) return parseBrasilApi(await r.json());
  } catch { /* sem dados */ }
  return null;
}
