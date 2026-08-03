import type { EstadoResumen, Resumen } from "@prisma/client";

export interface ResumenResponseDTO {
  id: string;
  cuentaId: string;
  periodo: string;
  montoTotalInformado: number;
  montoMinimoInformado: number;
  totalConsumosInformado?: number;
  montoPagado?: number;
  fechaPago?: string;
  saldoFinanciado: number;
  estado: EstadoResumen;
}

export function toResumenDTO(
  resumen: Pick<
    Resumen,
    | "id"
    | "cuentaId"
    | "periodo"
    | "montoTotalInformado"
    | "montoMinimoInformado"
    | "totalConsumosInformado"
    | "montoPagado"
    | "fechaPago"
    | "saldoFinanciado"
    | "estado"
  >,
): ResumenResponseDTO {
  return {
    id: resumen.id,
    cuentaId: resumen.cuentaId,
    periodo: resumen.periodo,
    montoTotalInformado: Number(resumen.montoTotalInformado),
    montoMinimoInformado: Number(resumen.montoMinimoInformado),
    totalConsumosInformado:
      resumen.totalConsumosInformado != null
        ? Number(resumen.totalConsumosInformado)
        : undefined,
    montoPagado:
      resumen.montoPagado != null ? Number(resumen.montoPagado) : undefined,
    fechaPago: resumen.fechaPago?.toISOString(),
    saldoFinanciado: Number(resumen.saldoFinanciado),
    estado: resumen.estado,
  };
}
