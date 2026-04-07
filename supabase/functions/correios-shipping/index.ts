import { corsHeaders } from '@supabase/supabase-js/cors'

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

    // Weight in grams (API expects grams), minimum 300g
    const weightGrams = Math.max(Math.round((weight || 0.3) * 1000), 300);
    const safeLength = Math.max(length || 16, 16);
    const safeWidth = Math.max(width || 11, 11);
    const safeHeight = Math.max(height || 2, 2);

    // Service codes: 04510 = PAC, 04014 = SEDEX
    const serviceCodes = ['04510', '04014'];
    const serviceNames: Record<string, string> = {
      '04510': 'PAC',
      '04014': 'SEDEX',
    };

    const options: ShippingOption[] = [];

    for (const code of serviceCodes) {
      try {
        const params = new URLSearchParams({
          nCdEmpresa: '',
          sDsSenha: '',
          nCdServico: code,
          sCepOrigem: cleanOrigin,
          sCepDestino: cleanDestiny,
          nVlPeso: String(weightGrams / 1000),
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

        const url = `http://ws.correios.com.br/calculador/CalcPrecoPrazo.aspx?${params.toString()}`;
        const res = await fetch(url);
        const text = await res.text();

        // Parse XML response
        const valorMatch = text.match(/<Valor>([\d.,]+)<\/Valor>/);
        const prazoMatch = text.match(/<PrazoEntrega>(\d+)<\/PrazoEntrega>/);
        const erroMatch = text.match(/<Erro>(\d+)<\/Erro>/);
        const msgErroMatch = text.match(/<MsgErro><!\[CDATA\[(.*?)\]\]><\/MsgErro>/);

        const erro = erroMatch ? erroMatch[1] : '0';

        if (erro === '0' || erro === '') {
          const valor = valorMatch ? parseFloat(valorMatch[1].replace('.', '').replace(',', '.')) : 0;
          const prazo = prazoMatch ? parseInt(prazoMatch[1]) : 0;

          if (valor > 0) {
            options.push({
              code,
              name: serviceNames[code],
              price: valor,
              deadline: prazo,
            });
          }
        } else {
          options.push({
            code,
            name: serviceNames[code],
            price: 0,
            deadline: 0,
            error: msgErroMatch ? msgErroMatch[1] : `Erro ${erro}`,
          });
        }
      } catch (e) {
        options.push({
          code,
          name: serviceNames[code],
          price: 0,
          deadline: 0,
          error: 'Erro ao consultar Correios',
        });
      }
    }

    return new Response(JSON.stringify({ options }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Erro interno' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
