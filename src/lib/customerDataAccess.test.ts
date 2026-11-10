import { describe, expect, it } from 'vitest';
import { customerDataIsReadOnly } from './customerDataAccess';
describe('cadastro mantido pela loja', () => {
  it.each(['dicolore', 'dicoloresenses'])('cliente %s não pode editar cadastro', slug => {
    expect(customerDataIsReadOnly(slug, false)).toBe(true);
  });
  it.each(['dicolore', 'dicoloresenses'])('equipe autorizada %s mantém edição', slug => {
    expect(customerDataIsReadOnly(slug, true)).toBe(false);
  });
  it('não bloqueia clientes JEWOS', () => {
    expect(customerDataIsReadOnly('jewosnewborn', false)).toBe(false);
  });
});