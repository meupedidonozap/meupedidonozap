import type { Order, CartItem } from '@/types';

const PAYMENT_CODE: Record<string, string> = {
  pix: '1',
  boleto: '2',
  cartao: '3',
  dinheiro: '4',
};

function escapeXml(value: string | number | undefined | null): string {
  if (value === undefined || value === null) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function pad(n: number, len: number): string {
  return String(n).padStart(len, '0');
}

function formatDateBR(d: Date): string {
  return `${pad(d.getDate(), 2)}/${pad(d.getMonth() + 1, 2)}/${d.getFullYear()}`;
}

function isoWeek(d: Date): number {
  const target = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNr = (target.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNr + 3);
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const diff = (target.getTime() - firstThursday.getTime()) / 86400000;
  return 1 + Math.round((diff - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
}

function onlyDigits(s: string | undefined): string {
  return (s || '').replace(/\D/g, '');
}

interface StoreLike {
  name: string;
  settings?: any;
}

export interface CustomerExtra {
  cpfCnpj?: string;
  sellerCode?: string;
  isTelevendas?: boolean;
}

export function exportOrderXml(order: Order, store: StoreLike, extra: CustomerExtra = {}): string {
  const created = new Date(order.createdAt);
  const delivery = new Date(created);
  delivery.setDate(delivery.getDate() + 2);

  const s = store.settings || {};
  const rep = s.representante || {};
  const cpfCnpj = extra.cpfCnpj || order.customer.cpfCnpj || '';
  const sellerCode = extra.sellerCode || rep.codigo || '';
  const televendas = extra.isTelevendas ? 'Sim' : 'Nao';

  const formaCodigo = (order.customer as any)?.paymentFormaCodigo
    || PAYMENT_CODE[order.paymentMethod]
    || '';
  const condicaoCodigo = (order.customer as any)?.paymentCondicaoCodigo || '';

  const itensXml = order.items
    .map((item: CartItem) => {
      const total = (item.price * item.quantity).toFixed(2);
      return `  <itensPedido>
    <produto>${escapeXml(item.code)}</produto>
    <descProduto>${escapeXml(item.name)}</descProduto>
    <cor>${escapeXml(item.color || '')}</cor>
    <descCor>${escapeXml(item.color || '')}</descCor>
    <gtam>${escapeXml(item.size || '')}</gtam>
    <descGtam>${escapeXml(item.size || '')}</descGtam>
    <precoUnitario>${item.price.toFixed(2)}</precoUnitario>
    <valorTotal>${total}</valorTotal>
    <dataEntrega>${formatDateBR(delivery)}</dataEntrega>
    <anoEntrega>${delivery.getFullYear()}</anoEntrega>
    <periodoEntrega>${isoWeek(delivery)}</periodoEntrega>
    <listaTamanhos>
      <tamanho>${escapeXml(item.size || '')}</tamanho>
      <quantidade>${item.quantity}</quantidade>
    </listaTamanhos>
  </itensPedido>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<dadosGeraisPedido>
  <numero>${pad(order.orderNumber, 9)}</numero>
  <emissao>${formatDateBR(created)}</emissao>
  <cgcCliente>${escapeXml(onlyDigits(cpfCnpj))}</cgcCliente>
  <nomeCliente>${escapeXml(order.customer.name)}</nomeCliente>
  <cgcRepresentante>${escapeXml(onlyDigits(rep.cgc))}</cgcRepresentante>
  <nomeRepresentante>${escapeXml(rep.nome || '')}</nomeRepresentante>
  <codigoRepresentante>${escapeXml(sellerCode)}</codigoRepresentante>
  <pedidoTelevendas>${televendas}</pedidoTelevendas>
  <formaPagamento>${escapeXml(formaCodigo)}</formaPagamento>
  <condicaoPagamento>${escapeXml(condicaoCodigo)}</condicaoPagamento>
  <prazoMedio>${s.prazoMedio ?? 0}</prazoMedio>
  <tabelaPrecos>${escapeXml(s.tabelaPrecos || '')}</tabelaPrecos>
  <colunaTabelaPrecos>2</colunaTabelaPrecos>
${itensXml}
</dadosGeraisPedido>
`;
}

export function exportOrderTxt(order: Order, store: StoreLike, extra: CustomerExtra = {}): string {
  const created = new Date(order.createdAt);
  const cpfCnpj = extra.cpfCnpj || order.customer.cpfCnpj || '';
  const header = [
    'PEDIDO',
    pad(order.orderNumber, 9),
    formatDateBR(created),
    onlyDigits(cpfCnpj),
    order.customer.name,
    order.total.toFixed(2),
    extra.sellerCode || '',
    extra.isTelevendas ? 'Sim' : 'Nao',
  ].join(';');

  const lines = order.items.map((item) => {
    return [
      'ITEM',
      item.code,
      item.name,
      item.color || '',
      item.size || '',
      item.quantity,
      item.price.toFixed(2),
      (item.price * item.quantity).toFixed(2),
    ].join(';');
  });

  return [header, ...lines].join('\n') + '\n';
}

export function downloadOrderFile(order: Order, store: StoreLike, format: 'xml' | 'txt', extra: CustomerExtra = {}) {
  const content = format === 'xml' ? exportOrderXml(order, store, extra) : exportOrderTxt(order, store, extra);
  const mime = format === 'xml' ? 'application/xml' : 'text/plain';
  const created = new Date(order.createdAt);
  const dt = `${pad(created.getDate(), 2)}${pad(created.getMonth() + 1, 2)}${created.getFullYear()}`;
  const tm = `${pad(created.getHours(), 2)}${pad(created.getMinutes(), 2)}${pad(created.getSeconds(), 2)}`;
  const filename = `pedido_${pad(order.orderNumber, 9)}_${dt}_${tm}.${format}`;

  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}