import { describe, it, expect, beforeEach } from 'vitest';
import { saveCustomerDraft, loadCustomerDraft, clearCustomerDraft, DRAFT_TTL_MS } from './customerDraft';

describe('customerDraft', () => {
  beforeEach(() => localStorage.clear());
  it('salva e lê o rascunho', () => {
    saveCustomerDraft('s1', { form: { name: 'JOAO' }, mode: 'new', search: '', open: true });
    expect(loadCustomerDraft('s1')?.form.name).toBe('JOAO');
  });
  it('descarta após 24h', () => {
    saveCustomerDraft('s1', { form: {}, mode: 'new', search: '', open: true }, 0);
    expect(loadCustomerDraft('s1', DRAFT_TTL_MS + 1)).toBeNull();
  });
  it('limpa', () => {
    saveCustomerDraft('s1', { form: {}, mode: 'new', search: '', open: true });
    clearCustomerDraft('s1');
    expect(loadCustomerDraft('s1')).toBeNull();
  });
});
