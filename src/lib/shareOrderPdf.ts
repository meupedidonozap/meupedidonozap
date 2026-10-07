import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency } from '@/lib/formatters';

/** Gera o PDF do orçamento/pedido e abre a tela de compartilhamento do celular. */
export async function shareOrderPdf(orderId: string, storeName: string): Promise<void> {
  const { data: o, error } = await supabase.from('orders').select('*').eq('id', orderId).single();
  if (error || !o) throw new Error(error?.message || 'Pedido não encontrado');
  const order: any = o;
  const c: any = order.customer || {};
  const isQuote = order.status === 'orcamento';
  const title = isQuote ? 'ORÇAMENTO' : `PEDIDO #${order.order_number ?? ''}`;

  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  doc.setFont('helvetica', 'bold'); doc.setFontSize(16);
  doc.text(storeName, 14, 16);
  doc.setFontSize(13); doc.text(title, 196, 16, { align: 'right' });
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
  doc.text(`Data: ${new Date(order.created_at).toLocaleString('pt-BR')}`, 196, 22, { align: 'right' });

  let y = 30;
  const line = (t: string) => { doc.text(t, 14, y); y += 5; };
  doc.setFont('helvetica', 'bold'); line('Cliente'); doc.setFont('helvetica', 'normal');
  line(`${c.customerCode ? c.customerCode + ' - ' : ''}${c.name || ''}`);
  if (c.cpfCnpj) line(`CPF/CNPJ: ${c.cpfCnpj}`);
  const addr = [[c.address, c.number].filter(Boolean).join(', '), c.neighborhood, [c.city, c.uf].filter(Boolean).join('/')].filter(Boolean).join(' - ');
  if (addr) line(addr);
  if (c.whatsapp) line(`WhatsApp: ${c.whatsapp}`);
  if (c.paymentMethod || order.payment_method) line(`Pagamento: ${c.paymentMethod || order.payment_method}`);

  const items: any[] = Array.isArray(order.items) ? order.items : [];
  autoTable(doc, {
    startY: y + 2,
    head: [['Código', 'Produto', 'Qtd', 'Unit.', 'Desc.', 'Total']],
    body: items.map((it) => {
      const pct = Number(it.discountPercent || 0);
      const unit = Number(it.price || 0) * (1 - pct / 100);
      const variant = [it.size && `Tam: ${it.size}`, it.color && `Cor: ${it.color}`].filter(Boolean).join(' · ');
      return [it.code || '', `${it.name || ''}${variant ? `\n${variant}` : ''}`, String(it.quantity || 0),
        formatCurrency(unit), pct ? `${pct}%` : '-', formatCurrency(unit * Number(it.quantity || 0))];
    }),
    styles: { fontSize: 8, cellPadding: 1.5 },
    headStyles: { fillColor: [15, 23, 42] },
    columnStyles: { 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' } },
  });

  y = (doc as any).lastAutoTable.finalY + 8;
  doc.setFontSize(10);
  const right = (t: string, bold = false) => { doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.text(t, 196, y, { align: 'right' }); y += 6; };
  if (order.subtotal != null) right(`Subtotal: ${formatCurrency(Number(order.subtotal))}`);
  if (Number(order.discount) > 0) right(`Desconto: -${formatCurrency(Number(order.discount))}`);
  if (Number(order.delivery_fee) > 0) right(`Entrega: ${formatCurrency(Number(order.delivery_fee))}`);
  right(`TOTAL: ${formatCurrency(Number(order.total))}`, true);
  if (order.observations) {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
    doc.text(doc.splitTextToSize(`Observações: ${order.observations}`, 182), 14, y + 2);
  }

  const name = `${isQuote ? 'Orcamento' : 'Pedido-' + (order.order_number ?? '')}-${(c.name || 'cliente').replace(/[^\w]+/g, '_').slice(0, 30)}.pdf`;
  const file = new File([doc.output('blob')], name, { type: 'application/pdf' });

  const nav: any = navigator;
  if (nav.canShare && nav.canShare({ files: [file] })) {
    try {
      await nav.share({ files: [file], title, text: `${title} - ${storeName}` });
    } catch (e: any) {
      if (e?.name !== 'AbortError') throw e;
    }
    return;
  }
  // Computador / navegador sem compartilhamento: abre o PDF.
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
