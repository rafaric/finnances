import type { CargoResumen, EstadoCargoResumen, TipoCargoResumen } from "@prisma/client";

export interface CargoResumenResponseDTO {
  id: string;
  resumenId: string;
  tipo: TipoCargoResumen;
  monto: number;
  estado: EstadoCargoResumen;
  transaccionId?: string;
}

export function toCargoResumenDTO(cargo: CargoResumen): CargoResumenResponseDTO {
  return {
    id: cargo.id,
    resumenId: cargo.resumenId,
    tipo: cargo.tipo,
    monto: Number(cargo.monto),
    estado: cargo.estado,
    transaccionId: cargo.transaccionId ?? undefined,
  };
}
