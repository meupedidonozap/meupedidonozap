/** Cliente continua "não atendido" enquanto o check-in está aberto (sem checkout). */
export function isUnattendedCustomer(
  customerId: string,
  visitedInPeriod: Set<string>,
  openVisitIds: { has(id: string): boolean },
): boolean {
  return !visitedInPeriod.has(customerId) || openVisitIds.has(customerId);
}
