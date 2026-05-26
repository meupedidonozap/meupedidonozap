import { formatCurrency, formatDateTime, formatCPFCNPJ } from '@/lib/formatters';

export interface ReceiptItem {
  name: string;
  quantity: number;
  unitPrice: number;
}

export interface ReceiptOptions {
  storeName: string;
  cnpj?: string;
  address?: string;
  phone?: string;
  receiptNumber?: string | number;
  dateTime?: Date | string;
  tableNumber?: number;
  tabLabel?: string;
  items: ReceiptItem[];
  paymentMethod?: string;
}

const paymentMap: Record<string, string> = {
  pix: 'PIX',
  cartao: 'Cartão',
  dinheiro: 'Dinheiro',
  boleto: 'Boleto',
};

function buildHTML(opts: ReceiptOptions): string {
  const sep = '--------------------------------';
  const dblSep = '================================';
  const dt = opts.dateTime ? formatDateTime(opts.dateTime) : formatDateTime(new Date());
  const subtotal = opts.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
  const itemsHTML = opts.items.map((i, idx) => `
    <div style="margin-bottom:4px">
      <div><strong>${idx + 1})</strong> ${i.name}</div>
      <div style="padding-left:16px">${i.quantity} x ${formatCurrency(i.unitPrice)} = ${formatCurrency(i.unitPrice * i.quantity)}</div>
    </div>`).join('');

  return `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8"><title>Comprovante</title>
<style>
@media print { @page { margin: 2mm; width: 80mm; } body { margin: 0; } }
body { font-family: 'Courier New', Courier, monospace; font-size: 11px; line-height: 1.4; width: 280px; max-width: 280px; margin: 0 auto; padding: 4px; color:#000; background:#fff; }
.center { text-align:center; }
.sep { text-align:center; letter-spacing:1px; margin:4px 0; }
.title { font-size:13px; font-weight:bold; text-transform:uppercase; }
.totals-line { display:flex; justify-content:space-between; }
.grand { font-size:13px; font-weight:bold; }
.warn { font-weight:bold; text-align:center; font-size:12px; line-height:1.5; }
</style></head><body>
<div class="sep">${dblSep}</div>
<div class="center title">${opts.storeName}</div>
${opts.cnpj ? `<div class="center">CNPJ: ${formatCPFCNPJ(opts.cnpj)}</div>` : ''}
${opts.address ? `<div class="center">${opts.address}</div>` : ''}
${opts.phone ? `<div class="center">Tel: ${opts.phone}</div>` : ''}
<div class="sep">${dblSep}</div>
<div class="center title">COMPROVANTE DE PAGAMENTO</div>
<div class="center">${opts.receiptNumber != null ? `Nº ${opts.receiptNumber} | ` : ''}${dt}</div>
${opts.tableNumber != null || opts.tabLabel ? `<div class="center">${opts.tableNumber != null ? `Mesa ${opts.tableNumber}` : ''}${opts.tabLabel ? ` - ${opts.tabLabel}` : ''}</div>` : ''}
<div class="sep">${sep}</div>
<div style="font-weight:bold;margin-bottom:2px">ITENS PAGOS</div>
${itemsHTML}
<div class="sep">${sep}</div>
${opts.paymentMethod ? `<div>Forma de pagamento: ${paymentMap[opts.paymentMethod] || opts.paymentMethod}</div>` : ''}
<div class="totals-line grand"><span>TOTAL PAGO:</span><span>${formatCurrency(subtotal)}</span></div>
<div class="sep">${dblSep}</div>
<div class="warn">*** ESTE DOCUMENTO ***<br/>*** NÃO É CUPOM FISCAL ***</div>
<div class="center" style="margin-top:4px">Apenas comprovante interno do estabelecimento</div>
<div class="sep">${dblSep}</div>
<div class="center" style="font-size:9px;color:#666;margin-top:4px">Emitido em ${formatDateTime(new Date())}</div>
</body></html>`;
}

export function printReceipt(opts: ReceiptOptions): void {
  const html = buildHTML(opts);
  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;top:-10000px;left:-10000px;width:0;height:0;border:none';
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!doc) { document.body.removeChild(iframe); return; }
  doc.open(); doc.write(html); doc.close();
  const trigger = () => {
    try { iframe.contentWindow?.print(); } catch {}
    setTimeout(() => { if (iframe.parentNode) document.body.removeChild(iframe); }, 1000);
  };
  iframe.onload = () => setTimeout(trigger, 250);
  setTimeout(trigger, 600);
}