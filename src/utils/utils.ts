export function formatDateToISO(date: Date): string {
  return date.toISOString().split("T")[0] || "";
}
