import { z } from 'zod';
import { cpf, cnpj } from 'cpf-cnpj-validator';

const digits = (value: string) => value.replace(/\D/g, '');
const requiredText = (label: string, max = 150) => z.string().trim().min(1, `Informe ${label}.`).max(max, `${label}: máximo de ${max} caracteres.`);

export const customerSchema = z.object({
  name: requiredText('o nome', 200),
  cpfCnpj: z.string().trim().max(18).refine(value => cpf.isValid(value) || cnpj.isValid(value), 'Informe um CPF/CNPJ válido.'),
  whatsapp: z.string().trim().max(20).refine(value => /^[1-9]{2}\d{8,9}$/.test(digits(value)), 'Informe um telefone com DDD (10 ou 11 dígitos).'),
  cep: z.string().trim().max(9).refine(value => /^\d{8}$/.test(digits(value)), 'Informe um CEP com 8 dígitos.'),
  uf: z.enum(['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'], { errorMap: () => ({ message: 'Informe uma UF válida.' }) }),
  city: requiredText('a cidade'),
  neighborhood: requiredText('o bairro'),
  address: requiredText('a rua', 250),
  number: requiredText('o número do endereço (ou S/N)', 30),
});

export function getCustomerError(customer: unknown): string | null {
  const result = customerSchema.safeParse(customer);
  return result.success ? null : result.error.issues[0]?.message || 'Preencha os dados obrigatórios.';
}