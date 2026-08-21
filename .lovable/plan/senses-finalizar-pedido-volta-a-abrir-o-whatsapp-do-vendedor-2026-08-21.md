# SENSES: FINALIZAR PEDIDO volta a abrir o WhatsApp do vendedor

## Situação atual (verificada no código)

No checkout, o fluxo de cliente comum (não Modo Vendedor) já cria o pedido e em seguida chama a abertura do WhatsApp do vendedor selecionado. O botão já mostra **FINALIZAR PEDIDO** na Senses. Ou seja, a regra existe, mas a janela do WhatsApp muitas vezes não abre.

Causa mais provável (ainda não confirmada em execução): a abertura da janela acontece **depois** de salvar o pedido no servidor. Como há uma espera entre o clique e o `window.open`, o navegador (principalmente iPhone/Safari e Chrome no celular) bloqueia a janela por não ser mais considerada uma ação direta do usuário. Nada avisa o cliente disso — ele vê "Pedido enviado!" e nenhuma tela do WhatsApp.

## O que muda

1. **Senses volta a enviar pelo WhatsApp** no clique em FINALIZAR PEDIDO, com o vendedor obrigatório já selecionado (comportamento igual ao da DiColore). O rótulo do botão continua **FINALIZAR PEDIDO**.
2. **Abertura à prova de bloqueio**: a janela do WhatsApp é aberta imediatamente no clique e apenas atualizada com a mensagem depois que o pedido é gravado.
3. **Plano B visível**: se ainda assim o navegador bloquear, aparece uma tela de confirmação com o nome do vendedor e um botão grande "Abrir WhatsApp de [vendedor]", que o cliente toca para enviar. Assim o pedido nunca fica sem transmissão.
4. Modo Vendedor (vendedor logado fazendo pedido para o cliente) continua como está: grava o pedido sem abrir WhatsApp.

## Detalhes técnicos

Arquivo: `src/pages/CheckoutPage.tsx`

- Em `handleSendWhatsApp`: após `validateForm()` e antes do `await createOrder.mutateAsync(...)`, abrir `window.open('', '_blank')` (gesto do usuário) e guardar a referência; após a criação, atribuir `win.location.href` com a URL do WhatsApp montada por `openWhatsApp`.
- Extrair de `openWhatsApp` (em `src/lib/formatters.ts`) um `buildWhatsAppUrl(phone, message)` para reutilizar a URL sem abrir janela; `openWhatsApp` passa a usá-lo (sem mudança de comportamento para os demais chamadores).
- Se `win` for `null` (popup bloqueado) ou o pedido demorar, gravar em estado `pendingWhatsApp = { url, sellerName }` e renderizar um `Dialog` com botão âncora `href={url} target="_blank"` — clique direto do usuário, sem bloqueio.
- Manter `sellerOrder` (Modo Vendedor) com o retorno antecipado atual; a mudança vale apenas para o fluxo de cliente.
- Nenhuma alteração no rótulo do botão, no bloco "📱 Enviar pedido para", nas validações ou em outras lojas.
