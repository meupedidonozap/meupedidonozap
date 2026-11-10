export const LOOKUP_BATCH = 250;

export function documentCandidates(values: string[]): string[] {
  const candidates = new Set<string>();
  for (const value of values) {
    const digits = value.replace(/\D/g, "");
    if (digits.length !== 11 && digits.length !== 14) continue;
    candidates.add(value.trim());
    candidates.add(digits);
    candidates.add(digits.length === 11
      ? digits.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4")
      : digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5"));
  }
  return [...candidates];
}

// This interface keeps the lookup testable without importing the Deno runtime.
type QueryResult = { data: Record<string, unknown>[] | null; error: { message: string } | null };
type Query = PromiseLike<QueryResult> & {
  select(columns: string): Query;
  eq(column: string, value: string): Query;
  in(column: string, values: string[]): Query;
  or(filter: string): Query;
  order(column: string): Query;
  range(from: number, to: number): Query;
};
type Client = { from(table: string): Pick<Query, "select"> };

export async function loadBatchCustomers(client: Client, storeId: string, records: Record<string, string>[]) {
  const codes = [...new Set(records.map((r) => r.codigo).filter(Boolean))];
  const docs = documentCandidates(records.map((r) => r.cnpj || ""));
  const found = new Map<string, Record<string, unknown>>();
  for (const [column, values] of [["customer_code", codes], ["cpf_cnpj", docs]] as const) {
    for (let start = 0; start < values.length; start += LOOKUP_BATCH) {
      for (let offset = 0; ; offset += 1000) {
        let query = client.from("customer_profiles").select("*").eq("store_id", storeId)
          .in(column, values.slice(start, start + LOOKUP_BATCH));
        if (column === "cpf_cnpj") query = query.or("customer_code.is.null,customer_code.eq.");
        const { data, error } = await query.order("id").range(offset, offset + 999);
        if (error) throw new Error(error.message);
        for (const row of data || []) found.set(String(row.id), row);
        if ((data || []).length < 1000) break;
      }
    }
  }
  return [...found.values()];
}

export const shouldCreateAccess = (rowsMode: boolean) => !rowsMode;