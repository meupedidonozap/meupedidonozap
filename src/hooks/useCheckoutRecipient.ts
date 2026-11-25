import { useEffect, useState } from 'react';
import type { OrderRecipient } from './useOrderRecipients';

/**
 * DiColore: the recipient always starts blank and must be chosen for each order,
 * so a previous or automatic choice can never send an order to the wrong person.
 */
export function useCheckoutRecipient(
  slug: string | undefined,
  storeId: string | undefined,
  userId: string | undefined,
  profileId: string | undefined,
  options: OrderRecipient[],
  ready: boolean,
) {
  const scope = `${storeId || ''}:${userId || ''}:${profileId || ''}`;
  const [selection, setSelection] = useState({ scope, id: '' });
  const current = selection.scope === scope ? selection.id : '';
  const selectedId = options.some(option => option.id === current) ? current : '';

  useEffect(() => {
    // Earlier versions remembered the last recipient; discard it.
    if (slug !== 'dicolore' || !storeId || !userId || !profileId) return;
    try { localStorage.removeItem(`mpz_checkout_recipient:${storeId}:${userId}:${profileId}`); } catch { /* Private storage may be unavailable. */ }
  }, [slug, storeId, userId, profileId]);

  const select = (id: string) => {
    if (!ready || !options.some(option => option.id === id)) return;
    setSelection({ scope, id });
  };
  return [selectedId, select] as const;
}
