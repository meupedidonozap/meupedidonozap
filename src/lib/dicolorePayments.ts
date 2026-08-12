export interface PaymentForma {
  codigo: string;
  descricao: string;
  filial: string;
  ativo: boolean;
}

export interface PaymentCondicao {
  codigo: string;
  descricao: string;
  filial: string;
  ativo: boolean;
}

export const DEFAULT_DICOLORE_FORMAS: PaymentForma[] = [
  { codigo: '1',  descricao: 'CHEQUE',             filial: '*', ativo: true },
  { codigo: '3',  descricao: 'A VISTA',            filial: '*', ativo: true },
  { codigo: '4',  descricao: 'BOLETO BANCARIO',    filial: '*', ativo: true },
  { codigo: '5',  descricao: 'DEPÓSITO',           filial: '*', ativo: true },
  { codigo: '42', descricao: 'CARTAO DE CREDITO',  filial: '*', ativo: true },
];

export const DEFAULT_DICOLORE_CONDICOES: PaymentCondicao[] = [
  { codigo: '63',  descricao: '1/30 S/J',              filial: '*', ativo: true },
  { codigo: '47',  descricao: '7 DIAS S/J',            filial: '*', ativo: true },
  { codigo: '87',  descricao: '30/45/60/75/90 S/J',    filial: '*', ativo: true },
  { codigo: '310', descricao: '25/50/75/90 S/J',       filial: '*', ativo: true },
  { codigo: '122', descricao: '1/30/60 S/J',           filial: '*', ativo: true },
  { codigo: '71',  descricao: '1/30/60/90 S/J',        filial: '*', ativo: true },
  { codigo: '400', descricao: '30/60/90/120 C/J',      filial: '*', ativo: true },
  { codigo: '84',  descricao: '10 DIAS S/J',           filial: '*', ativo: true },
  { codigo: '21',  descricao: '15 DIAS',               filial: '*', ativo: true },
  { codigo: '3',   descricao: '30 DIAS S/J',           filial: '*', ativo: true },
  { codigo: '61',  descricao: '30/60 S/J',             filial: '*', ativo: true },
  { codigo: '30',  descricao: '30/60/90 S/J',          filial: '*', ativo: true },
  { codigo: '60',  descricao: '30/60/90 S/J',          filial: '*', ativo: true },
  { codigo: '1',   descricao: 'VENDA A VISTA',         filial: '*', ativo: true },
];

export function getStoreFormas(settings: any): PaymentForma[] {
  const list = settings?.formasPagamento;
  if (Array.isArray(list) && list.length > 0) return list as PaymentForma[];
  return DEFAULT_DICOLORE_FORMAS;
}

export function getStoreCondicoes(settings: any): PaymentCondicao[] {
  const list = settings?.condicoesPagamento;
  if (Array.isArray(list) && list.length > 0) return list as PaymentCondicao[];
  return DEFAULT_DICOLORE_CONDICOES;
}

export function isDicoloreFlow(slug?: string | null, settings?: any): boolean {
  if (slug === 'dicolore' || slug === 'dicoloresenses') return true;
  const f = settings?.formasPagamento;
  const c = settings?.condicoesPagamento;
  return Array.isArray(f) && f.length > 0 && Array.isArray(c) && c.length > 0;
}