export function currentPeriod(date = new Date()): string {
  return date.toISOString().slice(0, 7);
}

export function shiftPeriod(periodo: string, amount: number): string {
  const date = new Date(`${periodo}-01T00:00:00.000Z`);
  date.setUTCMonth(date.getUTCMonth() + amount);
  return date.toISOString().slice(0, 7);
}

export function formatPeriod(periodo: string): string {
  return new Intl.DateTimeFormat("es-AR", {
    month: "short",
    year: "numeric",
  }).format(new Date(`${periodo}-01T00:00:00.000Z`));
}
