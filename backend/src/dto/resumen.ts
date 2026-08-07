import type { EstadoConciliacion, EstadoResumen, Resumen } from "@prisma/client";

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
  entidadInformada?: string;
  ultimosDigitosInformados?: string;
  interesesInformados?: number;
  impuestosInformados?: number;
  comisionesInformadas?: number;
  segurosInformados?: number;
  confianzaOCR?: number;
  diferenciaConciliacion?: number;
  estadoConciliacion: EstadoConciliacion;
  estado: EstadoResumen;
  consumosExtraidos?: unknown[];
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
     | "saldoFinanciado" | "entidadInformada" | "ultimosDigitosInformados"
     | "interesesInformados" | "impuestosInformados" | "comisionesInformadas"
     | "segurosInformados" | "confianzaOCR" | "diferenciaConciliacion" | "estadoConciliacion" | "consumosExtraidos"
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
    entidadInformada: resumen.entidadInformada ?? undefined,
    ultimosDigitosInformados: resumen.ultimosDigitosInformados ?? undefined,
    interesesInformados: resumen.interesesInformados != null ? Number(resumen.interesesInformados) : undefined,
    impuestosInformados: resumen.impuestosInformados != null ? Number(resumen.impuestosInformados) : undefined,
    comisionesInformadas: resumen.comisionesInformadas != null ? Number(resumen.comisionesInformadas) : undefined,
    segurosInformados: resumen.segurosInformados != null ? Number(resumen.segurosInformados) : undefined,
    confianzaOCR: resumen.confianzaOCR != null ? Number(resumen.confianzaOCR) : undefined,
    diferenciaConciliacion: resumen.diferenciaConciliacion != null ? Number(resumen.diferenciaConciliacion) : undefined,
    estadoConciliacion: resumen.estadoConciliacion,
    consumosExtraidos: Array.isArray(resumen.consumosExtraidos) ? resumen.consumosExtraidos : undefined,
    estado: resumen.estado,
  };
}
