import { get, set } from 'idb-keyval';
import type { Order } from '@/types';

export type QueuedOrderStatus = 'queued' | 'sending' | 'error';

export interface QueuedOrder {
  /** client_order_id — chave de idempotência */
  id: string;
  storeId: string;
  storeSlug: string;
  createdAt: string;
  status: QueuedOrderStatus;
  attempts: number;
  lastError?: string;
  customerName: string;
  total: number;
  payload: Omit<Order, 'id' | 'orderNumber' | 'createdAt'> & { origem?: string };
}

const KEY = 'offline_order_queue_v1';
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => {
    try { l(); } catch {}
  });
}

export function subscribeQueue(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

async function readAll(): Promise<QueuedOrder[]> {
  try {
    const fromIdb = await get<QueuedOrder[]>(KEY);
    if (Array.isArray(fromIdb)) return fromIdb;
  } catch {}
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as QueuedOrder[]) : [];
  } catch {
    return [];
  }
}

async function writeAll(items: QueuedOrder[]) {
  try { await set(KEY, items); } catch {}
  try { localStorage.setItem(KEY, JSON.stringify(items)); } catch {}
  notify();
}

export async function listQueue(): Promise<QueuedOrder[]> {
  return readAll();
}

export async function listQueueForStore(storeId: string | undefined): Promise<QueuedOrder[]> {
  const all = await readAll();
  return storeId ? all.filter((q) => q.storeId === storeId) : all;
}

export function newClientOrderId(): string {
  try {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  } catch {}
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function enqueueOrder(entry: Omit<QueuedOrder, 'status' | 'attempts' | 'createdAt'>): Promise<QueuedOrder> {
  const item: QueuedOrder = {
    ...entry,
    status: 'queued',
    attempts: 0,
    createdAt: new Date().toISOString(),
  };
  const all = await readAll();
  await writeAll([...all, item]);
  return item;
}

export async function updateQueued(id: string, patch: Partial<QueuedOrder>) {
  const all = await readAll();
  await writeAll(all.map((q) => (q.id === id ? { ...q, ...patch } : q)));
}

export async function removeFromQueue(id: string) {
  const all = await readAll();
  await writeAll(all.filter((q) => q.id !== id));
}

export function isOnline(): boolean {
  return typeof navigator === 'undefined' ? true : navigator.onLine !== false;
}