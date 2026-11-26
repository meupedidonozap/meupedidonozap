export interface InvoiceItemRow {
  key: string;
  code: string;
  name: string;
  quantity: number;
  unit: number;
  total: number;
}

type Row = Record<string, unknown>;

const num = (value: unknown) => Number(value) || 0;

/**
 * Itens exibidos em "Ver itens da nota": os itens reais da NF (dw_nota_fiscal_item) têm
 * prioridade; os itens faturados do pedido só entram quando a nota ainda não tem itens.
 */
export function resolveInvoiceItems(
  invoiceItems: Row[],
  orderItems: Row[],
  productNames: Record<string, string> = {},
): InvoiceItemRow[] {
  if (invoiceItems.length) {
    return invoiceItems.map((it) => {
      const code = String(it.produto_codigo || '');
      return {
        key: String(it.id || it.external_key),
        code,
        name: productNames[code] || '',
        quantity: num(it.quantidade),
        unit: num(it.valor_unitario),
        total: num(it.valor_total),
      };
    });
  }
  return orderItems.filter((it) => num(it.quantidade_faturada) > 0).map((it) => {
    const code = String(it.produto_codigo || '');
    return {
      key: String(it.id),
      code,
      name: String(it.produto_descricao || '') || productNames[code] || '',
      quantity: num(it.quantidade_faturada),
      unit: num(it.valor_unitario),
      total: num(it.quantidade_faturada) * num(it.valor_unitario),
    };
  });
}
