## Novo segmento: SALAO (Salão de Beleza com Agendamento)

Criar um novo tipo de loja `SALAO` que permite cadastrar serviços com duração e gerenciar uma agenda de horários por profissional, com reserva automática ao gerar pedido.

---

### 1. Banco de dados (migration)

**Adicionar tipo `SALAO`** ao enum `StoreType`.

**Nova tabela `salon_professionals`** (profissionais do salão):
- store_id, name, photo_url, bio, is_active, sort_order

**Nova tabela `salon_services`** (serviços oferecidos):
- store_id, name, description, price, duration_minutes (ex: 30, 60, 90), image_url, is_active, sort_order
- (separada de `products` para ter o campo duração e simplificar)

**Tabela de associação `salon_service_professionals`**:
- service_id, professional_id (quais profissionais executam quais serviços)

**Nova tabela `salon_appointments`** (reservas de horário):
- store_id, professional_id, service_id, order_id (opcional — link com pedido)
- customer_name, customer_whatsapp
- starts_at (timestamptz), ends_at (timestamptz)
- status: `reservado` (pedido gerado) | `confirmado` (salão confirmou) | `concluido` | `cancelado`
- created_at
- **Constraint EXCLUDE** (via btree_gist) impedindo dois agendamentos do mesmo profissional com intervalo `[starts_at, ends_at)` sobreposto, exceto quando status=`cancelado`. Garante que não dá para reservar o mesmo horário duas vezes.

**RLS**: leitura pública (para mostrar slots ocupados), escrita autenticada (admin da loja) + insert via Edge Function para cliente final.

### 2. Edge Function `criar-agendamento`

Recebe `{ storeId, serviceId, professionalId, startsAt, customer, orderId? }`. Valida disponibilidade, calcula `endsAt` a partir de `duration_minutes`, insere na tabela. A constraint EXCLUDE garante que dois clientes simultâneos não consigam reservar o mesmo slot (o segundo recebe erro). Retorna o agendamento criado.

### 3. Admin do Salão (`/:slug/admin`)

Nova aba **"Salão"** visível só quando `store.type === 'SALAO'` com sub-abas:

- **Profissionais**: CRUD (nome, foto, bio, ativar/desativar).
- **Serviços**: CRUD com nome, descrição, preço, **duração em minutos**, foto, e seleção de quais profissionais executam.
- **Agenda**: visualização semanal/diária mostrando agendamentos. Permite:
  - Criar agendamento manual (escolher profissional, serviço, cliente, data/hora).
  - Cancelar/confirmar/concluir agendamento.
  - Bloquear horários (cria appointment do tipo "bloqueio" interno).

Horários de funcionamento usam o `workingHours` já existente em `StoreSettings`.

### 4. Storefront do Salão (`/:slug` quando type=SALAO)

Nova página `SalonStorePage`:

- Lista de serviços (cards com foto, nome, preço, duração).
- Cliente clica em **Agendar** → abre `BookingDialog`:
  1. **Escolher profissional** (lista os habilitados para aquele serviço; opção "Qualquer profissional" pega o primeiro disponível).
  2. **Escolher data** (calendário shadcn, datas passadas e dias fechados desabilitados conforme `workingHours`).
  3. **Escolher horário**: gera slots a partir do horário de abertura, com intervalo igual à `duration_minutes` do serviço, e remove os que conflitam com agendamentos existentes daquele profissional. Slots ocupados aparecem desabilitados.
  4. **Confirmar dados do cliente** (nome, whatsapp — usa perfil logado se houver).
  5. Ao confirmar: chama `criar-pedido` (cria order com 1 item = serviço) + `criar-agendamento` em sequência. Se a edge function de agendamento falhar (slot tomado entre o load e o submit), mostra erro pedindo para escolher outro horário sem criar pedido órfão.
- Após sucesso: redireciona para tela de confirmação com WhatsApp do salão e mensagem pré-formatada.

### 5. Tipos e hooks (frontend)

- `src/types/index.ts`: adicionar `'SALAO'` em `StoreType` e novos tipos `SalonService`, `SalonProfessional`, `SalonAppointment`.
- Novos hooks: `useSalonServices`, `useSalonProfessionals`, `useSalonAppointments` (com filtros por data/profissional), `useCreateAppointment`.
- `StorePage.tsx`: rotear para `SalonStorePage` quando `store.type === 'SALAO'`.

### 6. AdminPage (plataforma)

Adicionar `SALAO` nas opções de tipo ao criar loja.

---

### Reserva imediata (regra do usuário)

Conforme escolhido: **ao gerar o pedido o slot já é reservado** (status `reservado`). A constraint do banco impede sobreposição mesmo que dois clientes cliquem ao mesmo tempo. O salão depois confirma/conclui pelo admin. Se cancelar, libera o slot automaticamente (status `cancelado` é excluído da constraint).

### Pontos não incluídos (futuro)

- Notificações automáticas (lembrete por WhatsApp).
- Pagamento online antecipado.
- Sinal/caução para reserva.
- Relatórios de ocupação por profissional.