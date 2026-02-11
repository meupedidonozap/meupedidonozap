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
  const itemsRows = order.items
    .map((item, i) => {
      const itemTotal = item.price * item.quantity;
      return `
        <tr>
          <td style="padding:6px 8px;border-bottom:1px solid #ddd;text-align:center">${i + 1}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #ddd;font-family:monospace">${item.code || '-'}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #ddd">${item.name}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #ddd;text-align:center">${item.size || '-'}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #ddd;text-align:center">${item.color || '-'}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #ddd;text-align:center">${item.quantity}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #ddd;text-align:right">${formatCurrency(item.price)}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #ddd;text-align:right">-</td>
          <td style="padding:6px 8px;border-bottom:1px solid #ddd;text-align:right;font-weight:600">${formatCurrency(itemTotal)}</td>
        </tr>`;
    })
    .join('');

  const customer = order.customer;
  const fullAddress = [customer.address, customer.number, customer.complement, customer.neighborhood, customer.city, customer.uf, customer.cep]
    .filter(Boolean)
    .join(', ');

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Pedido #${order.orderNumber}</title>
<style>
  @media print {
    body { margin: 0; }
    @page { margin: 15mm; }
  }
  body {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 12px;
    color: #222;
    max-width: 800px;
    margin: 0 auto;
    padding: 20px;
  }
  .header {
    text-align: center;
    border-bottom: 3px solid #333;
    padding-bottom: 12px;
    margin-bottom: 16px;
  }
  .header h1 {
    margin: 0 0 4px;
    font-size: 22px;
    text-transform: uppercase;
    letter-spacing: 1px;
  }
  .header p {
    margin: 0;
    font-size: 12px;
    color: #555;
  }
  .section {
    margin-bottom: 16px;
  }
  .section-title {
    font-size: 13px;
    font-weight: 700;
    text-transform: uppercase;
    background: #f0f0f0;
    padding: 6px 10px;
    margin-bottom: 8px;
    border-left: 4px solid #333;
  }
  .info-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 4px 24px;
    padding: 0 10px;
    font-size: 12px;
  }
  .info-grid .full {
    grid-column: 1 / -1;
  }
  .info-grid strong {
    color: #555;
    font-weight: 600;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 11px;
  }
  thead th {
    background: #333;
    color: #fff;
    padding: 8px;
    text-align: left;
    font-size: 10px;
    text-transform: uppercase;
  }
  .totals {
    text-align: right;
    margin-top: 12px;
    padding: 10px;
    border-top: 2px solid #333;
  }
  .totals p {
    margin: 4px 0;
    font-size: 13px;
  }
  .totals .grand-total {
    font-size: 18px;
    font-weight: 800;
    margin-top: 8px;
    padding-top: 8px;
    border-top: 2px solid #333;
  }
  .footer {
    text-align: center;
    margin-top: 24px;
    font-size: 10px;
    color: #999;
    border-top: 1px solid #ddd;
    padding-top: 10px;
  }
</style>
</head>
<body>
  <div class="header">
    <h1>${storeName}</h1>
    <p>Pedido #${order.orderNumber} &bull; ${formatDateTime(order.createdAt)}</p>
  </div>

  <div class="section">
    <div class="section-title">Dados do Cliente</div>
    <div class="info-grid">
      <p><strong>Nome:</strong> ${customer.name}</p>
      <p><strong>CPF/CNPJ:</strong> ${formatCPFCNPJ(customer.cpfCnpj)}</p>
      <p><strong>WhatsApp:</strong> ${formatPhone(customer.whatsapp)}</p>
      <p><strong>Pagamento:</strong> ${paymentMap[order.paymentMethod] || order.paymentMethod}</p>
      <p class="full"><strong>Endereço:</strong> ${fullAddress}</p>
      <p><strong>Turno de Entrega:</strong> ${shiftMap[order.deliveryShift] || order.deliveryShift}</p>
      ${order.observations ? `<p class="full"><strong>Observações:</strong> ${order.observations}</p>` : ''}
    </div>
  </div>

  <div class="section">
    <div class="section-title">Itens do Pedido</div>
    <table>
      <thead>
        <tr>
          <th style="text-align:center">#</th>
          <th>Código</th>
          <th>Produto</th>
          <th style="text-align:center">Tamanho</th>
          <th style="text-align:center">Cor</th>
          <th style="text-align:center">Qtd</th>
          <th style="text-align:right">Vlr Unit.</th>
          <th style="text-align:right">Desc.</th>
          <th style="text-align:right">Total</th>
        </tr>
      </thead>
      <tbody>
        ${itemsRows}
      </tbody>
    </table>

    <div class="totals">
      <p><strong>Subtotal:</strong> ${formatCurrency(order.subtotal)}</p>
      ${order.discount > 0 ? `<p><strong>Desconto:</strong> -${formatCurrency(order.discount)}</p>` : ''}
      ${order.deliveryFee > 0 ? `<p><strong>Taxa de Entrega:</strong> ${formatCurrency(order.deliveryFee)}</p>` : ''}
      <p class="grand-total">TOTAL: ${formatCurrency(order.total)}</p>
    </div>
  </div>

  <div class="footer">
    Documento gerado em ${formatDateTime(new Date())} &bull; ${storeName}
  </div>
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
