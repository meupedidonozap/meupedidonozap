import { describe, it, expect } from "vitest";
import {
  cleaningTotal,
  cleaningQuoteSchema,
  isCleaningStore,
  cleaningWhatsApp,
  businessDate,
  cleaningInventorySchema,
  cleaningPurchaseSchema,
} from "./cleaning";
describe("Limpa Telhas Brusque", () => {
  it("cobra por metro quadrado mais adicionais", () =>
    expect(
      cleaningTotal(
        [{ area: 100, unit_price: 5 }],
        [{ mode: "fixed", price: 50 }],
      ),
    ).toBe(550));
  it("não inventa preço enquanto a tabela não foi definida", () =>
    expect(cleaningTotal([{ area: 100, unit_price: null }], [])).toBeNull());
  it("adicionais por área e percentual são calculados sem duplicar base", () =>
    expect(
      cleaningTotal(
        [{ area: 20, unit_price: 10 }],
        [
          { mode: "per_m2", price: 2 },
          { mode: "percent", price: 10 },
        ],
      ),
    ).toBe(260));
  it("mantém alterações isoladas da DiColore e do Rafa", () => {
    expect(isCleaningStore({ slug: "dicolore" })).toBe(false);
    expect(isCleaningStore({ slug: "rafasmanutencaoresidencial" })).toBe(false);
    expect(isCleaningStore({ slug: "limpa-telhas-brusque" })).toBe(true);
  });
  it("usa exatamente o WhatsApp informado", () =>
    expect(cleaningWhatsApp("+55 47 9711-5829", "Orçamento & agenda")).toBe(
      "https://wa.me/554797115829?text=Or%C3%A7amento%20%26%20agenda",
    ));
  it("recusa área zero", () =>
    expect(
      cleaningQuoteSchema.safeParse({
        items: [
          { service_id: "00000000-0000-4000-8000-000000000001", area: 0 },
        ],
        addon_ids: [],
        notes: "",
        height: 0,
        access: "facil",
        water: true,
        electricity: true,
      }).success,
    ).toBe(false));
  it("usa a data do negócio em Brusque", () =>
    expect(businessDate(new Date("2026-11-25T01:00:00Z"))).toBe("2026-11-24"));
  it("não aceita estoque negativo", () =>
    expect(
      cleaningInventorySchema.safeParse({
        name: "Detergente",
        unit: "L",
        quantity: -1,
        min_quantity: 0,
      }).success,
    ).toBe(false));
  it("não aceita compra sem quantidade positiva", () =>
    expect(
      cleaningPurchaseSchema.safeParse({
        inventory_id: "00000000-0000-4000-8000-000000000001",
        supplier: "Fornecedor",
        quantity: 0,
        total: 100,
        due_date: "2026-12-01",
      }).success,
    ).toBe(false));
});
