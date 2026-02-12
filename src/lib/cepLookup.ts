export async function fetchAddressByCep(cep: string) {
  const cleaned = cep.replace(/\D/g, '');
  if (cleaned.length !== 8) return null;
  const res = await fetch(`https://viacep.com.br/ws/${cleaned}/json/`);
  const data = await res.json();
  if (data.erro) return null;
  return {
    uf: data.uf as string,
    city: data.localidade as string,
    neighborhood: data.bairro as string,
    address: data.logradouro as string,
  };
}
