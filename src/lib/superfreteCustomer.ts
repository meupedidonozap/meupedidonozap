type ShippingCustomer = {
  cpfCnpj?: string | null;
  whatsapp?: string | null;
};

const digits = (value?: string | null) => String(value || '').replace(/\D/g, '');

export function isSuperfreteShipping(code?: string | null) {
  return /^SF-\d+$/.test(String(code || ''));
}

export function getSuperfreteCustomerError(customer: ShippingCustomer, shippingCode?: string | null) {
  if (!isSuperfreteShipping(shippingCode)) return null;

  const documentLength = digits(customer.cpfCnpj).length;
  if (documentLength !== 11 && documentLength !== 14) {
    return 'Informe o CPF/CNPJ do cliente (11 ou 14 dígitos) para gerar a etiqueta do Super Frete.';
  }

  const phoneLength = digits(customer.whatsapp).length;
  if (phoneLength !== 10 && phoneLength !== 11) {
    return 'Informe um WhatsApp com DDD (10 ou 11 dígitos) para gerar a etiqueta do Super Frete.';
  }

  return null;
}
