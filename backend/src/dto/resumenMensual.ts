import type { Categoria } from "@prisma/client";
import type { ResumenMensualData, GastoCategoriaData } from "../services/resumenMensual";

export interface GastoCategoriaDTO {
  categoria: Categoria;
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
      categoria: g.categoria,
      monto: g.monto,
      porcentaje: g.porcentaje,
    })),
    disponibleLiquido: data.disponibleLiquido,
    deudaTarjetas: data.deudaTarjetas,
  };
}
