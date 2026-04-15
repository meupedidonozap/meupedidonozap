

# Simplificar criação de senha para clientes da DICOLORE

## Problema
O formulário de cadastro não deixa claro como criar a senha. Como a DICOLORE não tem venda online nem dados sensíveis, o processo pode ser simplificado.

## Limitação técnica
O sistema de autenticação exige no mínimo 6 caracteres para a senha — isso não pode ser alterado. Porém podemos simplificar a experiência.

## Solução

### Arquivo: `src/components/CustomerAuthDialog.tsx`

1. **Remover o campo "Confirmar Senha"** — reduz atrito, o campo de confirmação é desnecessário para um sistema simples
2. **Melhorar os textos e placeholders** para deixar claro o que o usuário deve fazer:
   - Placeholder da senha: `"Crie uma senha simples (mín. 6)"` em vez de `"Mínimo 6 caracteres"`
   - Adicionar texto auxiliar abaixo do campo: `"Ex: seu nome + 123"`
3. **Mostrar/ocultar senha** — adicionar botão de olho (Eye/EyeOff) no campo de senha para que o usuário veja o que está digitando, evitando erros

### Resultado
- Formulário com apenas 2 campos (email + senha) em vez de 3
- Texto claro com exemplo de senha simples
- Botão para visualizar a senha digitada

