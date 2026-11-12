import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { fillMissingDiscounts } from "./groupDiscounts.ts";
const rules = [{ type: "group", groupId: "COLORAÇÃO", minQuantity: 6, discountPercent: 5 }];
const items = [1, 2, 3].map((n) => ({ productId: `p${n}`, groupId: "COLORAÇÃO", price: 25, quantity: 3 }));
Deno.test("R$ 25,00 com 5% de desconto transmite R$ 23,75", () => {
  const out = fillMissingDiscounts(items, rules, 4, false);
  assertEquals(Math.round(out[0].price * (1 - out[0].discountPercent / 100) * 100) / 100, 23.75);
});
Deno.test("cliente sem desconto não recebe desconto", () => {
  assertEquals(fillMissingDiscounts(items, rules, 4, true)[0].discountPercent, undefined);
});
