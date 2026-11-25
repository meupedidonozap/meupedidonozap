import { Plus, Trash2, Ruler, Calculator } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Choice, Field } from "./CleaningFields";
import { areaLabel, draftAreaValue, newRoofArea, type RoofAreaDraft } from "@/lib/cleaningMeasurements";

export default function CleaningRoofAreas({ areas, onChange, services }: { areas: RoofAreaDraft[]; onChange: (areas: RoofAreaDraft[]) => void; services: { id: string; name: string }[] }) {
  function patch(id: string, changes: Partial<RoofAreaDraft>) { onChange(areas.map(a => a.id === id ? { ...a, ...changes } : a)); }
  return <div className="mb-6 space-y-5">
    <h3 className="text-base font-semibold">Tamanho do telhado</h3>
    {areas.map((a, i) => <div key={a.id} className="space-y-4 border-b pb-5">
      <div className="flex items-center justify-between gap-3">
        <p className="font-medium">Área {i + 1}</p>
        {areas.length > 1 && <Button type="button" variant="ghost" size="icon" aria-label={`Remover área ${i + 1}`} title="Remover área" onClick={() => onChange(areas.filter(v => v.id !== a.id))}><Trash2 /></Button>}
      </div>
      {services.length > 1 && <Choice label={`Serviço da área ${i + 1}`} value={a.service_id} onChange={service_id => patch(a.id, { service_id })} options={services.map(s => [s.id, s.name])} />}
      <div className="grid grid-cols-2 gap-2" role="group" aria-label={`Medição da área ${i + 1}`}>
        <Button type="button" className="h-auto min-h-11 whitespace-normal" variant={a.mode === "known" ? "secondary" : "outline"} aria-pressed={a.mode === "known"} onClick={() => patch(a.id, { mode: "known" })}><Ruler className="shrink-0" />Já sei a metragem</Button>
        <Button type="button" className="h-auto min-h-11 whitespace-normal" variant={a.mode === "dimensions" ? "secondary" : "outline"} aria-pressed={a.mode === "dimensions"} onClick={() => patch(a.id, { mode: "dimensions" })}><Calculator className="shrink-0" />Calcular pelo tamanho</Button>
      </div>
      {a.mode === "known" ? <Field label={`Área ${i + 1} (m²)`} type="number" min="0.01" max="100000" step="0.01" value={a.area} onChange={area => patch(a.id, { area })} required /> : <>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label={`Comprimento (m) — área ${i + 1}`} type="number" min="0.01" max="100000" step="0.01" value={a.length} onChange={length => patch(a.id, { length })} required />
          <Field label={`Largura (m) — área ${i + 1}`} type="number" min="0.01" max="100000" step="0.01" value={a.width} onChange={width => patch(a.id, { width })} required />
          <Field label={`Inclinação do telhado (%) — área ${i + 1}`} type="number" min="0" max="100" step="0.1" value={a.slope} onChange={slope => patch(a.id, { slope })} required />
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label={`Inclinação da área ${i + 1}`}>
          {[[20, "Baixa 20%"], [30, "Média 30%"], [45, "Alta 45%"]].map(([value, label]) => <Button key={value} type="button" size="sm" variant={Number(a.slope) === value ? "secondary" : "outline"} aria-pressed={Number(a.slope) === value} onClick={() => patch(a.id, { slope: String(value) })}>{label}</Button>)}
        </div>
      </>}
      <p role="status" className="text-sm font-semibold text-primary">Área estimada: {areaLabel(draftAreaValue(a))} m²</p>
    </div>)}
    {!!services.length && <Button type="button" variant="outline" disabled={areas.length >= 20} onClick={() => onChange([...areas, newRoofArea(services[0].id)])}><Plus />Adicionar outra área</Button>}
    <p className="font-semibold">Área total: {areaLabel(areas.reduce((sum, a) => sum + draftAreaValue(a), 0))} m²</p>
  </div>;
}