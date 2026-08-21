export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d);
}

export function formatDateTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

export function formatPhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 11) {
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
  }
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 6)}-${cleaned.slice(6)}`;
  }
  return phone;
}

export function formatCPFCNPJ(value: string): string {
  const cleaned = value.replace(/\D/g, '');
  if (cleaned.length === 11) {
    return `${cleaned.slice(0, 3)}.${cleaned.slice(3, 6)}.${cleaned.slice(6, 9)}-${cleaned.slice(9)}`;
  }
  if (cleaned.length === 14) {
    return `${cleaned.slice(0, 2)}.${cleaned.slice(2, 5)}.${cleaned.slice(5, 8)}/${cleaned.slice(8, 12)}-${cleaned.slice(12)}`;
  }
  return value;
}

export function formatCEP(value: string): string {
  const cleaned = value.replace(/\D/g, '');
  if (cleaned.length === 8) {
    return `${cleaned.slice(0, 5)}-${cleaned.slice(5)}`;
  }
  return value;
}

export function generateOrderId(): string {
  return `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function generateWhatsAppMessage(order: {
  storeName: string;
  customer: {
    name: string;
    cpfCnpj: string;
    whatsapp: string;
    address: string;
    neighborhood: string;
    city: string;
    uf: string;
    cep: string;
  };
  items: Array<{
    code: string;
    name: string;
    quantity: number;
    price: number;
    discountPercent?: number;
    size?: string;
    color?: string;
  }>;
  subtotal: number;
  discount: number;
  total: number;
  paymentMethod: string;
  deliveryShift: string;
}): string {
  const now = new Date();
  const dateStr = formatDateTime(now);

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

  const sep = '━━━━━━━━━━━━━━━━━━';

  let msg = `📋 *PEDIDO ${order.storeName.toUpperCase()}*\n`;
  msg += `📅 ${dateStr}\n\n`;

  msg += `👤 ${order.customer.name}\n`;
  if (order.customer.cpfCnpj) {
    msg += `🪪 ${order.customer.cpfCnpj}\n`;
  }
  msg += `📱 ${order.customer.whatsapp}\n`;
  msg += `📍 ${order.customer.address} - ${order.customer.neighborhood}\n`;
  msg += `    ${order.customer.cep} ${order.customer.city}/${order.customer.uf}\n`;
  msg += `💳 ${paymentMap[order.paymentMethod] || order.paymentMethod} | 🚚 ${shiftMap[order.deliveryShift] || order.deliveryShift}\n\n`;

  msg += `${sep}\n`;
  msg += `📦 *ITENS (${order.items.length})*\n`;
  msg += `${sep}\n`;

  for (const item of order.items) {
    const discPct = item.discountPercent || 0;
    const discountedPrice = discPct > 0 ? item.price * (1 - discPct / 100) : item.price;
    const totalItem = discountedPrice * item.quantity;

    const priceStr = discPct > 0
      ? `${formatCurrency(item.price)} → *${formatCurrency(discountedPrice)}* (-${discPct}%)`
      : formatCurrency(item.price);

    const variantParts = [item.color, item.size].filter(Boolean).join(' · ');
    const nameStr = variantParts ? `${item.name} (${variantParts})` : item.name;
    msg += `• ${nameStr} | ${item.quantity}un | ${priceStr} | *${formatCurrency(totalItem)}*\n`;
  }

  msg += `${sep}\n\n`;
  msg += `Subtotal: ${formatCurrency(order.subtotal)}\n`;
  if (order.discount > 0) {
    msg += `Desconto: -${formatCurrency(order.discount)}\n`;
  }
  msg += `💰 *TOTAL: ${formatCurrency(order.total)}*\n`;

  return msg;
}

export function buildWhatsAppUrl(phone: string, message: string): string {
  const cleanedPhone = phone.replace(/\D/g, '');
  const encodedMessage = encodeURIComponent(message);
  return `https://api.whatsapp.com/send/?text=${encodedMessage}&phone=${cleanedPhone}`;
}

export function openWhatsApp(phone: string, message: string): void {
  window.open(buildWhatsAppUrl(phone, message), '_blank');
}

export function downloadTxt(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
