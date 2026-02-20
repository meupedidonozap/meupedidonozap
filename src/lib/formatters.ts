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

  let message = `PEDIDO ${order.storeName.toUpperCase()} - ${dateStr}\n`;
  message += `================================\n`;
  message += `CLIENTE: ${order.customer.name}\n`;
  message += `CPF/CNPJ: ${order.customer.cpfCnpj} | Tel: ${order.customer.whatsapp}\n`;
  message += `Endereço: ${order.customer.address} - ${order.customer.neighborhood} - ${order.customer.cep} ${order.customer.city}/${order.customer.uf}\n`;
  message += `Pagamento: ${paymentMap[order.paymentMethod] || order.paymentMethod} | Entrega: ${shiftMap[order.deliveryShift] || order.deliveryShift}\n`;
  message += `\n`;
  message += `ITENS DO PEDIDO\n`;
  message += `--------------------------------\n`;
  message += `# | Código        | Produto               | Tam | Cor       | Qtd | Unit       | Total\n`;
  message += `--------------------------------\n`;

  order.items.forEach((item, index) => {
    const total = item.price * item.quantity;
    const tamStr = (item.size || '-').slice(0, 10).padEnd(3);
    const corStr = (item.color || '-').slice(0, 9);
    message += `${index + 1} | ${item.code.slice(0, 13)} | ${item.name.slice(0, 21)} | ${tamStr} | ${corStr} | ${item.quantity} | ${formatCurrency(item.price)} | ${formatCurrency(total)}\n`;
  });

  message += `--------------------------------\n`;
  message += `Subtotal: ${formatCurrency(order.subtotal)}\n`;
  message += `Desconto: -${formatCurrency(order.discount)}\n`;
  message += `\n`;
  message += `TOTAL:    ${formatCurrency(order.total)}\n`;

  return message;
}

export function openWhatsApp(phone: string, message: string): void {
  const cleanedPhone = phone.replace(/\D/g, '');
  const encodedMessage = encodeURIComponent(message);
  window.open(`https://api.whatsapp.com/send/?text=${encodedMessage}&phone=${cleanedPhone}`, '_blank');
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
