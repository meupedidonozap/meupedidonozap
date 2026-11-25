import { describe, it, expect } from "vitest";
import { roofAreaValue, sumRoofAreas, serviceAreas, fallSurcharge, travelCharge, cleaningEstimateSettingsSchema, readEstimateSettings } from "./cleaningMeasurements";
const service_id = "00000000-0000-4000-8000-000000000001";
describe("Metragem e deslocamento Limpa Telhas", () => {
  it.each([[20, 120], [30, 130], [45, 145]])("10 × 10 com inclinação %s%% resulta em %s m²", (slope, expected) => {
    expect(roofAreaValue({ mode: "dimensions", service_id, length: 10, width: 10, slope })).toBe(expected);
  });
  it("soma telhados com metragem conhecida e calculada", () => expect(sumRoofAreas([{ mode: "known", service_id, area: 50 }, { mode: "dimensions", service_id, length: 10, width: 10, slope: 30 }])).toBe(180));
  it("separa metragem por serviço para usar o preço de cada produto", () => expect(serviceAreas([{ mode: "known", service_id, area: 50 }, { mode: "known", service_id, area: 30 }, { mode: "known", service_id: "00000000-0000-4000-8000-000000000002", area: 20 }])).toEqual([{ service_id, area: 80 }, { service_id: "00000000-0000-4000-8000-000000000002", area: 20 }]));
  it("10 km de ida e 10 km de volta a R$1,20 somam R$24", () => expect(travelCharge(10)).toBe(24));
  it("usa adicional configurado para 2 ou 4 quedas", () => {
    const ranges = [{ min: 2, max: 2, price: 50 }, { min: 4, max: 4, price: 100 }];
    expect(fallSurcharge(2, ranges)).toBe(50);
    expect(fallSurcharge(4, ranges)).toBe(100);
    expect(fallSurcharge(3, ranges)).toBeNull();
  });
  it("base não cadastrada e preços não definidos nunca são inventados", () => expect(readEstimateSettings({})).toEqual({ base_address: null, round_trip: true, solar_price: null, fall_ranges: [] }));
  it("impede faixas sobrepostas", () => expect(cleaningEstimateSettingsSchema.safeParse({ base_address: null, round_trip: true, solar_price: 0, fall_ranges: [{ min: 1, max: 2, price: 50 }, { min: 2, max: 4, price: 100 }] }).success).toBe(false));
  it("base pode ser substituída por um novo endereço completo", () => {
    const old = { cep: "88350000", address: "Rua de teste", number: "10", neighborhood: "Centro", city: "Brusque", uf: "SC", complement: "" };
    const settings = { base_address: { ...old, number: "20" }, round_trip: true, solar_price: null, fall_ranges: [] };
    expect(cleaningEstimateSettingsSchema.parse(settings).base_address?.number).toBe("20");
  });
});