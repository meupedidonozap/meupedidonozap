
# Mostrar Botao "Faca Login" e Nome do Usuario no Header

## O que sera feito

### 1. Usuario NAO logado: botao "Faca Login" com seta
Substituir o icone de login sozinho por um botao com texto "Faca Login" e uma seta, tornando mais claro para o usuario que ele pode se autenticar.

### 2. Usuario LOGADO: nome ao lado do icone de usuario
Buscar o perfil do cliente (`customer_profiles`) para exibir o primeiro nome ao lado do icone de usuario no header, sem circulo ou borda extra. Exemplo: `[icone] Denis`

## Mudancas Tecnicas

### Arquivo: `src/pages/ProductStorePage.tsx`

**Adicionar import:**
- `useCustomerProfile` de `@/hooks/useCustomerProfile`

**Adicionar hook (junto aos outros hooks, ~linha 37):**
```typescript
const { data: customerProfile } = useCustomerProfile(user?.id, store?.id);
```

**Substituir bloco de login/usuario no header (linhas 174-191):**

Quando `user` existe (logado):
```tsx
<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button variant="ghost" size="sm" className="gap-1">
      <User className="h-5 w-5" />
      <span className="text-sm max-w-[100px] truncate">
        {customerProfile?.name?.split(' ')[0] || 'Perfil'}
      </span>
    </Button>
  </DropdownMenuTrigger>
  {/* ...dropdown items permanecem iguais */}
</DropdownMenu>
```

Quando `user` NAO existe (deslogado):
```tsx
<Button variant="ghost" size="sm" className="gap-1"
  onClick={() => setAuthDialogOpen(true)}>
  <LogIn className="h-4 w-4" />
  <span className="text-sm">Faca Login</span>
</Button>
```

### Arquivo: `src/pages/FoodStorePage.tsx`

Aplicar as mesmas mudancas no header da loja de comida:
- Importar `useAuth`, `useCustomerProfile`, `CustomerAuthDialog`
- Adicionar hooks de autenticacao e perfil
- Adicionar botao "Faca Login" quando deslogado
- Mostrar nome do usuario quando logado
- Adicionar o `CustomerAuthDialog` no JSX

## Resumo

| Estado | Antes | Depois |
|---|---|---|
| Deslogado | Icone de seta sozinho | Botao "Faca Login" com icone |
| Logado | Icone de usuario sozinho | Icone + primeiro nome do cliente |
