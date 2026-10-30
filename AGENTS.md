# Project Architecture Rules

- App-shell updates use the single guarded service-worker registrar and a shared in-memory update signal; refresh never clears auth/cart storage or unrelated messaging workers, preventing data loss and preview caching.

- ERP financial records are mirrored and authorized by normalized customer code; they do not depend on locally-created orders.
- Sellers/telesales see ERP titles through the customer portfolio; DiColore invoices instead use the invoice representative, enforced in RLS with normalized seller codes. Own customers see their invoices and store/platform admins see all, keeping invoice ownership independent of portfolio transfers.
- ERP item identity is aligned to its ERP order header by a database trigger; item reads resolve the header customer or an authorized DiColore invoice representative, preventing stale item codes from hiding synchronized items.
- Store financial display cutoffs live in store settings and filter reads without deleting synchronized history.
- ERP orders (erp_orders/erp_order_items) are synced by the ERP script via sync-titles, keyed by filial|pedcod, and authorized with the same customer-portfolio rule as titles; the Vendas > Pedidos tab reads them for DiColore.
- ERP order export resolves customer registrations through the tested shared resolver before building the payload; explicit codes never fall back to a different registration, preventing duplicate login profiles from changing transmitted identity.
- Windows ERP sync sources and regression tests live under scripts/dicolore; period order refresh lists codes from the base order table, then reads the ERP view in small code batches that are each confirmed before the next (splitting batches that time out), without item reads by default, because the view's per-order subqueries make wide date queries exceed the ERP timeout.
- Store PIX/card receiving is configured per store in settings.paymentGateway; PIX uses a locally generated BR Code (static key + exact amount) so money goes straight to the store's own account without a gateway API, and payment is confirmed manually in the admin.
