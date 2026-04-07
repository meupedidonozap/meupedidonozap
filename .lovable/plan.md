

# Adicionar CEP de Origem na Loja + Cotação de Frete no Checkout

## Resumo

1. Adicionar campo de CEP no cadastro/configurações da loja (admin)
2. No checkout de lojas tipo LOJA e ACESSORIOS, quando o cliente digitar o CEP, calcular frete automaticamente usando uma edge function que consulta a API dos Correios
3. Cliente escolhe entre PAC e SEDEX, e o valor é somado ao total

## Mudanças

### 1. Tipo `StoreSettings` — adicionar configuração de frete

Em `src/types/index.ts`, adicionar ao `StoreSettings`:

```typescript
shipping?: {
  enabled: boolean;
  originCep: string;
  defaultWeight: number;  // kg
  defaultLength: number;  // cm
  defaultWidth: number;   // cm
  defaultHeight: number;  // cm
}
```

### 2. Admin — campo CEP de origem + config de frete

Em `src/pages/StoreAdminPage.tsx`, na aba Configurações:
- Substituir o campo "Endereço" (textarea livre) por campos estruturados: **CEP**, UF, Cidade, Bairro, Endereço, Número
- Auto-preenchimento via ViaCEP (já existe `fetchAddressByCep`)
- Para lojas tipo LOJA e ACESSORIOS, exibir seção "Frete Correios" com toggle para ativar e campos de peso/dimensões padrão
- O CEP da loja é salvo em `settings.shipping.originCep` e o endereço completo continua no campo `address`

### 3. Edge Function `correios-shipping`

Nova função em `supabase/functions/correios-shipping/index.ts`:
- Recebe: CEP origem, CEP destino, peso, dimensões
- Consulta API pública dos Correios (calculador de preços/prazos)
- Retorna opções PAC e SEDEX com preço e prazo estimado
- Sem necessidade de API key ou contrato

### 4. Checkout — cotação de frete

Em `src/pages/CheckoutPage.tsx`, para lojas com `settings.shipping?.enabled`:
- Quando CEP do cliente for digitado (8 dígitos), chamar a edge function
- Exibir opções de frete (ex: "PAC — R$ 25,90 (8 dias úteis)" / "SEDEX — R$ 45,00 (3 dias úteis)")
- Cliente seleciona a modalidade
- Valor do frete substitui a `deliveryFee` fixa no cálculo do total
- Para lojas sem frete Correios ativado, continua com taxa fixa como hoje

### 5. Nenhuma migração de banco

Tudo fica no JSONB `settings` da tabela `stores` (já existente). O valor do frete já é salvo no campo `delivery_fee` do pedido.

## Fluxo

```text
Admin configura CEP de origem + peso/dimensões na aba Configurações
                    ↓
Cliente no checkout digita CEP → sistema consulta Correios
                    ↓
Mostra: PAC (R$ X, Y dias) / SEDEX (R$ X, Y dias)
                    ↓
Cliente escolhe → frete somado ao total → pedido salvo com frete real
```

## Arquivos envolvidos

- `src/types/index.ts` — tipo `shipping` no `StoreSettings`
- `supabase/functions/correios-shipping/index.ts` — nova edge function
- `src/pages/StoreAdminPage.tsx` — CEP de origem + config frete
- `src/pages/CheckoutPage.tsx` — cotação + seleção de frete

