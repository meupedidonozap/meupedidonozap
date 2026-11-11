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
  for (const url of [`https://viacep.com.br/ws/${cep}/json/`, `https://brasilapi.com.br/api/cep/v2/${cep}`]) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      try {
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) continue;
        const data = await response.json();
        if (data.erro) continue;
        const city = location.city || text(data.localidade ?? data.city);
        const uf = location.uf || text(data.uf ?? data.state);
        if (city && uf) return { city, uf };
      } finally { clearTimeout(timer); }
    } catch { /* Try the second provider without altering official street/identity. */ }
  }
  return location;
}