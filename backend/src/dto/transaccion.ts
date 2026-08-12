import type { EstadoTransaccion, OrigenTransaccion, Transaccion, Categoria, Subcategoria } from "@prisma/client";
import type { CuentaResumenDTO } from "./cuenta";

export interface CategoriaResponseDTO {
  id: string;
  nombre: string;
  icono: string;
  color: string;
  tipo: "GASTO" | "INGRESO";
  activa: boolean;
}

export interface SubcategoriaResponseDTO {
  id: string;
  nombre: string;
  categoriaId: string;
}

export interface TransaccionResponseDTO {
  id: string;
  monto: number;
  moneda: string;
  comercio?: string;
  nota?: string;
  createdAt?: string;
  origen: OrigenTransaccion;
  categoria: CategoriaResponseDTO;
  subcategoria?: SubcategoriaResponseDTO;
  fecha: string;
  estado: EstadoTransaccion;
  cuenta?: CuentaResumenDTO;
  textoCrudoOCR?: string;
  esTransferenciaAPersona: boolean;
}

export interface ToTransaccionDTOInput {
  transaccion: Pick<
    Transaccion,
    | "id"
    | "monto"
    | "moneda"
     | "comercio"
     | "nota"
    | "origen"
    | "categoriaId"
    | "subcategoriaId"
    | "fecha"
    | "estado"
    | "textoCrudoOCR"
     | "esTransferenciaAPersona"
     | "createdAt"
  >;
  categoria: Pick<Categoria, "id" | "nombre" | "icono" | "color" | "tipo" | "activa">;
  subcategoria?: Pick<Subcategoria, "id" | "nombre" | "categoriaId"> | null;
  cuenta?: CuentaResumenDTO;
}

export function toTransaccionDTO({
  transaccion,
  categoria,
  subcategoria,
  cuenta,
}: ToTransaccionDTOInput): TransaccionResponseDTO {
  return {
    id: transaccion.id,
    monto: Number(transaccion.monto),
    moneda: transaccion.moneda,
    comercio: transaccion.comercio ?? undefined,
    nota: transaccion.nota ?? undefined,
    createdAt: transaccion.createdAt.toISOString(),
    origen: transaccion.origen,
    categoria: {
      id: categoria.id,
      nombre: categoria.nombre,
      icono: categoria.icono,
      color: categoria.color,
      tipo: categoria.tipo,
      activa: categoria.activa,
    },
    subcategoria: subcategoria
      ? {
          id: subcategoria.id,
          nombre: subcategoria.nombre,
          categoriaId: subcategoria.categoriaId,
        }
      : undefined,
    fecha: transaccion.fecha.toISOString(),
    estado: transaccion.estado,
    cuenta,
    textoCrudoOCR: transaccion.textoCrudoOCR ?? undefined,
    esTransferenciaAPersona: transaccion.esTransferenciaAPersona,
  };
}
