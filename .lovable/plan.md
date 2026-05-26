## Comprovante de Compra (Não Fiscal)

Sim, é totalmente possível — o CNPJ é do **estabelecimento (loja)**, não seu. Cada loja terá o próprio CNPJ cadastrado nas configurações e impresso no comprovante.

### 1. Cadastro do CNPJ por loja
- Adicionar campo **CNPJ** em `stores.settings.cnpj` (JSONB já existente, sem migration).
- Adicionar input "CNPJ" na aba **Geral** da `StoreAdminPage` (formatação automática `00.000.000/0000-00`).
- Pré-preencher para a Pastelaria RM26: `65.950.355/0001-97`.

### 2. Função de impressão do comprovante
- Criar `src/lib/printReceipt.ts` com função `printReceipt({ storeName, cnpj, address, items, total, paymentMethod, receiptNumber, dateTime })`.
- Layout térmico 80mm (mesmo padrão de `printOrder.ts`):
  ```
  ================================
        NOME DA LOJA
       CNPJ: 65.950.355/0001-97
       Endereço da loja
  ================================
  COMPROVANTE DE PAGAMENTO
  Nº 000123  |  26/05/2026 14:32
  Mesa 5 - Comanda 2
  --------------------------------
  ITENS PAGOS
  1) X-Burger              R$ 25,00
  2) Refrigerante 350ml    R$  6,00
  --------------------------------
  Forma de pagamento: PIX
  TOTAL PAGO:           R$ 31,00
  ================================
  *** ESTE DOCUMENTO NÃO É ***
  ***    CUPOM FISCAL     ***
  Apenas comprovante interno
  ================================
  ```

### 3. Onde aparece o botão "Imprimir Comprovante"
No `TableSessionDialog` → `PaymentDialog` (fluxo de pagamento parcial/total já existente):
- Após confirmar pagamento dos itens selecionados, mostrar botão **"🖨️ Imprimir Comprovante"**.
- Também adicionar botão de impressão ao lado de cada item já marcado como **PAGO** (status `paid`) na lista da comanda, para reimpressão.
- E um botão **"Imprimir comprovante da comanda"** quando a comanda inteira estiver paga.

### 4. Numeração do comprovante
Usar o `order_number` do pedido de pagamento gerado (já existe quando o pagamento parcial cria a `order` com `origem='mesa'`). Sem nova sequência no banco.

### Resumo técnico
- **Sem migrations** — CNPJ vai no `settings` JSONB.
- **Arquivos novos:** `src/lib/printReceipt.ts`.
- **Arquivos editados:** `src/pages/StoreAdminPage.tsx` (campo CNPJ), `src/components/TableSessionDialog.tsx` (botões de impressão no PaymentDialog e na lista de itens pagos).
- Nenhuma mudança em RLS, edge functions ou tipos.