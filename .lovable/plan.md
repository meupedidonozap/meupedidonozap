## Diagnóstico

- O erro de duplicidade no iPhone vem do cadastro de `push_subscriptions`: hoje o sistema procura uma inscrição existente só por `endpoint`, mas a política de acesso não permite enxergar/atualizar inscrição de outro usuário/aparelho em alguns cenários. Isso gera erro de chave única no `endpoint`.
- A notificação do Android do Ronaldo não chegou porque a função de envio está falhando com: `VAPID_PRIVATE_KEY not configured`.
- A regra de destinatário está correta para o pedido recente: cliente com `seller_code = 21` resolve para `Ronaldo` e `Televendas Grazi`.
- Hoje existe 1 aparelho ativo para Ronaldo, mas o comportamento desejado é: todos os aparelhos logados no mesmo usuário/vendedor e com notificação ativada devem receber.

## Plano de correção

1. **Configurar o envio push no backend**
   - Adicionar/configurar o segredo `VAPID_PRIVATE_KEY` correspondente à chave pública já usada no app.
   - Manter a função `notify-new-order` usando essa chave para assinar e entregar as notificações.

2. **Corrigir cadastro por múltiplos aparelhos**
   - Ajustar a ativação de push para permitir vários aparelhos por usuário/vendedor.
   - Resolver duplicidade de `endpoint` fazendo upsert robusto: se o mesmo navegador/aparelho já existir, reativa e atualiza; se for outro aparelho, cria nova inscrição.
   - Garantir que o cadastro sempre grave `store_id`, `seller_id`, `user_id`, `endpoint`, `p256dh`, `auth`, `user_agent` e `is_active = true`.

3. **Ajustar regra de leitura/atualização da inscrição**
   - Criar uma função/política segura no banco para permitir que o próprio usuário reative/atualize sua inscrição sem esbarrar no erro de duplicidade.
   - Preservar RLS: usuário comum só gerencia as próprias inscrições; serviço backend continua podendo enviar para todos os vendedores vinculados.

4. **Garantir envio para todos os aparelhos ativos**
   - Conferir a função `notify-new-order` para buscar todas as inscrições ativas dos destinatários (`seller_id IN (...)`) e enviar para cada uma.
   - Não limitar por usuário nem por um único aparelho.
   - Manter desativação automática de inscrições mortas quando o navegador retorna 404/410.

5. **Melhorar mensagem de erro na tela**
   - Trocar o erro técnico de duplicidade por uma mensagem amigável como: “Este aparelho já tinha uma inscrição; tente novamente ou desative/ative as notificações.”
   - Quando possível, tentar corrigir automaticamente reativando a inscrição.

6. **Validar com dados da Dicolore**
   - Confirmar que Ronaldo continua vinculado ao vendedor código `21`.
   - Confirmar que pedidos novos de clientes com `seller_code = 21` disparam para Ronaldo e para televendas vinculados.
   - Após a chave VAPID estar configurada, testar/confirmar que a função não retorna mais erro 500.

## Observação importante

Para finalizar 100%, preciso que a chave privada VAPID seja cadastrada como segredo do backend. Se ela não existir/não for conhecida, será necessário gerar um novo par VAPID e atualizar tanto a chave pública no app quanto a privada no backend.