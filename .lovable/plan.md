## Problema

O preview de impressão da térmica está saindo como folha A4 inteira (vide print: "1 folha de papel"). A regra `@page { size: 80mm auto }` está correta no HTML do iframe, mas o Chrome **ignora `@page` quando o `print()` é disparado de um `<iframe>` invisível** — ele usa as configurações de página do documento pai (A4). Por isso o conteúdo sai estreito no canto de uma folha A4, sem corte automático.

A nova impressora `GS-FJ80H-UE` é 80mm padrão (área imprimível ~72mm), então a correção serve para as duas.

## Solução

### 1. Trocar iframe por `window.open` na impressão térmica
Arquivos: `src/lib/printOrder.ts`, `src/lib/printReceipt.ts`

- Substituir o fluxo `createElement('iframe') → print()` por `window.open('', '_blank', 'width=380,height=600')`, escrever o HTML completo, aguardar `onload` e disparar `print()` na janela aberta. Chrome respeita `@page { size: 80mm auto }` em janelas reais, fazendo o papel ter altura exatamente igual ao conteúdo.
- Fechar a janela após o print (`onafterprint`).
- Manter o fluxo A4 atual (já funciona).

### 2. Ajustar CSS do recibo térmico
- `@page { size: 80mm auto; margin: 0; }` (margem zero — a impressora térmica já tem margem física).
- `body { width: 72mm; padding: 3mm; margin: 0; }` (área imprimível real).
- Remover o `width: 280px` em px (não escala bem entre impressoras 80mm) e usar `mm`.
- Garantir que não há `min-height` ou elemento que force altura adicional.

### 3. Configuração por loja: impressora padrão
Arquivo: `src/components/SalonAdminTab.tsx` (ou aba de configurações da loja onde já estão settings)

- Adicionar campo no `settings` JSONB da loja: `default_printer: 'thermal_80mm' | 'a4'`.
- No menu de impressão em `StoreAdminPage.tsx` (linhas 1187-1200), quando `default_printer === 'thermal_80mm'`, o botão da impressora dispara direto `printOrder(order, store.name, 'thermal', ...)` em vez de abrir o dropdown — mantendo o dropdown apenas como opção secundária (long-press ou menu "...").
- Não é possível pular o diálogo nativo do navegador (limitação do Chrome), mas com `@page size: 80mm auto` o preview já mostra o tamanho correto e o usuário só clica "Imprimir".

## Detalhes técnicos

**Por que iframe não funciona para `@page`:** o Chrome trata `iframe.print()` como impressão do documento host. Já `window.open().print()` cria um contexto de impressão independente que honra `@page size`.

**Estrutura final do CSS térmico:**
```css
@page { size: 80mm auto; margin: 0; }
@media print {
  html, body { margin: 0; padding: 0; }
  body { width: 72mm; padding: 3mm 4mm; }
}
body { font-family: 'Courier New', monospace; font-size: 11px; line-height: 1.35; }
```

**Sem mudanças de schema** (campo `default_printer` vai dentro do `settings` JSONB já existente em `stores`).

## Arquivos alterados
- `src/lib/printOrder.ts` — trocar iframe→window.open + CSS térmico
- `src/lib/printReceipt.ts` — mesmo tratamento
- `src/pages/StoreAdminPage.tsx` — usar `store.settings.default_printer` no botão de impressão
- Aba de configurações da loja — novo seletor "Impressora padrão"
