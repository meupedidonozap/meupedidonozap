export function paymentRefusalReason(detail?: string): string {
  const reasons: Record<string, string> = {
    cc_rejected_insufficient_amount: 'Limite ou saldo insuficiente no cartão.',
    cc_rejected_high_risk: 'Pagamento recusado pela análise de segurança. Confira o nome e CPF do titular do cartão e os dados do comprador. Uma divergência pode causar recusa, mas o provedor não confirmou que esse foi o motivo.',
    cc_rejected_bad_filled_other: 'Dados do cartão ou titular incorretos. Confira nome, CPF e demais dados informados.',
    cc_rejected_call_for_authorize: 'Autorize a compra com o banco emissor e tente novamente.',
    cc_rejected_bad_filled_security_code: 'Código de segurança (CVV) incorreto.',
    cc_rejected_bad_filled_date: 'Data de validade incorreta.',
    cc_rejected_bad_filled_card_number: 'Número do cartão incorreto.',
    cc_rejected_blacklist: 'Cartão não aceito para compras online.',
    cc_rejected_card_disabled: 'Cartão bloqueado ou não ativado. Consulte o banco.',
    cc_rejected_duplicated_payment: 'Tentativa de pagamento duplicada.',
    cc_rejected_max_attempts: 'Limite de tentativas atingido. Use outro cartão.',
    cc_rejected_invalid_installments: 'Parcelamento não aceito pelo cartão.',
    cc_rejected_card_type_not_allowed: 'Tipo de cartão não aceito.',
    cc_rejected_other_reason: 'Pagamento recusado pelo banco emissor, sem motivo detalhado.',
    cc_amount_rate_limit_exceeded: 'Limite do cartão excedido.',
    rejected_by_bank: 'Pagamento recusado pelo banco emissor.',
    rejected_by_regulations: 'Pagamento recusado por regras do banco.',
    rejected_insufficient_data: 'Dados do comprador incompletos. Confira nome e CPF.',
    expired: 'Pagamento expirado.',
    by_payer: 'Pagamento cancelado pelo comprador.',
  };
  return reasons[detail || ''] || 'Pagamento não aprovado. O provedor não informou um motivo detalhado.';
}