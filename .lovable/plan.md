

# Permitir Reabrir OS Paga para Edição

## Problema

Atualmente, quando uma OS tem status "pago", a variavel `isLocked = true` bloqueia toda edição. O usuario precisa poder reabrir uma OS paga para corrigir data, adicionar itens esquecidos, etc.

## Solucao

Remover o bloqueio total (`isLocked`) e substituir por um fluxo de "reabrir":

### Arquivo: `src/components/ServiceOrderDialog.tsx`

1. **Remover `isLocked`** como bloqueio geral de edição
2. **Adicionar botão "Reabrir OS"** visivel apenas quando `originalStatus === 'pago'`
   - Ao clicar, muda o status local para `em_andamento` e habilita a edição
   - Adiciona estado `const [unlocked, setUnlocked] = useState(false)`
3. **Nova logica de bloqueio**: `const isLocked = originalStatus === 'pago' && !unlocked`
   - Se o usuario clicou "Reabrir", `unlocked = true` e pode editar normalmente
   - A OS so volta a ser salva como "pago" quando o usuario escolher novamente
4. **Reset `unlocked`** no useEffect de inicializacao (quando abre o dialog)

### Comportamento

- Abrir OS paga → tela mostra dados bloqueados + botao "Reabrir para Edição"
- Clicar "Reabrir" → status muda para "Em Andamento", campos desbloqueiam
- Usuario edita itens/extras/observações normalmente
- Ao salvar, sincroniza pedido como sempre (OS→Pedido)
- Pode marcar como "pago" novamente com nova data

### Nenhuma outra mudanca

O fluxo de sincronizacao OS↔Pedido, cache do React Query e dashboard permanecem inalterados.

