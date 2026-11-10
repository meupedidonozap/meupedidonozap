import { describe, expect, it } from "vitest";
import { documentCandidates, loadBatchCustomers, shouldCreateAccess } from "./batch";

describe("ERP customer batch", () => {
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
          range: () => query,
          then: (resolve: (value: { data: never[]; error: null }) => unknown) => Promise.resolve(resolve({ data: [], error: null })),
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