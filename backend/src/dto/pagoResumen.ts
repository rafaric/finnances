import type { PagoResumen, TipoPagoResumen } from "@prisma/client";

export interface PagoResumenResponseDTO {
  id: string;
  resumenId: string;
  cuentaOrigenId: string;
  cuentaOrigenNombre: string;
  monto: number;
  fecha: string;
  tipo: TipoPagoResumen;
}

export function toPagoResumenDTO(pago: PagoResumen & { cuentaOrigen: { nombre: string } }): PagoResumenResponseDTO {
  return {
    id: pago.id,
    resumenId: pago.resumenId,
    cuentaOrigenId: pago.cuentaOrigenId,
    cuentaOrigenNombre: pago.cuentaOrigen.nombre,
    monto: Number(pago.monto),
    fecha: pago.fecha.toISOString(),
    tipo: pago.tipo,
  };
}
