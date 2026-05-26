import type { StoreSettings, StoreType } from '@/types';

/**
 * Templates pré-configurados aplicados ao criar nova loja por tipo de negócio.
 * Baseado na configuração madura da Pastelaria RM26 (modelo DELIVERY).
 */

export interface StoreTemplate {
  settings: StoreSettings;
  categories: string[];
  ingredients: { name: string; extraPrice?: number }[];
}

const baseWorkingHours = {
  monday: { open: '08:00', close: '22:00', isOpen: true },
  tuesday: { open: '08:00', close: '22:00', isOpen: true },
  wednesday: { open: '08:00', close: '22:00', isOpen: true },
  thursday: { open: '08:00', close: '22:00', isOpen: true },
  friday: { open: '08:00', close: '23:00', isOpen: true },
  saturday: { open: '08:00', close: '23:00', isOpen: true },
  sunday: { open: '00:00', close: '00:00', isOpen: false },
};

/**
 * Modelo DELIVERY (COMIDA) — espelhado da Pastelaria RM26.
 * Inclui categorias, ingredientes/molhos comuns, formas de pagamento
 * e horários típicos do ramo (manhã, almoço, tarde, noite).
 */
export const DELIVERY_TEMPLATE: StoreTemplate = {
  settings: {
    primaryColor: '#1a2332',
    accentColor: '#22c55e',
    deliveryFee: 0,
    minOrderValue: 0,
    acceptPix: true,
    acceptCard: true,
    acceptBoleto: false,
    workingHours: baseWorkingHours,
    discountRules: [],
    offersDelivery: false,
    deliveryNeighborhoods: [],
    materialApoio: { enabled: false, maxPercent: 4, categoryIds: [] },
  },
  categories: [
    'BEBIDAS',
    'CAFÉS',
    'CHOCOLATES',
    'LANCHES',
    'PASTEL',
    'PASTÉIS DOCES & ESPECIAIS',
    'PIZZA',
    'PORÇÕES',
  ],
  ingredients: [
    { name: 'AZEITONA' },
    { name: 'BACON' },
    { name: 'BANANA' },
    { name: 'BROCOLIS' },
    { name: 'CALABRESA' },
    { name: 'CARNE' },
    { name: 'CATUPIRY' },
    { name: 'CEBOLA' },
    { name: 'CHEDDAR' },
    { name: 'CHOCO BRANCO' },
    { name: 'CHOCO PRETO' },
    { name: 'CONFETE' },
    { name: 'FRANGO' },
    { name: 'MILHO' },
    { name: 'MORANGO' },
    { name: 'MUSSARELA' },
    { name: 'ORÉGANO' },
    { name: 'OVO' },
    { name: 'PALMITO' },
    { name: 'PEPINO' },
    { name: 'PRESUNTO' },
    { name: 'TOMATE' },
    { name: 'ÁGUA SEM GAS 500ML' },
    { name: 'COCA COLA LATA 350ML' },
    { name: 'GUARANÁ LATA 350ML' },
    { name: 'SUCO' },
  ],
};

export function getTemplateForType(type: StoreType): StoreTemplate | null {
  if (type === 'COMIDA') return DELIVERY_TEMPLATE;
  return null;
}