import type { Cuenta, TipoCuenta } from "@prisma/client";

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

export interface CuentaResponseDTO {
  id: string;
  nombre: string;
  tipo: TipoCuenta;
  banco?: string;
  nombreEntidad?: string;
  ultimosDigitos?: string;
  colorIdentificador?: string;
  saldoInicial: number;
  saldoActual: number;
  diaCierre?: number;
  diaPago?: number;
  cuentaDebitoMinimoId?: string;
}

export function toCuentaDTO(
  cuenta: Pick<
    Cuenta,
    | "id" | "nombre" | "tipo" | "banco" | "nombreEntidad" | "ultimosDigitos"
     | "colorIdentificador" | "saldoInicial" | "diaCierre" | "diaPago" | "cuentaDebitoMinimoId"
  >,
  saldoCalculado: number,
): CuentaResponseDTO {
  return {
    id: cuenta.id,
    nombre: cuenta.nombre,
    tipo: cuenta.tipo,
    banco: cuenta.banco ?? undefined,
    nombreEntidad: cuenta.nombreEntidad ?? undefined,
    ultimosDigitos: cuenta.ultimosDigitos ?? undefined,
    colorIdentificador: cuenta.colorIdentificador ?? undefined,
    saldoInicial: Number(cuenta.saldoInicial),
    saldoActual: saldoCalculado,
    diaCierre: cuenta.diaCierre ?? undefined,
    diaPago: cuenta.diaPago ?? undefined,
    cuentaDebitoMinimoId: cuenta.cuentaDebitoMinimoId ?? undefined,
  };
}
