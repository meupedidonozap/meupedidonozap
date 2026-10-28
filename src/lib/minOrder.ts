/** Valor mínimo efetivo do pedido. Na DiColore, vendedor/televendas não têm mínimo (pedidos de complemento). */
export function effectiveMinOrder(store: { slug?: string; settings?: { minOrderValue?: number } } | null | undefined, isSellerMode: boolean): number {
  if (isSellerMode && store?.slug === 'dicolore') return 0;
  return Number(store?.settings?.minOrderValue) || 0;
}
