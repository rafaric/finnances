import { Categoria, EstadoTransaccion, PrismaClient, TipoCuenta } from "@prisma/client";
import calcularSaldo from "./saldo";

export interface GastoCategoriaData {
  categoria: Categoria;
  monto: number;
  porcentaje: number;
}

export interface ResumenMensualData {
  periodo: string;
  ingresos: number;
  gastos: number;
  ahorro: number;
  margen: number;
  gastosPorCategoria: GastoCategoriaData[];
  disponibleLiquido: number;
  deudaTarjetas: number;
}

export async function calcularResumenMensual(
  prisma: PrismaClient,
  periodo: string, // YYYY-MM
): Promise<ResumenMensualData> {
  const start = new Date(`${periodo}-01T00:00:00.000Z`);
  const end = new Date(start);
  end.setUTCMonth(end.getUTCMonth() + 1);

  const [transacciones, ingresos, cuentas] = await Promise.all([
    prisma.transaccion.findMany({
      where: {
        estado: EstadoTransaccion.CONFIRMADA,
        fecha: { gte: start, lt: end },
      },
    }),
    prisma.ingreso.findMany({
      where: { fechaCobro: { gte: start, lt: end } },
    }),
    prisma.cuenta.findMany(),
  ]);

  // gastos: transacciones con monto negativo (excluye transferencias — no hay Transaccion para ellas)
  const gastosTotal = transacciones.reduce((acc, t) => {
    const m = Number(t.monto);
    return m < 0 ? acc + Math.abs(m) : acc;
  }, 0);

  const ingresosTotal = ingresos.reduce((acc, i) => acc + Number(i.monto), 0);

  // gastos por categoria
  const porCategoria = new Map<Categoria, number>();
  for (const t of transacciones) {
    const m = Number(t.monto);
    if (m < 0) {
      porCategoria.set(t.categoria, (porCategoria.get(t.categoria) ?? 0) + Math.abs(m));
    }
  }

  const gastosPorCategoria: GastoCategoriaData[] = Array.from(porCategoria.entries())
    .map(([categoria, monto]) => ({
      categoria,
      monto: Number(monto.toFixed(2)),
      porcentaje: gastosTotal > 0 ? Number(((monto / gastosTotal) * 100).toFixed(2)) : 0,
    }))
    .sort((a, b) => b.monto - a.monto);

  // saldos por tipo de cuenta
  const saldos = await Promise.all(
    cuentas.map(async (c) => ({ tipo: c.tipo, saldo: await calcularSaldo(prisma, c.id) })),
  );

  const disponibleLiquido = saldos
    .filter((s) => s.tipo !== TipoCuenta.TARJETA_CREDITO)
    .reduce((acc, s) => acc + s.saldo, 0);

  const deudaTarjetas = saldos
    .filter((s) => s.tipo === TipoCuenta.TARJETA_CREDITO)
    .reduce((acc, s) => acc + Math.abs(Math.min(s.saldo, 0)), 0);

  const ahorro = Number((ingresosTotal - gastosTotal).toFixed(2));
  const margen = ingresosTotal > 0
    ? Number(((ahorro / ingresosTotal) * 100).toFixed(2))
    : 0;

  return {
    periodo,
    ingresos: Number(ingresosTotal.toFixed(2)),
    gastos: Number(gastosTotal.toFixed(2)),
    ahorro,
    margen,
    gastosPorCategoria,
    disponibleLiquido: Number(disponibleLiquido.toFixed(2)),
    deudaTarjetas: Number(deudaTarjetas.toFixed(2)),
  };
}
