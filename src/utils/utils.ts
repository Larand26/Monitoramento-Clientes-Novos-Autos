export function formatDateToISO(date: Date): string {
  return date.toISOString().split("T")[0] || "";
}

export function cleanCnpj(cnpj: string): string {
  return cnpj.replace(/[^\d]+/g, "");
}
