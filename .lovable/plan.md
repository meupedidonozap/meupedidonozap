
Objetivo: fazer o cadastro funcionar exatamente assim: email + senha → endereço → pedido, sem validação de conta por e-mail.

Status do que validei:
- Não, o fluxo atual ainda não está 100% validado de ponta a ponta.
- No código, `src/components/CustomerAuthDialog.tsx` ainda tem a etapa `confirm-email`, o que conflita com o fluxo simples que você pediu.
- O salvamento do endereço depende de sessão autenticada real, porque a segurança da tabela `customer_profiles` exige `auth.uid() = user_id`.
- O hook `useUpsertCustomerProfile()` já usa `getUser()` (isso está certo), mas o restante do fluxo ainda não garante cadastro simples com sessão imediata.

Plano de correção

1. Ajustar a autenticação para cadastro imediato
- Ativar no backend o cadastro com sessão imediata, sem exigir confirmação de e-mail.
- Isso é obrigatório para o fluxo simples funcionar de forma estável.
- Não precisa afrouxar a segurança do banco para isso.

2. Simplificar o `CustomerAuthDialog`
- Remover a lógica/etapa `confirm-email`.
- Depois do `signUp`, só avançar para o formulário de endereço quando a sessão real estiver pronta.
- Se a sessão não aparecer, mostrar erro claro e impedir avanço para evitar perder pedido/cadastro.

3. Fortalecer `useAuth.ts`
- Parar de depender só do estado local/cached para decidir se o usuário está autenticado.
- Fazer o hook refletir melhor a sessão real do backend após cadastro/login.
- Fazer `signUp` retornar um estado confiável de “sessão pronta” antes de liberar o próximo passo.

4. Manter `useCustomerProfile.ts` seguro
- Continuar usando o usuário autenticado real como fonte do `user_id`.
- Não relaxar a RLS.
- Garantir mensagem amigável se a sessão não existir, em vez de erro técnico.

5. Revisão de consistência no checkout
- Conferir `CheckoutPage.tsx` e `useOrders.ts` para garantir que, após salvar o endereço, o pedido também continue vinculado ao usuário sem inconsistência de sessão.

Validação final que precisa ser feita
- Teste real na Dicolore com um cliente novo:
  1. abrir a loja
  2. criar conta com email e senha
  3. preencher e salvar endereço
  4. voltar ao checkout
  5. enviar pedido
- Revalidar também:
  - login com cliente já existente
  - autofill do endereço
  - fluxo sem qualquer tela de confirmação de e-mail

Arquivos envolvidos
- `src/components/CustomerAuthDialog.tsx`
- `src/hooks/useAuth.ts`
- `src/hooks/useCustomerProfile.ts`
- `src/hooks/useOrders.ts` (ajuste de consistência, se necessário)

Detalhe técnico
- O problema não deve ser resolvido soltando a regra do banco.
- A correção certa é alinhar autenticação + sessão + fluxo da UI.
- Para o processo “simples” que você quer, a conta precisa entrar já autenticada, e o endereço só pode salvar depois disso.

Resultado esperado
- O cliente cria a conta e segue direto para o endereço.
- O endereço salva sem erro.
- O pedido fica vinculado ao cliente.
- Não existe mais etapa de validação por e-mail nesse fluxo.
