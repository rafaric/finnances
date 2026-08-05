import type { Categoria, EstadoTransaccion, OrigenTransaccion, Transaccion } from "@prisma/client";
import type { CuentaResumenDTO } from "./cuenta";

export interface TransaccionResponseDTO {
  id: string;
  monto: number;
  moneda: string;
  comercio?: string;
  origen: OrigenTransaccion;
  categoria: Categoria;
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
    | "origen"
    | "categoria"
    | "fecha"
    | "estado"
     | "textoCrudoOCR"
     | "esTransferenciaAPersona"
  >;
  cuenta?: CuentaResumenDTO;
}

export function toTransaccionDTO({
  transaccion,
  cuenta,
}: ToTransaccionDTOInput): TransaccionResponseDTO {
  return {
    id: transaccion.id,
    monto: Number(transaccion.monto),
    moneda: transaccion.moneda,
    comercio: transaccion.comercio ?? undefined,
    origen: transaccion.origen,
    categoria: transaccion.categoria,
    fecha: transaccion.fecha.toISOString(),
    estado: transaccion.estado,
    cuenta,
    textoCrudoOCR: transaccion.textoCrudoOCR ?? undefined,
    esTransferenciaAPersona: transaccion.esTransferenciaAPersona,
  };
}
