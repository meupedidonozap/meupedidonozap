import { describe, it, expect, beforeEach } from 'vitest';
import { getEditingQuote, setEditingQuote } from './quoteEditing';
describe('edição de orçamento', () => {
  beforeEach(() => { localStorage.clear(); sessionStorage.clear(); });
  it('a marca de edição sobrevive à recarga (fica no aparelho, não na aba)', () => {
    setEditingQuote({ id: 'q754', storeId: 's', customerName: 'OLINDA' });
    sessionStorage.clear();
    expect(getEditingQuote('s')?.id).toBe('q754');
  });
  it('cancelar a edição limpa a marca', () => {
    setEditingQuote({ id: 'q754', storeId: 's', customerName: 'OLINDA' });
    setEditingQuote(null);
    expect(getEditingQuote('s')).toBeNull();
  });
  it('marca de outra loja não vale', () => {
    setEditingQuote({ id: 'q', storeId: 'a', customerName: 'x' });
    expect(getEditingQuote('b')).toBeNull();
  });
});
