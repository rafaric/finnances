import { EstadoInstanciaRecurrente, EstadoTransaccion, PrismaClient, TipoCuenta } from "@prisma/client";
import calcularSaldo from "./saldo";
import { obtenerRangoCiclo } from "./cicloFinanciero";

type CategoriaConNombre = {
  id: string;
  nombre: string;
  icono: string;
  color: string;
  tipo: "GASTO" | "INGRESO";
};

export interface GastoCategoriaData {
  categoria: CategoriaConNombre;
  monto: number;
  porcentaje: number;
  subcategorias?: GastoSubcategoriaData[];
}

export interface GastoSubcategoriaData {
  subcategoria: { id: string; nombre: string };
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
  gastosProyectados: number;
  gastosProyectadosPorCategoria: GastoCategoriaData[];
}

export async function calcularResumenMensual(
  prisma: PrismaClient,
  periodo: string, // YYYY-MM
): Promise<ResumenMensualData> {
  const { start, end } = await obtenerRangoCiclo(prisma, periodo);

  const [transacciones, ingresos, cuentas, cuotasProyectadas, instanciasRecurrentes] = await Promise.all([
    prisma.transaccion.findMany({
      where: {
        estado: EstadoTransaccion.CONFIRMADA,
        fecha: { gte: start, lt: end },
      },
        include: { categoria: true, subcategoria: true },
    }),
    prisma.ingreso.findMany({
      where: { periodoDisponible: periodo },
    }),
    prisma.cuenta.findMany(),
    prisma.cuota.findMany({
      where: { fechaImputacion: { gte: start, lt: end }, estado: "PROYECTADO" },
      include: { compra: { include: { categoria: true } } },
    }),
    prisma.instanciaGastoRecurrente.findMany({
      where: {
        fechaVencimiento: { gte: start, lt: end },
        estado: EstadoInstanciaRecurrente.PROYECTADO,
        gastoRecurrente: { activo: true },
      },
      include: { gastoRecurrente: { include: { categoria: true } } },
    }),
  ]);

  // gastos: transacciones con monto negativo (excluye transferencias — no hay Transaccion para ellas)
  const gastosTotal = transacciones.reduce((acc, t) => {
    const m = Number(t.monto);
    return m < 0 ? acc + Math.abs(m) : acc;
  }, 0);

  const ingresosTotal = ingresos.reduce((acc, i) => acc + Number(i.monto), 0);

  // gastos por categoria
  const porCategoria = new Map<string, { categoria: CategoriaConNombre; monto: number; subcategorias: Map<string, { nombre: string; monto: number }> }>();
  for (const t of transacciones) {
    const m = Number(t.monto);
    if (m < 0 && t.categoria) {
      const existing = porCategoria.get(t.categoria.id);
      if (existing) {
        existing.monto += Math.abs(m);
      } else {
          porCategoria.set(t.categoria.id, {
          categoria: {
            id: t.categoria.id,
            nombre: t.categoria.nombre,
            icono: t.categoria.icono,
            color: t.categoria.color,
            tipo: t.categoria.tipo,
          },
            monto: Math.abs(m),
            subcategorias: new Map(),
          });
        }
        if (t.subcategoria) {
          const category = porCategoria.get(t.categoria.id)!;
          const subcategory = category.subcategorias.get(t.subcategoria.id);
          if (subcategory) subcategory.monto += Math.abs(m);
          else category.subcategorias.set(t.subcategoria.id, { nombre: t.subcategoria.nombre, monto: Math.abs(m) });
        }
      }
  }

  const gastosPorCategoria: GastoCategoriaData[] = Array.from(porCategoria.values())
    .map(({ categoria, monto, subcategorias }) => ({
      categoria,
      monto: Number(monto.toFixed(2)),
      porcentaje: gastosTotal > 0 ? Number(((monto / gastosTotal) * 100).toFixed(2)) : 0,
      subcategorias: Array.from(subcategorias.entries())
        .map(([id, subcategoria]) => ({ subcategoria: { id, nombre: subcategoria.nombre }, monto: Number(subcategoria.monto.toFixed(2)), porcentaje: monto > 0 ? Number(((subcategoria.monto / monto) * 100).toFixed(2)) : 0 }))
        .sort((a, b) => b.monto - a.monto),
    }))
    .sort((a, b) => b.monto - a.monto);

  const proyectadosTotal = cuotasProyectadas.reduce((sum, cuota) => sum + Number(cuota.monto), 0)
    + instanciasRecurrentes.reduce((sum, instancia) => sum + Number(instancia.monto ?? 0), 0);
  const proyectadosPorCategoriaMap = new Map<string, { categoria: CategoriaConNombre; monto: number }>();
  for (const cuota of cuotasProyectadas) {
    const categoria = cuota.compra.categoria;
    if (!categoria) continue;
    const current = proyectadosPorCategoriaMap.get(categoria.id);
    if (current) current.monto += Number(cuota.monto);
    else {
      proyectadosPorCategoriaMap.set(categoria.id, { categoria: { id: categoria.id, nombre: categoria.nombre, icono: categoria.icono, color: categoria.color, tipo: categoria.tipo }, monto: Number(cuota.monto) });
    }
  }
  for (const instancia of instanciasRecurrentes) {
    const categoria = instancia.gastoRecurrente.categoria;
    if (!categoria) continue;
    const monto = Number(instancia.monto ?? 0);
    const current = proyectadosPorCategoriaMap.get(categoria.id);
    if (current) current.monto += monto;
    else {
      proyectadosPorCategoriaMap.set(categoria.id, { categoria: { id: categoria.id, nombre: categoria.nombre, icono: categoria.icono, color: categoria.color, tipo: categoria.tipo }, monto });
    }
  }
  const gastosProyectadosPorCategoria = Array.from(proyectadosPorCategoriaMap.values()).map(({ categoria, monto }) => ({ categoria, monto: Number(monto.toFixed(2)), porcentaje: proyectadosTotal > 0 ? Number(((monto / proyectadosTotal) * 100).toFixed(2)) : 0 })).sort((a, b) => b.monto - a.monto);

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
    gastosProyectados: Number(proyectadosTotal.toFixed(2)),
    gastosProyectadosPorCategoria,
  };
}
