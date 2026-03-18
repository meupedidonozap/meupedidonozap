

# Erro de Build: @swc/core native binding

## Diagnóstico

O erro **"Failed to load native binding"** do `@swc/core` é um problema de infraestrutura do ambiente de build, **não é causado pelas mudanças de código** que fizemos. O pacote `@swc/core` (usado internamente pelo `@vitejs/plugin-react-swc`) requer binários nativos compilados para a plataforma específica, e o ambiente de build não conseguiu carregá-los.

## Solução

Este erro normalmente se resolve sozinho ao re-triggerar o build, pois é intermitente no ambiente de sandbox. Vou fazer uma edição mínima no `vite.config.ts` (adicionar um comentário) para forçar um novo build limpo.

Quanto ao teste de visitas — depois que o build voltar a funcionar, o fluxo pode ser testado manualmente:
1. Acessar a URL de uma loja no preview (ex: `/loja/slug-da-loja`)
2. Entrar no painel admin e verificar a aba "Visitas"

## Ação

- Forçar rebuild com edição trivial no `vite.config.ts`

