import type { Order } from '@/types';
import { formatCurrency, formatDateTime, formatCPFCNPJ, formatPhone } from '@/lib/formatters';

const paymentMap: Record<string, string> = {
  pix: 'PIX',
  boleto: 'Boleto',
  cartao: 'Cartão',
  dinheiro: 'Dinheiro',
};

const shiftMap: Record<string, string> = {
  manha: 'Manhã',
  tarde: 'Tarde',
  noite: 'Noite',
};

function buildOrderHTML(order: Order, storeName: string): string {
  const customer = order.customer;
  const sep = '--------------------------------';
  const dblSep = '================================';

  const addressParts = [customer.address, customer.number].filter(Boolean).join(', ');
  const addressLine2 = [customer.complement, customer.neighborhood].filter(Boolean).join(' - ');
  const addressLine3 = [customer.city, customer.uf].filter(Boolean).join('/') + (customer.cep ? ` - ${customer.cep}` : '');

  const itemsHTML = order.items
    .map((item, i) => {
      const itemTotal = item.price * item.quantity;
      const details: string[] = [];
      if (item.code) details.push(`Cod: ${item.code}`);
      if (item.size) details.push(`Tam: ${item.size}`);
      if (item.color) details.push(`Cor: ${item.color}`);
      const detailLine = details.length > 0 ? `<div style="padding-left:16px">${details.join(' | ')}</div>` : '';
      return `
        <div style="margin-bottom:6px">
          <div><strong>${i + 1})</strong> ${item.name}</div>
          ${detailLine}
          <div style="padding-left:16px">${item.quantity} x ${formatCurrency(item.price)} = ${formatCurrency(itemTotal)}</div>
        </div>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Pedido #${order.orderNumber}</title>
<style>
  @media print {
    @page { margin: 2mm; width: 80mm; }
    body { margin: 0; }
  }
  body {
    font-family: 'Courier New', Courier, monospace;
    font-size: 11px;
    line-height: 1.4;
    width: 280px;
    max-width: 280px;
    margin: 0 auto;
    padding: 4px;
    color: #000;
    background: #fff;
  }
  .center { text-align: center; }
  .sep { text-align: center; letter-spacing: 1px; margin: 4px 0; }
  .section-title { font-weight: bold; font-size: 12px; margin: 4px 0 2px; }
  .totals-line { display: flex; justify-content: space-between; }
  .grand-total { font-size: 13px; font-weight: bold; }
</style>
</head>
<body>
  <div class="sep">${dblSep}</div>
  <div class="center" style="font-size:13px;font-weight:bold;text-transform:uppercase">${storeName}</div>
  <div class="sep">${dblSep}</div>
  <div class="center">Pedido #${order.orderNumber} | ${formatDateTime(order.createdAt)}</div>
  <div class="sep">${sep}</div>

  <div class="section-title">CLIENTE</div>
  <div>Nome: ${customer.name}</div>
  <div>CPF: ${formatCPFCNPJ(customer.cpfCnpj)}</div>
  <div>Fone: ${formatPhone(customer.whatsapp)}</div>
  <div>End: ${addressParts}</div>
  ${addressLine2 ? `<div>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;${addressLine2}</div>` : ''}
  <div>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;${addressLine3}</div>
  <div>Entrega: ${shiftMap[order.deliveryShift] || order.deliveryShift}</div>
  <div>Pagto: ${paymentMap[order.paymentMethod] || order.paymentMethod}</div>
  <div class="sep">${sep}</div>

  <div class="section-title">ITENS</div>
  ${itemsHTML}
  <div class="sep">${sep}</div>

  <div class="totals-line"><span>Subtotal:</span><span>${formatCurrency(order.subtotal)}</span></div>
  ${order.discount > 0 ? `<div class="totals-line"><span>Desconto:</span><span>-${formatCurrency(order.discount)}</span></div>` : ''}
  ${order.deliveryFee > 0 ? `<div class="totals-line"><span>Taxa entrega:</span><span>${formatCurrency(order.deliveryFee)}</span></div>` : ''}
  <div class="sep">${dblSep}</div>
  <div class="totals-line grand-total"><span>TOTAL:</span><span>${formatCurrency(order.total)}</span></div>
  <div class="sep">${dblSep}</div>

  ${order.observations ? `<div>Obs: ${order.observations}</div><div class="sep">${sep}</div>` : ''}

  <div class="center" style="font-size:9px;color:#666;margin-top:4px">Gerado em ${formatDateTime(new Date())}</div>
</body>
</html>`;
}

export function printOrder(order: Order, storeName: string): void {
  const html = buildOrderHTML(order, storeName);

  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.top = '-10000px';
  iframe.style.left = '-10000px';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = 'none';
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!doc) {
    document.body.removeChild(iframe);
    return;
  }

  doc.open();
  doc.write(html);
  doc.close();

  iframe.onload = () => {
    setTimeout(() => {
      iframe.contentWindow?.print();
      setTimeout(() => {
        document.body.removeChild(iframe);
      }, 1000);
    }, 250);
  };

  // Fallback if onload doesn't fire (content already written)
  setTimeout(() => {
    try {
      iframe.contentWindow?.print();
    } catch {}
    setTimeout(() => {
      if (iframe.parentNode) document.body.removeChild(iframe);
    }, 1000);
  }, 500);
}
