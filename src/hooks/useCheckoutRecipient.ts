import { useEffect, useState } from 'react';
import type { OrderRecipient } from './useOrderRecipients';

/** A saved preference is not authority: accept only currently available recipients. */
export function useCheckoutRecipient(
  slug: string | undefined,
  storeId: string | undefined,
  userId: string | undefined,
  profileId: string | undefined,
  options: OrderRecipient[],
  ready: boolean,
  linkedSeller: boolean,
) {
  const key = slug === 'dicolore' && storeId && userId && profileId
    ? `mpz_checkout_recipient:${storeId}:${userId}:${profileId}` : null;
  const scope = key || `${storeId || ''}:${userId || ''}:${profileId || ''}`;
  const [selection, setSelection] = useState({ scope, id: '' });
  const current = selection.scope === scope ? selection.id : '';
  const selectedId = options.some(option => option.id === current) ? current : '';

  useEffect(() => {
    if (!ready) return;
    let saved = '';
    try { saved = key ? localStorage.getItem(key) || '' : ''; } catch { /* Private storage may be unavailable. */ }
    const restored = options.find(option => option.id === saved)?.id || '';
    const sellers = options.filter(option => option.kind === 'vendedor');
    const fallback = options.length === 1 ? options[0].id
      : key && linkedSeller && sellers.length === 1 ? sellers[0].id : '';
    const id = selectedId || restored || fallback;
    setSelection(previous => previous.scope === scope && previous.id === id ? previous : { scope, id });
    try {
      if (key && id) localStorage.setItem(key, id);
      else if (key) localStorage.removeItem(key);
    } catch { /* Selection still works in memory. */ }
  }, [key, scope, options, ready, linkedSeller, selectedId]);

  const select = (id: string) => {
    if (!ready || !options.some(option => option.id === id)) return;
    setSelection({ scope, id });
    try { if (key) localStorage.setItem(key, id); } catch { /* Selection still works in memory. */ }
  };
  return [selectedId, select] as const;
}