import type { Ingreso } from "@prisma/client";
import type { CuentaResumenDTO } from "./cuenta";
import type { CategoriaResponseDTO, SubcategoriaResponseDTO } from "./transaccion";

export interface IngresoResponseDTO {
  id: string;
  monto: number;
  moneda: string;
  fechaCobro: string;
  periodoDisponible: string;
  categoria: CategoriaResponseDTO;
  subcategoria?: SubcategoriaResponseDTO;
  cuenta: CuentaResumenDTO;
}

interface IngresoConCategoria extends Ingreso {
  categoria: { id: string; nombre: string; icono: string; color: string; tipo: string; activa: boolean };
  subcategoria?: { id: string; nombre: string; categoriaId: string } | null;
}

export function toIngresoDTO(ingreso: IngresoConCategoria, cuenta: CuentaResumenDTO): IngresoResponseDTO {
  return {
    id: ingreso.id,
    monto: Number(ingreso.monto),
    moneda: "ARS",
    fechaCobro: ingreso.fechaCobro.toISOString(),
    periodoDisponible: ingreso.periodoDisponible,
    categoria: {
      id: ingreso.categoria.id,
      nombre: ingreso.categoria.nombre,
      icono: ingreso.categoria.icono,
      color: ingreso.categoria.color,
      tipo: ingreso.categoria.tipo as "GASTO" | "INGRESO",
      activa: ingreso.categoria.activa,
    },
    subcategoria: ingreso.subcategoria
      ? {
          id: ingreso.subcategoria.id,
          nombre: ingreso.subcategoria.nombre,
          categoriaId: ingreso.subcategoria.categoriaId,
        }
      : undefined,
    cuenta,
  };
}
