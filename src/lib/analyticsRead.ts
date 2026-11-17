/** Bounded parallel reads preserve every RLS-authorized row without a page waterfall. */
export async function analyticsRows<T>(build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const rows: T[] = [];
  const size = 1000, concurrency = 4;
  for (let start = 0; ; start += size * concurrency) {
    const pages = await Promise.all(Array.from({ length: concurrency }, (_, i) => build(start + i * size, start + (i + 1) * size - 1)));
    for (const page of pages) if (page.error) throw page.error;
    for (const page of pages) {
      rows.push(...(page.data || []));
      if (!page.data || page.data.length < size) return rows;
    }
  }
}