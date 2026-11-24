import { z } from "zod";

export const CLEANING_SLUG = "limpa-telhas-brusque";
export const isCleaningStore = (store?: { slug?: string } | null) =>
  store?.slug === CLEANING_SLUG;
export const cleaningItemSchema = z.object({
  service_id: z.string().uuid(),
  area: z.coerce
    .number()
    .finite()
    .positive("Informe uma área maior que zero.")
    .max(100000),
});
export const cleaningQuoteSchema = z.object({
  items: z.array(cleaningItemSchema).min(1, "Selecione um serviço.").max(3),
  addon_ids: z.array(z.string().uuid()).max(30),
  notes: z.string().trim().max(2000),
  height: z.coerce.number().min(0).max(100),
  access: z.enum(["facil", "restrito"]),
  water: z.boolean(),
  electricity: z.boolean(),
});
export type CleaningQuoteInput = z.infer<typeof cleaningQuoteSchema>;
const finiteMoney = z.coerce
  .number()
  .finite()
  .positive("Informe um valor maior que zero.")
  .max(999999999);
export const cleaningInventorySchema = z.object({
  name: z.string().trim().min(1, "Informe o nome.").max(150),
  unit: z.string().trim().min(1).max(10),
  quantity: z.coerce.number().finite().min(0).max(999999999),
  min_quantity: z.coerce.number().finite().min(0).max(999999999),
});
export const cleaningPurchaseSchema = z.object({
  inventory_id: z.string().uuid("Selecione um produto."),
  supplier: z.string().trim().min(1, "Informe o fornecedor.").max(200),
  quantity: finiteMoney,
  total: finiteMoney,
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe o vencimento."),
});
export const cleaningAccountSchema = z.object({
  description: z.string().trim().min(1, "Informe a descrição.").max(250),
  party: z.string().trim().max(200),
  amount: finiteMoney,
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe o vencimento."),
});
export const cleaningCatalogSchema = z
  .object({
    name: z.string().trim().min(1, "Informe o nome.").max(200),
    price: z.coerce.number().finite().min(0).max(999999999),
    ready: z.boolean(),
    kind: z.enum(["service", "addon"]),
    mode: z.enum(["per_m2", "fixed", "percent"]),
  })
  .refine((v) => !v.ready || v.price > 0, "Informe um preço maior que zero.");
export function cleaningTotal(
  lines: { area: number; unit_price: number | null }[],
  addons: { mode: string; price: number | null }[],
) {
  if (
    !lines.length ||
    lines.some((l) => l.unit_price === null) ||
    addons.some((a) => a.price === null)
  )
    return null;
  const round = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100;
  const base = lines.reduce(
    (sum, l) => sum + round(l.area * (l.unit_price ?? 0)),
    0,
  );
  const area = lines.reduce((sum, l) => sum + l.area, 0);
  return round(
    base +
      addons.reduce(
        (sum, a) =>
          sum +
          round(
            (a.price ?? 0) *
              (a.mode === "per_m2"
                ? area
                : a.mode === "percent"
                  ? base / 100
                  : 1),
          ),
        0,
      ),
  );
}
export const cleaningMoney = (value: number | null) =>
  value === null
    ? "Sob avaliação"
    : new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
      }).format(value);
export const cleaningDate = (value?: string | null, time = false) =>
  !value
    ? "—"
    : new Intl.DateTimeFormat("pt-BR", {
        timeZone: "America/Sao_Paulo",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        ...(time ? ({ hour: "2-digit", minute: "2-digit" } as const) : {}),
      }).format(
        new Date(value.length === 10 ? `${value}T12:00:00-03:00` : value),
      );
export function businessDate(instant = new Date()) {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);
  return ["year", "month", "day"]
    .map((type) => parts.find((part) => part.type === type)?.value)
    .join("-");
}
export const cleaningStatus: Record<string, string> = {
  solicitado: "Aguardando avaliação",
  pronto: "Orçamento disponível",
  aceito: "Aceito",
  cancelado: "Cancelado",
  solicitado_agenda: "Horário solicitado",
  confirmado: "Confirmado",
  em_andamento: "Em atendimento",
  concluido: "Concluído",
  bloqueado: "Indisponível",
  open: "Em aberto",
  paid: "Pago",
};
export function cleaningWhatsApp(phone: string, text: string) {
  const digits = phone.replace(/\D/g, "");
  if (!/^(55)?[1-9]{2}\d{8,9}$/.test(digits)) return null;
  return `https://wa.me/${digits.startsWith("55") ? digits : `55${digits}`}?text=${encodeURIComponent(text.slice(0, 10000))}`;
}
