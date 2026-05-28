# Reordenação manual das lojas no Admin Principal

## O que será feito

Permitir que o admin principal reorganize a ordem em que as lojas aparecem em `/admin`, usando botões de subir/descer em cada card de loja. A ordem será salva no banco e respeitada em toda listagem do admin.

## Mudanças

### 1. Banco de dados (migração)
- Adicionar coluna `sort_order` (integer, default 0) na tabela `stores`.
- Inicializar com valores sequenciais baseados em `created_at` (lojas mais recentes primeiro, preservando a ordem atual).
- Criar índice em `sort_order` para performance.

### 2. Hook `src/hooks/useStores.ts`
- Alterar ordenação de `created_at DESC` para `sort_order ASC, created_at DESC` (fallback).
- Adicionar mutation `useReorderStore` para trocar posições entre duas lojas (swap de `sort_order`).

### 3. UI `src/pages/AdminPage.tsx`
- Em cada card de loja, adicionar dois botões discretos: ▲ (subir) e ▼ (descer).
- Desabilitar ▲ na primeira loja e ▼ na última.
- Ao clicar, chamar a mutation, mostrar loader e atualizar a lista (invalida o React Query).
- Visível apenas para platform admins (já é o público de `/admin`).

## Onde fica salvo
A ordem é persistida na coluna `stores.sort_order` no backend, então vale para qualquer dispositivo/sessão do admin.
