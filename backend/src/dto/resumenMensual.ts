import type { ResumenMensualData, GastoCategoriaData } from "../services/resumenMensual";

export interface CategoriaDTO {
  id: string;
  nombre: string;
  icono: string;
  color: string;
  tipo: "GASTO" | "INGRESO";
}

export interface GastoCategoriaDTO {
  categoria: CategoriaDTO;
  monto: number;
  porcentaje: number;
}

export interface ResumenMensualDTO {
  periodo: string;
  ingresos: number;
  gastos: number;
  ahorro: number;
  margen: number;
  gastosPorCategoria: GastoCategoriaDTO[];
  disponibleLiquido: number;
  deudaTarjetas: number;
}

export function toResumenMensualDTO(data: ResumenMensualData): ResumenMensualDTO {
  return {
    periodo: data.periodo,
    ingresos: data.ingresos,
    gastos: data.gastos,
    ahorro: data.ahorro,
    margen: data.margen,
    gastosPorCategoria: data.gastosPorCategoria.map((g: GastoCategoriaData) => ({
      categoria: {
        id: g.categoria.id,
        nombre: g.categoria.nombre,
        icono: g.categoria.icono,
        color: g.categoria.color,
        tipo: g.categoria.tipo,
      },
      monto: g.monto,
      porcentaje: g.porcentaje,
    })),
    disponibleLiquido: data.disponibleLiquido,
    deudaTarjetas: data.deudaTarjetas,
  };
}
