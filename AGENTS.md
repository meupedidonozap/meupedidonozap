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

- Stock reservation is done by an orders trigger (deduct when status leaves orcamento/cancelado, restore on cancel); Bling sync subtracts open-order reservations from its saldo so the 5-min cron never re-adds reserved units.
- Mercado Pago refunds run only server-side via the mercadopago function (action refund, store order permission required) and set the order cancelado/refunded.
- MPZ orders are exported to Bling (POST /pedidos/vendas) by bling-sync on the 5-min cron and via action send_orders; numeroLoja "MPZ-<order_number>" deduplicates and orders.bling_order_id/bling_error/bling_attempts track state (max 5 retries, online payments only after paid).

- External third-party API for DiColore lives in the api-externa function (x-api-key = EXTERNAL_API_TOKEN); order routes proxy orders-export so the payload stays identical, and customers pending ERP are those with empty customer_code and no erp_sent_at.
- DiColore stock comes from the ERP view mpz_produto_estoque via sync-stock-erp (x-sync-token), subtracting MPZ orders not yet transmitted to the ERP; the Sheets route is legacy.

- DiColore customer profiles carry the ERP dw_cliente attributes as same-named columns; api-externa serves customers through the shared dw layout builder and orders carry the customer's CIF/FOB freight, so third-party integrators receive the exact DW contract.

- The "new version" banner shows only for stores listed in public/release.json ("all" for everyone); other stores update silently, so store-specific releases do not interrupt unrelated tenants. Edit that file on each release.
- Checkout restores payment choices from the authorized saved order on edit; seller/telesales release uses the same validation for new and edited orders, while PDF previews never save or release orders.
