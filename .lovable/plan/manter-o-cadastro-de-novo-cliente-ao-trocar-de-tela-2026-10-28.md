# Manter o cadastro de novo cliente ao trocar de tela

## O que muda
Quando o vendedor/televendas estiver cadastrando um novo cliente e sair para outro app (WhatsApp, por exemplo) ou o navegador recarregar a página, ao voltar:
- a janela de cadastro reabre sozinha, na aba "Novo cliente";
- todos os campos já digitados (CNPJ/CPF, nome, telefone, endereço etc.) continuam preenchidos;
- a busca de cliente digitada também é mantida.

O rascunho é apagado quando o cliente é salvo com sucesso ou quando o usuário fecha/cancela a janela de propósito. Rascunhos com mais de 24 horas são descartados.

Vale para Android (Chrome, Firefox), iOS (Safari, Chrome, Firefox) e Windows (Chrome, Edge) — inclusive quando o celular "mata" a aba em segundo plano.

## Detalhes técnicos
- Novo `src/lib/customerDraft.ts`: salvar/ler/limpar rascunho em `localStorage` com chave por loja + usuário (`mpz:customer-draft:<storeId>`), contendo `form`, `mode`, `search`, `open`, `savedAt`; expira em 24h.
- `SellerCustomerDialog.tsx`: inicializa `form/mode/search` a partir do rascunho; grava a cada alteração (debounce curto) e também em `visibilitychange`/`pagehide` (iOS); limpa no sucesso do cadastro e no fechamento manual.
- `SellerModeBar.tsx` e `CheckoutPage.tsx`: ao montar, se houver rascunho com `open=true`, reabrem a janela automaticamente.
- Teste `src/lib/customerDraft.test.ts`: salvar/ler, expiração de 24h, limpeza.
