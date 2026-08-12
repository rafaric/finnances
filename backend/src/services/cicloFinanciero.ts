import { PrismaClient } from "@prisma/client";

function calendarFallback(periodo: string): Date {
  const start = new Date(`${periodo}-01T00:00:00.000Z`);
  start.setUTCMonth(start.getUTCMonth() + 1);
  return start;
}

export async function obtenerRangoCiclo(prisma: PrismaClient, periodo: string): Promise<{ start: Date; end: Date }> {
  const ciclo = await prisma.cicloFinanciero.findUnique({ where: { periodo } });
  if (!ciclo) {
    const start = new Date(`${periodo}-01T00:00:00.000Z`);
    return { start, end: calendarFallback(periodo) };
  }

  const start = ciclo.inicio;
  const siguiente = await prisma.cicloFinanciero.findFirst({
    where: { inicio: { gt: start } },
    orderBy: { inicio: "asc" },
    select: { inicio: true },
  });
  return { start, end: siguiente?.inicio ?? calendarFallback(periodo) };
}
