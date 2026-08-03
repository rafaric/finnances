import type { Cuenta } from "@prisma/client";

export interface CuentaResumenDTO {
  id: string;
  nombre: string;
  saldoActual: number;
}

export function toCuentaResumenDTO(
  cuenta: Pick<Cuenta, "id" | "nombre">,
  saldoCalculado: number,
): CuentaResumenDTO {
  return {
    id: cuenta.id,
    nombre: cuenta.nombre,
    saldoActual: saldoCalculado,
  };
}
