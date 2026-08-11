import type { Order, CartItem, DiscountRule } from '@/types';
import { isDicoloreFlow } from './dicolorePayments';
import { ensureItemDiscountPercents } from './groupDiscounts';
import { expandKitItems, type KitMap } from './kitExpansion';

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

function formatCgc(s: string | undefined): string {
  const d = onlyDigits(s);
  if (d.length === 11) {
    return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  }
  if (d.length === 14) {
    return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
  }
  return d;
}

interface StoreLike {
  name: string;
  settings?: any;
}

export interface CustomerExtra {
  cpfCnpj?: string;
  sellerCode?: string;
  isTelevendas?: boolean;
  discountRules?: DiscountRule[];
  transportadora?: string;
  /** Map productId -> commission percent (Dicolore <perCom>). */
  productCommission?: Record<string, number>;
  /** Composição dos KITs: kit id -> componentes (kits são explodidos na saída). */
  kitMap?: KitMap;
}

export function exportOrderXml(order: Order, store: StoreLike, extra: CustomerExtra = {}): string {
  const created = new Date(order.createdAt);
  const delivery = new Date(created);
  delivery.setDate(delivery.getDate() + 2);

  const s = store.settings || {};
  const rep = s.representante || {};
  const cpfCnpj = extra.cpfCnpj || order.customer.cpfCnpj || '';
  const sellerCode = extra.sellerCode || rep.codigo || '';
  const isDicolore = isDicoloreFlow(undefined, s);
  const priceDecimals = isDicolore ? 3 : 2;
  const televendas = isDicolore
    ? (extra.isTelevendas ? 'S' : 'N')
    : (extra.isTelevendas ? 'Sim' : 'Nao');
  const commissionMap = extra.productCommission || {};

  const formaCodigo = (order.customer as any)?.paymentFormaCodigo
    || PAYMENT_CODE[order.paymentMethod]
    || '';
  const condicaoCodigo = (order.customer as any)?.paymentCondicaoCodigo || '';
  const transportadora = extra.transportadora || '';

  const rules = extra.discountRules ?? s.discountRules;
  const itemsForExport = expandKitItems(
    ensureItemDiscountPercents(order.items as any, rules) as any,
    extra.kitMap,
  );
  const itensXml = itemsForExport
    .map((item: CartItem) => {
      const discPct = (item as any).discountPercent || 0;
      const unitPrice = discPct > 0 ? item.price * (1 - discPct / 100) : item.price;
      const total = (unitPrice * item.quantity).toFixed(2);
      const perComTag = isDicolore
        ? `\n    <perCom>${(Number(commissionMap[item.productId]) || 0).toFixed(2)}</perCom>`
        : '';
      return `  <itensPedido>
    <produto>${escapeXml(item.code)}</produto>
    <descProduto>${escapeXml(item.name)}</descProduto>
    <cor>${escapeXml(item.color || '')}</cor>
    <descCor>${escapeXml(item.color || '')}</descCor>
    <gtam>${escapeXml(item.size || '')}</gtam>
    <descGtam>${escapeXml(item.size || '')}</descGtam>
    <precoUnitario>${unitPrice.toFixed(priceDecimals)}</precoUnitario>
    <valorTotal>${total}</valorTotal>${perComTag}
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
  <cgcCliente>${escapeXml(formatCgc(cpfCnpj))}</cgcCliente>
  <nomeCliente>${escapeXml(order.customer.name)}</nomeCliente>
  <cgcRepresentante>${escapeXml(onlyDigits(rep.cgc))}</cgcRepresentante>
  <nomeRepresentante>${escapeXml(rep.nome || '')}</nomeRepresentante>
  <codigoRepresentante>${escapeXml(sellerCode)}</codigoRepresentante>
  <pedidoTelevendas>${televendas}</pedidoTelevendas>
  <formaPagamento>${escapeXml(formaCodigo)}</formaPagamento>
${isDicolore ? `  <tipovenda>${escapeXml(condicaoCodigo)}</tipovenda>\n  <transportadora>${escapeXml(transportadora)}</transportadora>\n` : ''}\
  <prazoMedio>${s.prazoMedio ?? 0}</prazoMedio>
  <tabelaPrecos>${escapeXml(s.tabelaPrecos || (isDicolore ? '4' : ''))}</tabelaPrecos>
  <colunaTabelaPrecos>${isDicolore ? 3 : 2}</colunaTabelaPrecos>
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
    formatCgc(cpfCnpj),
    order.customer.name,
    order.total.toFixed(2),
    extra.sellerCode || '',
    extra.isTelevendas ? 'Sim' : 'Nao',
  ].join(';');

  const s = store.settings || {};
  const rules = extra.discountRules ?? s.discountRules;
  const itemsForExport = expandKitItems(
    ensureItemDiscountPercents(order.items as any, rules) as any,
    extra.kitMap,
  );
  const lines = itemsForExport.map((item) => {
    const discPct = (item as any).discountPercent || 0;
    const unitPrice = discPct > 0 ? item.price * (1 - discPct / 100) : item.price;
    return [
      'ITEM',
      item.code,
      item.name,
      item.color || '',
      item.size || '',
      item.quantity,
      unitPrice.toFixed(2),
      (unitPrice * item.quantity).toFixed(2),
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