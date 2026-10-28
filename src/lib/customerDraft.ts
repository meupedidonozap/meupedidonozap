export interface CustomerDraft {
  form: Record<string, string>;
  mode: 'existing' | 'new';
  search: string;
  open: boolean;
  savedAt: number;
}

export const DRAFT_TTL_MS = 24 * 60 * 60 * 1000;
const key = (storeId: string) => `mpz:customer-draft:${storeId}`;

export function saveCustomerDraft(storeId: string, d: Omit<CustomerDraft, 'savedAt'>, now = Date.now()) {
  try { localStorage.setItem(key(storeId), JSON.stringify({ ...d, savedAt: now })); } catch { /* ignore */ }
}

export function loadCustomerDraft(storeId: string, now = Date.now()): CustomerDraft | null {
  try {
    const raw = localStorage.getItem(key(storeId));
    if (!raw) return null;
    const d = JSON.parse(raw) as CustomerDraft;
    if (!d.savedAt || now - d.savedAt > DRAFT_TTL_MS) { localStorage.removeItem(key(storeId)); return null; }
    return d;
  } catch { return null; }
}

export function clearCustomerDraft(storeId: string) {
  try { localStorage.removeItem(key(storeId)); } catch { /* ignore */ }
}

export function hasOpenCustomerDraft(storeId?: string) {
  return !!storeId && !!loadCustomerDraft(storeId)?.open;
}
