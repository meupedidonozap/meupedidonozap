let current: File | null = null;
const listeners = new Set<(file: File | null) => void>();

export function previewOrderPdf(file: File | null): void {
  current = file;
  listeners.forEach(listener => listener(file));
}

export function subscribeOrderPdf(listener: (file: File | null) => void): () => void {
  listeners.add(listener);
  listener(current);
  return () => { listeners.delete(listener); };
}