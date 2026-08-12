import type { Compra, Cuota, EstadoCuota } from "@prisma/client";

export interface CuotaResponseDTO {
  id: string;
  compraId: string;
  numeroCuota: number;
  monto: number;
  moneda: string;
  fechaImputacion: string;
  estado: EstadoCuota;
  transaccionId?: string;
}

export interface CompraResponseDTO {
  id: string;
  montoTotal: number;
  moneda: string;
  comercio: string;
  fechaCompra: string;
  cantidadCuotas: number;
  cuentaId: string;
  cuotas: CuotaResponseDTO[];
}

export function toCuotaDTO(cuota: Cuota): CuotaResponseDTO {
  return {
    id: cuota.id,
    compraId: cuota.compraId,
    numeroCuota: cuota.numeroCuota,
    monto: Number(cuota.monto),
    moneda: cuota.moneda,
    fechaImputacion: cuota.fechaImputacion.toISOString(),
    estado: cuota.estado,
    transaccionId: cuota.transaccionId ?? undefined,
  };
}

export function toCompraDTO(compra: Compra & { cuotas: Cuota[] }): CompraResponseDTO {
  return {
    id: compra.id,
    montoTotal: Number(compra.montoTotal),
    moneda: compra.moneda,
    comercio: compra.comercio,
    fechaCompra: compra.fechaCompra.toISOString(),
    cantidadCuotas: compra.cantidadCuotas,
    cuentaId: compra.cuentaId,
    cuotas: compra.cuotas.map(toCuotaDTO),
  };
}
