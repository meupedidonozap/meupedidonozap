## Problema diagnosticado

O usuário **não** está com problema de cache do navegador. Está caindo em um loop causado pelo nosso próprio `ErrorBoundary`:

1. Algo no código (provavelmente um erro JS específico no fluxo do carrinho da DICOLORE) dispara um crash do React.
2. O `ErrorBoundary` mostra a tela "Ops! Algo deu errado" com o botão **"Limpar Cache e Atualizar"**.
3. Esse botão (`src/components/CacheBuster.tsx`) chama `localStorage.clear()` e `sessionStorage.clear()`, **apagando o carrinho** (`cart_dicolore`) e a sessão do cliente logado.
4. O usuário entra de novo, refaz o pedido, e o **mesmo crash acontece** — porque o problema nunca foi cache, e sim um bug em runtime. A tela aparece de novo, ela limpa de novo, perde tudo de novo. Loop infinito.

Isso vai acontecer igual no Safari iOS e no Chrome — não é específico do navegador, é um bug do app que está sendo mascarado pelo ErrorBoundary.

## O que vou mudar

### 1. `src/components/CacheBuster.tsx` — parar de destruir dados do usuário
- **Remover** `localStorage.clear()` e `sessionStorage.clear()`. Esses storages guardam **carrinho e sessão de login**, não cache de versão. Limpá-los nunca resolve o erro real, só causa perda de dados.
- Manter apenas: limpar `caches` API e desregistrar service workers (que é o que de fato resolve cache de assets).
- Mesmo ajuste no auto-clear do `src/main.tsx` (rota `?limpar`): preservar carrinho e sessão.

### 2. `src/components/ErrorBoundary.tsx` — diagnóstico em vez de loop
- Em vez de oferecer "Limpar Cache" como solução padrão (que destrói dados), oferecer:
  - **Botão primário "Recarregar página"** (apenas `window.location.reload()`).
  - Botão secundário "Voltar à loja".
  - Botão discreto "Limpar cache" só como último recurso, com aviso claro de que vai deslogar.
- **Mostrar a mensagem de erro real** (`this.state.error?.message`) num bloco recolhível, para que possamos diagnosticar o crash quando o usuário enviar o print.
- Logar o erro para o console com prefixo `[ErrorBoundary]` para facilitar capturar nos logs do navegador.

### 3. Reforço defensivo no `CartContext`
- No `setStoreId`, envolver o `JSON.parse(saved)` em try/catch já existe — mas se o parse retornar algo inválido (ex.: items não é array), pode quebrar renderização. Validar a forma do objeto carregado e descartar se estiver corrompido, em vez de retornar para o estado inicial silenciosamente.

## O que isso resolve

- **Quebra o ciclo**: mesmo que ainda exista um bug em runtime, o usuário não perde mais o carrinho ao tentar de novo, e a recarga simples já é suficiente na maioria dos casos transitórios.
- **Permite diagnosticar**: na próxima vez que aparecer a tela de erro, vamos ver a mensagem real do crash e poder corrigir a causa-raiz.

## Próximo passo (depois desta correção)

Pedir à usuária da DICOLORE para reproduzir uma vez mais e mandar print da nova tela de erro (que agora vai mostrar a mensagem técnica). Com isso identificamos e corrigimos o crash original, em vez de só tratar o sintoma.

## Arquivos afetados

- `src/components/CacheBuster.tsx`
- `src/components/ErrorBoundary.tsx`
- `src/main.tsx`
- `src/contexts/CartContext.tsx`
