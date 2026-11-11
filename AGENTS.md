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
- DiColore products (new items, names, price tables, groups→categories, deactivation) and stock come straight from ERP views via sync_estoque_erp.py (products to sync-prices rows mode, then sync-stock-erp), both x-sync-token; Sheets route is legacy fallback for the panel button. DiColore customers read the existing public.dw_cliente via sync_clientes_erp.py to sync-customers rows mode (x-sync-token), sending only changed rows; the source is fixed so stale local overrides cannot require view recreation or ERP DDL locks. The customer monitor reuses the installed stock/financial monitor API destination unless MPZ_CLIENTES_API_URL is configured, avoiding internal endpoint disclosure in copyable deliveries.

- DiColore customer profiles carry the ERP dw_cliente attributes as same-named columns; api-externa serves customers through the shared dw layout builder and orders carry the customer's CIF/FOB freight, so third-party integrators receive the exact DW contract.
- ERP customer sync reads only batch codes and orphan document matches, never provisions access in rows mode, and returns every failed code; the monitor uses 250-row batches with bounded transient retries and checkpoints only confirmed rows to avoid timeouts and lost retries.
- ERP customer sync uses a tested store-scoped price-table initializer for inserts and unassigned legacy profiles, while assigned MPZ tables are omitted from updates; this allows full reloads and seller transfers without overwriting manual pricing.

- Each build embeds an automatic source fingerprint and emits network-only app-version.json with targets from public/release.json; route-aware polling on entry, every minute and resume requires a non-dismissable refresh only for affected stores with stale bundles, without clearing cart/auth storage. Edit release.json on each release; never rely solely on service-worker events to detect stale screens.
- Checkout restores payment choices from the authorized saved order on edit; seller/telesales release uses the same validation for new and edited orders, while PDF previews never save or release orders.
- Customer forms share a Zod schema with CPF/CNPJ checksum validation; database triggers validate interactive customer/order writes while leaving ERP service imports and unrelated historical updates untouched.
- Managed-customer stores block self-profile writes with restrictive RLS and stamp customer orders from the authenticated user's official profile; UI read-only fields never serve as authorization.
- Store-specific order status guards run on inserts and updates using authenticated permissions; checkout submission and ERP release remain separate actions to prevent bypassing review.
- Bling order export requires payment_status paid (cron and manual); card refusals store the translated Mercado Pago reason in orders.payment_error, and an abandoned card checkout is cancelled server-side and the cart restored from a local backup, so unpaid orders are never picked.

- Manual payment confirmations use an authorized, row-locked RPC with immutable receipt context on the order; provider callbacks never replace manually confirmed payments, preventing misleading settlement history.
- Customer account and additional addresses share store-scoped queries and managed-store guards; checkout selects saved addresses without replacing the primary profile.
- Payment recovery cancels only after provider checks exclude live payments, preserves refusal history, and rebuilds the cart from the authorized order if the local backup is unavailable.
- DiColore ERP locations resolve IBGE codes locally with CEP fallback; legacy checkout repairs persist server-derived city/state on the RLS-authorized profile before order creation, because order triggers stamp official data. New orders initialize ERP payment defaults; edits retain saved choices.
