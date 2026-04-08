import type { Order, ServiceOrderExtraItem } from '@/types';
import { formatCurrency, formatDateTime, formatCPFCNPJ, formatPhone } from '@/lib/formatters';

interface PrintOptions {
  extraItems?: ServiceOrderExtraItem[];
}

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

function buildThermalHTML(order: Order, storeName: string, options?: PrintOptions): string {
  const customer = order.customer;
  const sep = '--------------------------------';
  const dblSep = '================================';

  const addressParts = [customer.address, customer.number].filter(Boolean).join(', ');
  const addressLine2 = [customer.complement, customer.neighborhood].filter(Boolean).join(' - ');
  const addressLine3 = [customer.city, customer.uf].filter(Boolean).join('/') + (customer.cep ? ` - ${customer.cep}` : '');

  const itemsHTML = order.items
    .map((item, i) => {
      const discPct = (item as any).discountPercent || 0;
      const discountedPrice = discPct > 0 ? item.price * (1 - discPct / 100) : item.price;
      const itemTotal = discountedPrice * item.quantity;
      const codeLine = item.code ? `<div style="padding-left:16px">Cod: ${item.code}</div>` : '';
      const variantLine = '';
      const discountLine = discPct > 0
        ? `<div style="padding-left:16px;text-decoration:line-through;color:#999">${formatCurrency(item.price)} un.</div>
           <div style="padding-left:16px;font-weight:bold">-${discPct}% → ${formatCurrency(discountedPrice)} un.</div>`
        : '';
      return `
        <div style="margin-bottom:6px">
          <div><strong>${i + 1})</strong> ${item.name}</div>
          ${codeLine}
          ${variantLine}
          ${discountLine}
          <div style="padding-left:16px">${item.quantity} x ${formatCurrency(discountedPrice)} = ${formatCurrency(itemTotal)}</div>
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

  <div class="section-title">ITENS DO PEDIDO</div>
  ${itemsHTML}
  <div class="sep">${sep}</div>

  ${(options?.extraItems && options.extraItems.length > 0) ? `
  <div class="section-title">ITENS DA OS</div>
  ${options.extraItems.map((item, i) => {
    const itemTotal = item.price * item.quantity;
    return `<div style="margin-bottom:6px">
      <div><strong>${i + 1})</strong> ${item.name}</div>
      <div style="padding-left:16px">${item.quantity} x ${formatCurrency(item.price)} = ${formatCurrency(itemTotal)}</div>
    </div>`;
  }).join('')}
  <div class="sep">${sep}</div>
  ` : ''}

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

function buildA4HTML(order: Order, storeName: string, options?: PrintOptions): string {
  const customer = order.customer;
  const addressParts = [customer.address, customer.number].filter(Boolean).join(', ');
  const addressLine2 = [customer.complement, customer.neighborhood].filter(Boolean).join(' - ');
  const addressLine3 = [customer.city, customer.uf].filter(Boolean).join('/') + (customer.cep ? ` - ${customer.cep}` : '');

  const itemsRows = order.items
    .map((item, i) => {
      const discPct = (item as any).discountPercent || 0;
      const discountedPrice = discPct > 0 ? item.price * (1 - discPct / 100) : item.price;
      const itemTotal = discountedPrice * item.quantity;
      const priceCell = discPct > 0
        ? `<span style="text-decoration:line-through;color:#999;font-size:10px">${formatCurrency(item.price)}</span><br/><strong style="color:#e67e22">${formatCurrency(discountedPrice)} (-${discPct}%)</strong>`
        : formatCurrency(item.price);
      return `<tr>
        <td style="padding:4px 8px;border-bottom:1px solid #ddd;text-align:center">${i + 1}</td>
        <td style="padding:4px 8px;border-bottom:1px solid #ddd">${item.name}</td>
        <td style="padding:4px 8px;border-bottom:1px solid #ddd">${item.code || '-'}</td>
        <td style="padding:4px 8px;border-bottom:1px solid #ddd;text-align:center">${item.quantity}</td>
        <td style="padding:4px 8px;border-bottom:1px solid #ddd;text-align:right">${priceCell}</td>
        <td style="padding:4px 8px;border-bottom:1px solid #ddd;text-align:right">${formatCurrency(itemTotal)}</td>
      </tr>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Pedido #${order.orderNumber}</title>
<style>
  @media print {
    @page { margin: 15mm; }
    body { margin: 0; }
  }
  body {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 12px;
    line-height: 1.5;
    color: #000;
    background: #fff;
    max-width: 800px;
    margin: 0 auto;
    padding: 20px;
  }
  .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #000; padding-bottom: 12px; }
  .header h1 { font-size: 20px; margin: 0; text-transform: uppercase; }
  .header p { font-size: 14px; margin: 4px 0 0; color: #555; }
  .section { margin-bottom: 16px; }
  .section-title { font-size: 13px; font-weight: bold; border-bottom: 1px solid #999; padding-bottom: 4px; margin-bottom: 8px; text-transform: uppercase; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 24px; }
  .info-grid div { font-size: 12px; }
  .info-grid strong { display: inline-block; min-width: 80px; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #f0f0f0; padding: 6px 8px; text-align: left; border-bottom: 2px solid #999; font-size: 11px; text-transform: uppercase; }
  .totals { margin-top: 12px; text-align: right; }
  .totals div { margin-bottom: 2px; }
  .totals .grand { font-size: 16px; font-weight: bold; border-top: 2px solid #000; padding-top: 6px; margin-top: 6px; }
  .footer { text-align: center; font-size: 10px; color: #888; margin-top: 24px; border-top: 1px solid #ddd; padding-top: 8px; }
</style>
</head>
<body>
  <div class="header">
    <h1>${storeName}</h1>
    <p>Pedido #${order.orderNumber} &mdash; ${formatDateTime(order.createdAt)}</p>
  </div>

  <div class="section">
    <div class="section-title">Cliente</div>
    <div class="info-grid">
      <div><strong>Nome:</strong> ${customer.name}</div>
      <div><strong>CPF/CNPJ:</strong> ${formatCPFCNPJ(customer.cpfCnpj)}</div>
      <div><strong>Telefone:</strong> ${formatPhone(customer.whatsapp)}</div>
      <div><strong>Pagamento:</strong> ${paymentMap[order.paymentMethod] || order.paymentMethod}</div>
      <div><strong>Endereço:</strong> ${addressParts}${addressLine2 ? ', ' + addressLine2 : ''}</div>
      <div><strong>Cidade:</strong> ${addressLine3}</div>
      <div><strong>Entrega:</strong> ${shiftMap[order.deliveryShift] || order.deliveryShift}</div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Itens do Pedido</div>
    <table>
      <thead>
        <tr>
          <th style="text-align:center;width:32px">#</th>
          <th>Produto</th>
          <th style="width:80px">Código</th>
          <th style="text-align:center;width:40px">Qtd</th>
          <th style="text-align:right;width:85px">Preço Unit.</th>
          <th style="text-align:right;width:85px">Total</th>
        </tr>
      </thead>
      <tbody>
        ${itemsRows}
      </tbody>
    </table>
  </div>

  ${(options?.extraItems && options.extraItems.length > 0) ? `
  <div class="section">
    <div class="section-title">Itens da OS (Materiais Adicionais)</div>
    <table>
      <thead>
        <tr>
          <th style="text-align:center;width:40px">#</th>
          <th>Item</th>
          <th style="text-align:center;width:50px">Qtd</th>
          <th style="text-align:right;width:90px">Preço Unit.</th>
          <th style="text-align:right;width:90px">Total</th>
        </tr>
      </thead>
      <tbody>
        ${options.extraItems.map((item, i) => {
          const itemTotal = item.price * item.quantity;
          return `<tr>
            <td style="padding:4px 8px;border-bottom:1px solid #ddd;text-align:center">${i + 1}</td>
            <td style="padding:4px 8px;border-bottom:1px solid #ddd">${item.name}</td>
            <td style="padding:4px 8px;border-bottom:1px solid #ddd;text-align:center">${item.quantity}</td>
            <td style="padding:4px 8px;border-bottom:1px solid #ddd;text-align:right">${formatCurrency(item.price)}</td>
            <td style="padding:4px 8px;border-bottom:1px solid #ddd;text-align:right">${formatCurrency(itemTotal)}</td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
  </div>
  ` : ''}

  <div class="section">
    <div class="totals">
      <div>Subtotal: ${formatCurrency(order.subtotal)}</div>
      ${order.discount > 0 ? `<div>Desconto: -${formatCurrency(order.discount)}</div>` : ''}
      ${order.deliveryFee > 0 ? `<div>Taxa de entrega: ${formatCurrency(order.deliveryFee)}</div>` : ''}
      <div class="grand">TOTAL: ${formatCurrency(order.total)}</div>
    </div>
  </div>

  ${order.observations ? `<div class="section"><div class="section-title">Observações</div><p>${order.observations}</p></div>` : ''}

  <div class="footer">Gerado em ${formatDateTime(new Date())}</div>
</body>
</html>`;
}

export function printOrder(order: Order, storeName: string, layout: 'thermal' | 'a4' = 'thermal', options?: PrintOptions): void {
  const html = layout === 'a4' ? buildA4HTML(order, storeName, options) : buildThermalHTML(order, storeName, options);

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
