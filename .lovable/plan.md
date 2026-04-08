

# Mensagem WhatsApp compacta para pedidos extensos

## Formato proposto

```text
📋 *PEDIDO DICOLORE PROFISSIONAL*
📅 08/04/2026, 17:29

👤 DENIS TESTE 2
📱 (47) 99717-8657
📍 Rod. Dep. Antônio Heil, 542 - Limoeiro
    88352-502 Brusque/SC
💳 PIX | 🚚 Tarde

━━━━━━━━━━━━━━━━━━
📦 *ITENS (3)*
━━━━━━━━━━━━━━━━━━
• 000 Extra Clareador C | 6un | R$ 18,90 → *R$ 17,96* (-5%) | *R$ 107,73*
• OX 20 Vol 900ml | 2un | R$ 25,00 | *R$ 50,00*
• Máscara Hidratante | 1un | R$ 38,50 | *R$ 38,50*
━━━━━━━━━━━━━━━━━━

Subtotal: R$ 196,23
💰 *TOTAL: R$ 196,23*
```

## O que muda

- Cada item em **uma linha só** com bullet `•`: nome | qtd | preço | total
- Sem cabeçalho de tabela, sem numeração sequencial, sem pipes duplos
- Desconto inline: preço original → preço com desconto (-X%)
- Emojis para seções (📋📦💳🚚💰)
- Negrito WhatsApp (`*texto*`) nos valores importantes
- CPF/CNPJ só aparece se preenchido
- Separadores com `━` (mais limpo que `---`)
- Contador de itens no cabeçalho da seção

## Arquivo modificado

- `src/lib/formatters.ts` — reescrever `generateWhatsAppMessage`

