# Project Architecture Rules

- ERP financial records are mirrored and authorized by normalized customer code; they do not depend on locally-created orders.
- Sellers/telesales see ERP titles and invoices only for customers linked to their seller codes in the customer register; the ERP document's own seller code never grants access. Store and platform admins see all.
- Store financial display cutoffs live in store settings and filter reads without deleting synchronized history.
- ERP orders (erp_orders/erp_order_items) are synced by the ERP script via sync-titles, keyed by filial|pedcod, and authorized with the same customer-portfolio rule as titles; the Vendas > Pedidos tab reads them for DiColore.
