## Cadastro de bairros com taxa de entrega (COMIDA/PIZZARIA)

### Objetivo
Permitir ao admin cadastrar bairros atendidos com a respectiva taxa. No checkout, o cliente escolhe "Entregar" ou "Retirar na loja"; se "Entregar", seleciona o bairro e a taxa é somada ao total, com destaque visual.

### Banco
Sem migração. Os bairros ficam em `stores.settings.deliveryNeighborhoods` (JSONB já existente), no formato:
```
[{ id, name, fee }]
```

### Admin — `src/pages/StoreAdminPage.tsx` (aba "Frete/Entrega")
Para lojas `COMIDA` e `PIZZARIA`, adicionar bloco "Bairros atendidos":
- Lista com nome do bairro + taxa (R$) + botão remover
- Linha "Adicionar bairro" (input nome + input taxa + botão +)
- Salva em `stores.settings.deliveryNeighborhoods` via update normal

### Checkout — `src/pages/CheckoutPage.tsx`
1. Para lojas COMIDA/PIZZARIA com bairros cadastrados, adicionar no card "Endereço" (acima do CEP) um toggle:
   - `Entregar` (padrão) / `Retirar na loja`
2. Quando `Retirar na loja`: ocultar campos de endereço, zerar `deliveryFee`, marcar `delivery_shift`/observação com "RETIRAR NA LOJA".
3. Quando `Entregar` e a loja tem bairros cadastrados: substituir o input livre de bairro por um `<Select>` com os bairros cadastrados; ao selecionar, definir `deliveryFee = bairro.fee` e preencher `formData.neighborhood` com o nome.
4. No "Resumo do Pedido", quando houver taxa de bairro, destacar a linha (fundo `bg-accent/10`, ícone `Truck`, label "🛵 Taxa de entrega — <bairro>") e adicionar abaixo do total um pequeno aviso "Inclui taxa de entrega de R$ X,XX".
5. Persistir `deliveryFee`, `deliveryType` ('entrega' | 'retirada') e bairro no pedido (`observations` recebe sufixo "[RETIRAR NA LOJA]" quando aplicável; `deliveryFee` já existe no objeto).

### Tipos — `src/types/index.ts`
- Adicionar `deliveryNeighborhoods?: { id: string; name: string; fee: number }[]` em `StoreSettings`.

### Não alterado
- Lojas LOJA/ACESSORIOS continuam usando Correios.
- SERVICOS não tem entrega.
- Fluxo de pagamento, cupom e validações inalterados.

### Arquivos
- `src/types/index.ts`
- `src/pages/StoreAdminPage.tsx` (bloco bairros na aba de frete)
- `src/pages/CheckoutPage.tsx` (toggle + select bairro + destaque)
