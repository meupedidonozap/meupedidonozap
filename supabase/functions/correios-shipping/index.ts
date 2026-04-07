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

    // Service codes: 04510 = PAC, 04014 = SEDEX
    const services = [
      { code: '04510', name: 'PAC' },
      { code: '04014', name: 'SEDEX' },
    ];

    const params = new URLSearchParams({
      nCdEmpresa: '',
      sDsSenha: '',
      nCdServico: services.map(s => s.code).join(','),
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
    const timeout = setTimeout(() => controller.abort(), 15000);

    const url = `http://ws.correios.com.br/calculador/CalcPrecoPrazo.aspx?${params.toString()}`;
    console.log('Fetching:', url);

    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    const text = await res.text();
    console.log('Response length:', text.length);

    const options: ShippingOption[] = [];

    // Parse each cServico block
    const serviceBlocks = text.match(/<cServico>([\s\S]*?)<\/cServico>/g) || [];

    for (const block of serviceBlocks) {
      const codeMatch = block.match(/<Codigo>(\d+)<\/Codigo>/);
      const valorMatch = block.match(/<Valor>([\d.,]+)<\/Valor>/);
      const prazoMatch = block.match(/<PrazoEntrega>(\d+)<\/PrazoEntrega>/);
      const erroMatch = block.match(/<Erro>(\d*)<\/Erro>/);
      const msgErroMatch = block.match(/<MsgErro>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/MsgErro>/);

      const code = codeMatch ? codeMatch[1] : '';
      const service = services.find(s => s.code === code);
      if (!service) continue;

      const erro = erroMatch ? erroMatch[1] : '0';

      if (erro === '0' || erro === '') {
        const valor = valorMatch ? parseFloat(valorMatch[1].replace('.', '').replace(',', '.')) : 0;
        const prazo = prazoMatch ? parseInt(prazoMatch[1]) : 0;

        if (valor > 0) {
          options.push({
            code,
            name: service.name,
            price: valor,
            deadline: prazo,
          });
        }
      } else {
        options.push({
          code,
          name: service.name,
          price: 0,
          deadline: 0,
          error: msgErroMatch ? msgErroMatch[1] : `Erro ${erro}`,
        });
      }
    }

    // If no blocks parsed, try fallback
    if (options.length === 0 && text.length > 0) {
      console.log('No cServico blocks found, raw:', text.substring(0, 500));
    }

    return new Response(JSON.stringify({ options }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Error:', err);
    return new Response(JSON.stringify({ error: 'Erro ao consultar Correios' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
