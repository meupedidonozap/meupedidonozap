# Project Architecture Rules

- App-shell updates use the single guarded service-worker registrar and a shared in-memory update signal; refresh never clears auth/cart storage or unrelated messaging workers, preventing data loss and preview caching.

- ERP financial records are mirrored and authorized by normalized customer code; they do not depend on locally-created orders.
- Sellers/telesales see ERP titles and invoices only for customers linked to their seller codes in the customer register; the ERP document's own seller code never grants access. Store and platform admins see all.
- Store financial display cutoffs live in store settings and filter reads without deleting synchronized history.
- ERP orders (erp_orders/erp_order_items) are synced by the ERP script via sync-titles, keyed by filial|pedcod, and authorized with the same customer-portfolio rule as titles; the Vendas > Pedidos tab reads them for DiColore.
- ERP order export resolves customer registrations through the tested shared resolver before building the payload; explicit codes never fall back to a different registration, preventing duplicate login profiles from changing transmitted identity.
- Windows ERP sync sources and regression tests live under scripts/dicolore; order refresh sends complete headers in bounded daily or explicit-code queries without item reads by default, so OF/NF progress is independent of expensive item synchronization.
- Store PIX/card receiving is configured per store in settings.paymentGateway; PIX uses a locally generated BR Code (static key + exact amount) so money goes straight to the store's own account without a gateway API, and payment is confirmed manually in the admin.
