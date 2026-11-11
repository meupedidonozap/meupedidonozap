import municipalities from './municipios.json' with { type: 'json' };

// Reference: github.com/kelvins/municipios-brasileiros (IBGE municipality codes).
const lookup = municipalities as Record<string, string[]>;
const text = (value: unknown) => String(value ?? '').trim();
export function locationFromIbge(row: Record<string, unknown>) {
  const code = text(row.municipio_codigo_ibge);
  const municipality = lookup[code];
  return {
    city: text(row.endereco_cidade ?? row.city) || municipality?.[0] || '',
    uf: text(row.endereco_uf ?? row.uf).toUpperCase() || municipality?.[1] || '',
  };
}

export async function resolveCustomerLocation(row: Record<string, unknown>) {
  const location = locationFromIbge(row);
  if (location.city && location.uf) return location;
  const cep = text(row.endereco_cep ?? row.cep).replace(/\D/g, '');
  if (cep.length !== 8) return location;
  try {
    const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) return location;
    const data = await response.json();
    if (data.erro) return location;
    return { city: location.city || text(data.localidade), uf: location.uf || text(data.uf) };
  } catch { return location; }
}