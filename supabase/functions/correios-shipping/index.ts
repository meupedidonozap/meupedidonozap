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

    const services = [
      { code: '04510', name: 'PAC' },
      { code: '04014', name: 'SEDEX' },
    ];

    const options: ShippingOption[] = [];

    // Try multiple API endpoints
    const apis = [
      `https://www.cepcerto.com/ws/json-frete/${cleanOrigin}/${cleanDestiny}/${safeWeight}/${safeLength}/${safeHeight}/${safeWidth}`,
    ];

    // Try CepCerto API first (free, no auth needed, fast)
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      const res = await fetch(apis[0], { signal: controller.signal });
      clearTimeout(timeout);

      const data = await res.json();
      console.log('CepCerto response:', JSON.stringify(data));

      if (data.valorpac && parseFloat(data.valorpac) > 0) {
        options.push({
          code: '04510',
          name: 'PAC',
          price: parseFloat(data.valorpac.replace(',', '.')),
          deadline: parseInt(data.prazopac) || 10,
        });
      }

      if (data.valorsedex && parseFloat(data.valorsedex) > 0) {
        options.push({
          code: '04014',
          name: 'SEDEX',
          price: parseFloat(data.valorsedex.replace(',', '.')),
          deadline: parseInt(data.prazosedex) || 5,
        });
      }
    } catch (e) {
      console.error('CepCerto failed:', e);
    }

    // Fallback: try Correios WS (may be slow)
    if (options.length === 0) {
      try {
        const params = new URLSearchParams({
          nCdEmpresa: '',
          sDsSenha: '',
          nCdServico: '04510,04014',
          sCepOrigem: cleanOrigin,
          sCepDestino: cleanDestiny,
          nVlPeso: String(safeWeight),
          nCdFormato: '1',
          nVlComprimento: String(safeLength),
          nVlAltura: String(safeHeight),
          nVlLargura: String(safeWidth),
          nVlDiametro: '0',
          sCdMaoPropria: 'N',
          nVlValorDeclarado: '0',
          sCdAvisoRecebimento: 'N',
          StrRetorno: 'xml',
        });

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);

        const url = `https://ws.correios.com.br/calculador/CalcPrecoPrazo.aspx?${params.toString()}`;
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timeout);

        const text = await res.text();
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
      } catch (e) {
        console.error('Correios WS failed:', e);
      }
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
