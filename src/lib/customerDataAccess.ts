export function isManagedCustomerStore(slug?: string): boolean {
  return slug === 'dicolore' || slug === 'dicoloresenses';
}

export function customerDataIsReadOnly(slug: string | undefined, isStaff: boolean): boolean {
  return isManagedCustomerStore(slug) && !isStaff;
}