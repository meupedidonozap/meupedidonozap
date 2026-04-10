

# Ativar Boleto para a loja DICOLORE

## Problema
A loja DICOLORE não tem a opção "Boleto" habilitada nas formas de pagamento (`acceptBoleto: false` no campo `settings`).

## Solução
Executar uma migração SQL para atualizar o campo `settings` da loja DICOLORE, adicionando `acceptBoleto: true`.

```sql
UPDATE stores
SET settings = jsonb_set(settings, '{acceptBoleto}', 'true')
WHERE slug = 'dicolore';
```

Nenhuma alteração de código é necessária — o checkout e o painel admin já verificam `store.settings.acceptBoleto` e exibem a opção automaticamente quando está `true`.

## Resultado
- A opção "Boleto" aparecerá no checkout da DICOLORE e na criação manual de pedidos
- Nenhuma outra loja é afetada

