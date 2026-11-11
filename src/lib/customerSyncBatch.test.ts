import { describe, expect, it } from "vitest";
import { customerPriceTablePatch, documentCandidates, loadBatchCustomers, normalizeCustomerPriceTable, shouldCreateAccess } from "../../supabase/functions/sync-customers/batch";

describe("ERP customer batch", () => {
  it.each([1, 9])("initializes seller 28 with ERP table %s", (table) => {
    expect(customerPriceTablePatch("dicolore", "28", table, null)).toEqual({ price_table: table });
  });

  it.each(["28", "028", " 00028 "])("normalizes seller code %s", (seller) => {
    expect(customerPriceTablePatch("dicolore", seller, "9", null)).toEqual({ price_table: 9 });
  });

  it.each([null, "", 0, 2, 3, 4, 8, 11, "abc"])("defaults seller 28 unsupported table %s to 4", (table) => {
    expect(customerPriceTablePatch("dicolore", "28", table, null)).toEqual({ price_table: 4 });
  });

  it.each(["10", "21", "46", "128", "", "0"])("initializes other seller %s with table 4", (seller) => {
    expect(customerPriceTablePatch("dicolore", seller, 9, null)).toEqual({ price_table: 4 });
  });

  it.each([1, 3, 4, 8, 9, 11])("never overwrites MPZ assignment %s on a full reload or seller change", (table) => {
    expect(customerPriceTablePatch("dicolore", "28", 1, table)).toEqual({});
    expect(customerPriceTablePatch("dicolore", "46", 9, table)).toEqual({});
  });

  it("initializes legacy unassigned customers using the same first-load rule", () => {
    expect(customerPriceTablePatch("dicolore", "28", 1, undefined)).toEqual({ price_table: 1 });
    expect(customerPriceTablePatch("dicolore", "46", 1, null)).toEqual({ price_table: 4 });
  });

  it("keeps other stores' supported ERP table behavior unchanged", () => {
    expect(customerPriceTablePatch("other-store", "46", 9, null)).toEqual({ price_table: 9 });
  });

  it.each([1, 3, 4, 8, 9, 11])("preserves supported ERP price table %s", (table) => {
    expect(normalizeCustomerPriceTable(String(table))).toBe(table);
  });

  it.each([0, 2, 5, 6, 7, 10, 12, -1, 1.5, "", "abc", null, undefined])(
    "defaults unsupported or missing ERP price table %s to table 4",
    (table) => { expect(normalizeCustomerPriceTable(table)).toBe(4); },
  );

  it("does not provision access for ERP rows, preserving the legacy CSV behavior", () => {
    expect(shouldCreateAccess(true)).toBe(false);
    expect(shouldCreateAccess(false)).toBe(true);
  });

  it("matches unformatted and formatted orphan documents", () => {
    expect(documentCandidates(["04161153000171"])).toEqual([
      "04161153000171", "04.161.153/0001-71",
    ]);
  });

  it("only looks up the incoming store codes and orphan documents in small batches", async () => {
    const calls: { column: string; values: string[]; store?: string; orphan?: string }[] = [];
    const client = {
      from: () => {
        const call = { column: "", values: [] as string[], store: "", orphan: "" };
        const query = {
          select: () => query,
          eq: (_col: string, value: string) => { call.store = value; return query; },
          in: (column: string, values: string[]) => { call.column = column; call.values = values; calls.push(call); return query; },
          or: (filter: string) => { call.orphan = filter; return query; },
          order: () => query,
          range: () => Promise.resolve({ data: [], error: null }),
        };
        return query;
      },
    };
    await loadBatchCustomers(client, "test-store", Array.from({ length: 251 }, (_, i) => ({ codigo: String(i), cnpj: "04161153000171" })));
    expect(calls.map((c) => [c.column, c.values.length])).toEqual([["customer_code", 250], ["customer_code", 1], ["cpf_cnpj", 2]]);
    expect(calls.every((c) => c.store === "test-store")).toBe(true);
    expect(calls[1].values).toEqual(["250"]);
    expect(calls[2].orphan).toBe("customer_code.is.null,customer_code.eq.");
  });
});