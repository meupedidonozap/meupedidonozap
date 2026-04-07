const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// CEP ranges mapped to Brazilian regions for distance-based pricing
// First 1-2 digits of CEP determine the region
function getRegion(cep: string): string {
  const prefix = parseInt(cep.substring(0, 2));
  if (prefix >= 1 && prefix <= 19) return 'SP';
  if (prefix >= 20 && prefix <= 28) return 'RJ';
  if (prefix >= 29 && prefix <= 29) return 'ES';
  if (prefix >= 30 && prefix <= 39) return 'MG';
  if (prefix >= 40 && prefix <= 48) return 'BA';
  if (prefix >= 49 && prefix <= 49) return 'SE';
  if (prefix >= 50 && prefix <= 56) return 'PE';
  if (prefix >= 57 && prefix <= 57) return 'AL';
  if (prefix >= 58 && prefix <= 58) return 'PB';
  if (prefix >= 59 && prefix <= 59) return 'RN';
  if (prefix >= 60 && prefix <= 63) return 'CE';
  if (prefix >= 64 && prefix <= 64) return 'PI';
  if (prefix >= 65 && prefix <= 65) return 'MA';
  if (prefix >= 66 && prefix <= 68) return 'PA';
  if (prefix >= 69 && prefix <= 69) return 'AM';
  if (prefix >= 70 && prefix <= 72) return 'DF';
  if (prefix >= 73 && prefix <= 76) return 'GO';
  if (prefix >= 77 && prefix <= 77) return 'TO';
  if (prefix >= 78 && prefix <= 78) return 'MT';
  if (prefix >= 79 && prefix <= 79) return 'MS';
  if (prefix >= 80 && prefix <= 87) return 'PR';
  if (prefix >= 88 && prefix <= 89) return 'SC';
  if (prefix >= 90 && prefix <= 99) return 'RS';
  return 'OTHER';
}

// Macro-regions
function getMacroRegion(region: string): string {
  if (['SP', 'RJ', 'ES', 'MG'].includes(region)) return 'SUDESTE';
  if (['PR', 'SC', 'RS'].includes(region)) return 'SUL';
  if (['BA', 'SE', 'PE', 'AL', 'PB', 'RN', 'CE', 'PI', 'MA'].includes(region)) return 'NORDESTE';
  if (['PA', 'AM', 'AP', 'RO', 'RR', 'AC', 'TO'].includes(region)) return 'NORTE';
  if (['DF', 'GO', 'MT', 'MS'].includes(region)) return 'CENTRO_OESTE';
  return 'OTHER';
}

// Base pricing table (approximate Correios rates for 0.5kg package)
// Format: [same_state_pac, same_region_pac, diff_region_pac, same_state_sedex, same_region_sedex, diff_region_sedex]
const basePricing = {
  sameState:    { pac: 18.50, sedex: 28.00, pacDays: 5, sedexDays: 2 },
  sameRegion:   { pac: 25.00, sedex: 38.00, pacDays: 7, sedexDays: 3 },
  neighbor:     { pac: 32.00, sedex: 48.00, pacDays: 8, sedexDays: 4 },
  farRegion:    { pac: 42.00, sedex: 62.00, pacDays: 10, sedexDays: 5 },
  veryFar:      { pac: 55.00, sedex: 80.00, pacDays: 12, sedexDays: 6 },
};

// Neighboring macro-regions
const neighbors: Record<string, string[]> = {
  SUL: ['SUDESTE'],
  SUDESTE: ['SUL', 'CENTRO_OESTE', 'NORDESTE'],
  CENTRO_OESTE: ['SUDESTE', 'NORTE', 'NORDESTE'],
  NORDESTE: ['SUDESTE', 'CENTRO_OESTE', 'NORTE'],
  NORTE: ['CENTRO_OESTE', 'NORDESTE'],
};

function calculateDistance(originRegion: string, destRegion: string): string {
  if (originRegion === destRegion) return 'sameState';
  const originMacro = getMacroRegion(originRegion);
  const destMacro = getMacroRegion(destRegion);
  if (originMacro === destMacro) return 'sameRegion';
  if (neighbors[originMacro]?.includes(destMacro)) return 'neighbor';
  // Check if two hops away
  const originNeighbors = neighbors[originMacro] || [];
  for (const n of originNeighbors) {
    if (neighbors[n]?.includes(destMacro)) return 'farRegion';
  }
  return 'veryFar';
}

function calculatePrice(basePrice: number, weight: number): number {
  // Weight adjustment: base is for 0.5kg, add ~R$3-5 per extra 0.5kg
  const extraWeight = Math.max(0, weight - 0.5);
  const weightSurcharge = Math.ceil(extraWeight / 0.5) * 4.0;
  return Math.round((basePrice + weightSurcharge) * 100) / 100;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { originCep, destinyCep, weight } = body;

    if (!originCep || !destinyCep) {
      return new Response(JSON.stringify({ error: 'CEP de origem e destino são obrigatórios' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const cleanOrigin = originCep.replace(/\D/g, '');
    const cleanDestiny = destinyCep.replace(/\D/g, '');

    if (cleanOrigin.length !== 8 || cleanDestiny.length !== 8) {
      return new Response(JSON.stringify({ error: 'CEP inválido' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const originRegion = getRegion(cleanOrigin);
    const destRegion = getRegion(cleanDestiny);
    const distance = calculateDistance(originRegion, destRegion);
    const pricing = basePricing[distance as keyof typeof basePricing];
    const safeWeight = Math.max(weight || 0.3, 0.3);

    const options = [
      {
        code: '04510',
        name: 'PAC',
        price: calculatePrice(pricing.pac, safeWeight),
        deadline: pricing.pacDays,
      },
      {
        code: '04014',
        name: 'SEDEX',
        price: calculatePrice(pricing.sedex, safeWeight),
        deadline: pricing.sedexDays,
      },
    ];

    return new Response(JSON.stringify({ options }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Error:', err);
    return new Response(JSON.stringify({ error: 'Erro ao calcular frete' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
