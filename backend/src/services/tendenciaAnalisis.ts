import { PrismaClient } from "@prisma/client";
import { calcularResumenMensual } from "./resumenMensual";

export interface TendenciaMesData {
  periodo: string;
  ingresos: number;
  gastos: number;
  ahorro: number;
  tieneDatos: boolean;
}

function shiftPeriod(periodo: string, offset: number): string {
  const [year, month] = periodo.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1 + offset, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export async function calcularTendenciaAnalisis(
  prisma: PrismaClient,
  periodo: string,
  meses: number,
): Promise<TendenciaMesData[]> {
  const periodos = Array.from({ length: meses }, (_, index) => shiftPeriod(periodo, index - meses + 1));
  const resumenes = await Promise.all(periodos.map((item) => calcularResumenMensual(prisma, item)));
  return resumenes.map((resumen) => ({
    periodo: resumen.periodo,
    ingresos: resumen.ingresos,
    gastos: resumen.gastos,
    ahorro: resumen.ahorro,
    tieneDatos: resumen.ingresos > 0 || resumen.gastos > 0,
  }));
}
