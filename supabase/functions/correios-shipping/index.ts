const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ShippingRequest {
  originCep: string;
  destinyCep: string;
  weight: number;
  length: number;
  width: number;
  height: number;
}

interface ShippingOption {
  code: string;
  name: string;
  price: number;
  deadline: number;
  error?: string;
}

async function tryCorreiosXml(
  cleanOrigin: string,
  cleanDestiny: string,
  weight: number,
  length: number,
  height: number,
  width: number,
): Promise<ShippingOption[]> {
  const services = [
    { code: '04510', name: 'PAC' },
    { code: '04014', name: 'SEDEX' },
  ];

  const params = new URLSearchParams({
    nCdEmpresa: '',
    sDsSenha: '',
    nCdServico: '04510,04014',
    sCepOrigem: cleanOrigin,
    sCepDestino: cleanDestiny,
    nVlPeso: String(weight),
    nCdFormato: '1',
    nVlComprimento: String(length),
    nVlAltura: String(height),
    nVlLargura: String(width),
    nVlDiametro: '0',
    sCdMaoPropria: 'N',
    nVlValorDeclarado: '0',
    sCdAvisoRecebimento: 'N',
    StrRetorno: 'xml',
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    const url = `https://ws.correios.com.br/calculador/CalcPrecoPrazo.aspx?${params.toString()}`;
    console.log('Trying Correios WS...');
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    const text = await res.text();
    console.log('Correios response length:', text.length);

    const options: ShippingOption[] = [];
    const serviceBlocks = text.match(/<cServico>([\s\S]*?)<\/cServico>/g) || [];

    for (const block of serviceBlocks) {
      const codeMatch = block.match(/<Codigo>(\d+)<\/Codigo>/);
      const valorMatch = block.match(/<Valor>([\d.,]+)<\/Valor>/);
      const prazoMatch = block.match(/<PrazoEntrega>(\d+)<\/PrazoEntrega>/);
      const erroMatch = block.match(/<Erro>(\d*)<\/Erro>/);

      const code = codeMatch ? codeMatch[1] : '';
      const service = services.find(s => s.code === code);
      if (!service) continue;

      const erro = erroMatch ? erroMatch[1] : '0';
      if (erro === '0' || erro === '') {
        const valor = valorMatch ? parseFloat(valorMatch[1].replace('.', '').replace(',', '.')) : 0;
        const prazo = prazoMatch ? parseInt(prazoMatch[1]) : 0;
        if (valor > 0) {
          options.push({ code, name: service.name, price: valor, deadline: prazo });
        }
      }
    }
    return options;
  } catch (e) {
    clearTimeout(timeout);
    console.error('Correios WS error:', e);
    return [];
  }
}

async function tryBrasilApi(
  cleanOrigin: string,
  cleanDestiny: string,
  weight: number,
  length: number,
  height: number,
  width: number,
): Promise<ShippingOption[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    // BrasilAPI supports freight calculation
    const url = `https://brasilapi.com.br/api/correios/v1/preco-prazo?cepDestino=${cleanDestiny}&cepOrigem=${cleanOrigin}&peso=${weight}&comprimento=${length}&altura=${height}&largura=${width}&formato=1`;
    console.log('Trying BrasilAPI...');
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) {
      console.log('BrasilAPI returned:', res.status);
      return [];
    }

    const data = await res.json();
    console.log('BrasilAPI response:', JSON.stringify(data).substring(0, 300));

    if (!Array.isArray(data)) return [];

    const nameMap: Record<string, string> = {
      '04510': 'PAC',
      '04014': 'SEDEX',
      '41106': 'PAC',
      '40010': 'SEDEX',
    };

    const options: ShippingOption[] = [];
    for (const item of data) {
      const code = String(item.codigo || item.Codigo || '');
      const name = nameMap[code] || code;
      const price = parseFloat(String(item.valor || item.Valor || '0').replace(',', '.'));
      const deadline = parseInt(String(item.prazo || item.PrazoEntrega || '0'));

      if (price > 0 && (code === '04510' || code === '04014' || code === '41106' || code === '40010')) {
        options.push({ code, name, price, deadline });
      }
    }
    return options;
  } catch (e) {
    clearTimeout(timeout);
    console.error('BrasilAPI error:', e);
    return [];
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body: ShippingRequest = await req.json();
    const { originCep, destinyCep, weight, length, width, height } = body;

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

    const safeWeight = Math.max(weight || 0.3, 0.3);
    const safeLength = Math.max(length || 16, 16);
    const safeWidth = Math.max(width || 11, 11);
    const safeHeight = Math.max(height || 2, 2);

    // Try BrasilAPI first (usually faster and more reliable)
    let options = await tryBrasilApi(cleanOrigin, cleanDestiny, safeWeight, safeLength, safeHeight, safeWidth);

    // Fallback to Correios WS
    if (options.length === 0) {
      options = await tryCorreiosXml(cleanOrigin, cleanDestiny, safeWeight, safeLength, safeHeight, safeWidth);
    }

    return new Response(JSON.stringify({ options }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Error:', err);
    return new Response(JSON.stringify({ error: 'Erro ao consultar frete' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
