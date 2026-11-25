import { z } from "zod";

const positive = z.coerce.number().finite().min(0.01, "Informe uma medida maior que zero.").max(100000);
export const roofAreaSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("known"), service_id: z.string().uuid("Selecione o serviço da área."), area: positive }),
  z.object({ mode: z.literal("dimensions"), service_id: z.string().uuid("Selecione o serviço da área."), length: positive, width: positive, slope: z.coerce.number().finite().min(0).max(100) }),
]);
export type RoofArea = z.infer<typeof roofAreaSchema>;
export function roofAreaValue(area: RoofArea) {
  const value = area.mode === "known" ? area.area : area.length * area.width * (1 + area.slope / 100);
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
export function sumRoofAreas(areas: RoofArea[]) {
  return Math.round(areas.reduce((sum, area) => sum + roofAreaValue(area), 0) * 100) / 100;
}
export function serviceAreas(areas: RoofArea[]) {
  const totals = new Map<string, number>();
  areas.forEach(area => totals.set(area.service_id, (totals.get(area.service_id) ?? 0) + roofAreaValue(area)));
  return [...totals].map(([service_id, area]) => ({ service_id, area: Math.round(area * 100) / 100 }));
}
export const siteAddressSchema = z.object({
  cep: z.string().regex(/^\d{8}$/, "Informe um CEP válido."),
  address: z.string().trim().min(1, "Informe a rua.").max(200),
  number: z.string().trim().min(1, "Informe o número.").max(20),
  neighborhood: z.string().trim().min(1, "Informe o bairro.").max(100),
  city: z.string().trim().min(1, "Informe a cidade.").max(100),
  uf: z.string().regex(/^[A-Z]{2}$/, "Informe a UF."),
  complement: z.string().trim().max(200).default(""),
});
export type SiteAddress = z.infer<typeof siteAddressSchema>;
export const emptySiteAddress: SiteAddress = { cep: "", address: "", number: "", neighborhood: "", city: "", uf: "", complement: "" };
export const fallRangeSchema = z.object({ min: z.coerce.number().int().min(1).max(100), max: z.coerce.number().int().min(1).max(100), price: z.coerce.number().finite().min(0).max(999999) }).refine(v => v.max >= v.min, "Faixa de quedas inválida.");
export const cleaningEstimateSettingsSchema = z.object({
  base_address: siteAddressSchema.nullable(),
  round_trip: z.literal(true),
  solar_price: z.number().finite().min(0).max(999999).nullable(),
  fall_ranges: z.array(fallRangeSchema).max(20),
}).refine(v => v.fall_ranges.every((range, index) => v.fall_ranges.every((other, j) => index === j || range.max < other.min || range.min > other.max)), "As faixas de quedas não podem se sobrepor.");
export type CleaningEstimateSettings = z.infer<typeof cleaningEstimateSettingsSchema>;
export const defaultEstimateSettings: CleaningEstimateSettings = { base_address: null, round_trip: true, solar_price: null, fall_ranges: [] };
export function fallSurcharge(count: number, ranges: CleaningEstimateSettings["fall_ranges"]) {
  return ranges.find(range => count >= range.min && count <= range.max)?.price ?? null;
}
export function travelCharge(oneWayKm: number) {
  return Math.round((oneWayKm * 2 * 1.2 + Number.EPSILON) * 100) / 100;
}
export const areaLabel = (area: number) => new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(area);
export function readEstimateSettings(settings: unknown): CleaningEstimateSettings {
  const value = settings && typeof settings === "object" && "cleaningEstimate" in settings ? settings.cleaningEstimate : undefined;
  const parsed = cleaningEstimateSettingsSchema.safeParse(value);
  return parsed.success ? parsed.data : defaultEstimateSettings;
}
export type RoofAreaDraft = { id: string; service_id: string; mode: "known" | "dimensions"; area: string; length: string; width: string; slope: string };
export function newRoofArea(service_id: string): RoofAreaDraft {
  return { id: crypto.randomUUID(), service_id, mode: "known", area: "", length: "", width: "", slope: "30" };
}
export function draftAreaValue(draft: RoofAreaDraft) {
  const parsed = roofAreaSchema.safeParse(draft);
  return parsed.success ? roofAreaValue(parsed.data) : 0;
}