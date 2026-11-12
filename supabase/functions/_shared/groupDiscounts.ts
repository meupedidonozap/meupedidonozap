// Cópia server-side da regra de desconto por grupo/categoria/produto (src/lib/groupDiscounts.ts).
// Usada só como proteção: preenche discountPercent em itens que chegaram sem percentual.
const norm = (raw: unknown) => {
  const s = String(raw || "").trim(); if (!s) return "";
  const m = s.match(/^\s*[A-Za-z0-9]+\s*-\s*(.+)$/);
  return (m ? m[1] : s).trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
};
const TABLES = new Set([1, 3, 4, 8, 9, 11]);

export function fillMissingDiscounts(items: any[], rules: any[], priceTable: unknown, noDiscount: boolean): any[] {
  if (noDiscount || !Array.isArray(rules) || !rules.length) return items;
  if (items.some((it) => Number(it?.discountPercent) > 0)) return items; // pedido já tem desconto gravado
  const t = Number(priceTable); const table = TABLES.has(t) ? t : 4;
  const groupRules = rules.filter((r) => r?.type === "group" && (r.priceTable == null || r.priceTable === table));
  if (!groupRules.length) return items;
  const scopeOf = (r: any) => r.scope || "group";
  const keyFor = (scope: string, it: any) => scope === "product" ? (it.productId || "") : scope === "category" ? (it.categoryId || "") : norm(it.groupId);
  const ruleKey = (r: any) => scopeOf(r) === "product" ? (r.productId || "") : scopeOf(r) === "category" ? (r.categoryId || "") : norm(r.groupId);
  const chosen = new Map<any, number>();
  for (const scope of ["product", "group", "category"]) {
    const scoped = groupRules.filter((r) => scopeOf(r) === scope);
    if (!scoped.length) continue;
    const buckets = new Map<string, any[]>();
    for (const it of items) {
      if (chosen.has(it)) continue;
      const k = keyFor(scope, it); if (!k) continue;
      const l = buckets.get(k) || []; l.push(it); buckets.set(k, l);
    }
    for (const [k, list] of buckets) {
      const qty = list.reduce((s, i) => s + (Number(i.quantity) || 0), 0);
      const r = scoped.filter((x) => ruleKey(x) === k && (x.minQuantity || 0) <= qty)
        .sort((a, b) => (b.minQuantity || 0) - (a.minQuantity || 0))[0];
      if (r) for (const it of list) chosen.set(it, Number(r.discountPercent) || 0);
    }
  }
  return items.map((it) => chosen.get(it) ? { ...it, discountPercent: chosen.get(it) } : it);
}
