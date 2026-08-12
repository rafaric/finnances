import type { Cuenta, TransferenciaInterna } from "@prisma/client";
import type { CuentaResumenDTO } from "./cuenta";

export interface TransferenciaResponseDTO {
  id: string;
  cuentaOrigen: CuentaResumenDTO;
  cuentaDestino: CuentaResumenDTO;
  monto: number;
  fecha: string;
  nota?: string;
  createdAt?: string;
}

export interface TransferenciaWithCuentas
  extends TransferenciaInterna {
  cuentaOrigen: Pick<Cuenta, "id" | "nombre">;
  cuentaDestino: Pick<Cuenta, "id" | "nombre">;
}

export interface ToTransferenciaDTOInput {
  transferencia: TransferenciaWithCuentas;
  cuentaOrigen: CuentaResumenDTO;
  cuentaDestino: CuentaResumenDTO;
}

export function toTransferenciaDTO({
  transferencia,
  cuentaOrigen,
  cuentaDestino,
}: ToTransferenciaDTOInput): TransferenciaResponseDTO {
  return {
    id: transferencia.id,
    cuentaOrigen,
    cuentaDestino,
    monto: Number(transferencia.monto),
    fecha: transferencia.fecha.toISOString(),
    nota: transferencia.nota ?? undefined,
    createdAt: transferencia.createdAt.toISOString(),
  };
}
