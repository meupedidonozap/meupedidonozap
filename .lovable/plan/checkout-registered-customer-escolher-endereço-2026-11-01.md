# Checkout: registered customer + "Escolher endereço"

## What changes (JEWOS and other stores)

1. **No forced "Selecionar cliente"**
   - When the logged-in person is a seller/admin and has NOT picked a customer, the order goes in their own registered name (the name/WhatsApp already shown), instead of blocking with "Selecione o cliente antes de finalizar o pedido".
   - Picking a customer with "Selecionar cliente" still works as today.
   - DiColore keeps the current rule (must choose the customer), since its orders go to the ERP.

2. **Entregar = registered address by default**
   - When "Entregar" is chosen, the address fields are replaced by a summary card with the address from the registration (street, number, neighborhood, city/UF, zip code). Shipping is calculated automatically from that zip code.
   - A **"Escolher endereço"** button opens the fields (CEP, UF, city, neighborhood, street, number, complement) so the customer can enter a different zip code and address. Shipping is recalculated for the new zip code.
   - A **"Usar endereço do cadastro"** link goes back to the saved address.
   - If the registration has no address, the fields open automatically.
   - The other address is used only for this order. The registration is not changed.

3. **Retirar na loja**: unchanged (no address, no shipping).

## Technical details
- `src/pages/CheckoutPage.tsx`:
  - Validation: skip the `isSellerMode && !selectedCustomer` block when the store is not DiColore; the order uses the logged-in user's profile.
  - New state `useOtherAddress` (default false; true if the profile has no CEP/address). Keep a snapshot of the profile address. Summary card + "Escolher endereço" button; on toggle back, restore the snapshot and recalculate shipping.
  - Order saving must not overwrite the customer's saved address when `useOtherAddress` is true.
