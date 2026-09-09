import type { GastoRecurrenteResponseDTO } from "../../api/types";

function nextDueTimestamp(day: number | undefined, now: Date): number {
  if (!day) return Number.POSITIVE_INFINITY;

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const currentMonthLastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const dueThisMonth = new Date(now.getFullYear(), now.getMonth(), Math.min(day, currentMonthLastDay));
  if (dueThisMonth >= today) return dueThisMonth.getTime();

  const nextMonthLastDay = new Date(now.getFullYear(), now.getMonth() + 2, 0).getDate();
  return new Date(now.getFullYear(), now.getMonth() + 1, Math.min(day, nextMonthLastDay)).getTime();
}

export function sortActiveRecurrentes(items: GastoRecurrenteResponseDTO[], now = new Date()): GastoRecurrenteResponseDTO[] {
  return [...items].sort((left, right) => {
    const dueDifference = nextDueTimestamp(left.diaDelMes, now) - nextDueTimestamp(right.diaDelMes, now);
    return dueDifference || left.id.localeCompare(right.id);
  });
}
