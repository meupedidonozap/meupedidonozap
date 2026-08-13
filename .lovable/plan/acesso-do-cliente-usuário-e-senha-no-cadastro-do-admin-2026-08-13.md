# Acesso do cliente (usuário e senha) no cadastro do Admin

## O que muda

No cadastro de cliente do painel (Novo Cliente e Editar Cliente) entra um bloco **Acesso do Cliente**:

- **Usuário**: campo curto onde o vendedor digita apenas o nome (ex.: `ervadoce`); ao lado, fixo, aparece `@dicoloresenses` (o slug da loja atual). O sistema monta o login completo automaticamente.
- **Senha**: campo com mínimo de 6 caracteres, botão de mostrar/ocultar e um botão "Gerar" opcional.
- Aviso abaixo: "Informe estes dados ao cliente. Ele acessa a loja pela aba Código/Usuário e o pedido já sai vinculado ao representante deste cadastro."
- Se o vendedor não preencher usuário/senha, nada muda em relação a hoje (o acesso por Código do Cliente (ERP) continua funcionando como está).
- Na edição de um cliente que já tem acesso, o campo usuário aparece bloqueado e há o botão **Redefinir senha** (digita a nova senha, mínimo 6).

Validações: usuário só com letras/números (acentos e espaços são removidos), mínimo 3 caracteres, único dentro da loja; senha mínima de 6. Erros aparecem no próprio formulário.

## Barra de rolagem

O conteúdo do diálogo de cadastro/edição de cliente passa a ter altura máxima (~85% da tela) com rolagem vertical, mantendo título e botões Salvar/Cancelar sempre visíveis.

## Login do cliente na loja

A aba de login por código passa a se chamar **Código ou Usuário** e aceita tanto o código ERP quanto o usuário criado aqui — a montagem do e-mail interno já é a mesma regra, então basta ajustar rótulo e texto de ajuda.

## Detalhes técnicos

- `supabase/functions/import-customers/index.ts`: aceitar em cada linha os campos opcionais `login` e `senha`. Quando presentes, o e-mail interno passa a ser `login@<slug>.cliente.local` (em vez de `codigo@...`) e a senha usada é a informada, com validação de mínimo 6. Sem esses campos, o comportamento atual (código) é mantido. Redeploy da função.
- `src/pages/StoreAdminPage.tsx`:
  - `customerForm` ganha `loginUser` e `loginPassword`.
  - `createCustomerAccess` envia `login`/`senha` quando preenchidos; passa a ser chamado também quando há usuário/senha mesmo sem código ERP.
  - Novo bloco de UI "Acesso do Cliente" nos dois diálogos, com sufixo `@{store.slug}`.
  - `DialogContent` dos diálogos de cliente: `max-h-[85vh]` com área de campos em `overflow-y-auto`.
  - Após salvar, toast mostrando `Login: usuario@slug · Senha: ...`.
- `src/components/CustomerAuthDialog.tsx`: ajuste de rótulos da aba de código para "Código ou Usuário".
- Sem alteração de schema: o vínculo continua sendo `customer_profiles.user_id`.
